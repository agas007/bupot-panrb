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

    const where: any = {
      archiveStatus: status ? status : undefined,
      dataType: dataType ? dataType : undefined,
    };

    // Remove undefined keys
    Object.keys(where).forEach((key) =>
      where[key] === undefined && delete where[key]
    );

    const [records, total] = await Promise.all([
      prisma.archivedRecord.findMany({
        where,
        select: {
          id: true,
          originalId: true,
          dataType: true,
          archiveStatus: true,
          spmNumber: true,
          archivedData: true,
          archivedBy: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
          disposalScheduledAt: true,
          disposalScheduledDate: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.archivedRecord.count({ where }),
    ]);

    const byDataType = records.reduce<Record<string, number>>((acc, record) => {
      acc[record.dataType] = (acc[record.dataType] || 0) + 1;
      return acc;
    }, {});

    const byStatus = records.reduce<Record<string, number>>((acc, record) => {
      acc[record.archiveStatus] = (acc[record.archiveStatus] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      data: records,
      summary: {
        total,
        byDataType,
        byStatus,
      },
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
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
