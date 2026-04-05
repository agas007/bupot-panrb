import { PrismaClient } from "@prisma/client";

const getPrismaClient = () => {
  return new PrismaClient({
    log: ["error"],
  });
};

const _global = globalThis as unknown as { prisma: any | undefined };

// Detect if we have the new models and properties
if (_global.prisma && (!("auditLog" in _global.prisma) || !("colleague" in _global.prisma))) {
  console.log("[Prisma Log] Stale instance detected (missing models), re-initializing client...");
  _global.prisma = undefined;
}

export const prisma = _global.prisma || getPrismaClient();

if (process.env.NODE_ENV !== "production") _global.prisma = prisma;
