#!/bin/bash
# Cron wrapper for backup-db.sh
# Loads DB_PASSWORD from the app's .env then runs the backup.
# Logs to /home/deploy/backups/backup.log
set -euo pipefail

ENV_FILE="/home/deploy/apps/yugioh/server/.env"
BACKUP_SCRIPT="/home/deploy/apps/yugioh/server/scripts/backup-db.sh"
LOG_FILE="/home/deploy/backups/backup.log"

mkdir -p "$(dirname "$LOG_FILE")"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[$(date -Iseconds)] ERROR: $ENV_FILE not found" >> "$LOG_FILE"
  exit 1
fi

# Extract DB_PASSWORD from .env
DB_PASSWORD=$(grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
export DB_PASSWORD

# Run backup, append output to log
bash "$BACKUP_SCRIPT" >> "$LOG_FILE" 2>&1
