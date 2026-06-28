CREATE TABLE "Pph21Recipient" (
    "id" SERIAL NOT NULL,
    "nik" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultTaxObjectCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Pph21Recipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Pph21Batch" (
    "id" SERIAL NOT NULL,
    "recordId" INTEGER NOT NULL,
    "withholdingDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "issueNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Pph21Batch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Pph21Withholding" (
    "id" SERIAL NOT NULL,
    "batchId" INTEGER NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "recipientName" TEXT NOT NULL,
    "taxObjectCode" TEXT NOT NULL,
    "gross" DOUBLE PRECISION NOT NULL,
    "deemed" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "calculatedTax" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Pph21Withholding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Pph21Export" (
    "id" SERIAL NOT NULL,
    "fileName" TEXT NOT NULL,
    "exportedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pph21Export_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Pph21ExportItem" (
    "id" SERIAL NOT NULL,
    "exportId" INTEGER NOT NULL,
    "batchId" INTEGER NOT NULL,
    CONSTRAINT "Pph21ExportItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Pph21Recipient_nik_key" ON "Pph21Recipient"("nik");
CREATE INDEX "Pph21Recipient_name_idx" ON "Pph21Recipient"("name");
CREATE UNIQUE INDEX "Pph21Batch_recordId_key" ON "Pph21Batch"("recordId");
CREATE INDEX "Pph21Batch_status_idx" ON "Pph21Batch"("status");
CREATE INDEX "Pph21Withholding_batchId_idx" ON "Pph21Withholding"("batchId");
CREATE INDEX "Pph21Withholding_recipientId_idx" ON "Pph21Withholding"("recipientId");
CREATE UNIQUE INDEX "Pph21ExportItem_exportId_batchId_key" ON "Pph21ExportItem"("exportId", "batchId");
CREATE INDEX "Pph21ExportItem_batchId_idx" ON "Pph21ExportItem"("batchId");

ALTER TABLE "Pph21Batch" ADD CONSTRAINT "Pph21Batch_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "SPMRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Pph21Withholding" ADD CONSTRAINT "Pph21Withholding_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Pph21Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Pph21Withholding" ADD CONSTRAINT "Pph21Withholding_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Pph21Recipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pph21Export" ADD CONSTRAINT "Pph21Export_exportedById_fkey" FOREIGN KEY ("exportedById") REFERENCES "Colleague"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Pph21ExportItem" ADD CONSTRAINT "Pph21ExportItem_exportId_fkey" FOREIGN KEY ("exportId") REFERENCES "Pph21Export"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Pph21ExportItem" ADD CONSTRAINT "Pph21ExportItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Pph21Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
