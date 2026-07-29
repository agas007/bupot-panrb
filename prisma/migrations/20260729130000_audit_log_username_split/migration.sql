ALTER TABLE "AuditLog" ADD COLUMN "username" TEXT;

UPDATE "AuditLog"
SET "username" = "userName";

UPDATE "AuditLog" AS a
SET "username" = c."username"
FROM "Colleague" AS c
WHERE a."userName" = c."name";

UPDATE "AuditLog"
SET "username" = COALESCE("username", "userName");

ALTER TABLE "AuditLog" ALTER COLUMN "username" SET NOT NULL;
