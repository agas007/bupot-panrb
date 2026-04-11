import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_ACCOUNTS = ["411121", "411122", "411124"];

export const runtime = 'nodejs';

/**
 * Trigger internal notification
 */
async function notifyUser(userId: number, title: string, message: string, type: string = "INFO") {
  try {
    await (prisma as any).notification.create({
      data: {
        userId,
        title,
        message,
        type
      }
    });
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const assigneeId = searchParams.get("assigneeId");
  const status = searchParams.get("status");

  try {
    const records = await prisma.sPMRecord.findMany({
      where: {
        accountCode: { in: VALID_ACCOUNTS },
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
    
    // Auth context for notifications & audit
    const reqUsername = req.headers.get("x-simulated-username");
    const adminName = req.headers.get("x-simulated-user") || "Admin (Simulated)";

    if (status) {
      updateData.status = status;
      if (status === "COMPLETED") {
        updateData.completionDate = new Date();
      }
      action = status === "COMPLETED" ? "Marked as Done" : status === "ISSUES" ? "Flagged with Issues" : "Reverted to Pending";
    }
    if (docLink !== undefined) updateData.docLink = docLink;
    if (notes !== undefined) updateData.notes = notes;
    
    // Assignment Logic with Notifications
    if (assigneeId !== undefined) {
      const adminUser = reqUsername ? await (prisma.colleague as any).findFirst({ where: { username: reqUsername } }) : null;
      if (!adminUser || adminUser.role !== "ADMIN") {
        return NextResponse.json({ error: "Access Denied: Administrative role required for assignment" }, { status: 403 });
      }
      updateData.assigneeId = assigneeId === 0 ? null : assigneeId;
      action = assigneeId === 0 ? "Unassigned Task" : "Assigned Task";
      type = "admin";
    }

    const userName = adminName;
    let target = id ? `Record ID: ${id}` : `${ids?.length} Records`;

    if (ids && Array.isArray(ids)) {
      const targetIds = ids.map(Number);
      const result = await prisma.sPMRecord.updateMany({
        where: { id: { in: targetIds } },
        data: updateData,
      });
      
      // Notify about bulk assignment
      if (assigneeId && assigneeId !== 0) {
        await notifyUser(
          Number(assigneeId), 
          "📦 Penugasan Baru (Bulk)", 
          `Anda telah ditugaskan untuk mengerjakan ${targetIds.length} data bukti potong baru oleh ${adminName}.`,
          "INFO"
        );
      }
      
      // @ts-ignore
      await prisma.auditLog.create({
        data: { userName, action, target, type }
      });

      return NextResponse.json({ count: result.count });
    }

    const record = await prisma.sPMRecord.update({
      where: { id: Number(id) },
      data: updateData,
      include: { assignee: true }
    });

    // Notify about single assignment
    if (assigneeId && assigneeId !== 0) {
      await notifyUser(
        Number(assigneeId),
        "📌 Penugasan Baru",
        `Data SPM ${record.spmNumber} telah ditugaskan kepada Anda oleh ${adminName}. Segera cek lembar kerja!`,
        "INFO"
      );
    } else if (status === "COMPLETED" && record.assigneeId) {
      // Notify Admin when task is done? Optional, but good for tracking.
      // For now, only for assignments.
    }

    // @ts-ignore
    await prisma.auditLog.create({
      data: { userName, action, target: record.spmNumber, type }
    });

    return NextResponse.json(record);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
