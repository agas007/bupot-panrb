import { PrismaClient } from "@prisma/client";

export const isPrismaConnectionError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("P1000") ||
    error.message.includes("Can't reach database server") ||
    error.message.includes("P1002") ||
    error.message.includes("P1003") ||
    error.message.includes("P1001") ||
    error.message.includes("P1008") ||
    error.message.includes("P1017")
  );
};

export const getPrismaDatabaseErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) return null;

  if (
    error.message.includes("P1000") ||
    error.message.includes("Can't reach database server") ||
    error.message.includes("P1002") ||
    error.message.includes("P1003") ||
    error.message.includes("P1001") ||
    error.message.includes("P1008") ||
    error.message.includes("P1017")
  ) {
    return "Database tidak terhubung. Cek DATABASE_URL dan koneksi ke server DB dulu.";
  }

  if (error.message.includes("The table does not exist") || error.message.includes("P2021")) {
    return "Database terhubung, tapi schema/tabel belum lengkap. Jalankan migration Prisma di production dulu.";
  }

  return null;
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
