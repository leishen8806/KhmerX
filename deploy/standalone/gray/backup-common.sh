#!/usr/bin/env bash
# shellcheck disable=SC2034
set -Eeuo pipefail
set +x
umask 077
log() { printf '[gray-backup] %s\n' "$*"; }
fail() { log "FAIL $*" >&2; exit 1; }
config=${BACKUP_ENV_FILE:-/opt/payease/backup.env}
[[ -f "$config" && $(stat -c %a "$config") == 600 && $(stat -c %u "$config") == 0 ]] || fail 'backup.env must be root-owned mode 600'
set -a
# shellcheck disable=SC1090
source "$config"
set +a
: "${SPACES_BUCKET:?}" "${SPACES_ENDPOINT:?}" "${SPACES_REGION:?}" "${SOURCE_REGION:?}" "${SPACES_ACCESS_KEY_ID:?}" "${SPACES_SECRET_ACCESS_KEY:?}"
[[ "$SPACES_REGION" != "$SOURCE_REGION" ]] || fail 'backup region must differ from source'
[[ "$SPACES_REGION" =~ ^[a-z]+[0-9]+$ && "$SPACES_ENDPOINT" == "https://$SPACES_REGION.digitaloceanspaces.com" ]] || fail 'invalid Spaces endpoint'
[[ "$SPACES_BUCKET" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] || fail 'invalid bucket'
export RCLONE_CONFIG_KHMERX_TYPE=s3 RCLONE_CONFIG_KHMERX_PROVIDER=DigitalOcean RCLONE_CONFIG_KHMERX_ACL=private RCLONE_CONFIG_KHMERX_NO_CHECK_BUCKET=true
export RCLONE_CONFIG_KHMERX_ENDPOINT="$SPACES_ENDPOINT" RCLONE_CONFIG_KHMERX_ACCESS_KEY_ID="$SPACES_ACCESS_KEY_ID" RCLONE_CONFIG_KHMERX_SECRET_ACCESS_KEY="$SPACES_SECRET_ACCESS_KEY"
remote="khmerx:$SPACES_BUCKET/khmerx-gray"
data=${DATA_DIR:-/opt/payease/data}
compose=${BACKUP_COMPOSE:-/opt/payease/app/deploy/standalone/gray/compose.gray.yaml}
daily_keep=${DAILY_KEEP:-7}; weekly_keep=${WEEKLY_KEEP:-4}
[[ "$daily_keep" =~ ^[1-9][0-9]*$ && "$weekly_keep" =~ ^[1-9][0-9]*$ ]] || fail 'invalid retention counts'
validate_snapshot() {
  local directory=$1 file tables latest count=0
  (cd "$directory" && sha256sum --quiet -c SHA256SUMS) || fail 'checksum mismatch'
  while IFS= read -r -d '' file; do
    [[ $(sqlite3 "$file" 'PRAGMA integrity_check;') == ok ]] || fail 'SQLite integrity failed'
    tables=$(sqlite3 "$file" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    [[ "$tables" -gt 0 ]] || fail 'SQLite has no tables'
    latest=unavailable
    local table stamp
    for table in customer_workspaces kyc_cases; do
      if [[ $(sqlite3 "$file" "SELECT COUNT(*) FROM sqlite_master WHERE name='$table';") == 1 ]]; then
        stamp=$(sqlite3 "$file" "SELECT MAX(updated_at) FROM $table;")
        if [[ -n "$stamp" && ( "$latest" == unavailable || "$stamp" > "$latest" ) ]]; then latest=$stamp; fi
      fi
    done
    log "OK SQLite tables=$tables latest_timestamp=${latest:-empty}"; count=$((count+1))
  done < <(find "$directory/data" -type f \( -name '*.sqlite' -o -name '*.sqlite3' -o -name '*.db' \) -print0)
  [[ "$count" -gt 0 ]] || fail 'no SQLite databases restored'
}
