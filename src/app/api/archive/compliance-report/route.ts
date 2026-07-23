import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest) {
  try {
    const archivedRecords = await prisma.archivedRecord.findMany({
      select: {
        id: true,
        dataType: true,
        archiveStatus: true,
        archivedBy: {
          select: { id: true, name: true },
        },
        createdAt: true,
      },
    });

    const formatted = {
      ARCHIVED: 0,
      PENDING_APPROVAL: 0,
      REJECTED: 0,
      DISPOSED: 0,
    };

    const byDataType = {
      SPM_RECORD: 0,
      PPH21_WITHHOLDING: 0,
      TAX_RECONCILIATION: 0,
    };

    archivedRecords.forEach((record) => {
      if (record.archiveStatus in formatted) {
        formatted[record.archiveStatus as keyof typeof formatted] += 1;
      }
      if (record.dataType in byDataType) {
        byDataType[record.dataType as keyof typeof byDataType] += 1;
      }
    });

    const accessLogs = await prisma.archiveAccessLog.findMany({
      select: {
        id: true,
        accessedBy: { select: { id: true, name: true } },
        accessType: true,
        archivedRecord: {
          select: { spmNumber: true, dataType: true, archiveStatus: true },
        },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const disposalPending = await prisma.disposalApproval.count({
      where: { status: "PENDING" },
    });

    const disposalApproved = await prisma.disposalApproval.count({
      where: { status: "APPROVED" },
    });

    return NextResponse.json({
      period: new Date().toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      }),
      status: "READY",
      reportType: "ARCHIVE_SUMMARY",
      retentionTimeline: formatted,
      byDataType,
      accessAudit: accessLogs,
      disposalQueue: {
        pending: disposalPending,
        approved: disposalApproved,
      },
      summary: {
        totalArchivedRecords: archivedRecords.length,
        totalAccessLogs: accessLogs.length,
      },
    });
  } catch (error) {
    console.error("Archive summary error:", error);
    return NextResponse.json(
      { error: "Failed to generate archive summary" },
      { status: 500 }
    );
  }
}
