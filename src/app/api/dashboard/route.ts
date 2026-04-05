import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [totalRecords, completedRecords, unassignedRecords, colleagues] = await Promise.all([
      prisma.sPMRecord.count(),
      prisma.sPMRecord.count({ where: { status: "COMPLETED" } }),
      prisma.sPMRecord.count({ where: { assigneeId: null } }),
      prisma.colleague.findMany({
        include: {
          _count: {
            select: { 
              records: { 
                where: { status: "COMPLETED" } 
              } 
            }
          },
          records: {
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

    // Format monthly compliance (Dummy logic for now, using sp2dDate)
    const records = await prisma.sPMRecord.findMany({
      where: { sp2dDate: { not: null } },
      select: { sp2dDate: true, status: true }
    });

    const monthlyStats: Record<string, { total: number; completed: number }> = {};
    records.forEach((rec: any) => {
      const date = new Date(rec.sp2dDate!);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      if (!monthlyStats[monthKey]) monthlyStats[monthKey] = { total: 0, completed: 0 };
      monthlyStats[monthKey].total++;
      if (rec.status === "COMPLETED") monthlyStats[monthKey].completed++;
    });

    return NextResponse.json({
      total: totalRecords,
      completed: completedRecords,
      unassigned: unassignedRecords,
      colleagueStats,
      monthlyStats: Object.entries(monthlyStats).map(([month, data]) => ({
        month,
        ...data,
        percentage: Math.round((data.completed / data.total) * 100)
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
