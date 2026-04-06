import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = 'nodejs';

/**
 * @swagger
 * /api/records:
 *   get:
 *     summary: Get worksheet records
 *     description: Retrieve records with optional filtering by assignee and status.
 *     tags: [Management]
 *     parameters:
 *       - in: query
 *         name: assigneeId
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, COMPLETED] }
 *     responses:
 *       200:
 *         description: List of records.
 *   patch:
 *     summary: Update records
 *     description: Update single or bulk records for assignment or completion.
 *     tags: [Management]
 *     security:
 *       - SimulatorUser: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id: { type: number }
 *               ids: { type: array, items: { type: number } }
 *               status: { type: string, enum: [PENDING, COMPLETED] }
 *               assigneeId: { type: number, nullable: true }
 *               docLink: { type: string }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Record updated successfully.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const assigneeId = searchParams.get("assigneeId");
  const status = searchParams.get("status");

  try {
    const records = await prisma.sPMRecord.findMany({
      where: {
        ...(assigneeId ? { assigneeId: Number(assigneeId) } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        assignee: true,
      },
      orderBy: {
        sp2dDate: "desc",
      },
    });

    return NextResponse.json(records);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ids, status, docLink, notes, assigneeId } = body;

    const updateData: any = {};
    let action = "Updated Record";
    let type = "user";
    
    if (status) {
      updateData.status = status;
      if (status === "COMPLETED") {
        updateData.completionDate = new Date();
      }
      action = status === "COMPLETED" ? "Marked as Done" : "Reverted to Pending";
    }
    if (docLink !== undefined) updateData.docLink = docLink;
    if (notes !== undefined) updateData.notes = notes;
    if (assigneeId !== undefined) {
      // Security Check for assignment
      const reqUsername = req.headers.get("x-simulated-username");
      const adminUser = reqUsername ? await (prisma.colleague as any).findFirst({ where: { username: reqUsername } }) : null;
      if (!adminUser || adminUser.role !== "ADMIN") {
        return NextResponse.json({ error: "Access Denied: Administrative role required for assignment" }, { status: 403 });
      }
      updateData.assigneeId = assigneeId === 0 ? null : assigneeId;
      action = assigneeId === 0 ? "Unassigned Task" : "Assigned Task";
      type = "admin";
    }

    const userName = req.headers.get("x-simulated-user") || "Admin (Simulated)";
    let target = id ? `Record ID: ${id}` : `${ids?.length} Records`;

    if (ids && Array.isArray(ids)) {
      const result = await prisma.sPMRecord.updateMany({
        where: { id: { in: ids.map(Number) } },
        data: updateData,
      });
      
      // @ts-ignore
      await prisma.auditLog.create({
        data: { userName, action, target, type }
      });

      return NextResponse.json({ count: result.count });
    }

    const record = await prisma.sPMRecord.update({
      where: { id: Number(id) },
      data: updateData,
    });

    // @ts-ignore
    await prisma.auditLog.create({
      data: { userName, action, target: record.spmNumber, type }
    });

    return NextResponse.json(record);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
