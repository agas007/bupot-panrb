export type UserRole = "ADMIN" | "USER";

export interface Colleague {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  createdAt: string;
  _count?: {
    records: number;
  };
}

export type RecordStatus = "PENDING" | "COMPLETED";

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
}
