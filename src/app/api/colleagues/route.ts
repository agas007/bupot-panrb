import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getRequestSessionUser } from "@/lib/session-cookie";
import { getPrimaryRole, isAdminRole, normalizeUserRoles, serializeUserRoles } from "@/lib/roles";

export const runtime = 'nodejs';

/**
 * Administrative permission check
 */
async function isAdmin(req: NextRequest) {
  const sessionUser = getRequestSessionUser(req);
  const username = sessionUser?.username ?? req.headers.get("x-simulated-username");
  if (!username) return false;
  const user = await prisma.colleague.findFirst({
    where: { username }
  });
  return isAdminRole(user?.role);
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
    return NextResponse.json(colleagues.map((colleague) => ({
      ...colleague,
      roles: normalizeUserRoles(colleague.role),
      role: getPrimaryRole(colleague.role),
    })));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memuat colleagues" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Security Check
    if (!await isAdmin(req)) {
      return NextResponse.json({ error: "Access Denied: Administrative role required" }, { status: 403 });
    }

    const { name, username, password, role, roles } = await req.json();
    if (!name) throw new Error("Name is required");

    // Auto-generate username and password if not provided
    const finalUsername = username || name.toLowerCase().replace(/\s+/g, '.');
    const rawPassword = password || process.env.DEFAULT_USER_PASSWORD;
    if (!rawPassword) {
      return NextResponse.json(
        { error: "Password is required when DEFAULT_USER_PASSWORD is not set" },
        { status: 400 }
      );
    }
    
    // 🔥 NEW: Password Hashing
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const normalizedRoles = normalizeUserRoles(roles ?? role);
    const colleague = await prisma.colleague.create({
      data: { 
        name, 
        username: finalUsername,
        password: hashedPassword,
        role: serializeUserRoles(normalizedRoles),
      }
    });

    // Audit Log
    const sessionUser = getRequestSessionUser(req);
    const reqUser = sessionUser?.name || req.headers.get("x-simulated-user") || "Admin (Simulated)";
    await prisma.auditLog.create({
      data: {
        userName: reqUser,
        username: sessionUser?.username || req.headers.get("x-simulated-username") || reqUser,
        action: "Added New Member (Hashed)",
        target: `${name} (${normalizedRoles.join(", ")})`,
        type: "admin",
      }
    });

    return NextResponse.json({
      ...colleague,
      role: getPrimaryRole(colleague.role),
      roles: normalizeUserRoles(colleague.role),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menambah colleague" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, name, username, password, role, roles } = await req.json();
    const targetId = Number(id);
    const reqUsername = getRequestSessionUser(req)?.username ?? req.headers.get("x-simulated-username");
    if (!reqUsername) {
      return NextResponse.json({ error: "Invalid Session" }, { status: 401 });
    }

    // 1. Get Requester Info
    const requester = await prisma.colleague.findFirst({
      where: { username: reqUsername }
    });

    if (!requester) {
      return NextResponse.json({ error: "Invalid Session" }, { status: 401 });
    }

    const isTargetAdmin = isAdminRole(requester.role);
    const isSelf = requester.id === targetId;

    // 2. Authorization
    if (!isTargetAdmin && !isSelf) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    // 3. Prepare Update Data
    const updateData: Prisma.ColleagueUpdateInput = {};
    if (name) updateData.name = name;
    if (username && isTargetAdmin) updateData.username = username; // Only admin can change username
    if ((role || roles) && isTargetAdmin) {
      updateData.role = serializeUserRoles(normalizeUserRoles(roles ?? role));
    } // Only admin can change role
    
    // 🔥 NEW: Password Hashing for updates
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const colleague = await prisma.colleague.update({
      where: { id: targetId },
      data: updateData,
    });

    // Audit Log
    const sessionUser = getRequestSessionUser(req);
    const reqUserName = sessionUser?.name || req.headers.get("x-simulated-user") || requester.name;
    await prisma.auditLog.create({
      data: {
        userName: reqUserName,
        username: sessionUser?.username || req.headers.get("x-simulated-username") || requester.username,
        action: isSelf ? "Updated Own Profile" : "Updated Member Info (Encrypted)",
        target: isSelf ? "Self" : colleague.name,
        type: isTargetAdmin ? "admin" : "user",
      }
    });

    return NextResponse.json({
      ...colleague,
      role: getPrimaryRole(colleague.role),
      roles: normalizeUserRoles(colleague.role),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memperbarui colleague" }, { status: 500 });
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
    const reqUsername = getRequestSessionUser(req)?.username ?? req.headers.get("x-simulated-username");
    if (!reqUsername) {
      return NextResponse.json({ error: "Invalid Session" }, { status: 401 });
    }
    const reqUser = await prisma.colleague.findFirst({ where: { username: reqUsername } });
    
    if (reqUser && reqUser.id === targetId) {
      return NextResponse.json({ error: "Operation Denied: You cannot delete your own account." }, { status: 400 });
    }

    const colleague = await prisma.colleague.findUnique({ where: { id: targetId } });
    if (!colleague) throw new Error("Member not found");

    await prisma.colleague.delete({ where: { id: targetId } });

    // Audit Log
    const sessionUser = getRequestSessionUser(req);
    const reqUserName = sessionUser?.name || req.headers.get("x-simulated-user") || "Admin (Simulated)";
    await prisma.auditLog.create({
      data: {
        userName: reqUserName,
        username: sessionUser?.username || req.headers.get("x-simulated-username") || reqUserName,
        action: "Deleted Member",
        target: colleague.name,
        type: "danger",
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal menghapus colleague" }, { status: 500 });
  }
}
