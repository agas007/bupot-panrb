import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest) {
  try {
    const tableStatus = await prisma.$queryRaw<Array<{
      archivedRecordExists: boolean;
      disposalApprovalExists: boolean;
    }>>(Prisma.sql`
      SELECT
        to_regclass('public."ArchivedRecord"') IS NOT NULL AS "archivedRecordExists",
        to_regclass('public."DisposalApproval"') IS NOT NULL AS "disposalApprovalExists"
    `);

    if (!tableStatus[0]?.archivedRecordExists) {
      return NextResponse.json({
        stats: {
          ARCHIVED: 0,
          PENDING_APPROVAL: 0,
          REJECTED: 0,
          DISPOSED: 0,
        },
        byDataType: {
          SPM_RECORD: 0,
          PPH21_WITHHOLDING: 0,
          TAX_RECONCILIATION: 0,
        },
        disposalPending: 0,
        total: 0,
      });
    }

    const [statusRows, typeRows, disposalPendingRows] = await Promise.all([
      prisma.$queryRaw<Array<{ archiveStatus: string; count: number }>>(Prisma.sql`
        SELECT "archiveStatus", COUNT(*)::int AS count
        FROM "ArchivedRecord"
        GROUP BY "archiveStatus"
      `),
      prisma.$queryRaw<Array<{ dataType: string; count: number }>>(Prisma.sql`
        SELECT "dataType", COUNT(*)::int AS count
        FROM "ArchivedRecord"
        GROUP BY "dataType"
      `),
      prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM "DisposalApproval"
        WHERE "status" = 'PENDING'
      `),
    ]);

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

    statusRows.forEach((row) => {
      if (row.archiveStatus in formatted) {
        formatted[row.archiveStatus as keyof typeof formatted] = row.count;
      }
    });

    typeRows.forEach((row) => {
      if (row.dataType in byDataType) {
        byDataType[row.dataType as keyof typeof byDataType] = row.count;
      }
    });

    return NextResponse.json({
      stats: formatted,
      byDataType,
      disposalPending: disposalPendingRows[0]?.count ?? 0,
      total: Object.values(formatted).reduce((a, b) => a + b, 0),
    });
  } catch (error) {
    console.error("Archive stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
