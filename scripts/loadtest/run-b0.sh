#!/usr/bin/env bash
set -euo pipefail

origin_ip=""
host_name=""
k6_args=()

usage() {
  cat <<'EOF'
Usage: run-b0.sh --origin-ip IP --host HOST [k6 options]

The wrapper connects directly to the source IP and sends HOST as the request
Host header. The k6 script enforces LOADTEST_ALLOWED_HOSTS and production
domain blocking. Example:

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
      host_name=$2; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) k6_args+=("$1"); shift ;;
  esac
done

if [[ -z "$origin_ip" || -z "$host_name" ]]; then
  echo "--origin-ip and --host are required" >&2
  usage >&2
  exit 2
fi

exec k6 run -e "ORIGIN_IP=$origin_ip" -e "LOADTEST_HOST=$host_name" "${k6_args[@]}" scripts/loadtest/b0-main-flow.js
