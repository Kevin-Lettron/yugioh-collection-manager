#!/bin/bash
# Restore a PostgreSQL backup from a .sql.gz file.
# Usage: sudo bash restore-db.sh /path/to/backup.sql.gz
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  echo "Example: $0 /home/deploy/backups/yugioh_collection_2026-04-21_03-00-00.sql.gz"
  echo ""
  echo "Available backups:"
  ls -lh /home/deploy/backups/*.sql.gz 2>/dev/null || echo "  (none)"
  exit 1
fi

BACKUP_FILE="$1"
if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "ERROR: backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

DB_NAME="yugioh_collection"
DB_USER="yugioh"

# Load DB_PASSWORD from .env
ENV_FILE="/home/deploy/apps/yugioh/server/.env"
DB_PASSWORD=$(grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")

echo "⚠️  This will REPLACE the current DB '$DB_NAME' with the backup."
echo "    Backup: $BACKUP_FILE"
read -p "    Type 'yes' to proceed: " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

echo "→ Stopping the API to release DB connections..."
pm2 stop yugioh-api || true

echo "→ Restoring backup..."
gunzip -c "$BACKUP_FILE" | PGPASSWORD="$DB_PASSWORD" psql \
  --host=localhost \
  --username="$DB_USER" \
  --dbname="$DB_NAME"

echo "→ Restarting API..."
pm2 start yugioh-api

echo "✅ Restore done."
