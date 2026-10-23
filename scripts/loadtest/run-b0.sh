#!/usr/bin/env bash
set -euo pipefail

origin_ip=""
host_name=""
k6_args=()
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo_root=$(cd "$script_dir/../.." && pwd)
allowlist=${LOADTEST_ALLOWED_HOSTS:-localhost,127.0.0.1,10.0.2.2}

usage() {
  cat <<'EOF'
Usage: run-b0.sh [--origin-ip IP --host HOST] [k6 options]

Use -e SCENARIO=rows for the customer-shard consistency scenario. It keeps
one deterministic synthetic customer per VU and reports final KYC state mismatches.

When both target options are supplied, k6 resolves HOST directly to IP and
sends HOST as the HTTP Host header. Both values must appear in the allowlist.
Without them, BASE_URL defaults to localhost. Example:

  LOADTEST_ALLOWED_HOSTS=159.223.77.134,testapi.khmerx.org \
    scripts/loadtest/run-b0.sh --origin-ip 159.223.77.134 --host testapi.khmerx.org \
    -e VUS=100 -e DURATION=3m -e REPORT_PATH=scripts/loadtest/reports/b0-100.json
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --origin-ip)
      [[ $# -ge 2 ]] || { echo "--origin-ip requires a value" >&2; exit 2; }
      origin_ip=$2; shift 2 ;;
    --host)
      [[ $# -ge 2 ]] || { echo "--host requires a value" >&2; exit 2; }
      host_name=${2,,}; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) k6_args+=("$1"); shift ;;
  esac
done

if [[ -n "$origin_ip" && -z "$host_name" || -z "$origin_ip" && -n "$host_name" ]]; then
  echo "--origin-ip and --host must be provided together" >&2
  usage >&2
  exit 2
fi

normalize_host() { printf '%s' "${1,,}" | sed 's/\.$//'; }
is_allowed() {
  local candidate
  candidate=$(normalize_host "$1")
  local entry
  IFS=',' read -ra entries <<<"$allowlist"
  for entry in "${entries[@]}"; do
    entry=${entry//[[:space:]]/}
    [[ "$(normalize_host "$entry")" == "$candidate" ]] && return 0
  done
  return 1
}
is_production() {
  local candidate
  candidate=$(normalize_host "$1")
  [[ "$candidate" == payease.khmerx.org || "$candidate" == admin.khmerx.org || "$candidate" == api.khmerx.org || "$candidate" == *.payease.khmerx.org || "$candidate" == *.admin.khmerx.org || "$candidate" == *.api.khmerx.org ]]
}

if [[ -n "$origin_ip" ]]; then
  if ! [[ "$origin_ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || ! awk -F. '{for (i=1;i<=4;i++) if ($i > 255) exit 1}' <<<"$origin_ip"; then
    echo "--origin-ip must be a valid IPv4 address" >&2
    exit 2
  fi
  if ! is_allowed "$origin_ip"; then echo "origin IP is not in LOADTEST_ALLOWED_HOSTS" >&2; exit 2; fi
fi
if [[ -n "$host_name" ]]; then
  if ! [[ "$host_name" =~ ^[a-zA-Z0-9.-]+$ ]] || is_production "$host_name"; then
    echo "invalid or production --host is refused" >&2
    exit 2
  fi
  if ! is_allowed "$host_name"; then echo "host is not in LOADTEST_ALLOWED_HOSTS" >&2; exit 2; fi
fi

cd "$repo_root"
mkdir -p scripts/loadtest/reports
report_path="scripts/loadtest/reports/b0-$(date -u +%Y%m%dT%H%M%SZ).json"
base_args=(-e "LOADTEST_ALLOWED_HOSTS=$allowlist" -e "REPORT_PATH=$report_path")
if [[ -n "$origin_ip" ]]; then
  base_args+=(-e "ORIGIN_IP=$origin_ip" -e "LOADTEST_HOST=$host_name" -e "ORIGIN_SCHEME=${ORIGIN_SCHEME:-https}")
fi
exec k6 run "${base_args[@]}" "${k6_args[@]}" "$script_dir/b0-main-flow.js"
