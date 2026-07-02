import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestSessionUser } from "@/lib/session-cookie";

export const runtime = 'nodejs';

/**
 * Handle GET: Retrieve notifications for the current user
 */
export async function GET(req: NextRequest) {
  try {
    const username = getRequestSessionUser(req)?.username ?? req.headers.get("x-simulated-username");
    if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.colleague.findFirst({
      where: { username }
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return NextResponse.json(notifications);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memuat notifikasi" }, { status: 500 });
  }
}

/**
 * Handle PATCH: Mark notifications as read
 */
export async function PATCH(req: NextRequest) {
  try {
    const username = getRequestSessionUser(req)?.username ?? req.headers.get("x-simulated-username");
    if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, all } = await req.json();
    
    const user = await prisma.colleague.findFirst({
      where: { username }
    });

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (all) {
      await prisma.notification.updateMany({
        where: { userId: user.id },
        data: { isRead: true }
      });
    } else if (id) {
      await prisma.notification.updateMany({
        where: { id: Number(id), userId: user.id },
        data: { isRead: true }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memperbarui notifikasi" }, { status: 500 });
  }
}
