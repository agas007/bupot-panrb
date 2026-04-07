import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = 'nodejs';

/**
 * Handle GET: Retrieve notifications for the current user
 */
export async function GET(req: NextRequest) {
  try {
    const username = req.headers.get("x-simulated-username");
    if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await (prisma.colleague as any).findFirst({
      where: { username }
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const notifications = await (prisma as any).notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return NextResponse.json(notifications);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Handle PATCH: Mark notifications as read
 */
export async function PATCH(req: NextRequest) {
  try {
    const username = req.headers.get("x-simulated-username");
    if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, all } = await req.json();
    
    const user = await (prisma.colleague as any).findFirst({
      where: { username }
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (all) {
      await (prisma as any).notification.updateMany({
        where: { userId: user.id },
        data: { isRead: true }
      });
    } else if (id) {
      await (prisma as any).notification.update({
        where: { id: Number(id), userId: user.id },
        data: { isRead: true }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
