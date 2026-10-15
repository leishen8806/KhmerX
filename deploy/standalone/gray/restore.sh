#!/usr/bin/env bash
set -Eeuo pipefail
set +x
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=deploy/standalone/gray/backup-common.sh
source "$script_dir/backup-common.sh"
date_id=${1:-}; tier=${BACKUP_TIER:-daily}
[[ "$date_id" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ && "$tier" =~ ^(daily|weekly)$ ]] || fail 'usage: restore.sh YYYY-MM-DD [--dry-run|--apply]'
case "${2:---dry-run}" in
 --dry-run) log 'DRY RUN: download selected snapshot to a new temporary directory, verify checksums and SQLite; no live data replacement'; exit 0 ;;
 --apply) ;;
 *) fail 'invalid restore option' ;;
esac
destination=$(mktemp -d /tmp/khmerx-restore.XXXXXXXX)
finish() { local code=$?; if [[ "$code" != 0 ]]; then log 'FAIL restore validation; temporary directory retained for inspection' >&2; fi; }
trap finish EXIT
[[ $(rclone cat "$remote/$tier/$date_id/COMPLETE") == "$date_id" ]] || fail 'snapshot incomplete or date mismatch'
rclone copy "$remote/$tier/$date_id/" "$destination/"
validate_snapshot "$destination"
log "OK restore drill; reviewed data available at $destination/data; live data untouched"
