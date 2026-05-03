import { getTaxAccountLabel } from "@/lib/tax-codes";

export type ReconciliationStatus = "BALANCED" | "OVER" | "UNDER";

export interface ReconciliationRecordInput {
  id: number;
  spmNumber: string;
  sp2dNumber: string | null;
  sp2dDate: Date | string | null;
  recipient: string | null;
  description: string | null;
  accountCode: string;
  doneAmount: number;
}

export interface ReconciliationTargetInput {
  accountCode: string;
  coretaxAmount: number;
}

export interface ReconciliationSummaryRow {
  accountCode: string;
  accountLabel: string;
  coretaxAmount: number;
  doneAmount: number;
  difference: number;
  status: ReconciliationStatus;
  transactionCount: number;
  records: Array<{
    id: number;
    spmNumber: string;
    sp2dNumber: string | null;
    sp2dDate: string | null;
    recipient: string | null;
    description: string | null;
    doneAmount: number;
    accountCode: string;
  }>;
}

export function getReconciliationPeriodRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end };
}

function normalizeAccountCode(accountCode: string) {
  return accountCode.replace(/\s+/g, "").trim();
}

export function calculateReconciliationSummary(
  records: ReconciliationRecordInput[],
  targets: ReconciliationTargetInput[]
) {
  const targetMap = new Map(
    targets
      .map((target) => [normalizeAccountCode(target.accountCode), Number(target.coretaxAmount) || 0] as const)
  );

  const recordMap = new Map<string, ReconciliationRecordInput[]>();
  for (const record of records) {
    const code = normalizeAccountCode(record.accountCode);
    if (!recordMap.has(code)) recordMap.set(code, []);
    recordMap.get(code)!.push(record);
  }

  const accountCodes = Array.from(new Set([...recordMap.keys(), ...targetMap.keys()])).sort((a, b) =>
    a.localeCompare(b)
  );

  const summary = accountCodes.map((accountCode) => {
    const accountLabel = getTaxAccountLabel(accountCode);
    const recordsForCode = (recordMap.get(accountCode) || []).slice().sort((a, b) => {
      const aDate = a.sp2dDate ? new Date(a.sp2dDate).getTime() : 0;
      const bDate = b.sp2dDate ? new Date(b.sp2dDate).getTime() : 0;
      if (aDate !== bDate) return bDate - aDate;
      return a.spmNumber.localeCompare(b.spmNumber);
    });

    const doneAmount = recordsForCode.reduce((sum, record) => sum + (Number(record.doneAmount) || 0), 0);
    const coretaxAmount = targetMap.get(accountCode) || 0;
    const difference = doneAmount - coretaxAmount;
    const status: ReconciliationStatus = difference === 0 ? "BALANCED" : difference > 0 ? "OVER" : "UNDER";

    return {
      accountCode,
      accountLabel: accountLabel === "-" ? accountCode : accountLabel,
      coretaxAmount,
      doneAmount,
      difference,
      status,
      transactionCount: recordsForCode.length,
      records: recordsForCode.map((record) => ({
        id: record.id,
        spmNumber: record.spmNumber,
        sp2dNumber: record.sp2dNumber,
        sp2dDate: record.sp2dDate ? new Date(record.sp2dDate).toISOString() : null,
        recipient: record.recipient,
        description: record.description,
        doneAmount: Number(record.doneAmount) || 0,
        accountCode: record.accountCode,
      })),
    } satisfies ReconciliationSummaryRow;
  });

  const totals = summary.reduce(
    (acc, row) => {
      acc.coretaxAmount += row.coretaxAmount;
      acc.doneAmount += row.doneAmount;
      acc.difference += row.difference;
      if (row.status === "BALANCED") acc.balancedCount += 1;
      if (row.status === "OVER") acc.overCount += 1;
      if (row.status === "UNDER") acc.underCount += 1;
      return acc;
    },
    {
      coretaxAmount: 0,
      doneAmount: 0,
      difference: 0,
      balancedCount: 0,
      overCount: 0,
      underCount: 0,
    }
  );

  return { summary, totals };
}
