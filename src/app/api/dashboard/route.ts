import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  try {
    // Build filter
    const dateFilter: any = {};
    if (year) {
      const startOfYear = new Date(Number(year), 0, 1);
      const endOfYear = new Date(Number(year), 11, 31, 23, 59, 59);
      dateFilter.spmDate = { gte: startOfYear, lte: endOfYear };
      
      if (month && month !== "all") {
        const startOfMonth = new Date(Number(year), Number(month) - 1, 1);
        const endOfMonth = new Date(Number(year), Number(month), 0, 23, 59, 59);
        dateFilter.spmDate = { gte: startOfMonth, lte: endOfMonth };
      }
    }

    const [totalRecords, completedRecords, unassignedRecords, colleagues] = await Promise.all([
      prisma.sPMRecord.count({ where: dateFilter }),
      prisma.sPMRecord.count({ where: { ...dateFilter, status: "COMPLETED" } }),
      prisma.sPMRecord.count({ where: { ...dateFilter, assigneeId: null } }),
      prisma.colleague.findMany({
        include: {
          _count: {
            select: { 
              records: { 
                where: { ...dateFilter, status: "COMPLETED" } 
              } 
            }
          },
          records: {
            where: dateFilter,
            select: { id: true }
          }
        }
      })
    ]);

    // Format colleague stats
    const colleagueStats = colleagues.map((col: any) => ({
      name: col.name,
      total: col.records.length,
      completed: col._count.records,
      percentage: col.records.length > 0 
        ? Math.round((col._count.records / col.records.length) * 100) 
        : 0
    }));

    // Format monthly compliance (All records for the trend line, even beyond filter)
    const allRecords = await prisma.sPMRecord.findMany({
      where: year ? { spmDate: { gte: new Date(Number(year), 0, 1), lte: new Date(Number(year), 11, 31) } } : {},
      select: { spmDate: true, status: true }
    });

    const monthlyStatsMap: Record<string, { total: number; completed: number }> = {};
    allRecords.forEach((rec: any) => {
      const date = new Date(rec.spmDate);
      const monthIdx = date.getMonth() + 1; // 1-12
      const yearVal = date.getFullYear();
      const key = `${yearVal}-${monthIdx}`;
      
      if (!monthlyStatsMap[key]) monthlyStatsMap[key] = { total: 0, completed: 0 };
      monthlyStatsMap[key].total++;
      if (rec.status === "COMPLETED") monthlyStatsMap[key].completed++;
    });

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    const sortedMonthlyStats = Object.entries(monthlyStatsMap)
      .map(([key, data]) => {
        const [y, m] = key.split("-").map(Number);
        return {
          key,
          year: y,
          month: m,
          label: `${monthNames[m-1]} ${y}`,
          ...data,
          percentage: Math.round((data.completed / data.total) * 100)
        };
      })
      .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));

    return NextResponse.json({
      total: totalRecords,
      completed: completedRecords,
      unassigned: unassignedRecords,
      colleagueStats,
      monthlyStats: sortedMonthlyStats
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
