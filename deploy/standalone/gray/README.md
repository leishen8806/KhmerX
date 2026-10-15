# KhmerX gray deployment

This directory contains templates for the non-production Ubuntu gray host. It
contains no credentials and must not be used for production data.

## 1. Prepare the host

On `159.223.77.134`, as root, install the repository at `/opt/payease/app`
and run:

```sh
cd /opt/payease/app
bash deploy/standalone/gray/bootstrap-gray.sh
swapon --show
docker --version
docker compose version
ufw status verbose
```

If bootstrap fails, fix the reported package, disk, or firewall problem and
run it again. It is safe to rerun; directories, swap, packages, and firewall
rules are checked before use.

## 2. Add gray-only configuration

Copy `config.json.example` to `/opt/payease/data/config.json`, replace every
`replace-with-*` value with a secret supplied through the deployment process,
and keep the file root-readable only:

```sh
install -o root -g root -m 600 deploy/standalone/gray/config.json.example /opt/payease/data/config.json
vi /opt/payease/data/config.json
python3 -m json.tool /opt/payease/data/config.json >/dev/null
grep -q '"KHMERX_TEST_MODE": "false"' /opt/payease/data/config.json
```

Use only fictional gray data. Do not put Telegram tokens, customer data, or
credentials in Git.

## 3. Configure Caddy

The base `deploy/standalone/Caddyfile.gray` is the reviewed S4b template. The
local `gray/Caddyfile.gray` wrapper imports that file from the fixed checkout
path, so the trusted-proxy rules stay in one source of truth:

```sh
install -o root -g root -m 644 deploy/standalone/gray/Caddyfile.gray /etc/caddy/Caddyfile.gray
caddy validate --config /etc/caddy/Caddyfile.gray
systemctl reload caddy
```

The template uses `tls internal` with Cloudflare **Full** mode for initial
gray testing. After the origin is verified, replace those directives with
`tls <origin-cert> <origin-key>` and switch Cloudflare to **Full (strict)**.
Never trust `X-Real-IP` without the S4b trusted-proxy block.

Verify the four host routes locally:

```sh
curl -k --resolve testapi.khmerx.org:443:127.0.0.1 https://testapi.khmerx.org/healthz
curl -k --resolve testpayease.khmerx.org:443:127.0.0.1 https://testpayease.khmerx.org/healthz
curl -k --resolve testadmin.khmerx.org:443:127.0.0.1 https://testadmin.khmerx.org/
caddy validate --config /etc/caddy/Caddyfile.gray
```

If validation fails, check the certificate paths, DNS/host names, and that
ports 80/443 are available before reloading Caddy.

## 4. Start the stack

From the repository root on the host:

```sh
cd /opt/payease/app
docker compose -f deploy/standalone/gray/compose.gray.yaml config
docker compose -f deploy/standalone/gray/compose.gray.yaml up -d --build
docker compose -f deploy/standalone/gray/compose.gray.yaml ps
curl --fail http://127.0.0.1:4300/healthz
```

The application is capped at 1.5 GiB and the scanner gateway at 1.2 GiB.
`PAYEASE_MAX_IN_FLIGHT=32`, `PAYEASE_MAX_UPLOADS=2`, and the 15 MiB body cap
are gray stability defaults; change them only after a measured test.

If the scanner dependency is unavailable, the application intentionally stays
unhealthy. Check the external `oa-system_default` network and scanner token;
do not expose the scanner port publicly.

## 5. Health and logs

Run the idempotent health check from cron or manually:

```sh
bash deploy/standalone/gray/healthcheck.sh
docker compose -f deploy/standalone/gray/compose.gray.yaml logs --tail=100
df -h /opt/payease
free -h
```

The script exits non-zero on a stopped container, failed health endpoint,
invalid Caddy configuration, disk usage at least 90%, or memory usage at
least 90%. Docker keeps three 10 MiB log files per service.

## 6. Stop and recover

```sh
cd /opt/payease/app
docker compose -f deploy/standalone/gray/compose.gray.yaml stop
cp -a /opt/payease/data /opt/payease/data.backup.$(date +%Y%m%d%H%M%S)
docker compose -f deploy/standalone/gray/compose.gray.yaml start
```

The gray host is a single point of failure. Restore `/opt/payease/data` and
the matching `config.json` from the approved off-host backup before starting
the stack after disk loss.

## 7. Gray operating hours (Q11)

`/data/gray-closed` inside the container closes every business route. The host-side default is `/opt/payease/data/gray-closed`, mapped by the existing data volume. Flag absence is the default/open state. API requests receive ARC-00 `503 SERVICE_UNAVAILABLE`, one matching requestId and `Retry-After: 300`; browser routes receive a short km/en/zh maintenance page. The existing GET `/healthz`, `/readyz`, `/version` diagnostics keep their original behavior. Background/business job HTTP endpoints are also blocked. This does not claim to suspend timers already running inside the Worker.

The gateway path can be configured with binding `GRAY_CLOSED_FILE`; the host script supports `GRAY_DATA_DIR` and `GRAY_CLOSED_FILE`. If using non-default paths, map them to the same file across host/container. The host script rejects symlinks or a flag outside its gray data directory. `GRAY_RETRY_AFTER_SECONDS` sets a positive retry interval, default 300, capped at 3600.

Manual local drill on the gray host (do not run against production domains):

```bash
cd /opt/payease/app
bash deploy/standalone/gray/gray-hours.sh close --dry-run
sudo bash deploy/standalone/gray/gray-hours.sh close --apply
# Use the deployment's configured gray Host header; local HTTP avoids an external probe.
curl -i -H 'Host: testapi.khmerx.org' http://127.0.0.1:4300/api/h5/state
curl -i -H 'Host: testapi.khmerx.org' http://127.0.0.1:4300/healthz
sudo bash deploy/standalone/gray/gray-hours.sh open --apply
curl -i -H 'Host: testapi.khmerx.org' http://127.0.0.1:4300/api/h5/state
```

Expected: close gives 503 with retry/request headers, healthz stays 200; open restores normal authentication/API behavior (an unauthenticated 401 is valid). Script defaults to dry-run and explicit `--apply` changes only the marker; commands are idempotent.

Cron uses the **server timezone**, not a presumed `CRON_TZ` extension. Before installation require:

```bash
timedatectl show -p Timezone --value
# Must output Asia/Phnom_Penh; if different, the operator must correct it first.
date '+%Z %z %a %H:%M'
sudo install -o root -g root -m 644 deploy/standalone/gray/gray-hours.cron /etc/cron.d/khmerx-gray-hours
cat /etc/cron.d/khmerx-gray-hours
```

The reviewed schedule is Saturday 17:45 close and Monday 08:45 open. To disable, remove this cron entry manually and explicitly open the gateway; removing cron alone does not remove a closed marker. No VPS commands, timezone changes or cron installation were executed by Codex.