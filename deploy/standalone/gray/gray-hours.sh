#!/usr/bin/env bash
set -Eeuo pipefail
action=${1:-}; mode=${2:---dry-run}
[[ "$action" == close || "$action" == open ]] || { printf 'usage: %s close|open [--dry-run|--apply]\n' "$0" >&2; exit 2; }
[[ "$mode" == --dry-run || "$mode" == --apply ]] || exit 2
data=$(realpath -m -- "${GRAY_DATA_DIR:-/opt/payease/data}")
candidate=${GRAY_CLOSED_FILE:-$data/gray-closed}
[[ ! -L "$candidate" ]] || { printf 'FAIL flag cannot be a symlink\n' >&2; exit 1; }
flag=$(realpath -m -- "$candidate")
[[ "$flag" == "$data/"* ]] || { printf 'FAIL flag must remain inside gray data directory\n' >&2; exit 1; }
if [[ "$mode" == --dry-run ]]; then printf 'DRY RUN %s gray gateway\n' "$action"; exit 0; fi
[[ -d "$data" ]] || { printf 'FAIL gray data directory missing\n' >&2; exit 1; }
if [[ "$action" == close ]]; then touch -- "$flag"; else rm -f -- "$flag"; fi
printf 'OK %s gray gateway\n' "$action"
