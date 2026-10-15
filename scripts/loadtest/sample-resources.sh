#!/usr/bin/env bash
set -euo pipefail

# Record host and container resources while a load test is running.
# Intended to run on the gray financial-institution host (159.223.77.134).

interval=2
output=""
origin_ip=""
host_name=""

usage() {
  cat <<'EOF'
Usage: sample-resources.sh [options]

Options:
  --output FILE       CSV output path (default: reports/resources-UTC.csv)
  --interval SECONDS Sampling interval, at least 1 (default: 2)
  --origin-ip IP     Load-test origin IP to record as metadata
  --host HOST        Host header/domain to record as metadata
  -h, --help         Show this help

The sampler runs until interrupted. It writes one vmstat row and one row per
Docker container every interval. Run it on the gray host, not on production.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      [[ $# -ge 2 ]] || { echo "--output requires a value" >&2; exit 2; }
      output=$2; shift 2 ;;
    --interval)
      [[ $# -ge 2 ]] || { echo "--interval requires a value" >&2; exit 2; }
      interval=$2; shift 2 ;;
    --origin-ip)
      [[ $# -ge 2 ]] || { echo "--origin-ip requires a value" >&2; exit 2; }
      origin_ip=$2; shift 2 ;;
    --host)
      [[ $# -ge 2 ]] || { echo "--host requires a value" >&2; exit 2; }
      host_name=$2; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if ! [[ "$interval" =~ ^[1-9][0-9]*$ ]]; then
  echo "--interval must be a positive integer" >&2
  exit 2
fi

if [[ -z "$output" ]]; then
  mkdir -p scripts/loadtest/reports 2>/dev/null || true
  output="scripts/loadtest/reports/resources-$(date -u +%Y%m%dT%H%M%SZ).csv"
else
  mkdir -p "$(dirname "$output")"
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required for container resource sampling" >&2
  exit 1
fi
if ! command -v vmstat >/dev/null 2>&1; then
  echo "vmstat is required for host resource sampling" >&2
  exit 1
fi

csv() {
  local value=${1-}
  value=$(printf '%s' "$value" | sed 's/"/""/g')
  printf '"%s"' "$value"
}

write_csv_row() {
  local row=""
  local field
  for field in "$@"; do
    [[ -n "$row" ]] && row+=','
    row+="$(csv "$field")"
  done
  printf '%s\n' "$row" >>"$output"
}

printf '%s\n' 'timestamp_utc,source,origin_ip,host,container,cpu_pct,mem_usage,mem_pct,net_io,block_io,pids,r,b,swpd,free,buff,cache,si,so,bi,bo,in,cs,us,sy,id,wa,st' >"$output"
echo "Writing resource samples to $output (interval=${interval}s); press Ctrl-C to stop." >&2

while :; do
  timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

  docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}|{{.BlockIO}}|{{.PIDs}}' 2>/dev/null \
    | while IFS='|' read -r container cpu mem_usage mem_pct net_io block_io pids; do
      [[ -n "$container" ]] || continue
        write_csv_row "$timestamp" docker "$origin_ip" "$host_name" "$container" "$cpu" "$mem_usage" "$mem_pct" "$net_io" "$block_io" "$pids" \
          "" "" "" "" "" "" "" "" "" "" "" "" "" "" "" "" ""
      done

  vm_line=$(vmstat -n 1 2 | tail -n 1 | awk '{$1=$1; print}')
  read -r r b swpd free buff cache si so bi bo in cs us sy id wa st <<<"$vm_line" || true
  write_csv_row "$timestamp" vmstat "$origin_ip" "$host_name" "" "" "" "" "" "" "" \
    "$r" "$b" "$swpd" "$free" "$buff" "$cache" "$si" "$so" "$bi" "$bo" "$in" "$cs" "$us" "$sy" "$id" "$wa" "$st"

  sleep "$interval"
done
