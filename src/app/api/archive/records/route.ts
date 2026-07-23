import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dataType = searchParams.get("dataType");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const skip = (page - 1) * limit;

    const whereSql =
      status && dataType
        ? Prisma.sql`WHERE ar."archiveStatus" = ${status} AND ar."dataType" = ${dataType}`
        : status
          ? Prisma.sql`WHERE ar."archiveStatus" = ${status}`
          : dataType
            ? Prisma.sql`WHERE ar."dataType" = ${dataType}`
            : Prisma.empty;

    const [records, totalRows, dataTypeRows, statusRows] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          id: number;
          originalId: number;
          dataType: string;
          archiveStatus: string;
          spmNumber: string | null;
          archivedData: unknown;
          archivedById: number | null;
          archivedByName: string | null;
          archivedByUsername: string | null;
          disposalScheduledAt: string | null;
          disposalScheduledDate: string | null;
          createdAt: string;
          updatedAt: string;
        }>
      >(Prisma.sql`
        SELECT
          ar."id",
          ar."originalId",
          ar."dataType",
          ar."archiveStatus",
          ar."spmNumber",
          ar."archivedData",
          ar."archivedById",
          c."name" AS "archivedByName",
          c."username" AS "archivedByUsername",
          ar."disposalScheduledAt",
          ar."disposalScheduledDate",
          ar."createdAt",
          ar."updatedAt"
        FROM "ArchivedRecord" ar
        LEFT JOIN "Colleague" c ON c."id" = ar."archivedById"
        ${whereSql}
        ORDER BY ar."createdAt" DESC
        LIMIT ${limit}
        OFFSET ${skip}
      `),
      prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM "ArchivedRecord" ar
        ${whereSql}
      `),
      prisma.$queryRaw<Array<{ dataType: string; count: number }>>(Prisma.sql`
        SELECT ar."dataType", COUNT(*)::int AS count
        FROM "ArchivedRecord" ar
        ${whereSql}
        GROUP BY ar."dataType"
      `),
      prisma.$queryRaw<Array<{ archiveStatus: string; count: number }>>(Prisma.sql`
        SELECT ar."archiveStatus", COUNT(*)::int AS count
        FROM "ArchivedRecord" ar
        ${whereSql}
        GROUP BY ar."archiveStatus"
      `),
    ]);

    return NextResponse.json({
      data: records.map((record) => ({
        id: record.id,
        originalId: record.originalId,
        dataType: record.dataType,
        archiveStatus: record.archiveStatus,
        spmNumber: record.spmNumber,
        archivedData: record.archivedData,
        archivedBy: record.archivedByName
          ? {
              id: record.archivedById ?? 0,
              name: record.archivedByName,
              username: record.archivedByUsername ?? "",
            }
          : null,
        disposalScheduledAt: record.disposalScheduledAt,
        disposalScheduledDate: record.disposalScheduledDate,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      })),
      summary: {
        total: totalRows[0]?.count ?? 0,
        byDataType: dataTypeRows.reduce<Record<string, number>>((acc, row) => {
          acc[row.dataType] = row.count;
          return acc;
        }, {}),
        byStatus: statusRows.reduce<Record<string, number>>((acc, row) => {
          acc[row.archiveStatus] = row.count;
          return acc;
        }, {}),
      },
      pagination: {
        total: totalRows[0]?.count ?? 0,
        page,
        limit,
        pages: Math.ceil((totalRows[0]?.count ?? 0) / limit),
      },
    });
  } catch (error) {
    console.error("Archive records error:", error);
    return NextResponse.json(
      { error: "Failed to fetch records" },
      { status: 500 }
    );
  }
}
