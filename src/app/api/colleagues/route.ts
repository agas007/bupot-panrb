import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = 'nodejs';

/**
 * @swagger
 * /api/colleagues:
 *   get:
 *     summary: Get all team members
 *     tags: [Colleagues]
 *     responses:
 *       200:
 *         description: List of colleagues with task counts.
 *   post:
 *     summary: Add new member
 *     tags: [Colleagues]
 *     security:
 *       - SimulatorUser: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, username]
 *             properties:
 *               name: { type: string }
 *               username: { type: string }
 *               password: { type: string }
 *               role: { type: string, enum: [ADMIN, USER] }
 *     responses:
 *       200:
 *         description: Member added successfully.
 */
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

/**
 * @swagger
 * /api/colleagues:
 *   delete:
 *     summary: Delete a member
 *     tags: [Colleagues]
 *     security:
 *       - SimulatorUser: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id]
 *             properties:
 *               id: { type: number }
 *     responses:
 *       200:
 *         description: Member deleted successfully.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    const colleague = await prisma.colleague.findUnique({ where: { id: Number(id) } });

    await prisma.colleague.delete({ where: { id: Number(id) } });

    // Audit Log
    const reqUser = req.headers.get("x-simulated-user") || "Admin (Simulated)";
    // @ts-ignore
    await prisma.auditLog.create({
      data: {
        userName: reqUser,
        action: "Deleted Member",
        target: colleague?.name || `ID: ${id}`,
        type: "danger",
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
