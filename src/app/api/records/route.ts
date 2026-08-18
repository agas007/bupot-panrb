import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRequestSessionUser } from "@/lib/session-cookie";

const VALID_ACCOUNTS = ["411121", "411122", "411124", "411128", "811147"];

export const runtime = 'nodejs';

/**
 * Trigger internal notification
 */
async function notifyUser(userId: number, title: string, message: string, type: string = "INFO") {
  try {
    await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type
      }
    });
  } catch (err: unknown) {
    console.error("Failed to create notification:", err);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const assigneeId = searchParams.get("assigneeId");
  const status = searchParams.get("status");
  const pph21Process = searchParams.get("pph21Process");
  const q = String(searchParams.get("q") || "").trim();
  const accountCode = searchParams.get("accountCode");
  const sp2dMonth = searchParams.get("sp2dMonth");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const requestedSize = searchParams.get("pageSize") === "max" ? 1000 : Number(searchParams.get("pageSize")) || 25;
  const pageSize = Math.min(1000, Math.max(5, requestedSize));
  const sortKey = searchParams.get("sortKey");
  const sortDirection: Prisma.SortOrder = searchParams.get("sortDirection") === "asc" ? "asc" : "desc";
  const compact = searchParams.get("compact") === "1";
  const numericQuery = Number(q.replace(/\./g, "").replace(",", "."));
  const insensitiveMode: Prisma.QueryMode = "insensitive";

    const sp2dDateFilter: { gte?: Date; lt?: Date } = {};
    if (sp2dMonth && /^\d{4}-\d{2}$/.test(sp2dMonth)) {
      const [monthYear, monthPart] = sp2dMonth.split("-");
      const year = Number(monthYear);
      const month = Number(monthPart);
      if (Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12) {
        sp2dDateFilter.gte = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        sp2dDateFilter.lt = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
      }
    }
    if (startDate) {
      const start = new Date(`${startDate}T00:00:00.000Z`);
      if (!sp2dDateFilter.gte || start > sp2dDateFilter.gte) sp2dDateFilter.gte = start;
    }
    if (endDate) {
      const endExclusive = new Date(new Date(`${endDate}T00:00:00.000Z`).getTime() + 86_400_000);
      if (!sp2dDateFilter.lt || endExclusive < sp2dDateFilter.lt) sp2dDateFilter.lt = endExclusive;
    }

    try {
      const where: Prisma.SPMRecordWhereInput = {
        accountCode: accountCode && VALID_ACCOUNTS.includes(accountCode) ? accountCode : { in: VALID_ACCOUNTS },
        ...(assigneeId === "unassigned" ? { assigneeId: null } : assigneeId ? { assigneeId: Number(assigneeId) } : {}),
        ...(status ? { status } : {}),
      ...(pph21Process
        ? pph21Process === "PENDING"
          ? {
              OR: [
                { pph21Batch: null },
                { pph21Batch: { is: { status: "PENDING" } } },
              ],
            }
          : { pph21Batch: { is: { status: pph21Process } } }
        : {}),
      ...(sp2dDateFilter.gte || sp2dDateFilter.lt ? { sp2dDate: sp2dDateFilter } : {}),
      ...(q ? { OR: [
        { spmNumber: { contains: q, mode: insensitiveMode } },
        { sp2dNumber: { contains: q, mode: insensitiveMode } },
        { recipient: { contains: q, mode: insensitiveMode } },
        { description: { contains: q, mode: insensitiveMode } },
        { accountCode: { contains: q } },
        ...(Number.isFinite(numericQuery) ? [{ deductionAmount: numericQuery }, { totalValue: numericQuery }] : []),
      ] } : {}),
    };
    const orderBy: Prisma.SPMRecordOrderByWithRelationInput = sortKey === "spm" ? { spmNumber: sortDirection }
      : sortKey === "description" ? { description: sortDirection }
      : sortKey === "sp2d" ? { sp2dNumber: sortDirection }
      : sortKey === "akun" ? { accountCode: sortDirection }
      : sortKey === "recipient" ? { recipient: sortDirection }
      : sortKey === "assignee" ? { assignee: { name: sortDirection } }
      : { sp2dDate: sortDirection };
    const recordsQuery = compact
      ? prisma.sPMRecord.findMany({
          where,
          select: {
            id: true,
            spmNumber: true,
            sp2dNumber: true,
            sp2dDate: true,
            description: true,
            recipient: true,
            accountCode: true,
            deductionAmount: true,
            totalValue: true,
            status: true,
          },
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
        })
      : prisma.sPMRecord.findMany({
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
        });
    const [records, total] = await Promise.all([
      recordsQuery,
      prisma.sPMRecord.count({ where }),
    ]);

    return NextResponse.json({ records, total, page, pageSize });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memuat records" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ids, status, docLink, notes, assigneeId } = body;

    const updateData: Prisma.SPMRecordUncheckedUpdateInput = {};
    let action = "Updated Record";
    let type = "user";
    
    // Auth context for notifications & audit
    const reqUsername = getRequestSessionUser(req)?.username ?? req.headers.get("x-simulated-username");
    const adminName = getRequestSessionUser(req)?.name || req.headers.get("x-simulated-user") || "Admin (Simulated)";
    const auditUsername = reqUsername || adminName;

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
      const user = reqUsername ? await prisma.colleague.findFirst({ where: { username: reqUsername } }) : null;
      if (!user) {
        return NextResponse.json({ error: "Access Denied: Authentication required for assignment" }, { status: 403 });
      }
      updateData.assigneeId = assigneeId === 0 ? null : assigneeId;
      action = assigneeId === 0 ? "Unassigned Task" : "Assigned Task";
      type = user.role === "ADMIN" ? "admin" : "user";
    }

    const userName = adminName;
    const target = id ? `Record ID: ${id}` : `${ids?.length} Records`;

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
        data: { userName, username: auditUsername, action, target, type }
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
      data: { userName, username: auditUsername, action, target: record.spmNumber, type }
    });

    return NextResponse.json(record);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memperbarui record" }, { status: 500 });
  }
}
