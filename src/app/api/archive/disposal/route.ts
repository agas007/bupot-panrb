import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
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
    const { archivedRecordId, approvedById, action, reason } =
      await request.json();

    if (action === "approve") {
      const updated = await prisma.disposalApproval.update({
        where: { archivedRecordId },
        data: {
          status: "APPROVED",
          approvedById,
          approvalDate: new Date(),
          reason,
        },
      });

      // Update archived record status
      await prisma.archivedRecord.update({
        where: { id: archivedRecordId },
        data: {
          archiveStatus: "ELIGIBLE_FOR_DISPOSAL",
          disposalScheduledAt: new Date(),
        },
      });

      return NextResponse.json(updated);
    } else if (action === "reject") {
      const updated = await prisma.disposalApproval.update({
        where: { archivedRecordId },
        data: {
          status: "REJECTED",
          reason,
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
