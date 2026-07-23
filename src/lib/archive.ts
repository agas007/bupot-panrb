import { SPMRecord } from "@prisma/client";

export const ARCHIVE_POLICIES = {
  SPM_RECORD: {
    retentionYears: 5,
    inactivePeriod: 1, // becomes inactive after 1 year
    dataType: "SPM_RECORD",
  },
  PPH21_WITHHOLDING: {
    retentionYears: 5,
    inactivePeriod: 1,
    dataType: "PPH21_WITHHOLDING",
  },
  TAX_RECONCILIATION: {
    retentionYears: 5,
    inactivePeriod: 1,
    dataType: "TAX_RECONCILIATION",
  },
} as const;

export type DataType = keyof typeof ARCHIVE_POLICIES;

export function getArchivePolicy(dataType: DataType) {
  return ARCHIVE_POLICIES[dataType];
}

export function calculateArchiveStatus(
  createdDate: Date,
  dataType: DataType
): "ACTIVE" | "INACTIVE" | "ARCHIVED" {
  const policy = getArchivePolicy(dataType);
  const now = new Date();
  const yearsDiff =
    (now.getTime() - new Date(createdDate).getTime()) /
    (1000 * 60 * 60 * 24 * 365.25);

  if (yearsDiff >= policy.retentionYears) {
    return "ARCHIVED";
  }
  if (yearsDiff >= policy.inactivePeriod) {
    return "INACTIVE";
  }
  if (yearsDiff >= 0) {
    return "ACTIVE";
  }
  return "ACTIVE";
}

export function getRetentionProgress(
  createdDate: Date,
  dataType: DataType
): {
  current: number;
  total: number;
  percentage: number;
  statusLabel: string;
} {
  const policy = getArchivePolicy(dataType);
  const now = new Date();
  const yearsDiff =
    (now.getTime() - new Date(createdDate).getTime()) /
    (1000 * 60 * 60 * 24 * 365.25);

  const current = Math.min(Math.round(yearsDiff * 10) / 10, policy.retentionYears);
  const percentage = Math.min(
    Math.round((current / policy.retentionYears) * 100),
    100
  );

  return {
    current,
    total: policy.retentionYears,
    percentage,
    statusLabel: `${current}/${policy.retentionYears} tahun`,
  };
}

export function extractSPMMetadata(record: SPMRecord): {
  spmNumber: string;
  period: string;
} {
  const period = new Date(record.spmDate).toLocaleDateString("id-ID", {
    month: "2-digit",
    year: "numeric",
  });
  return {
    spmNumber: record.spmNumber,
    period,
  };
}
