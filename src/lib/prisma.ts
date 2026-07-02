import { PrismaClient } from "@prisma/client";

export const isPrismaConnectionError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Can't reach database server") ||
    error.message.includes("The table does not exist") ||
    error.message.includes("P1001") ||
    error.message.includes("P1017")
  );
};

const getPrismaClient = () => {
  return new PrismaClient({
    log: ["error"],
  });
};

const _global = globalThis as unknown as { prisma: PrismaClient | undefined };

// Detect if we have the new models and properties
if (_global.prisma && (!("auditLog" in _global.prisma) || !("colleague" in _global.prisma))) {
  console.log("[Prisma Log] Stale instance detected (missing models), re-initializing client...");
  _global.prisma = undefined;
}

export const prisma = _global.prisma || getPrismaClient();

if (process.env.NODE_ENV !== "production") _global.prisma = prisma;
