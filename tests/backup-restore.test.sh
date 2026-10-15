#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
root=$(mktemp -d /tmp/khmerx-backup-test.XXXXXXXX)
trap 'rm -rf -- "$root"' EXIT
export TEST_ROOT="$root" TEST_REMOTE="$root/remote" BACKUP_ENV_FILE="$root/backup.env"
mkdir -p "$root/bin" "$root/data/d1" "$root/data/r2" "$root/remote" /run/lock
cat > "$root/backup.env" <<EOF
SPACES_BUCKET=synthetic-backup
SPACES_REGION=nyc3
SOURCE_REGION=sgp1
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
SPACES_ACCESS_KEY_ID=synthetic-access
SPACES_SECRET_ACCESS_KEY=synthetic-secret
DATA_DIR=$root/data
BACKUP_COMPOSE=$root/compose.yaml
EOF
chmod 600 "$root/backup.env"
cat > "$root/bin/docker" <<'EOF'
#!/usr/bin/env bash
set -eu
printf '%s\n' "$*" >> "$TEST_ROOT/docker.log"
case "$*" in *' ps '*) printf 'payease\n';; *' stop '*) printf paused > "$TEST_ROOT/status";; *' start '*) printf running > "$TEST_ROOT/status";; esac
EOF
cat > "$root/bin/date" <<'EOF'
#!/usr/bin/env bash
if [[ "$*" == '-u +%u' ]]; then printf '7\n'; else /bin/date "$@"; fi
EOF
cat > "$root/bin/rclone" <<'EOF'
#!/usr/bin/env bash
set -eu
map_path() { local value=$1; if [[ "$value" == khmerx:* ]]; then printf '%s/%s' "$TEST_REMOTE" "${value#khmerx:}"; else printf '%s' "$value"; fi; }
action=$1; shift
printf '%s\n' "$action" >> "$TEST_ROOT/rclone.log"
source_path=$(map_path "${1:-}"); destination=$(map_path "${2:-}")
case "$action" in
 cat) cat "$source_path" ;;
 lsf) [[ -d "$source_path" ]] || exit 0; for item in "$source_path"/*/; do [[ -d "$item" ]] && printf '%s/\n' "$(basename "$item")"; done; exit 0 ;;
 copy|sync) mkdir -p "$destination"; cp -a "$source_path/." "$destination/" ;;
 copyto) [[ ${TEST_FAIL_COMPLETE:-0} != 1 ]] || exit 1; mkdir -p "$(dirname "$destination")"; cp "$source_path" "$destination" ;;
 check) diff -r --exclude=COMPLETE "$source_path" "$destination" ;;
 purge) [[ "$source_path" == "$TEST_REMOTE/"* ]] || exit 2; rm -rf -- "$source_path" ;;
 *) exit 2 ;;
esac
EOF
chmod +x "$root/bin/"*
export PATH="$root/bin:$PATH"
sqlite3 "$root/data/d1/main.sqlite" "PRAGMA journal_mode=WAL; CREATE TABLE customer_workspaces(updated_at TEXT); INSERT INTO customer_workspaces VALUES('2026-10-15T00:00:00Z');" >/dev/null
sqlite3 "$root/data/r2/meta.sqlite" 'CREATE TABLE objects(id TEXT);'
printf 'synthetic encrypted object' > "$root/data/r2/blob"
scripts=deploy/standalone/gray
bash "$scripts/backup.sh" >/dev/null
[[ ! -e "$root/docker.log" && ! -e "$root/rclone.log" ]]
for tier in daily weekly; do for day in 01 02 03 04 05 06 07 08; do directory="$TEST_REMOTE/synthetic-backup/khmerx-gray/$tier/2026-10-$day"; mkdir -p "$directory"; printf 'complete' > "$directory/COMPLETE"; done; done
bash "$scripts/backup.sh" --apply
[[ $(cat "$root/status") == running ]]
date_id=$(/bin/date -u +%F)
for tier in daily weekly; do [[ ! -d "$TEST_REMOTE/synthetic-backup/khmerx-gray/$tier/2026-10-01" ]]; done
[[ $(find "$TEST_REMOTE/synthetic-backup/khmerx-gray/daily" -mindepth 1 -maxdepth 1 -type d | wc -l) == 7 ]]
[[ $(find "$TEST_REMOTE/synthetic-backup/khmerx-gray/weekly" -mindepth 1 -maxdepth 1 -type d | wc -l) == 4 ]]
bash "$scripts/restore.sh" "$date_id" --apply
restored=$(find /tmp -maxdepth 1 -type d -name 'khmerx-restore.*' | head -n 1)
[[ $(sqlite3 "$restored/data/d1/main.sqlite" 'SELECT COUNT(*) FROM customer_workspaces;') == 1 ]]
cmp "$root/data/r2/blob" "$restored/data/r2/blob"
printf corrupted > "$TEST_REMOTE/synthetic-backup/khmerx-gray/daily/$date_id/data/r2/blob"
if bash "$scripts/restore.sh" "$date_id" --apply >/dev/null 2>&1; then printf 'FAIL corruption accepted\n' >&2; exit 1; fi
rm -f -- "$TEST_REMOTE/synthetic-backup/khmerx-gray/daily/$date_id/COMPLETE"
if TEST_FAIL_COMPLETE=1 bash "$scripts/backup.sh" --apply >/dev/null 2>&1; then printf 'FAIL upload error accepted\n' >&2; exit 1; fi
[[ $(cat "$root/status") == running && ! -e "$TEST_REMOTE/synthetic-backup/khmerx-gray/daily/$date_id/COMPLETE" ]]
sed -i 's/SOURCE_REGION=sgp1/SOURCE_REGION=nyc3/' "$root/backup.env"
if bash "$scripts/backup.sh" >/dev/null 2>&1; then printf 'FAIL same-region backup accepted\n' >&2; exit 1; fi
printf 'OK backup/restore, SQLite, object checksums, retention, dry-run and region guard\n'
