import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateReconciliationSummary,
  getReconciliationPeriodRange,
  ReconciliationTargetInput,
  ReconciliationRecordInput,
} from "@/lib/reconciliation";

export const runtime = "nodejs";

type SavedPeriodPayload = {
  id: number;
  year: number;
  month: number;
  title: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: null | {
    id: number;
    name: string;
    username: string;
    role: string;
  };
  targets: ReconciliationTargetInput[];
};

type PeriodRecordRow = {
  id: number;
  spmNumber: string;
  sp2dNumber: string | null;
  sp2dDate: Date | null;
  recipient: string | null;
  description: string | null;
  accountCode: string;
  deductionAmount: number;
};

type SavedPeriodRow = {
  year: number;
  month: number;
  status: string;
  updatedAt: Date;
};

async function getCurrentUser(req: NextRequest) {
  const username = req.headers.get("x-simulated-username");
  if (!username) return null;
  return prisma.colleague.findFirst({
    where: { username },
    select: { id: true, name: true, username: true, role: true },
  });
}

function parsePeriodParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function serializePeriod(period: {
  id: number;
  year: number;
  month: number;
  title: string | null;
  notes: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: null | {
    id: number;
    name: string;
    username: string;
    role: string;
  };
  targets: Array<{ accountCode: string; coretaxAmount: number }>;
}): SavedPeriodPayload {
  return {
    id: period.id,
    year: period.year,
    month: period.month,
    title: period.title,
    notes: period.notes,
    status: period.status,
    createdAt: period.createdAt.toISOString(),
    updatedAt: period.updatedAt.toISOString(),
    createdBy: period.createdBy,
    targets: period.targets.map((target) => ({
      accountCode: target.accountCode,
      coretaxAmount: Number(target.coretaxAmount) || 0,
    })),
  };
}

async function buildResponse(year: number, month: number) {
  const { start, end } = getReconciliationPeriodRange(year, month);

  const [period, records, savedPeriods] = await Promise.all([
    prisma.taxReconciliationPeriod.findUnique({
      where: {
        year_month: {
          year,
          month,
        },
      },
      include: {
        createdBy: {
          select: { id: true, name: true, username: true, role: true },
        },
        targets: true,
      },
    }),
    prisma.sPMRecord.findMany({
      where: {
        status: "COMPLETED",
        sp2dDate: {
          gte: start,
          lt: end,
        },
      },
      select: {
        id: true,
        spmNumber: true,
        sp2dNumber: true,
        sp2dDate: true,
        recipient: true,
        description: true,
        accountCode: true,
        deductionAmount: true,
      },
      orderBy: [
        { sp2dDate: "desc" },
        { spmNumber: "asc" },
      ],
    }),
    prisma.taxReconciliationPeriod.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: {
        year: true,
        month: true,
        status: true,
        updatedAt: true,
      },
    }),
  ]);

  const summaryPayload: ReconciliationRecordInput[] = (records as PeriodRecordRow[]).map((record) => ({
    id: record.id,
    spmNumber: record.spmNumber,
    sp2dNumber: record.sp2dNumber,
    sp2dDate: record.sp2dDate,
    recipient: record.recipient,
    description: record.description,
    accountCode: record.accountCode,
    doneAmount: Number(record.deductionAmount) || 0,
  }));

  const targetPayload: ReconciliationTargetInput[] = period?.targets.map((target: { accountCode: string; coretaxAmount: number }) => ({
    accountCode: target.accountCode,
    coretaxAmount: Number(target.coretaxAmount) || 0,
  })) ?? [];

  const { summary, totals } = calculateReconciliationSummary(summaryPayload, targetPayload);

  return {
    selection: { year, month },
    period: period
      ? serializePeriod(period)
      : null,
    summary,
    totals,
    savedPeriods: (savedPeriods as SavedPeriodRow[]).map((item) => ({
      year: item.year,
      month: item.month,
      status: item.status,
      updatedAt: item.updatedAt.toISOString(),
    })),
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Access Denied: Authentication required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const year = parsePeriodParam(searchParams.get("year"), currentYear);
    const month = parsePeriodParam(searchParams.get("month"), currentMonth);

    return NextResponse.json(await buildResponse(year, month));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load reconciliation data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Access Denied: Administrative role required" }, { status: 403 });
    }

    const body = await req.json();
    const year = Number(body.year);
    const month = Number(body.month);
    const status = body.status === "FINAL" ? "FINAL" : "DRAFT";
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : `Rekonsiliasi Coretax ${month}/${year}`;
    const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
    const targets = Array.isArray(body.targets) ? body.targets : [];

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    const cleanTargets = targets
      .map((target: { accountCode?: string; coretaxAmount?: number | string }) => ({
        accountCode: String(target.accountCode || "").trim(),
        coretaxAmount: Number(target.coretaxAmount) || 0,
      }))
      .filter((target: ReconciliationTargetInput) => target.accountCode);

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const period = await tx.taxReconciliationPeriod.upsert({
        where: {
          year_month: { year, month },
        },
        create: {
          year,
          month,
          title,
          notes,
          status,
          createdById: user.id,
        },
        update: {
          title,
          notes,
          status,
        },
        include: {
          createdBy: {
            select: { id: true, name: true, username: true, role: true },
          },
          targets: true,
        },
      });

      await tx.taxReconciliationTarget.deleteMany({
        where: { periodId: period.id },
      });

      if (cleanTargets.length > 0) {
        await tx.taxReconciliationTarget.createMany({
          data: cleanTargets.map((target: ReconciliationTargetInput) => ({
            periodId: period.id,
            accountCode: target.accountCode,
            coretaxAmount: target.coretaxAmount,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          userName: user.name,
          action: "Saved Tax Reconciliation Period",
          target: `${year}-${String(month).padStart(2, "0")}`,
          category: "DATA",
          type: "success",
        },
      });
    });

    return NextResponse.json({
      success: true,
      ...(await buildResponse(year, month)),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save reconciliation data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
