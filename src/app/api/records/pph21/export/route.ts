import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { canManagePph21, getPph21User } from "@/lib/pph21-auth";
import { formatDateOnly, PPH21_ACCOUNT_CODE, PPH21_TAX_OBJECT_LABELS } from "@/lib/pph21";

export const runtime = "nodejs";

type ExportFilters = {
  q?: string;
  assigneeId?: string | null;
  status?: string | null;
  pph21Process?: string | null;
  sp2dMonth?: string | null;
  sp2dMonths?: string[] | null;
  startDate?: string | null;
  endDate?: string | null;
  sortKey?: string | null;
  sortDirection?: "asc" | "desc" | null;
};

type ExportRecord = Prisma.SPMRecordGetPayload<{
  include: {
    assignee: { select: { name: true } };
    pph21Batch: {
      include: {
        withholdings: {
          include: { recipient: true };
          orderBy: { id: "asc" };
        };
      };
    };
  };
  }>;

const normalizeExportFilters = (value: { filters?: ExportFilters } | ExportFilters | null): ExportFilters => {
  if (!value) return {};
  if ("filters" in value) return value.filters || {};
  return value as ExportFilters;
};

const normalizeSearchTerm = (value: string) => String(value || "").trim();

const buildWhere = (filters: ExportFilters): Prisma.SPMRecordWhereInput => {
  const q = normalizeSearchTerm(filters.q || "");
  const assigneeId = filters.assigneeId;
  const status = filters.status;
  const pph21Process = filters.pph21Process;
  const sp2dMonth = filters.sp2dMonth;
  const sp2dMonths = Array.isArray(filters.sp2dMonths) ? filters.sp2dMonths : [];
  const startDate = filters.startDate;
  const endDate = filters.endDate;
  const numericQuery = Number(q.replace(/\./g, "").replace(",", "."));
  const insensitiveMode: Prisma.QueryMode = "insensitive";

  const selectedMonths = Array.from(new Set(
    sp2dMonths.length > 0
      ? sp2dMonths
      : sp2dMonth
        ? [sp2dMonth]
        : []
  )).filter((month) => /^\d{4}-\d{2}$/.test(month));

  const andClauses: Prisma.SPMRecordWhereInput[] = [
    { accountCode: PPH21_ACCOUNT_CODE },
    ...(assigneeId === "unassigned" ? [{ assigneeId: null }] : assigneeId ? [{ assigneeId: Number(assigneeId) }] : []),
    ...(status ? [{ status }] : []),
    ...(pph21Process
      ? [pph21Process === "PENDING"
        ? {
            OR: [
              { pph21Batch: null },
              { pph21Batch: { is: { status: "PENDING" } } },
            ],
          }
        : { pph21Batch: { is: { status: pph21Process } } }]
      : []),
    ...(q
      ? [{
          OR: [
            { spmNumber: { contains: q, mode: insensitiveMode } },
            { sp2dNumber: { contains: q, mode: insensitiveMode } },
            { recipient: { contains: q, mode: insensitiveMode } },
            { description: { contains: q, mode: insensitiveMode } },
            { accountCode: { contains: q } },
            ...(Number.isFinite(numericQuery) ? [{ deductionAmount: numericQuery }, { totalValue: numericQuery }] : []),
          ],
        }]
      : []),
  ];

  if (selectedMonths.length) {
    andClauses.push({
      OR: selectedMonths.map((month) => {
        const [yearText, monthText] = month.split("-");
        const year = Number(yearText);
        const monthIndex = Number(monthText);
        return {
          sp2dDate: {
            gte: new Date(Date.UTC(year, monthIndex - 1, 1, 0, 0, 0, 0)),
            lt: new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0)),
          },
        };
      }),
    });
  }

  if (startDate || endDate) {
    andClauses.push({
      sp2dDate: {
        ...(startDate ? { gte: new Date(`${startDate}T00:00:00.000Z`) } : {}),
        ...(endDate ? { lt: new Date(new Date(`${endDate}T00:00:00.000Z`).getTime() + 86_400_000) } : {}),
      },
    });
  }

  return andClauses.length === 1 ? andClauses[0] : { AND: andClauses };
};

const buildOrderBy = (filters: ExportFilters): Prisma.SPMRecordOrderByWithRelationInput[] => {
  const sortDirection: Prisma.SortOrder = filters.sortDirection === "asc" ? "asc" : "desc";
  const sortKey = filters.sortKey;

  if (sortKey === "spm") return [{ spmNumber: sortDirection }];
  if (sortKey === "description") return [{ description: sortDirection }];
  if (sortKey === "sp2d") return [{ sp2dNumber: sortDirection }];
  if (sortKey === "akun") return [{ accountCode: sortDirection }];
  if (sortKey === "recipient") return [{ recipient: sortDirection }];
  if (sortKey === "assignee") return [{ assignee: { name: sortDirection } }];
  return [{ sp2dDate: "asc" }, { spmNumber: "asc" }];
};

const formatDate = (value: string | Date | null | undefined) => {
  if (!value) return "";
  return formatDateOnly(value instanceof Date ? value : new Date(value));
};

export async function POST(req: NextRequest) {
  try {
    const user = await getPph21User(req);
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 403 });

    const body = (await req.json().catch(() => null)) as { filters?: ExportFilters } | ExportFilters | null;
    const filters = normalizeExportFilters(body);
    const where = buildWhere(filters);
    const orderBy = buildOrderBy(filters);

    const records = (await prisma.sPMRecord.findMany({
      where,
      include: {
        assignee: { select: { name: true } },
        pph21Batch: {
          include: {
            withholdings: {
              include: { recipient: true },
              orderBy: { id: "asc" },
            },
          },
        },
      },
      orderBy,
    })) as ExportRecord[];

    if (records.length === 0) {
      return NextResponse.json({ error: "Tidak ada record PPh 21 yang cocok dengan filter saat ini." }, { status: 404 });
    }

    const summaryRows: Array<Record<string, string | number>> = [];
    const detailRows: Array<Record<string, string | number>> = [];
    const incompleteRows: Array<Record<string, string | number>> = [];

    for (const record of records) {
      if (!canManagePph21(user, record)) {
        return NextResponse.json({ error: `Tidak berhak mengekspor ${record.spmNumber}.` }, { status: 403 });
      }

      const batch = record.pph21Batch;
      const withholdings = batch?.withholdings || [];
      const totalTax = withholdings.reduce((sum, line) => sum + line.calculatedTax, 0);
      const totalGross = withholdings.reduce((sum, line) => sum + line.gross, 0);
      const operator = record.assignee?.name || "-";
      const processStatus = batch?.status || "PENDING";
      const issueText = !batch
        ? "Belum ada batch PPh 21"
        : !withholdings.length
          ? "Batch belum punya detail recipient"
          : batch.status === "ISSUES"
            ? "Masih berstatus ISSUES"
            : totalTax !== record.deductionAmount
              ? "Total pajak tidak sama dengan potongan"
              : "";

      summaryRows.push({
        "SPM No.": record.spmNumber,
        "SPM Date": formatDate(record.spmDate),
        "Uraian SPM": record.description || "",
        "SP2D No": record.sp2dNumber || "",
        "SP2D Date": formatDate(record.sp2dDate),
        "Recipient Count": withholdings.length,
        "Total Amount": totalGross,
        "Total Tax": totalTax,
        "Record Deduction": record.deductionAmount,
        "Difference": totalTax - record.deductionAmount,
        "PPh 21 Process": processStatus,
        "Operator": operator,
        "Status": record.status,
      });

      if (withholdings.length === 0) {
        incompleteRows.push({
          "SPM No.": record.spmNumber,
          "SP2D No": record.sp2dNumber || "",
          "SP2D Date": formatDate(record.sp2dDate),
          "Uraian SPM": record.description || "",
          "Operator": operator,
          "PPh 21 Process": processStatus,
          "Issue": issueText || "Belum ada detail recipient",
        });
      }

      for (const line of withholdings) {
        detailRows.push({
          "SPM No.": record.spmNumber,
          "SPM Date": formatDate(record.spmDate),
          "Uraian SPM": record.description || "",
          "SP2D No": record.sp2dNumber || "",
          "SP2D Date": formatDate(record.sp2dDate),
          "Recipient Name": line.recipientName,
          NPWP: line.recipient?.nik || "",
          Amount: line.gross,
          "Tax Object Code": line.taxObjectCode,
          "Tax Object Label": PPH21_TAX_OBJECT_LABELS[line.taxObjectCode as keyof typeof PPH21_TAX_OBJECT_LABELS] || "",
          "Calculated Tax": line.calculatedTax,
          "Withholding Date": batch?.withholdingDate ? formatDate(batch.withholdingDate) : "",
          Operator: operator,
          "PPh 21 Process": processStatus,
        });
      }
    }

    const workbook = XLSX.utils.book_new();
    const detailSheet = XLSX.utils.json_to_sheet(detailRows);
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Ringkasan");
    XLSX.utils.book_append_sheet(workbook, detailSheet, "Detail Recipient");
    if (incompleteRows.length) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(incompleteRows), "Belum Lengkap");
    }

    summarySheet["!cols"] = [
      { wch: 18 },
      { wch: 14 },
      { wch: 42 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 12 },
      { wch: 16 },
      { wch: 18 },
      { wch: 12 },
    ];
    detailSheet["!cols"] = [
      { wch: 18 },
      { wch: 14 },
      { wch: 42 },
      { wch: 16 },
      { wch: 14 },
      { wch: 32 },
      { wch: 20 },
      { wch: 14 },
      { wch: 16 },
      { wch: 42 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
    ];

    if (incompleteRows.length) {
      const incompleteSheet = workbook.Sheets["Belum Lengkap"];
      incompleteSheet["!cols"] = [
        { wch: 18 },
        { wch: 16 },
        { wch: 14 },
        { wch: 42 },
        { wch: 18 },
        { wch: 16 },
        { wch: 36 },
      ];
    }

    const fileName = `Bupot_PANRB_PPh21_Detail_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-Export-Filename": fileName,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal membuat export Excel PPh 21" }, { status: 400 });
  }
}
