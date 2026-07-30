#!/bin/bash
# Automated PostgreSQL backup with 7-day retention.
# Run daily via cron. See DEPLOYMENT.md for setup.
set -euo pipefail

# ----- Config -----
DB_NAME="yugioh_collection"
DB_USER="yugioh"
BACKUP_DIR="/home/deploy/backups"
RETENTION_DAYS=7

# DB_PASSWORD must be exported before calling this script
# (loaded from /home/deploy/apps/yugioh/server/.env via the cron wrapper)
if [[ -z "${DB_PASSWORD:-}" ]]; then
  echo "ERROR: DB_PASSWORD env var must be set" >&2
  exit 1
fi

# ----- Setup -----
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

# ----- Dump + gzip -----
echo "[$(date -Iseconds)] Backing up ${DB_NAME} → ${BACKUP_FILE}"
PGPASSWORD="$DB_PASSWORD" pg_dump \
  --host=localhost \
  --username="$DB_USER" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  "$DB_NAME" | gzip > "$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date -Iseconds)] Backup done: $SIZE"

# ----- Purge old backups (> RETENTION_DAYS) -----
DELETED=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete -print | wc -l)
if [[ "$DELETED" -gt 0 ]]; then
  echo "[$(date -Iseconds)] Purged $DELETED backup(s) older than ${RETENTION_DAYS} days"
fi

# ----- Summary -----
KEPT=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f | wc -l)
TOTAL=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
echo "[$(date -Iseconds)] $KEPT backup(s) kept, total ${TOTAL:-0}"
