#!/usr/bin/env bash
set -Eeuo pipefail

# Required at runtime:
#   BACKUP_DATABASE_URL or DATABASE_URL
#   rclone remote named "nextcloud" (or BACKUP_REMOTE override)
#
# The script intentionally uses copy, not move: a remote outage must not
# destroy the only local copy before the transfer has been verified.

BACKUP_DIR="${BACKUP_DIR:-/var/backups/bupot}"
BACKUP_REMOTE="${BACKUP_REMOTE:-nextcloud:Backups/postgres}"
LOCAL_RETENTION_DAYS="${LOCAL_RETENTION_DAYS:-3}"
REMOTE_RETENTION_DAYS="${REMOTE_RETENTION_DAYS:-30}"
DATABASE_URL="${BACKUP_DATABASE_URL:-${DATABASE_URL:-}}"
RCLONE_TIMEOUT="${RCLONE_TIMEOUT:-30s}"
RCLONE_RETRIES="${RCLONE_RETRIES:-3}"

# Prisma commonly appends `schema=public`; libpq/pg_dump does not accept that
# Prisma-only query parameter, so remove it before invoking pg_dump.
DATABASE_URL_FOR_DUMP="$(printf '%s' "$DATABASE_URL" | sed -E \
  's/\?schema=[^&]*&/?/; s/&schema=[^&]*//; s/\?schema=[^&]*//; s/\?&/?/; s/[?&]$//')"

if [[ -z "$DATABASE_URL" ]]; then
  echo "BACKUP_DATABASE_URL or DATABASE_URL is required" >&2
  exit 1
fi

command -v pg_dump >/dev/null || { echo "pg_dump is required" >&2; exit 1; }
command -v rclone >/dev/null || { echo "rclone is required" >&2; exit 1; }

umask 077
mkdir -p "$BACKUP_DIR"

timestamp="$(date +%F_%H%M)"
filename="bupotdb_${timestamp}.sql.gz"
temporary_path="$BACKUP_DIR/.${filename}.tmp"
local_path="$BACKUP_DIR/$filename"
remote_path="$BACKUP_REMOTE/$filename"

cleanup() {
  rm -f "$temporary_path"
}
trap cleanup EXIT

echo "[$(date -Is)] Creating $local_path"
pg_dump "$DATABASE_URL_FOR_DUMP" | gzip -c > "$temporary_path"
gzip -t "$temporary_path"
mv "$temporary_path" "$local_path"

echo "[$(date -Is)] Uploading $filename to $BACKUP_REMOTE"
rclone copyto "$local_path" "$remote_path" \
  --timeout "$RCLONE_TIMEOUT" \
  --retries "$RCLONE_RETRIES" \
  --low-level-retries "$RCLONE_RETRIES"

echo "[$(date -Is)] Verifying remote object $filename"
rclone lsf "$BACKUP_REMOTE" \
  --files-only \
  --max-depth 1 \
  --timeout "$RCLONE_TIMEOUT" \
  --retries "$RCLONE_RETRIES" \
  | grep -Fx -- "$filename" >/dev/null

echo "[$(date -Is)] Cleaning local backups older than ${LOCAL_RETENTION_DAYS} days"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'bupotdb_*.sql.gz' \
  -mtime "+$LOCAL_RETENTION_DAYS" -delete

echo "[$(date -Is)] Cleaning remote backups older than ${REMOTE_RETENTION_DAYS} days"
rclone delete "$BACKUP_REMOTE" \
  --min-age "${REMOTE_RETENTION_DAYS}d" \
  --rmdirs \
  --timeout "$RCLONE_TIMEOUT" \
  --retries "$RCLONE_RETRIES" \
  --low-level-retries "$RCLONE_RETRIES" \
  --quiet

echo "[$(date -Is)] Backup completed: $filename"
