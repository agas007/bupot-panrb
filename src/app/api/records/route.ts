import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestSessionUser } from "@/lib/session-cookie";

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
  const q = String(searchParams.get("q") || "").trim();
  const accountCode = searchParams.get("accountCode");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const requestedSize = searchParams.get("pageSize") === "max" ? 1000 : Number(searchParams.get("pageSize")) || 25;
  const pageSize = Math.min(1000, Math.max(5, requestedSize));
  const sortKey = searchParams.get("sortKey");
  const sortDirection = searchParams.get("sortDirection") === "asc" ? "asc" : "desc";
  const numericQuery = Number(q.replace(/\./g, "").replace(",", "."));

  try {
    const where = {
      accountCode: accountCode && VALID_ACCOUNTS.includes(accountCode) ? accountCode : { in: VALID_ACCOUNTS },
      ...(assigneeId === "unassigned" ? { assigneeId: null } : assigneeId ? { assigneeId: Number(assigneeId) } : {}),
      ...(status ? { status } : {}),
      ...(startDate || endDate ? { sp2dDate: { ...(startDate ? { gte: new Date(`${startDate}T00:00:00.000Z`) } : {}), ...(endDate ? { lt: new Date(new Date(`${endDate}T00:00:00.000Z`).getTime() + 86_400_000) } : {}) } } : {}),
      ...(q ? { OR: [
        { spmNumber: { contains: q, mode: "insensitive" } },
        { sp2dNumber: { contains: q, mode: "insensitive" } },
        { recipient: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { accountCode: { contains: q } },
        ...(Number.isFinite(numericQuery) ? [{ deductionAmount: numericQuery }, { totalValue: numericQuery }] : []),
      ] } : {}),
    };
    const orderBy = sortKey === "spm" ? { spmNumber: sortDirection }
      : sortKey === "description" ? { description: sortDirection }
      : sortKey === "sp2d" ? { sp2dNumber: sortDirection }
      : sortKey === "akun" ? { accountCode: sortDirection }
      : sortKey === "recipient" ? { recipient: sortDirection }
      : sortKey === "assignee" ? { assignee: { name: sortDirection } }
      : { sp2dDate: sortDirection };
    const [records, total] = await Promise.all([
      prisma.sPMRecord.findMany({
        where,
        select: {
          id: true, uniqueKey: true, spmNumber: true, spmDate: true, accountCode: true, deductionAmount: true,
          sp2dNumber: true, sp2dDate: true, description: true, recipient: true, totalValue: true, status: true,
          assigneeId: true, completionDate: true, docLink: true, notes: true, importDate: true, updatedAt: true,
          assignee: { select: { id: true, username: true, name: true, role: true, createdAt: true } },
          pph21Batch: { select: { id: true, status: true, issueNotes: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.sPMRecord.count({ where }),
    ]);

    return NextResponse.json({ records, total, page, pageSize });
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
    const reqUsername = getRequestSessionUser(req)?.username ?? req.headers.get("x-simulated-username");
    const adminName = getRequestSessionUser(req)?.name || req.headers.get("x-simulated-user") || "Admin (Simulated)";

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
      const user = reqUsername ? await (prisma.colleague as any).findFirst({ where: { username: reqUsername } }) : null;
      if (!user) {
        return NextResponse.json({ error: "Access Denied: Authentication required for assignment" }, { status: 403 });
      }
      updateData.assigneeId = assigneeId === 0 ? null : assigneeId;
      action = assigneeId === 0 ? "Unassigned Task" : "Assigned Task";
      type = user.role === "ADMIN" ? "admin" : "user";
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

    await prisma.auditLog.create({
      data: { userName, action, target: record.spmNumber, type }
    });

    return NextResponse.json(record);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
