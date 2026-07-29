import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AuditLogEntry = {
  userName: string;
  username?: string;
  action: string;
  target: string;
  category?: string;
  type: string;
};

type AuditLogDb = {
  auditLog: {
    create: (args: any) => Promise<unknown>;
  };
  $queryRaw: (query: Prisma.Sql) => Promise<any>;
  $executeRaw: (query: Prisma.Sql) => Promise<any>;
};

let hasUsernameColumnCache: boolean | null = null;

const hasAuditLogUsernameColumn = async (): Promise<boolean> => {
  if (hasUsernameColumnCache !== null) {
    return hasUsernameColumnCache;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ present: boolean }>>(Prisma.sql`
      SELECT TRUE AS present
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'AuditLog'
        AND column_name = 'username'
      LIMIT 1
    `);

    hasUsernameColumnCache = rows.length > 0;
  } catch {
    hasUsernameColumnCache = false;
  }

  return hasUsernameColumnCache;
};

export const createAuditLogEntry = async (db: AuditLogDb, entry: AuditLogEntry) => {
  const hasUsernameColumn = await hasAuditLogUsernameColumn();

  if (hasUsernameColumn) {
    return db.auditLog.create({ data: entry });
  }

  return db.$executeRaw(Prisma.sql`
    INSERT INTO "AuditLog" ("userName", "action", "target", "category", "type")
    VALUES (
      ${entry.userName},
      ${entry.action},
      ${entry.target},
      ${entry.category ?? "GENERAL"},
      ${entry.type}
    )
  `);
};
