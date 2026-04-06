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
      },
      orderBy: { name: 'asc' }
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
      return NextResponse.json({ error: "Access Denied: Administrative role required" }, { status: 403 });
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

export async function PATCH(req: NextRequest) {
  try {
    const { id, name, username, password, role } = await req.json();
    const targetId = Number(id);
    const reqUsername = req.headers.get("x-simulated-username");

    // 1. Get Requester Info
    const requester = await (prisma.colleague as any).findFirst({
      where: { username: reqUsername }
    });

    if (!requester) {
      return NextResponse.json({ error: "Invalid Session" }, { status: 401 });
    }

    const isTargetAdmin = requester.role === "ADMIN";
    const isSelf = requester.id === targetId;

    // 2. Authorization
    if (!isTargetAdmin && !isSelf) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    // 3. Prepare Update Data
    const updateData: any = {};
    if (name) updateData.name = name;
    if (username && isTargetAdmin) updateData.username = username; // Only admin can change username
    if (password) updateData.password = password;
    if (role && isTargetAdmin) updateData.role = role; // Only admin can change role

    const colleague = await prisma.colleague.update({
      where: { id: targetId },
      data: updateData,
    });

    // Audit Log
    const reqUserName = req.headers.get("x-simulated-user") || requester.name;
    // @ts-ignore
    await prisma.auditLog.create({
      data: {
        userName: reqUserName,
        action: isSelf ? "Updated Own Profile" : "Updated Member Info",
        target: isSelf ? "Self" : colleague.name,
        type: isTargetAdmin ? "admin" : "user",
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
      return NextResponse.json({ error: "Access Denied: Administrative role required" }, { status: 403 });
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
