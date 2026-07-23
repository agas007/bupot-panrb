import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const stats = await prisma.sPMRecord.groupBy({
      by: ["archiveStatus"],
      _count: true,
    });

    const formatted = {
      ACTIVE: 0,
      INACTIVE: 0,
      ARCHIVED: 0,
      DISPOSED: 0,
    };

    stats.forEach((stat) => {
      formatted[stat.archiveStatus as keyof typeof formatted] = stat._count;
    });

    const disposalPending = await prisma.disposalApproval.count({
      where: { status: "PENDING" },
    });

    return NextResponse.json({
      stats: formatted,
      disposalPending,
      total: Object.values(formatted).reduce((a, b) => a + b, 0),
    });
  } catch (error) {
    console.error("Archive stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
