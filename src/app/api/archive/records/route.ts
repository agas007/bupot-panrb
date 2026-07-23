import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dataType = searchParams.get("dataType") || "SPM_RECORD";
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const skip = (page - 1) * limit;

    const where: any = {
      archiveStatus: status ? status : undefined,
    };

    // Remove undefined keys
    Object.keys(where).forEach((key) =>
      where[key] === undefined && delete where[key]
    );

    const [records, total] = await Promise.all([
      prisma.sPMRecord.findMany({
        where,
        select: {
          id: true,
          spmNumber: true,
          spmDate: true,
          accountCode: true,
          deductionAmount: true,
          sp2dNumber: true,
          recipient: true,
          status: true,
          archiveStatus: true,
          importDate: true,
          updatedAt: true,
          archivedRecord: {
            select: {
              id: true,
              archiveStatus: true,
              createdAt: true,
            },
          },
        },
        orderBy: { spmDate: "desc" },
        skip,
        take: limit,
      }),
      prisma.sPMRecord.count({ where }),
    ]);

    return NextResponse.json({
      data: records,
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
