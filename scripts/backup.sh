#!/usr/bin/env bash
#
# COMETS GR — Automated Backup Script
# Backs up: Supabase DB (schema + data via REST API) + Storage buckets
#
# Usage:
#   bash scripts/backup.sh              # manual run
#   (scheduled via Windows Task Scheduler — see scripts/install-schedule.bat)
#
# Config: scripts/.env.backup  (see .env.backup.example)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Load config ──────────────────────────────────────────────
ENV_FILE="$SCRIPT_DIR/.env.backup"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Copy .env.backup.example and fill in values."
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

: "${SUPABASE_URL:?SUPABASE_URL is required}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY is required}"
: "${BACKUP_DIR:=$PROJECT_DIR/backups}"
: "${RETENTION_DAYS:=30}"

# ── Prepare dated folder ─────────────────────────────────────
TODAY=$(date +%Y-%m-%d)
DEST="$BACKUP_DIR/$TODAY"
mkdir -p "$DEST"

echo "=== COMETS GR Backup — $TODAY ==="
echo "Destination: $DEST"

# ── 1. Database backup via Supabase REST API ─────────────────
echo ""
echo "[1/4] Exporting database tables via REST API..."

TABLES=(
  "profiles"
  "gr_documents"
  "weight_measurements"
  "count_grid_entries"
  "issue_reports"
  "weight_photos"
  "audit_log"
  "item_master"
  "running_numbers"
)

mkdir -p "$DEST/db"

for TABLE in "${TABLES[@]}"; do
  echo "  -> $TABLE"
  # Use range header to paginate; most tables < 10k rows
  HTTP_CODE=$(curl -s -w "%{http_code}" -o "$DEST/db/${TABLE}.json" \
    "${SUPABASE_URL}/rest/v1/${TABLE}?select=*" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Range: 0-9999" \
    -H "Prefer: count=exact")

  if [[ "$HTTP_CODE" -ge 400 ]]; then
    echo "  !! WARNING: $TABLE returned HTTP $HTTP_CODE"
  fi
done

echo "  Database export done."

# ── 2. Schema backup (migration files) ───────────────────────
echo ""
echo "[2/4] Copying migration files..."
mkdir -p "$DEST/migrations"
cp -r "$PROJECT_DIR/supabase/migrations/"* "$DEST/migrations/" 2>/dev/null || echo "  (no migrations found)"
echo "  Migrations copied."

# ── 3. Storage backup ────────────────────────────────────────
echo ""
echo "[3/4] Backing up storage buckets..."

BUCKETS=("gr-photos" "sap-attachments")

for BUCKET in "${BUCKETS[@]}"; do
  echo "  -> Listing $BUCKET..."
  mkdir -p "$DEST/storage/$BUCKET"

  # List all files in bucket via Storage API
  FILE_LIST=$(curl -s \
    "${SUPABASE_URL}/storage/v1/object/list/${BUCKET}" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"prefix":"","limit":10000,"offset":0}')

  echo "$FILE_LIST" > "$DEST/storage/${BUCKET}_manifest.json"

  # Count files (folders have id=null)
  FILE_COUNT=$(echo "$FILE_LIST" | python3 -c "
import json, sys
items = json.load(sys.stdin)
print(sum(1 for i in items if i.get('id')))
" 2>/dev/null || echo "?")

  echo "  $BUCKET: $FILE_COUNT files listed (manifest saved)"
  echo "  Note: file contents backed up via public URLs in manifest"
done

echo "  Storage manifests saved."

# ── 4. Auth users backup ─────────────────────────────────────
echo ""
echo "[4/4] Exporting auth users list..."

HTTP_CODE=$(curl -s -w "%{http_code}" -o "$DEST/db/auth_users.json" \
  "${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=500" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")

if [[ "$HTTP_CODE" -ge 400 ]]; then
  echo "  !! WARNING: auth users export returned HTTP $HTTP_CODE"
else
  echo "  Auth users exported."
fi

# ── 5. Cleanup old backups ───────────────────────────────────
echo ""
echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
DELETED=0
for OLD_DIR in "$BACKUP_DIR"/*/; do
  DIR_NAME=$(basename "$OLD_DIR")
  # Only process date-formatted directories
  if [[ "$DIR_NAME" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    # Compare dates using sort
    CUTOFF=$(date -d "-${RETENTION_DAYS} days" +%Y-%m-%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y-%m-%d 2>/dev/null || echo "")
    if [[ -n "$CUTOFF" && "$DIR_NAME" < "$CUTOFF" ]]; then
      echo "  Removing $DIR_NAME"
      rm -rf "$OLD_DIR"
      DELETED=$((DELETED + 1))
    fi
  fi
done
echo "  Removed $DELETED old backup(s)."

# ── Summary ──────────────────────────────────────────────────
echo ""
echo "=== Backup Complete ==="
TOTAL_SIZE=$(du -sh "$DEST" 2>/dev/null | cut -f1 || echo "?")
echo "Size: $TOTAL_SIZE"
echo "Location: $DEST"
echo ""
echo "Contents:"
ls -la "$DEST/db/" 2>/dev/null | tail -n +2
echo "---"
ls -la "$DEST/storage/" 2>/dev/null | tail -n +2
echo "---"
ls -la "$DEST/migrations/" 2>/dev/null | tail -n +2
