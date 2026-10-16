#!/usr/bin/env bash
set -Eeuo pipefail

log() { printf '[gray] %s\n' "$*"; }
fail() { printf '[gray] FAIL: %s\n' "$*" >&2; exit 1; }

[[ "$(id -u)" -eq 0 ]] || fail 'run as root'

ensure_dir() {
  local dir="$1"
  [[ ! -L "$dir" ]] || fail "directory must not be a symlink: $dir"
  if [[ -d "$dir" ]]; then log "OK directory $dir"; else mkdir -p "$dir"; log "CREATED directory $dir"; fi
}

for dir in /opt/payease/app /opt/payease/data /opt/payease/clamav /opt/payease/scanner-secrets; do
  ensure_dir "$dir"
done
# Match the existing image USER node (1000) and scanner USER nobody (65534).
chown 1000:1000 /opt/payease/data
chmod 700 /opt/payease/data
chown 1000:65534 /opt/payease/scanner-secrets
chmod 2750 /opt/payease/scanner-secrets
# Existing tokens also need the scanner group; never follow a token symlink.
[[ ! -L /opt/payease/scanner-secrets/scanner-token ]] || fail 'scanner token must not be a symlink'
if [[ -f /opt/payease/scanner-secrets/scanner-token ]]; then
  chown 1000:65534 /opt/payease/scanner-secrets/scanner-token
  chmod 640 /opt/payease/scanner-secrets/scanner-token
fi

if swapon --show=NAME --noheadings | grep -qx '/swapfile'; then
  log 'OK /swapfile is active'
else
  if [[ ! -f /swapfile ]]; then
    fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
  grep -qE '^/swapfile[[:space:]]' /etc/fstab || printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
  log 'OK enabled 2G /swapfile'
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl ufw

if command -v docker >/dev/null 2>&1; then
  log 'OK Docker installed'
else
  curl -fsSL https://get.docker.com | sh
  log 'OK Docker installed'
fi

docker compose version >/dev/null 2>&1 || apt-get install -y docker-compose-plugin
docker compose version >/dev/null 2>&1 || fail 'Docker Compose plugin is unavailable'
log 'OK Docker Compose available'

ufw default deny incoming
ufw default allow outgoing
for port in 22/tcp 80/tcp 443/tcp; do ufw allow "$port" >/dev/null; done
ufw --force enable >/dev/null
log 'OK UFW allows only 22/tcp, 80/tcp and 443/tcp for incoming traffic'

log 'Bootstrap complete; copy a reviewed config.json into /opt/payease/data before starting Compose.'
