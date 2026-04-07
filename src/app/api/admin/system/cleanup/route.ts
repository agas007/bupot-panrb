import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = 'nodejs';

/**
 * Handle POST: Bulk cleanup of old audit logs
 */
export async function POST(req: NextRequest) {
  try {
    const username = req.headers.get("x-simulated-username");
    const adminUser = username ? await (prisma.colleague as any).findFirst({ where: { username } }) : null;

    if (!adminUser || adminUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized access: Administrative level required" }, { status: 403 });
    }

    const { days } = await req.json();
    if (!days || isNaN(days)) {
      return NextResponse.json({ error: "A valid retention period (days) is required" }, { status: 400 });
    }

    const cutOffDate = new Date();
    cutOffDate.setDate(cutOffDate.getDate() - Number(days));

    const result = await (prisma.auditLog as any).deleteMany({
      where: {
        createdAt: {
          lt: cutOffDate
        }
      }
    });

    // Record the cleanup action itself
    await (prisma.auditLog as any).create({
      data: {
        userName: adminUser.name,
        action: "Executed Log Cleanup",
        target: `Logs older than ${days} days`,
        category: "ADMIN",
        type: "danger"
      }
    });

    return NextResponse.json({ 
      success: true, 
      count: result.count,
      message: `Successfully purged ${result.count} audit logs older than ${days} days.`
    });

  } catch (error: any) {
    console.error("[Cleanup API Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
