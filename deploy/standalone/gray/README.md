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
