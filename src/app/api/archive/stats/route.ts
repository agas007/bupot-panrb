import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest) {
  try {
    const archivedRecords = await prisma.archivedRecord.findMany({
      select: {
        id: true,
        dataType: true,
        archiveStatus: true,
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

    const disposalPending = await prisma.disposalApproval.count({
      where: { status: "PENDING" },
    });

    return NextResponse.json({
      stats: formatted,
      byDataType,
      disposalPending,
      total: archivedRecords.length,
    });
  } catch (error) {
    console.error("Archive stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
