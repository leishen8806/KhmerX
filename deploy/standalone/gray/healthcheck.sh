#!/usr/bin/env bash
set -uo pipefail

failed=0
ok() { printf 'OK   %s\n' "$*"; }
bad() { printf 'FAIL %s\n' "$*"; failed=1; }

cd /opt/payease/app || { bad 'app directory is missing'; exit 1; }

running_services="$(docker compose -f deploy/standalone/gray/compose.gray.yaml ps --status running --services 2>/dev/null || true)"
if grep -qx payease <<<"$running_services"; then
  ok 'payease container is running'
else
  bad 'payease container is not running'
fi
if grep -qx scanner <<<"$running_services"; then
  ok 'scanner container is running'
else
  bad 'scanner container is not running'
fi

if curl --fail --silent --show-error --max-time 5 http://127.0.0.1:4300/healthz >/dev/null; then
  ok 'gateway healthz'
else
  bad 'gateway healthz'
fi

if command -v caddy >/dev/null 2>&1 && caddy validate --config /etc/caddy/Caddyfile.gray >/dev/null 2>&1; then
  ok 'Caddy configuration'
else
  bad 'Caddy configuration'
fi

if [[ "$(df -P /opt/payease | awk 'NR==2 {gsub(/%/,"",$5); print $5}')" -lt 90 ]]; then
  ok 'disk usage below 90%'
else
  bad 'disk usage is at least 90%'
fi

if command -v free >/dev/null 2>&1 && free -m | awk 'NR==2 {exit ($3 <= $2 * 0.9 ? 0 : 1)}'; then
  ok 'memory usage below 90%'
else
  bad 'memory usage is at least 90%'
fi

exit "$failed"
