#!/usr/bin/env bash
set -Eeuo pipefail
set +x
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=deploy/standalone/gray/backup-common.sh
source "$script_dir/backup-common.sh"
case "${1:---dry-run}" in
 --dry-run) log 'DRY RUN: snapshot data with app paused, upload to private off-region Spaces, then retain daily/weekly copies'; exit 0 ;;
 --apply) ;;
 *) fail 'usage: backup.sh [--dry-run|--apply]' ;;
esac
exec 9>/run/lock/khmerx-gray-backup.lock
flock -n 9 || fail 'another backup is running'
stage=$(mktemp -d /tmp/khmerx-backup.XXXXXXXX); paused=false
finish() {
  local code=$?
  trap - EXIT
  if "$paused"; then docker compose -f "$compose" start payease >/dev/null || code=1; fi
  [[ "$stage" == /tmp/khmerx-backup.* ]] && rm -rf -- "$stage"
  if [[ "$code" != 0 ]]; then log 'FAIL snapshot/upload/retention; inspect service and remote permissions' >&2; else log 'OK backup complete'; fi
  exit "$code"
}
trap finish EXIT
[[ -d "$data" && ! -L "$data" ]] || fail 'invalid data directory'
[[ -z $(find "$data" -type l -print -quit) ]] || fail 'symlinks are not supported in backup data'
date_id=$(date -u +%F); destination="$remote/daily/$date_id"
if rclone cat "$destination/COMPLETE" >/dev/null 2>&1; then log 'OK existing completed daily snapshot; no overwrite'; else
running=$(docker compose -f "$compose" ps --status running --services payease) || fail 'cannot determine app state'
if [[ "$running" == payease ]]; then paused=true; docker compose -f "$compose" stop payease >/dev/null;
elif [[ $(docker compose -f "$compose" ps --all --format '{{.State}}' payease) != exited ]]; then fail 'app must be running or confirmed stopped'; fi
mkdir "$stage/data"
cp -a -- "$data/." "$stage/data/"
count=0
while IFS= read -r -d '' file; do
  relative=${file#"$data/"}
  [[ "$relative" =~ ^[a-zA-Z0-9_./-]+$ && "$relative" != *..* ]] || fail 'unsupported database filename'
  target="$stage/data/$relative"
  rm -f -- "$target-wal" "$target-shm"
  sqlite3 "$file" ".backup '$target'"
  count=$((count+1))
done < <(find "$data" -type f \( -name '*.sqlite' -o -name '*.sqlite3' -o -name '*.db' \) -print0)
[[ "$count" -gt 0 ]] || fail 'no SQLite databases found'
if "$paused"; then docker compose -f "$compose" start payease >/dev/null; paused=false; fi
(cd "$stage" && find data -type f -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)
validate_snapshot "$stage"
rclone sync "$stage/" "$destination/" --exclude COMPLETE
rclone check "$stage/" "$destination/" --download --exclude COMPLETE
printf '%s\n' "$date_id" > "$stage/COMPLETE"
rclone copyto "$stage/COMPLETE" "$destination/COMPLETE"
fi
if [[ $(date -u +%u) == 7 ]]; then
  rclone sync "$destination/" "$remote/weekly/$date_id/" --exclude COMPLETE
  rclone check "$destination/" "$remote/weekly/$date_id/" --download --exclude COMPLETE
  rclone copyto "$destination/COMPLETE" "$remote/weekly/$date_id/COMPLETE"
fi
prune() {
  local tier=$1 keep=$2 entry index=0 listing
  listing=$(rclone lsf "$remote/$tier/" --dirs-only)
  while IFS= read -r entry; do
    [[ "$entry" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}/$ ]] || continue
    rclone cat "$remote/$tier/${entry}COMPLETE" >/dev/null 2>&1 || continue
    index=$((index+1)); if (( index > keep )); then rclone purge "$remote/$tier/$entry"; fi
  done < <(printf '%s\n' "$listing" | sort -r)
}
prune daily "$daily_keep"
if [[ $(date -u +%u) == 7 ]]; then prune weekly "$weekly_keep"; fi
