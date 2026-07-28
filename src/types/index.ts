export type UserRole = "ADMIN" | "ARCHIVIST" | "USER";

export interface Colleague {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  roles?: UserRole[];
  createdAt: string;
  _count?: {
    records: number;
  };
}

export type RecordStatus = "PENDING" | "COMPLETED" | "ISSUES";

export interface SPMRecord {
  id: number;
  uniqueKey: string;
  spmNumber: string;
  spmDate: string;
  accountCode: string;
  deductionAmount: number;
  sp2dNumber?: string | null;
  sp2dDate?: string | null;
  description?: string | null;
  recipient?: string | null;
  totalValue?: number | null;
  status: RecordStatus;
  assigneeId?: number | null;
  assignee?: Colleague | null;
  completionDate?: string | null;
  docLink?: string | null;
  notes?: string | null;
  importDate: string;
  updatedAt: string;
  pph21Batch?: {
    id: number;
    status: "PENDING" | "DATA_ENTERED" | "COMPLETED" | "ISSUES";
    issueNotes?: string | null;
  } | null;
}

export interface AuditLog {
  id: number;
  userName: string;
  action: string;
  target: string;
  type: "system" | "user" | "admin" | "danger";
  createdAt: string;
}

export interface AuthSession {
  id: number;
  name: string;
  username: string;
  role: UserRole;
  roles: UserRole[];
}
