import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    // Use findFirst + cast to bypass Prisma's lagging ColleagueWhereUniqueInput
    const user = await (prisma.colleague as any).findFirst({
      where: { username }
    });

    if (!user || user.password !== password) {
      // Audit Log for failed attempt
      // @ts-ignore
      await prisma.auditLog.create({
        data: {
          userName: username || "Unknown",
          action: "Failed Login Attempt",
          target: "System Portal",
          type: "danger",
        }
      });
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    // Audit Log for successful login
    // @ts-ignore
    await prisma.auditLog.create({
      data: {
        userName: user.username,
        action: "Logged In",
        target: "Dashboard",
        type: "user",
      }
    });

    // Return user without password
    const { password: _, ...safeUser } = user;
    return NextResponse.json(safeUser);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
