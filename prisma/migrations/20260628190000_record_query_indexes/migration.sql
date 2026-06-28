CREATE INDEX IF NOT EXISTS "SPMRecord_accountCode_sp2dDate_idx" ON "SPMRecord"("accountCode", "sp2dDate");
CREATE INDEX IF NOT EXISTS "SPMRecord_sp2dNumber_idx" ON "SPMRecord"("sp2dNumber");
CREATE INDEX IF NOT EXISTS "SPMRecord_status_idx" ON "SPMRecord"("status");
CREATE INDEX IF NOT EXISTS "SPMRecord_assigneeId_idx" ON "SPMRecord"("assigneeId");
