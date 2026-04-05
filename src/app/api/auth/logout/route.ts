import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();

    // Audit Log for logout
    // @ts-ignore
    await prisma.auditLog.create({
      data: {
        userName: username || "Guest/Unknown",
        action: "Logged Out",
        target: "Dashboard",
        type: "user",
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
