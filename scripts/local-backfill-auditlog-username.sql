ALTER TABLE "AuditLog"
ADD COLUMN IF NOT EXISTS "username" TEXT;

UPDATE "AuditLog" AS a
SET "username" = COALESCE(a."username", a."userName", c."username")
FROM "Colleague" AS c
WHERE a."username" IS NULL
  AND a."userName" = c."name";

UPDATE "AuditLog"
SET "username" = COALESCE("username", "userName")
WHERE "username" IS NULL;

ALTER TABLE "AuditLog"
ALTER COLUMN "username" SET NOT NULL;
