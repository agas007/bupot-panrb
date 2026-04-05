import { PrismaClient } from "@prisma/client";

const getPrismaClient = () => {
  return new PrismaClient({
    log: ["error"],
  });
};

const _global = globalThis as unknown as { prisma: PrismaClient | undefined };

// If the existing global prisma instance doesn't have the 'auditLog' property
// it means it's a stale instance from before the model was added.
if (_global.prisma && !("auditLog" in _global.prisma)) {
  console.log("[Prisma Log] Stale instance detected, re-initializing client...");
  _global.prisma = undefined;
}

export const prisma = _global.prisma || getPrismaClient();

if (process.env.NODE_ENV !== "production") _global.prisma = prisma;
