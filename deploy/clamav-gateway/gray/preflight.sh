#!/usr/bin/env bash
set -Eeuo pipefail
memory_kb=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)
[[ "$memory_kb" -ge 7800000 ]] || { printf 'FAIL two ClamAV instances require an 8GB-class host; current 4GB Licensed host is blocked\n' >&2; exit 1; }
docker compose version >/dev/null
printf 'OK memory and Compose prerequisites; still verify certificates and firewall\n'
