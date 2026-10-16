# B0 申请主流程基线压测

本目录只包含本地或预发环境的 k6 脚本。脚本模拟：

`GET 认证预检 → 发送/校验演示验证码 → GET KYC → 上传 4 份虚构 JPG → 保存并提交 KYC → 轮询状态`

## 前置条件

1. 安装 [k6](https://grafana.com/docs/k6/latest/set-up/)。
2. 启动本地应用和数据库。默认目标是 `http://127.0.0.1:5173`。
3. 本地认证必须使用演示模式（`PAYEASE_AUTH_MODE=demo`、`KHMERX_TEST_MODE=true`），并准备一个可访问工作区的身份头。没有 ChatGPT 网关注入身份时，可通过环境变量传入：

```sh
export K6_USER_ID=synthetic-b0-runner
export K6_USER_EMAIL=b0-runner@example.test
```

如果预发网关要求身份证明，再传 `K6_IDENTITY_PROOF`。公司上下文可用 `K6_COMPANY`（例如 `t_<uuid>`）。

## 运行

```sh
# 先做 50 VU 验收（每个虚拟用户完成一次完整流程）
scripts/loadtest/run-b0.sh -e BASE_URL=http://127.0.0.1:5173 -e VUS=50 -e ONCE=true

# 指定 100/300/600/1000 VU
LOADTEST_ALLOWED_HOSTS=staging.example.test scripts/loadtest/run-b0.sh \
  -e BASE_URL=https://staging.example.test -e VUS=600 -e DURATION=3m

# 阶梯场景：100 → 300 → 600，每档 3 分钟
LOADTEST_ALLOWED_HOSTS=staging.example.test scripts/loadtest/run-b0.sh \
  -e BASE_URL=https://staging.example.test -e STAGES=true
```

仅允许本地、环回地址或 `LOADTEST_ALLOWED_HOSTS` 明确列出的预发目标。脚本会拒绝
`payease.khmerx.org`、`admin.khmerx.org`、`api.khmerx.org` 生产域名。

### 直连源站压测

压测从 `165.22.108.5` 发起，直连应用源站 `159.223.77.134`，并发送测试域名
Host 头，不经过 Cloudflare。用 `run-b0.sh` 传入 `--origin-ip` 与 `--host`；两者
必须同时提供，且 IP 与 Host 都必须列入 `LOADTEST_ALLOWED_HOSTS`：

```sh
LOADTEST_ALLOWED_HOSTS=159.223.77.134,testapi.khmerx.org \
  scripts/loadtest/run-b0.sh --origin-ip 159.223.77.134 --host testapi.khmerx.org \
  -e VUS=600 -e DURATION=3m
```

对 Mini App/H5 API 使用 `testpayease.khmerx.org` 替换 Host，并同步加入白名单。
如果 Caddy 为灰度域名使用 `tls internal`，压测发起机必须信任对应的 Caddy 内部 CA；
不要关闭 TLS 证书校验。

## B0b 灰度资源采集

资源采集必须在运行应用容器的灰度源站 `159.223.77.134` 上运行；不得在压测发起机
`165.22.108.5` 或生产机运行。
采集器每 2 秒将 `docker stats --no-stream` 和 `vmstat` 追加到 CSV，直到按
`Ctrl-C` 停止：

```sh
scripts/loadtest/sample-resources.sh \
  --output scripts/loadtest/reports/b0b-resources.csv
```

`--origin-ip` 和 `--host` 属于压测脚本 `run-b0.sh`，不属于采样脚本。压测结束后
停止采集器，再将 CSV 与 B0b 的 100/300/600 VU 报告一并归档。

## 报告

`run-b0.sh` 默认把报告写入 `scripts/loadtest/reports/`，可用 k6 参数 `-e REPORT_PATH=...`
指定文件名。报告包括每秒请求数、总用时、请求延迟 p50/p95/p99、错误率、按 HTTP
状态码和响应 `code` 的计数（包含 `409`、`CONFLICT`、`STATE_MUTATION_FAILED`）、写冲突
响应数、脚本重试数和上传成功率。写请求不会自动重试；服务端成功的乐观锁重试次数
目前不通过 API 暴露，报告会标记为不可观测。`checks` 失败时先查看认证、Cookie、Origin
和服务端配置，再提高并发；不要把生产域名用于压测。

## L1-A1 local fixture (synthetic; not Telegram registration)

Only `local-harness` is executable here; gray/VPS execution remains HOLD.
Use a disposable checkout-local `.wrangler/state` database with all migrations.
An explicit private `*.runtime.json` snapshot must match the local runtime:
`host: "localhost"`, `bindings.PAYEASE_ENV: "local"`, `PAYEASE_AUTH_MODE`,
`KHMERX_TEST_MODE`, `CUSTOMER_ROWS`, and `KYC_DATA_SECRET` (optional key ID).
Keep the snapshot private and ignored; never publish its contents. No OTP is sent.

```sh
node scripts/loadtest/fixture/cli.mjs plan --profile local-harness \
  --config scripts/loadtest/local.runtime.json --database .wrangler/state/test.sqlite \
  --base-url http://127.0.0.1:8788 --dataset main --run-id local-main-20261016 --count 600
# Repeat identical arguments with command apply, adding BOTH:
# --apply --confirm <printed-fingerprint> --output scripts/loadtest/manifests/main.manifest.json
node scripts/loadtest/rows-preflight.mjs scripts/loadtest/manifests/main.manifest.json \
  http://127.0.0.1:8788 on 600 main
```

Each runId creates a separate tenant and Ops department. `main` accepts 1..5000
customers (default 50); `smoke`/`timeout` have 3, `aux` has 6 invalid sessions,
`wrong-owner` has 0. Only normal datasets have approved synthetic KYC cases.
Do not reuse smoke customers for main. The fixture only supports `/api/h5/state`.
It does not create employees, institutions, service settings, assignments or audit.
There is no password option: both fixture bots disable password setup explicitly.

Plan and apply without `--apply` are read-only. Apply rejects stale fingerprints
and existing tenants, uses one transaction, and saves a private manifest before
commit (write failure rolls back). Treat interrupted runs as needing inspection.
Linux manifests are 600; Windows ACLs allow only the current user. Never commit,
print, serve or attach them. Remove them after session revocation/cleanup (A2).
Deleting a file does not guarantee removal of SSD/backed-up copies.
Real create and post-create cleanup acceptance are delivered by A2, not A1.

## L1-A2 cleanup (local only; audit tombstones retained)

```sh
node scripts/loadtest/fixture/cli.mjs cleanup --profile local-harness \
  --config scripts/loadtest/local.runtime.json --database .wrangler/state/test.sqlite \
  --base-url http://127.0.0.1:8788 --manifest scripts/loadtest/manifests/main.manifest.json
# Repeat with --apply --confirm <cleanup-fingerprint>
# and --output scripts/loadtest/manifests/cleanup-report.json
```

All seven contract ownership checks run again in the same transaction as deletes.
Extra/missing clients, unexpected staff, other audit actions or unknown public
identifiers refuse the entire cleanup. Reports contain counts/hashes, no tokens.
Unused datasets delete fully. After create, only the disabled tenant and immutable
system assignment audit remain. **Gray would permanently retain one disabled
tenant and about N audits per run**; gray execution remains HOLD in these scripts.
Neither foreign keys nor audit triggers are disabled. Keep the cleanup report;
then remove the sensitive manifest. Use a disposable local database copy whenever
possible; these scripts never discard an existing checkout database themselves.
A2 tests run real mutate/ensureAssignment for off/on, authenticate aux sessions,
verify missing Ops rejection, protected unrelated records and all seven guards.
These are source/SQLite service tests, not L1-B HTTP or 600-customer load evidence.

## L1-B rows harness (local only)

Requires Node >=22.13, installed dependencies, k6, and a fresh built worker:
`node scripts/run-framework.mjs build`. No application source is patched.
PowerShell: set `$env:K6_BIN` to the installed k6 executable, then run:

```sh
node scripts/loadtest/verify-rows.mjs --local-acceptance off 50
node scripts/loadtest/verify-rows.mjs --local-acceptance on 50
```

Each invocation creates a new disposable local D1 under `.wrangler/state/`, applies
all real migrations, and reuses A1/A2 for five independent datasets. Smoke runs
before main; consumed customers never return to main. No Telegram calls or new
auth bypass. Synthetic signed sessions exercise real HTTP customer authentication;
local demo mode requires the existing test flag and is not production evidence.
The orchestration disables Cloudflare metadata fetching and binds loopback only.

For an already prepared local server use `run-rows.sh` with ROWS_MANIFEST,
BASE_URL, CUSTOMER_ROWS and DATASET; ROWS_SUMMARY and per-request CSV are generated.
The runner intentionally supports loopback only: origin-IP/Host overrides and gray
execution remain HOLD. After preflight it fixes a barrier 15 seconds ahead and
assigns one unique customer/session per VU. Writes reuse body requestId on retry;
trace headers rotate UUIDs. No 429 retry; conflict detection is message-based
(OPEN-1). Service retry-after is capped at five seconds. Missing iterations remain
in the customer denominator. The legacy shared revision may rise as other clients
write, so concurrent readbacks require nondecreasing revision and unchanged bill
confirmation; isolated replay checks require exact revision equality.

Reports start with the local-only disclaimer. CSV contains request intervals and
sanitized tags, never cookies/body/credentials. Analysis measures real overlap,
first-write conflict denominator, retry reasons, error codes and latency. Readback
window metrics include only polls after the last write; earlier overlapping polls
remain in total request statistics. Insufficient overlap and >0.5% 429 are flagged;
local output cannot authorize Gate E. Server internal retries are unavailable.

Verification covers invalid sessions, cross-customer access, wrong owner, both
replays, immediate client disconnect plus <=10s committed-write polling, and an
independent read-only SQLite check of partitions/index/assignments/audit. Nonzero
mismatches or failed assertions return failure. Finally A2 runs dry-run/apply per
dataset, retains immutable audit and disabled tenants, then removes manifests.
A process crash needs manual fixture cleanup; never discard unrelated databases.
Raw CSV/logs stay local; commit sanitized reports only, including raw CSV SHA256.
Current source may fail on-mode confirm_bill replay: record failure, do not relax
its unchanged-revision assertion or modify application code in this task.


## L1-G gray-config fixture (operator only)

Codex validation uses local `node:22.22.1-bookworm-slim --network none` containers only.
No VPS or gray endpoint was contacted. Local Telegram fixture sessions are synthetic;
this is not Telegram registration or an authentication benchmark.

Before each approved window, stop the gray application and create a nonempty tar backup
of its D1 directory outside `/data/d1`. Ensure the backup is less than 30 minutes old.
The tool validates declarations, not actual application shutdown; its write lock is an
additional check. Keep session expiry before the next Saturday 17:45 closing time.
Manifest directory must already exist with owner `1000:1000`, mode `700`.

Operator template (do not run without separate owner authorization):
```sh
# After stopping the application and creating /opt/payease/loadtest/d1-before-RUN.tgz:
docker run --rm --network none --user 1000:1000 -e L1G_CONTAINER=1 \
  -v "$REPO:/app:ro" -v /opt/payease/data:/data \
  -v /opt/payease/data/config.json:/run/config.json:ro \
  -v /opt/payease/loadtest:/out -w /app node:22.22.1-bookworm-slim \
  node scripts/loadtest/fixture/cli.mjs plan --profile gray-config \
  --config /run/config.json --d1-dir /data/d1 --base-url https://testapi.khmerx.org \
  --expect-rows off --dataset main --run-id RUN --count 100 --output-dir /out/manifests \
  --app-stopped --backup-ref /out/d1-before-RUN.tgz
```
Use a valid lowercase 8–40 character run ID in place of RUN. Keep all target/declaration
arguments for every command, including read-only `plan`, `db-check` and cleanup planning.
Replace `plan` with `apply --apply --confirm FINGERPRINT --output /out/manifests/RUN.json`.
Create independent smoke/main/timeout/aux/wrong-owner runs; only main accepts a custom count.
Restart the application and transfer manifests privately to the load generator.
After the run, stop again, create a fresh backup, then use `db-check --manifest FILE`,
`cleanup --manifest FILE`, and `cleanup --manifest FILE --apply --confirm FINGERPRINT
--output /out/manifests/RUN-cleanup.json`. Retain immutable audit and inactive tenant
rows after create; unused runs are completely removed. Restart and check readiness.
Securely delete manifests on both machines after cleanup. Reports contain counts/hashes,
not session tokens. Private mode-600 manifests are the explicit credential artifact.
Restore backups only after owner authorization, with the application stopped.


### L1-G2 direct-origin rows (operator template; execution remains HOLD)

Only manifests produced by gray-config are accepted. Both host and origin IP must be
in `LOADTEST_ALLOWED_HOSTS`; the sole approved IP is `159.223.77.134`. No Cloudflare
mode exists. The operator declares actual configured scales as JSON, not estimates:
```sh
export LOADTEST_ALLOWED_HOSTS=159.223.77.134,testapi.khmerx.org
export ORIGIN_IP=159.223.77.134 BASE_URL=https://testapi.khmerx.org CUSTOMER_ROWS=off
export ROWS_MANIFEST=/private/smoke.json DATASET=smoke VUS=3
bash scripts/loadtest/run-rows.sh --declared-scales \
  '{"PAYEASE_GATEWAY_RATE_SCALE":30,"PAYEASE_LIMIT_SCALE":1}'
```
After smoke succeeds, use the independent main manifest and authorized client count.
The runner maps the approved hostname directly to the approved origin, with TLS
verification skipped only for this gray direct-origin mode. Reports explicitly say
“灰度直连源站，已跳过证书校验，未经 Cloudflare” and declare target, rows mode and scales.
These synthetic fixtures do not measure Telegram registration or authentication.
Observed write concurrency below 80% cannot support a claimed concurrency result.

HTTP verification, with the sanitized main db-check JSON copied back by the operator:
```sh
node scripts/loadtest/verify-rows.mjs --gray /private/main.json /private/aux.json \
  /private/wrong-owner.json /private/timeout.json /private/main-db-check.json \
  scripts/loadtest/reports/gray-verification.json --declared-scales \
  '{"PAYEASE_GATEWAY_RATE_SCALE":30,"PAYEASE_LIMIT_SCALE":1}'
```
The verifier never opens a database in gray mode. db-check contains counts/booleans
only and is operator-supplied evidence; verify its provenance and matching window.
For local-only smoke tests, a disposable k6 wrapper changes the already-validated
hosts mapping to an in-container self-signed HTTPS server. This is test transport
substitution, not permission to target another origin or proof of gray readiness.
