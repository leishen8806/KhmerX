#!/usr/bin/env bash
set -Eeuo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
config=${SCANNER_ENV_FILE:-/opt/payease-scanner/scanner.env}
[[ -f "$config" && $(stat -c %a "$config") == 600 ]] || { printf 'FAIL protected scanner.env required\n' >&2; exit 1; }
set -a
# shellcheck disable=SC1090
source "$config"
set +a
for port in 18081 18082; do
  curl --fail --silent --show-error --max-time 5 "http://127.0.0.1:$port/health" >/dev/null
  status=$(curl --silent --show-error --max-time 5 -o /dev/null -w '%{http_code}' --data-binary 'synthetic probe' "http://127.0.0.1:$port/scan")
  [[ "$status" == 401 ]] || { printf 'FAIL scanner token enforcement\n' >&2; exit 1; }
done
status=$(curl --silent --show-error --max-time 5 --resolve "$SCANNER_HOST:9443:127.0.0.1" -o /dev/null -w '%{http_code}' "https://$SCANNER_HOST:9443/health")
[[ "$status" == 403 ]] || { printf 'FAIL source restriction/TLS\n' >&2; exit 1; }
printf 'OK both scanners healthy; token, TLS and local source rejection verified\n'
