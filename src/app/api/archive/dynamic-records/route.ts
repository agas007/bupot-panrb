import { prisma } from "@/lib/prisma";
import { calculateArchiveStatus, getRetentionProgress } from "@/lib/archive";
import { NextRequest, NextResponse } from "next/server";
import { canAccessArchive } from "@/lib/roles";
import { getRequestSessionUser } from "@/lib/session-cookie";

export async function GET(request: NextRequest) {
  try {
    const user = getRequestSessionUser(request);
    if (!user || !canAccessArchive(user.role)) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const records = await prisma.sPMRecord.findMany({
      select: {
        id: true,
        uniqueKey: true,
        spmNumber: true,
        spmDate: true,
        accountCode: true,
        deductionAmount: true,
        sp2dNumber: true,
        recipient: true,
        description: true,
        status: true,
        importDate: true,
        updatedAt: true,
      },
      orderBy: { importDate: "desc" },
    });

    const shaped = records
      .map((record) => {
        const archiveStatus = calculateArchiveStatus(record.importDate, "SPM_RECORD");
        return {
          ...record,
          archiveStatus,
          retentionProgress: getRetentionProgress(record.importDate, "SPM_RECORD"),
        };
      })
      .filter((record) => (status ? record.archiveStatus === status : true));

    const total = shaped.length;
    const paged = shaped.slice(skip, skip + limit);

    const summary = shaped.reduce<Record<string, number>>((acc, record) => {
      acc[record.archiveStatus] = (acc[record.archiveStatus] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      data: paged,
      summary,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Dynamic archive records error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dynamic archive records" },
      { status: 500 }
    );
  }
}
