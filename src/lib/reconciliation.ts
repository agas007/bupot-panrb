import { getTaxAccountLabel } from "./tax-codes.ts";

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

export interface MonthlyComparisonInput {
  name: string;
  amount: number;
  reference?: string | null;
}

export type MonthlyComparisonStatus = "MATCHED" | "OVER" | "UNDER" | "ONLY_IN_APP" | "ONLY_IN_CORTEX";

export interface MonthlyComparisonRow {
  key: string;
  name: string;
  appAmount: number;
  cortexAmount: number;
  difference: number;
  appCount: number;
  cortexCount: number;
  appReferences: string[];
  cortexReferences: string[];
  status: MonthlyComparisonStatus;
}

export interface MonthlyComparisonTotals {
  appAmount: number;
  cortexAmount: number;
  difference: number;
  matchedCount: number;
  overCount: number;
  underCount: number;
  onlyInAppCount: number;
  onlyInCortexCount: number;
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

export function normalizeComparisonName(value: string) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function aggregateComparisonRows(rows: MonthlyComparisonInput[]) {
  const aggregated = new Map<string, { name: string; amount: number; count: number; references: string[] }>();

  for (const row of rows) {
    const key = normalizeComparisonName(row.name);
    if (!key) continue;

    const current = aggregated.get(key) || {
      name: row.name.trim(),
      amount: 0,
      count: 0,
      references: [],
    };

    current.amount += Number(row.amount) || 0;
    current.count += 1;
    if (row.reference) {
      const reference = String(row.reference).trim();
      if (reference && !current.references.includes(reference)) {
        current.references.push(reference);
      }
    }
    if (!current.name) {
      current.name = row.name.trim();
    }
    aggregated.set(key, current);
  }

  return aggregated;
}

export function buildMonthlyComparisonRows(
  appRows: MonthlyComparisonInput[],
  cortexRows: MonthlyComparisonInput[],
) {
  const appMap = aggregateComparisonRows(appRows);
  const cortexMap = aggregateComparisonRows(cortexRows);
  const keys = Array.from(new Set([...appMap.keys(), ...cortexMap.keys()])).sort((a, b) => a.localeCompare(b));

  const rows = keys.map((key) => {
    const appRow = appMap.get(key) || { name: key, amount: 0, count: 0, references: [] };
    const cortexRow = cortexMap.get(key) || { name: key, amount: 0, count: 0, references: [] };
    const difference = cortexRow.amount - appRow.amount;
    const appExists = appRow.count > 0;
    const cortexExists = cortexRow.count > 0;

    const status: MonthlyComparisonStatus = !appExists && cortexExists
      ? "ONLY_IN_CORTEX"
      : appExists && !cortexExists
        ? "ONLY_IN_APP"
        : difference === 0
          ? "MATCHED"
          : difference > 0
            ? "OVER"
            : "UNDER";

    return {
      key,
      name: cortexRow.name || appRow.name || key,
      appAmount: appRow.amount,
      cortexAmount: cortexRow.amount,
      difference,
      appCount: appRow.count,
      cortexCount: cortexRow.count,
      appReferences: appRow.references,
      cortexReferences: cortexRow.references,
      status,
    } satisfies MonthlyComparisonRow;
  });

  const totals = rows.reduce<MonthlyComparisonTotals>(
    (acc, row) => {
      acc.appAmount += row.appAmount;
      acc.cortexAmount += row.cortexAmount;
      acc.difference += row.difference;
      if (row.status === "MATCHED") acc.matchedCount += 1;
      if (row.status === "OVER") acc.overCount += 1;
      if (row.status === "UNDER") acc.underCount += 1;
      if (row.status === "ONLY_IN_APP") acc.onlyInAppCount += 1;
      if (row.status === "ONLY_IN_CORTEX") acc.onlyInCortexCount += 1;
      return acc;
    },
    {
      appAmount: 0,
      cortexAmount: 0,
      difference: 0,
      matchedCount: 0,
      overCount: 0,
      underCount: 0,
      onlyInAppCount: 0,
      onlyInCortexCount: 0,
    }
  );

  return { rows, totals };
}
