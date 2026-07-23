import { prisma } from "@/lib/prisma";
import { getRequestSessionUser } from "@/lib/session-cookie";
import { NextRequest, NextResponse } from "next/server";

const assertAdmin = async (request: NextRequest) => {
  const sessionUser = getRequestSessionUser(request);
  if (!sessionUser) return null;

  const adminUser = await prisma.colleague.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, role: true, name: true, username: true },
  });

  if (!adminUser || adminUser.role !== "ADMIN") {
    return null;
  }

  return adminUser;
};

export async function GET(request: NextRequest) {
  try {
    const adminUser = await assertAdmin(request);
    if (!adminUser) {
      return NextResponse.json(
        { error: "Unauthorized access: Administrative level required" },
        { status: 403 }
      );
    }

    const status = request.nextUrl.searchParams.get("status") || "PENDING";
    const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20");

    const skip = (page - 1) * limit;

    const [approvals, total] = await Promise.all([
      prisma.disposalApproval.findMany({
        where: { status: status || undefined },
        select: {
          id: true,
          archivedRecordId: true,
          archivedRecord: {
            select: {
              id: true,
              dataType: true,
              spmNumber: true,
              archivedData: true,
              createdAt: true,
            },
          },
          requestedBy: {
            select: { id: true, name: true },
          },
          approvedBy: {
            select: { id: true, name: true },
          },
          status: true,
          disposalMethod: true,
          approvalDate: true,
          reason: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.disposalApproval.count({ where: { status: status || undefined } }),
    ]);

    return NextResponse.json({
      data: approvals,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Disposal requests error:", error);
    return NextResponse.json(
      { error: "Failed to fetch disposal requests" },
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

    const { archivedRecordId, action, reason } =
      await request.json();
    const archivedRecordIdNumber = Number(archivedRecordId);

    if (!Number.isFinite(archivedRecordIdNumber)) {
      return NextResponse.json(
        { error: "Invalid archivedRecordId" },
        { status: 400 }
      );
    }

    if (action === "approve") {
      const updated = await prisma.disposalApproval.update({
        where: { archivedRecordId: archivedRecordIdNumber },
        data: {
          status: "APPROVED",
          approvedById: adminUser.id,
          approvalDate: new Date(),
          reason,
        },
      });

      return NextResponse.json(updated);
    } else if (action === "reject") {
      const updated = await prisma.disposalApproval.update({
        where: { archivedRecordId: archivedRecordIdNumber },
        data: {
          status: "REJECTED",
          reason,
          approvedById: null,
          approvalDate: null,
        },
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Disposal approval error:", error);
    return NextResponse.json(
      { error: "Failed to process disposal approval" },
      { status: 500 }
    );
  }
}
