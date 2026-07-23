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
  nik?: string | null;
  name: string;
  amount: number;
  reference?: string | null;
}

export type MonthlyComparisonStatus = "MATCHED" | "OVER" | "UNDER" | "ONLY_IN_APP" | "ONLY_IN_CORTEX";
export type MonthlyComparisonMatchBy = "NIK" | "NAME";

export interface MonthlyComparisonRow {
  key: string;
  matchBy: MonthlyComparisonMatchBy;
  name: string;
  appName: string;
  cortexName: string;
  appNik: string | null;
  cortexNik: string | null;
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

function normalizeComparisonNik(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "").trim();
}

type AggregatedComparisonRow = {
  key: string;
  matchBy: MonthlyComparisonMatchBy;
  name: string;
  nik: string | null;
  amount: number;
  count: number;
  references: string[];
};

function aggregateComparisonRows(rows: MonthlyComparisonInput[]) {
  const aggregated: AggregatedComparisonRow[] = [];
  const aliasToIndex = new Map<string, number>();

  for (const row of rows) {
    const nik = normalizeComparisonNik(row.nik);
    const nameKey = normalizeComparisonName(row.name);
    const primaryKey = nik.length >= 10 ? `NIK:${nik}` : nameKey ? `NAME:${nameKey}` : "";
    if (!primaryKey) continue;

    const groupIndex = aliasToIndex.has(primaryKey) ? aliasToIndex.get(primaryKey)! : aggregated.length;

    if (!aggregated[groupIndex]) {
      aggregated[groupIndex] = {
        key: primaryKey,
        matchBy: nik.length >= 10 ? "NIK" : "NAME",
        name: row.name.trim(),
        nik: nik.length >= 10 ? nik : null,
        amount: 0,
        count: 0,
        references: [],
      };
    }

    const current = aggregated[groupIndex];
    current.amount += Number(row.amount) || 0;
    current.count += 1;
    if (row.reference) {
      const reference = String(row.reference).trim();
      if (reference && !current.references.includes(reference)) {
        current.references.push(reference);
      }
    }
    if (!current.name) current.name = row.name.trim();
    if (!current.nik && nik.length >= 10) current.nik = nik;
    if (nik.length >= 10) current.matchBy = "NIK";

    aliasToIndex.set(primaryKey, groupIndex);
  }

  return aggregated;
}

function mergeComparisonGroups(
  appGroups: AggregatedComparisonRow[],
  cortexGroups: AggregatedComparisonRow[],
) {
  const rows: MonthlyComparisonRow[] = [];
  const usedApp = new Set<number>();
  const usedCortex = new Set<number>();

  const cortexNikMap = new Map<string, number>();
  const cortexNameMap = new Map<string, number>();
  cortexGroups.forEach((group, index) => {
    if (group.nik) {
      cortexNikMap.set(group.nik, index);
      return;
    }
    const nameAlias = normalizeComparisonName(group.name);
    if (nameAlias) cortexNameMap.set(nameAlias, index);
  });

  const appNikMap = new Map<string, number>();
  const appNameMap = new Map<string, number>();
  appGroups.forEach((group, index) => {
    if (group.nik) {
      appNikMap.set(group.nik, index);
      return;
    }
    const nameAlias = normalizeComparisonName(group.name);
    if (nameAlias) appNameMap.set(nameAlias, index);
  });

  const pairGroups = (appIndex: number, cortexIndex: number, matchBy: MonthlyComparisonMatchBy) => {
    const appRow = appGroups[appIndex];
    const cortexRow = cortexGroups[cortexIndex];
    usedApp.add(appIndex);
    usedCortex.add(cortexIndex);
    const difference = cortexRow.amount - appRow.amount;
    const status: MonthlyComparisonStatus = difference === 0 ? "MATCHED" : difference > 0 ? "OVER" : "UNDER";
    rows.push({
      key: cortexRow.nik || appRow.nik || cortexRow.key || appRow.key,
      matchBy,
      name: cortexRow.name || appRow.name || cortexRow.key || appRow.key,
      appName: appRow.name,
      cortexName: cortexRow.name,
      appNik: appRow.nik,
      cortexNik: cortexRow.nik,
      appAmount: appRow.amount,
      cortexAmount: cortexRow.amount,
      difference,
      appCount: appRow.count,
      cortexCount: cortexRow.count,
      appReferences: appRow.references,
      cortexReferences: cortexRow.references,
      status,
    });
  };

  // NIK is the primary key. Name fallback is only for rows without NIK.
  for (const [nik, appIndex] of appNikMap.entries()) {
    const cortexIndex = cortexNikMap.get(nik);
    if (cortexIndex === undefined) continue;
    pairGroups(appIndex, cortexIndex, "NIK");
  }

  for (const [alias, appIndex] of appNameMap.entries()) {
    if (usedApp.has(appIndex)) continue;
    const cortexIndex = cortexNameMap.get(alias);
    if (cortexIndex === undefined || usedCortex.has(cortexIndex)) continue;
    pairGroups(appIndex, cortexIndex, "NAME");
  }

  for (let index = 0; index < appGroups.length; index += 1) {
    if (usedApp.has(index)) continue;
    const appRow = appGroups[index];
    rows.push({
      key: appRow.nik || appRow.key,
      matchBy: appRow.nik ? "NIK" : "NAME",
      name: appRow.name,
      appName: appRow.name,
      cortexName: "",
      appNik: appRow.nik,
      cortexNik: null,
      appAmount: appRow.amount,
      cortexAmount: 0,
      difference: -appRow.amount,
      appCount: appRow.count,
      cortexCount: 0,
      appReferences: appRow.references,
      cortexReferences: [],
      status: "ONLY_IN_APP",
    });
  }

  for (let index = 0; index < cortexGroups.length; index += 1) {
    if (usedCortex.has(index)) continue;
    const cortexRow = cortexGroups[index];
    rows.push({
      key: cortexRow.nik || cortexRow.key,
      matchBy: cortexRow.nik ? "NIK" : "NAME",
      name: cortexRow.name,
      appName: "",
      cortexName: cortexRow.name,
      appNik: null,
      cortexNik: cortexRow.nik,
      appAmount: 0,
      cortexAmount: cortexRow.amount,
      difference: cortexRow.amount,
      appCount: 0,
      cortexCount: cortexRow.count,
      appReferences: [],
      cortexReferences: cortexRow.references,
      status: "ONLY_IN_CORTEX",
    });
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

export function buildMonthlyComparisonRows(
  appRows: MonthlyComparisonInput[],
  cortexRows: MonthlyComparisonInput[],
) {
  const appGroups = aggregateComparisonRows(appRows);
  const cortexGroups = aggregateComparisonRows(cortexRows);
  const rows = mergeComparisonGroups(appGroups, cortexGroups);

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
