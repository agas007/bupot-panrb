ALTER TABLE "SPMRecord"
ADD COLUMN IF NOT EXISTS "archiveStatus" TEXT NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX IF NOT EXISTS "SPMRecord_archiveStatus_idx" ON "SPMRecord"("archiveStatus");
