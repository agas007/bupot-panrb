import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestSessionUser } from "@/lib/session-cookie";
import { canAccessArchive } from "@/lib/roles";

export const runtime = "nodejs";

const assertAdmin = async (request: NextRequest) => {
  const sessionUser = getRequestSessionUser(request);
  if (!sessionUser) return null;

  const adminUser = await prisma.colleague.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, role: true, name: true, username: true },
  });

  if (!adminUser || !canAccessArchive(adminUser.role)) {
    return null;
  }

  return adminUser;
};

const ensureArchiveDossierTables = async () => {
  const tableStatus = await prisma.$queryRaw<Array<{
    archiveDossierExists: boolean;
    archiveDossierAttachmentExists: boolean;
  }>>(Prisma.sql`
    SELECT
      to_regclass('public."ArchiveDossier"') IS NOT NULL AS "archiveDossierExists",
      to_regclass('public."ArchiveDossierAttachment"') IS NOT NULL AS "archiveDossierAttachmentExists"
  `);

  return Boolean(tableStatus[0]?.archiveDossierExists && tableStatus[0]?.archiveDossierAttachmentExists);
};

const toBuffer = async (file: File) => Buffer.from(await file.arrayBuffer());

const selectDossier = {
  id: true,
  dossierIndex: true,
  title: true,
  period: true,
  notes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      username: true,
    },
  },
  attachments: {
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      size: true,
      createdAt: true,
      uploadedBy: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  },
} as const;

export async function GET(request: NextRequest) {
  try {
    const adminUser = await assertAdmin(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: "Unauthorized access: Administrative level required" },
        { status: 403 }
      );
    }

    const page = Number(request.nextUrl.searchParams.get("page") || "1");
    const limit = Number(request.nextUrl.searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    if (!(await ensureArchiveDossierTables())) {
      return NextResponse.json({
        data: [],
        pagination: {
          total: 0,
          page,
          limit,
          pages: 0,
        },
      });
    }

    const [data, total] = await Promise.all([
      prisma.archiveDossier.findMany({
        select: selectDossier,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.archiveDossier.count(),
    ]);

    return NextResponse.json({
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Archive dossier list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch archive dossiers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminUser = await assertAdmin(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: "Unauthorized access: Administrative level required" },
        { status: 403 }
      );
    }

    if (!(await ensureArchiveDossierTables())) {
      return NextResponse.json(
        { error: "Archive storage tables are not available yet" },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const dossierIdValue = String(formData.get("dossierId") || "").trim();
    const dossierIndex = String(formData.get("dossierIndex") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const period = String(formData.get("period") || "").trim();
    const notes = String(formData.get("notes") || "").trim();
    const rawFiles = formData.getAll("files");
    const files = rawFiles.filter((item): item is File => item instanceof File);
    const dossierId = Number(dossierIdValue);
    const isAppendMode = Number.isFinite(dossierId) && dossierId > 0;

    if (files.length === 0) {
      return NextResponse.json({ error: "Minimal satu lampiran wajib diupload" }, { status: 400 });
    }

    if (files.length > 20) {
      return NextResponse.json({ error: "Maksimal 20 lampiran per dosier" }, { status: 400 });
    }

    const attachments = await Promise.all(
      files.map(async (file) => ({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        fileData: await toBuffer(file),
        uploadedById: adminUser.id,
      }))
    );

    let dossier;

    if (isAppendMode) {
      const existing = await prisma.archiveDossier.findUnique({
        where: { id: dossierId },
        select: { id: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "Dosier tidak ditemukan" }, { status: 404 });
      }

      dossier = await prisma.archiveDossier.update({
        where: { id: dossierId },
        data: {
          title: title || undefined,
          period: period || undefined,
          notes: notes || undefined,
          attachments: {
            create: attachments,
          },
        },
        select: selectDossier,
      });
    } else {
      if (!dossierIndex) {
        return NextResponse.json({ error: "Indeks dosier wajib diisi" }, { status: 400 });
      }

      if (!title) {
        return NextResponse.json({ error: "Judul dosier wajib diisi" }, { status: 400 });
      }

      dossier = await prisma.archiveDossier.create({
        data: {
          dossierIndex,
          title,
          period: period || null,
          notes: notes || null,
          status: "STORED",
          createdById: adminUser.id,
          attachments: {
            create: attachments,
          },
        },
        select: selectDossier,
      });
    }

    return NextResponse.json(dossier, { status: 201 });
  } catch (error) {
    console.error("Archive dossier create error:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Indeks dosier sudah dipakai" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to store archive dossier" },
      { status: 500 }
    );
  }
}
