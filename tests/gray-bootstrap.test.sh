#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'run this fixture only inside the disposable root container'; exit 1; }
fixture_dir=$(mktemp -d /tmp/khmerx-gray-bootstrap.XXXXXX)
case "$fixture_dir" in /tmp/khmerx-gray-bootstrap.*) ;; *) exit 1 ;; esac
trap 'rm -rf -- "$fixture_dir"' EXIT
mkdir -p "$fixture_dir/bin" "$fixture_dir/data/scanner-secrets"
printf 'synthetic-token-not-a-credential' > "$fixture_dir/data/scanner-secrets/scanner-token"
for command in apt-get docker ufw; do
  printf '#!/bin/sh\nexit 0\n' > "$fixture_dir/bin/$command"
done
printf '#!/bin/sh\nprintf "/swapfile\\n"\n' > "$fixture_dir/bin/swapon"
printf '#!/bin/sh\nexit 99\n' > "$fixture_dir/bin/curl"
chmod +x "$fixture_dir/bin/"*
export PATH="$fixture_dir/bin:$PATH"
sed "s|/opt/payease|$fixture_dir/data|g" /src/deploy/standalone/gray/bootstrap-gray.sh | tr -d '\r' > "$fixture_dir/bootstrap.sh"
for cycle in first second; do
  bash "$fixture_dir/bootstrap.sh" > "$fixture_dir/$cycle.log"
  find "$fixture_dir/data" -printf '%P %u %g %m\n' | sort > "$fixture_dir/$cycle.state"
done
cmp "$fixture_dir/first.state" "$fixture_dir/second.state"
[[ $(stat -c '%u:%g %a' "$fixture_dir/data/data") == '1000:1000 700' ]]
[[ $(stat -c '%u:%g %a' "$fixture_dir/data/scanner-secrets") == '1000:65534 2750' ]]
[[ $(stat -c '%u:%g %a' "$fixture_dir/data/scanner-secrets/scanner-token") == '1000:65534 640' ]]
echo 'Q4 bootstrap repeat PASS (temporary paths; package/swap/firewall commands mocked)'
