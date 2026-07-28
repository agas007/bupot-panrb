CREATE TABLE "ArchivePolicy" (
    "id" SERIAL NOT NULL,
    "dataType" TEXT NOT NULL,
    "retentionYears" INTEGER NOT NULL,
    "inactivePeriod" INTEGER NOT NULL,
    "disposalMethod" TEXT NOT NULL DEFAULT 'SOFT_DELETE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ArchivePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArchivedRecord" (
    "id" SERIAL NOT NULL,
    "originalId" INTEGER NOT NULL,
    "dataType" TEXT NOT NULL,
    "archivedData" JSONB NOT NULL,
    "archivedById" INTEGER,
    "spmNumber" TEXT,
    "spmRecordId" INTEGER,
    "archiveStatus" TEXT NOT NULL DEFAULT 'ARCHIVED',
    "disposalScheduledDate" TIMESTAMP(3),
    "disposalScheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ArchivedRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArchiveAccessLog" (
    "id" SERIAL NOT NULL,
    "archivedRecordId" INTEGER NOT NULL,
    "accessedById" INTEGER NOT NULL,
    "accessType" TEXT NOT NULL,
    "reason" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArchiveAccessLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DisposalApproval" (
    "id" SERIAL NOT NULL,
    "archivedRecordId" INTEGER NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "approvedById" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "disposalMethod" TEXT NOT NULL DEFAULT 'SOFT_DELETE',
    "approvalDate" TIMESTAMP(3),
    "disposalExecutedAt" TIMESTAMP(3),
    "reason" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DisposalApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArchiveDossier" (
    "id" SERIAL NOT NULL,
    "dossierIndex" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "period" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'STORED',
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ArchiveDossier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArchiveDossierAttachment" (
    "id" SERIAL NOT NULL,
    "dossierId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "uploadedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArchiveDossierAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArchivePolicy_dataType_key" ON "ArchivePolicy"("dataType");
CREATE UNIQUE INDEX "ArchivedRecord_spmRecordId_key" ON "ArchivedRecord"("spmRecordId");
CREATE INDEX "ArchivedRecord_dataType_idx" ON "ArchivedRecord"("dataType");
CREATE INDEX "ArchivedRecord_spmNumber_idx" ON "ArchivedRecord"("spmNumber");
CREATE INDEX "ArchivedRecord_archiveStatus_idx" ON "ArchivedRecord"("archiveStatus");
CREATE INDEX "ArchivedRecord_originalId_idx" ON "ArchivedRecord"("originalId");
CREATE UNIQUE INDEX "ArchivedRecord_originalId_dataType_key" ON "ArchivedRecord"("originalId", "dataType");
CREATE INDEX "ArchiveAccessLog_archivedRecordId_idx" ON "ArchiveAccessLog"("archivedRecordId");
CREATE INDEX "ArchiveAccessLog_accessedById_idx" ON "ArchiveAccessLog"("accessedById");
CREATE INDEX "ArchiveAccessLog_createdAt_idx" ON "ArchiveAccessLog"("createdAt");
CREATE UNIQUE INDEX "DisposalApproval_archivedRecordId_key" ON "DisposalApproval"("archivedRecordId");
CREATE INDEX "DisposalApproval_status_idx" ON "DisposalApproval"("status");
CREATE INDEX "DisposalApproval_archivedRecordId_idx" ON "DisposalApproval"("archivedRecordId");
CREATE INDEX "DisposalApproval_createdAt_idx" ON "DisposalApproval"("createdAt");
CREATE UNIQUE INDEX "ArchiveDossier_dossierIndex_key" ON "ArchiveDossier"("dossierIndex");
CREATE INDEX "ArchiveDossier_dossierIndex_idx" ON "ArchiveDossier"("dossierIndex");
CREATE INDEX "ArchiveDossier_status_idx" ON "ArchiveDossier"("status");
CREATE INDEX "ArchiveDossier_createdAt_idx" ON "ArchiveDossier"("createdAt");
CREATE INDEX "ArchiveDossierAttachment_dossierId_idx" ON "ArchiveDossierAttachment"("dossierId");
CREATE INDEX "ArchiveDossierAttachment_createdAt_idx" ON "ArchiveDossierAttachment"("createdAt");

ALTER TABLE "ArchivedRecord" ADD CONSTRAINT "ArchivedRecord_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "Colleague"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ArchivedRecord" ADD CONSTRAINT "ArchivedRecord_spmRecordId_fkey" FOREIGN KEY ("spmRecordId") REFERENCES "SPMRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchiveAccessLog" ADD CONSTRAINT "ArchiveAccessLog_archivedRecordId_fkey" FOREIGN KEY ("archivedRecordId") REFERENCES "ArchivedRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchiveAccessLog" ADD CONSTRAINT "ArchiveAccessLog_accessedById_fkey" FOREIGN KEY ("accessedById") REFERENCES "Colleague"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DisposalApproval" ADD CONSTRAINT "DisposalApproval_archivedRecordId_fkey" FOREIGN KEY ("archivedRecordId") REFERENCES "ArchivedRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DisposalApproval" ADD CONSTRAINT "DisposalApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Colleague"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DisposalApproval" ADD CONSTRAINT "DisposalApproval_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Colleague"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ArchiveDossier" ADD CONSTRAINT "ArchiveDossier_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Colleague"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ArchiveDossierAttachment" ADD CONSTRAINT "ArchiveDossierAttachment_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "ArchiveDossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchiveDossierAttachment" ADD CONSTRAINT "ArchiveDossierAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Colleague"("id") ON DELETE SET NULL ON UPDATE CASCADE;
