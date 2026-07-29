import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestSessionUser, SESSION_COOKIE_NAME } from "@/lib/session-cookie";

export async function POST(req: NextRequest) {
  try {
    const sessionUser = getRequestSessionUser(req);
    const { username } = await req.json();
    const actorUsername = sessionUser?.username || username || "Guest/Unknown";
    const actorName = sessionUser?.name || actorUsername;

    // Audit Log for logout
    await prisma.auditLog.create({
      data: {
        userName: actorName,
        username: actorUsername,
        action: "Logged Out",
        target: "Dashboard",
        type: "user",
      }
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: "",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
