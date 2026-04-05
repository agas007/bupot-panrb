import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * @swagger
 * /api/logs:
 *   get:
 *     summary: Fetch activity logs
 *     description: Retrieve the last 200 activity log entries from the database.
 *     tags: [Logs]
 *     responses:
 *       200:
 *         description: Success
 */
export async function GET() {
  try {
    // @ts-ignore
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json(logs);
  } catch (error) {
    console.error("Fetch logs error:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
