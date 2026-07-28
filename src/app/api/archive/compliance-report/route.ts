import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { canAccessArchive } from "@/lib/roles";
import { getRequestSessionUser } from "@/lib/session-cookie";

export async function GET(_request: NextRequest) {
  try {
    const user = getRequestSessionUser(_request);
    if (!user || !canAccessArchive(user.role)) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const tableStatus = await prisma.$queryRaw<Array<{
      archivedRecordExists: boolean;
      accessLogExists: boolean;
      disposalApprovalExists: boolean;
    }>>(Prisma.sql`
      SELECT
        to_regclass('public."ArchivedRecord"') IS NOT NULL AS "archivedRecordExists",
        to_regclass('public."ArchiveAccessLog"') IS NOT NULL AS "accessLogExists",
        to_regclass('public."DisposalApproval"') IS NOT NULL AS "disposalApprovalExists"
    `);

    if (!tableStatus[0]?.archivedRecordExists) {
      return NextResponse.json({
        period: new Date().toLocaleDateString("id-ID", {
          month: "long",
          year: "numeric",
        }),
        status: "READY",
        reportType: "ARCHIVE_SUMMARY",
        retentionTimeline: {
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
        accessAudit: [],
        disposalQueue: {
          pending: 0,
          approved: 0,
        },
        summary: {
          totalArchivedRecords: 0,
          totalAccessLogs: 0,
        },
      });
    }

    const [statusRows, typeRows, accessLogsRows, disposalPendingRows, disposalApprovedRows, archivedCountRows] = await Promise.all([
      prisma.$queryRaw<Array<{ archiveStatus: string; count: number }>>(Prisma.sql`
        SELECT ar."archiveStatus", COUNT(*)::int AS count
        FROM "ArchivedRecord" ar
        GROUP BY ar."archiveStatus"
      `),
      prisma.$queryRaw<Array<{ dataType: string; count: number }>>(Prisma.sql`
        SELECT ar."dataType", COUNT(*)::int AS count
        FROM "ArchivedRecord" ar
        GROUP BY ar."dataType"
      `),
      prisma.$queryRaw<Array<{
        id: number;
        accessType: string;
        createdAt: string;
        archivedRecordSpmNumber: string | null;
        archivedRecordDataType: string;
        archivedRecordArchiveStatus: string;
        accessedById: number;
        accessedByName: string;
      }>>(Prisma.sql`
        SELECT
          aal."id",
          aal."accessType",
          aal."createdAt",
          ar."spmNumber" AS "archivedRecordSpmNumber",
          ar."dataType" AS "archivedRecordDataType",
          ar."archiveStatus" AS "archivedRecordArchiveStatus",
          c."id" AS "accessedById",
          c."name" AS "accessedByName"
        FROM "ArchiveAccessLog" aal
        LEFT JOIN "ArchivedRecord" ar ON ar."id" = aal."archivedRecordId"
        LEFT JOIN "Colleague" c ON c."id" = aal."accessedById"
        ORDER BY aal."createdAt" DESC
        LIMIT 5
      `),
      prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM "DisposalApproval"
        WHERE "status" = 'PENDING'
      `),
      prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM "DisposalApproval"
        WHERE "status" = 'APPROVED'
      `),
      prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM "ArchivedRecord"
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
      period: new Date().toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      }),
      status: "READY",
      reportType: "ARCHIVE_SUMMARY",
      retentionTimeline: formatted,
      byDataType,
      accessAudit: accessLogsRows.map((row) => ({
        id: row.id,
        accessType: row.accessType,
        archivedRecord: {
          spmNumber: row.archivedRecordSpmNumber,
          dataType: row.archivedRecordDataType,
          archiveStatus: row.archivedRecordArchiveStatus,
        },
        accessedBy: {
          id: row.accessedById,
          name: row.accessedByName,
        },
        createdAt: row.createdAt,
      })),
      disposalQueue: {
        pending: disposalPendingRows[0]?.count ?? 0,
        approved: disposalApprovedRows[0]?.count ?? 0,
      },
      summary: {
        totalArchivedRecords: archivedCountRows[0]?.count ?? 0,
        totalAccessLogs: accessLogsRows.length,
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
