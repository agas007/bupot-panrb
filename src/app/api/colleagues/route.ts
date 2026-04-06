import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = 'nodejs';

/**
 * Administrative permission check
 */
async function isAdmin(req: NextRequest) {
  const username = req.headers.get("x-simulated-username");
  if (!username) return false;
  // Use findFirst with cast to bypass Prisma's lagging types
  const user = await (prisma.colleague as any).findFirst({
    where: { username }
  });
  return user && user.role === "ADMIN";
}

export async function GET() {
  try {
    const colleagues = await prisma.colleague.findMany({
      include: {
        _count: {
          select: { records: true }
        }
      }
    });
    return NextResponse.json(colleagues);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Security Check
    if (!await isAdmin(req)) {
      return NextResponse.json({ error: "Access Denied: Administratve role required" }, { status: 403 });
    }

    const { name, username, password, role } = await req.json();
    if (!name) throw new Error("Name is required");

    // Auto-generate username and password if not provided
    const finalUsername = username || name.toLowerCase().replace(/\s+/g, '.');
    const finalPassword = password || process.env.DEFAULT_USER_PASSWORD || "Placeholder123!";

    const colleague = await (prisma.colleague as any).create({
      data: { 
        name, 
        username: finalUsername,
        password: finalPassword,
        role: role || "USER" 
      }
    });

    // Audit Log
    const reqUser = req.headers.get("x-simulated-user") || "Admin (Simulated)";
    // @ts-ignore
    await prisma.auditLog.create({
      data: {
        userName: reqUser,
        action: "Added New Member",
        target: `${name} (${role || "USER"})`,
        type: "admin",
      }
    });

    return NextResponse.json(colleague);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // 1. Security Check
    if (!await isAdmin(req)) {
      return NextResponse.json({ error: "Access Denied: Administratve role required" }, { status: 403 });
    }

    const { id } = await req.json();
    const targetId = Number(id);

    // 2. Prevent Self-Deletion
    const reqUsername = req.headers.get("x-simulated-username");
    // @ts-ignore
    const reqUser = await prisma.colleague.findFirst({ where: { username: reqUsername } });
    
    if (reqUser && reqUser.id === targetId) {
      return NextResponse.json({ error: "Operation Denied: You cannot delete your own account." }, { status: 400 });
    }

    const colleague = await prisma.colleague.findUnique({ where: { id: targetId } });
    if (!colleague) throw new Error("Member not found");

    await prisma.colleague.delete({ where: { id: targetId } });

    // Audit Log
    const reqUserName = req.headers.get("x-simulated-user") || "Admin (Simulated)";
    // @ts-ignore
    await prisma.auditLog.create({
      data: {
        userName: reqUserName,
        action: "Deleted Member",
        target: colleague.name,
        type: "danger",
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
