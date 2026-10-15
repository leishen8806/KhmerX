#!/usr/bin/env bash
set -Eeuo pipefail
case "${1:---dry-run}" in
  --dry-run) apply=false ;;
  --apply) apply=true ;;
  *) printf 'usage: %s [--dry-run|--apply]\n' "$0" >&2; exit 2 ;;
esac
if "$apply"; then
  [[ $(id -u) -eq 0 ]] || { printf 'Root required\n' >&2; exit 1; }
  ufw status | grep -q '^Status: active' || { printf 'Enable UFW with verified SSH access first\n' >&2; exit 1; }
  ufw insert 1 allow from 159.223.77.134 to any port 9443 proto tcp
  ufw insert 2 deny 9443/tcp
  ufw status numbered
else
  printf '%s\n' 'DRY RUN: allow 159.223.77.134 -> 9443/tcp first; deny all other sources on 9443/tcp (IPv4/IPv6). SSH rules remain intact.'
fi
