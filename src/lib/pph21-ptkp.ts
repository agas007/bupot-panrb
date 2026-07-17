import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

let ensurePtkpTablePromise: Promise<void> | null = null;

export function ensurePph21RecipientPtkpTable() {
  if (!ensurePtkpTablePromise) {
    ensurePtkpTablePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Pph21RecipientPtkp" (
          "id" SERIAL NOT NULL,
          "nik" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "taxYear" INTEGER NOT NULL,
          "statusPtkp" TEXT NOT NULL,
          "category" TEXT,
          "sourceData" TEXT,
          "note" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "Pph21RecipientPtkp_pkey" PRIMARY KEY ("id")
        );
      `);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Pph21RecipientPtkp_nik_taxYear_key" ON "Pph21RecipientPtkp"("nik", "taxYear");`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Pph21RecipientPtkp_nik_idx" ON "Pph21RecipientPtkp"("nik");`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Pph21RecipientPtkp_taxYear_idx" ON "Pph21RecipientPtkp"("taxYear");`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Pph21RecipientPtkp_statusPtkp_idx" ON "Pph21RecipientPtkp"("statusPtkp");`);
    })().catch((error) => {
      ensurePtkpTablePromise = null;
      throw error;
    });
  }
  return ensurePtkpTablePromise;
}

export function isMissingPtkpTableError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
}
