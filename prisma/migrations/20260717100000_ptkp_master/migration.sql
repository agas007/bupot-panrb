CREATE TABLE "Pph21RecipientPtkp" (
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

CREATE UNIQUE INDEX "Pph21RecipientPtkp_nik_taxYear_key" ON "Pph21RecipientPtkp"("nik", "taxYear");
CREATE INDEX "Pph21RecipientPtkp_nik_idx" ON "Pph21RecipientPtkp"("nik");
CREATE INDEX "Pph21RecipientPtkp_taxYear_idx" ON "Pph21RecipientPtkp"("taxYear");
CREATE INDEX "Pph21RecipientPtkp_statusPtkp_idx" ON "Pph21RecipientPtkp"("statusPtkp");
