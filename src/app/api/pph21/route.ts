import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManagePph21, getPph21User } from "@/lib/pph21-auth";
import { normalizePph21Lines, PPH21_ACCOUNT_CODE } from "@/lib/pph21";

export const runtime = "nodejs";

const batchInclude = {
  withholdings: { include: { recipient: true }, orderBy: { id: "asc" as const } },
  exportItems: { orderBy: { id: "desc" as const }, take: 1, include: { export: true } },
};

type Pph21Record = Prisma.SPMRecordGetPayload<{ include: { assignee: { select: { id: true; name: true } }; pph21Batch: { include: { withholdings: { include: { recipient: true } }; exportItems: { include: { export: true } } } } } }>;

export async function GET(req: NextRequest) {
  const user = await getPph21User(req);
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 403 });
  const recordId = Number(req.nextUrl.searchParams.get("recordId"));

  if (recordId) {
    const record = await prisma.sPMRecord.findUnique({
      where: { id: recordId },
      include: { pph21Batch: { include: batchInclude } },
    });
    if (!record || record.accountCode !== PPH21_ACCOUNT_CODE) return NextResponse.json({ error: "Record PPh 21 tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ ...record, canManage: canManagePph21(user, record) });
  }

  const records = await prisma.sPMRecord.findMany({
    where: { accountCode: PPH21_ACCOUNT_CODE },
    include: { assignee: { select: { id: true, name: true } }, pph21Batch: { include: batchInclude } },
    orderBy: [{ sp2dDate: "desc" }, { spmNumber: "asc" }],
  }) as Pph21Record[];
  return NextResponse.json(records.map((record) => ({ ...record, canManage: canManagePph21(user, record) })));
}

export async function POST(req: NextRequest) {
  try {
    const user = await getPph21User(req);
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 403 });
    const body = await req.json();
    const recordId = Number(body.recordId);
    const record = await prisma.sPMRecord.findUnique({ where: { id: recordId } });
    if (!record || record.accountCode !== PPH21_ACCOUNT_CODE) return NextResponse.json({ error: "Record PPh 21 tidak ditemukan" }, { status: 404 });
    if (!canManagePph21(user, record)) return NextResponse.json({ error: "Anda bukan admin atau assignee record ini" }, { status: 403 });

    const withholdingDate = new Date(String(body.withholdingDate || ""));
    if (Number.isNaN(withholdingDate.getTime())) return NextResponse.json({ error: "WithholdingDate wajib valid" }, { status: 400 });
    const lines = normalizePph21Lines(body.lines);
    const totalTax = lines.reduce((sum, line) => sum + line.calculatedTax, 0);

    const batch = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const savedBatch = await tx.pph21Batch.upsert({
        where: { recordId },
        create: { recordId, withholdingDate, status: "DATA_ENTERED" },
        update: { withholdingDate, status: "DATA_ENTERED", issueNotes: null },
      });
      await tx.pph21Withholding.deleteMany({ where: { batchId: savedBatch.id } });
      for (const line of lines) {
        const recipient = await tx.pph21Recipient.upsert({
          where: { nik: line.nik },
          create: { nik: line.nik, name: line.name, defaultTaxObjectCode: line.taxObjectCode },
          update: {},
        });
        await tx.pph21Withholding.create({
          data: { batchId: savedBatch.id, recipientId: recipient.id, recipientName: line.name, taxObjectCode: line.taxObjectCode, gross: line.gross, deemed: line.deemed, rate: line.rate, calculatedTax: line.calculatedTax },
        });
      }
      await tx.auditLog.create({ data: { userName: user.name, action: "Saved PPh 21 Details", target: record.sp2dNumber || record.spmNumber, category: "DATA", type: "success" } });
      return tx.pph21Batch.findUnique({ where: { id: savedBatch.id }, include: batchInclude });
    });
    return NextResponse.json({ batch, totalTax, expectedTax: record.deductionAmount, isBalanced: totalTax === record.deductionAmount });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menyimpan rincian PPh 21" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getPph21User(req);
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 403 });
    const body = await req.json();
    const record = await prisma.sPMRecord.findUnique({ where: { id: Number(body.recordId) }, include: { pph21Batch: true } });
    if (!record?.pph21Batch) return NextResponse.json({ error: "Rincian PPh 21 belum tersedia" }, { status: 404 });
    if (!canManagePph21(user, record)) return NextResponse.json({ error: "Access denied" }, { status: 403 });
    if (body.status !== "ISSUES" && body.status !== "DATA_ENTERED") return NextResponse.json({ error: "Status tidak didukung" }, { status: 400 });
    const issueNotes = String(body.issueNotes || "").trim();
    if (body.status === "ISSUES" && !issueNotes) return NextResponse.json({ error: "Catatan issue wajib diisi" }, { status: 400 });
    const batch = await prisma.pph21Batch.update({ where: { id: record.pph21Batch.id }, data: { status: body.status, issueNotes: body.status === "ISSUES" ? issueNotes : null } });
    await prisma.auditLog.create({ data: { userName: user.name, action: `Set PPh 21 Status ${body.status}`, target: record.sp2dNumber || record.spmNumber, category: "DATA", type: body.status === "ISSUES" ? "warning" : "success" } });
    return NextResponse.json(batch);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal mengubah status" }, { status: 400 });
  }
}
