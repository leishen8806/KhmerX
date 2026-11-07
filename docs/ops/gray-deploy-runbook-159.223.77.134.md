# 159.223.77.134 灰度部署手册

> 本手册只供负责人或运维在负责人批准后执行。Codex 仅准备文档和本地只读核对脚本，未连接、登录或写入 VPS。159.223.77.134 是测试灰度环境；正式环境不适用本手册。

> **当前状态：暂缓。** 在本地 standalone（Node `server.mjs` + 灰度配置 + 虚构数据）和 dev harness 完整验收、负责人复核前，不得在 `159.223.77.134` 执行下文任何停止服务、备份、配置写入、启动、迁移、回滚或重启步骤。负责人复核通过后，仍须另行批准具体 VPS 操作；本手册本身不构成部署授权。

## 0. 部署边界与基线

- 目标：`159.223.77.134`，四个测试域名为 `test.khmerx.org`（官网静态页，public）、`testpayease.khmerx.org`（H5/Mini App，public）、`testadmin.khmerx.org`（员工后台，admin）、`testapi.khmerx.org`（API，api）。
- 应用部署目录：`/opt/payease/app`；数据目录：`/opt/payease/data`；扫描器密钥目录：`/opt/payease/scanner-secrets`。
- 执行前确认最终 `main` 基线：

  ```sh
  git fetch origin
  git rev-parse origin/main
  git show --no-patch --format='%H %s' origin/main
  ```

  在部署记录中保存 commit SHA，并确认构建产物的 `BUILD_ID` 来自同一 SHA。部署前在**本机**运行配置检查：

  ```sh
  node deploy/standalone/gray/check-config.mjs --example deploy/standalone/gray/config.json.example
  # 期望：EXAMPLE VALID — NOT DEPLOYABLE
  ```

  实际配置文件只能在目标机以只读挂载检查；不得把密钥值复制到终端记录、日志或 Git：

  ```sh
  docker run --rm --network none -v "$PWD:/app:ro" \
    -v /opt/payease/data/config.json:/run/config.json:ro -w /app node:22.22.1-bookworm-slim \
    node deploy/standalone/gray/check-config.mjs /run/config.json
  # 期望：GRAY CONFIG CHECK: PASS
  ```

## 1. 部署前备份（暂缓，待本地验收和负责人评估）

先停止会写入数据的应用，再备份 `/opt/payease/data` 中的 D1、R2 和 `config.json`。如果使用现有 `backup.sh`，按其默认 dry-run 先检查，再由运维明确使用 `--apply`；不得在没有备份完成证据时继续：

```sh
cd /opt/payease/app
sudo docker compose -f deploy/standalone/gray/compose.gray.yaml stop payease
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
sudo install -d -m 700 "/opt/payease/backups/$stamp"
sudo cp -a /opt/payease/data "/opt/payease/backups/$stamp/data"
sudo sha256sum /opt/payease/backups/$stamp/data/config.json | sudo tee "/opt/payease/backups/$stamp/config.json.sha256"
sudo docker compose -f deploy/standalone/gray/compose.gray.yaml start payease
```

确认备份完整后才继续：目录中同时存在 `d1/`、`r2/`、`config.json` 和校验文件；`config.json` 能以 root 只读打开且 JSON 解析成功；D1 目录包含 SQLite 文件并能对每个库执行只读 `PRAGMA integrity_check`；R2 目录包含对象存储文件。只记录路径、时间、文件数量、字节数和 SHA256，不记录配置内容或密钥。备份失败、服务未恢复或完整性检查失败，立即停止，不继续部署。

## 2. 配置清单（暂缓，待本地验收和负责人评估）

配置文件在 `/opt/payease/data/config.json`，密钥只由负责人/运维通过受控流程注入。以下键名和期望值必须逐项核对，文档不包含任何密钥值：

```text
PAYEASE_ENV=gray
KHMERX_TEST_MODE=false
PAYEASE_IDENTITY_PROOF_REQUIRED=true
PAYEASE_DEMO_OTP_ALLOWED=true
PAYEASE_H5_AUTH_MODE=demo
PAYEASE_TELEGRAM_AUTH_MODE=telegram
PAYEASE_AUTH_MODE=telegram
```

- `companies` 必须**只有一家**，名称为 `KhmerX Gray`，并且 `customerCompanyId` 与该公司的 `t_...` ID 一致；账户只使用测试账号，不能放生产客户或真实员工数据。
- `test.khmerx.org` 只提供 public 官网静态内容；`testpayease.khmerx.org` 是 public H5/Mini App；`testadmin.khmerx.org` 是 admin 后台；`testapi.khmerx.org` 是 api 入口。配置中的 `publicClientHosts`、`adminHosts`、`apiHosts` 必须分别与此对应。
- 业务机器人的 Token 必须配置在 `KhmerX Gray` 公司对应的 Bot 渠道下；Bot 元数据与渠道 ID 要与实际绑定一致。不要在 `config.json`、Git、工单或 shell history 中写 Token 值。
- `TELEGRAM_BOT_TOKEN_1`、`TELEGRAM_GATEWAY_TOKEN`、`KYC_DATA_SECRET`、`PAYEASE_AUTH_SECRET`、`PAYEASE_IDENTITY_PROOF_SECRET`、`POSTLOAN_JOB_SECRET`、`KYC_SCAN_TOKEN` 及 Basic 口令必须由受控 secret 流程注入并满足长度/权限要求。
- `KHMERX_TEST_MODE=false` 是 standalone 安全门；灰度的 H5 测试 OTP 由 `PAYEASE_ENV=gray` 与 `PAYEASE_DEMO_OTP_ALLOWED=true` 控制，不能把同一配置复制到非 gray 环境。

## 3. 部署步骤（暂缓，待本地验收和负责人评估）

以下步骤沿用 `deploy/standalone` 的现有 Compose/node 方式；应用启动时会自动执行尚未应用的迁移，包含 0063。不得手工跳过迁移、修改迁移顺序或在正式环境执行：

```sh
cd /opt/payease/app
git fetch origin
git checkout --detach <负责人记录的最终-main-SHA>
docker compose -f deploy/standalone/gray/compose.gray.yaml config --quiet
docker compose -f deploy/standalone/gray/compose.gray.yaml up -d --build
docker compose -f deploy/standalone/gray/compose.gray.yaml ps
```

若 Compose 不可用，必须由运维按同一 `deploy/standalone/Dockerfile` 和 `node deploy/standalone/server.mjs` 方式执行，并保持 `/app/dist`、`/data/config.json`、scanner token 挂载及端口 `127.0.0.1:4300` 不变。不得临时改成开发服务器或把 scanner 端口暴露公网。

## 4. 部署后核对（暂缓，待本地验收和负责人评估）

以下每项都必须得到期望值；任一失败立即停止并按第 6 节回滚。优先从目标机本地 `127.0.0.1:4300` 配合正确 Host 核对，避免把内部健康检查暴露到公网：

```sh
curl --fail --silent http://127.0.0.1:4300/healthz
# 期望 HTTP 200，JSON status=ok
curl --fail --silent http://127.0.0.1:4300/readyz
# 期望 HTTP 200，JSON status=ready
curl --fail --silent http://127.0.0.1:4300/version
# 期望 HTTP 200，JSON service=payease-api，buildId 与部署前基线一致
```

配置四域名后，再逐个以 TLS/Caddy 入口核对：

```sh
curl -k --resolve testpayease.khmerx.org:443:127.0.0.1 https://testpayease.khmerx.org/healthz
curl -k --resolve testadmin.khmerx.org:443:127.0.0.1 https://testadmin.khmerx.org/
curl -k --resolve testapi.khmerx.org:443:127.0.0.1 https://testapi.khmerx.org/healthz
curl -k --resolve test.khmerx.org:443:127.0.0.1 https://test.khmerx.org/
```

应用核对：

1. `GET https://testpayease.khmerx.org/api/h5/auth` 应返回 HTTP 200，`company` 为 `KhmerX Gray`，`mode` 为 `demo`。不得把响应中的 Cookie 或身份头写入日志。
2. 带 `X-Telegram-Init-Data` 的同一 GET/Telegram 登录路径应显示 `mode=telegram`；响应不能包含 `demoCode`。使用合成、已过期或无效 initData 只能得到稳定错误码，不能得到公司信息。
3. 在测试页面使用一个虚构号码（例如 `+85512000001`，不得使用真实号码）和固定验证码 `123456` 完整登录一次，确认会话建立、退出后会话失效；不得向 Telegram 发送消息或写入真实客户数据。
4. 以受控测试账号进入 `/team/channels`，运行只读自检，期望结果为 `ok`；不得把 Token 明文显示或复制。
5. 在本机复制目标 D1 到只读临时文件，运行：

   ```sh
   node scripts/audit-seq-verify.mjs --db /path/to/read-only-copy.sqlite
   ```

   期望 JSON 中 `seqNull.count=0`、`seqUnique=true`，若使用 `--backfill-max-seq N` 检查迁移范围，`orderCheck=passed`。脚本只读，禁止使用 `--remote` 或 `--production`。

## 5. 本地只读核对脚本

本仓库提供 `scripts/gray/post-deploy-check.mjs`。它只发 GET，检查 `/healthz`、`/version` 和 `/api/h5/auth`，并断言 `company=KhmerX Gray`、`mode=demo`；可用 `EXPECTED_BUILD_ID` 进一步固定 buildId：

```sh
EXPECTED_BUILD_ID=<基线-buildId> node scripts/gray/post-deploy-check.mjs http://127.0.0.1:4300
```

不得把真实域名、真实 Token 或真实客户数据传给本地脚本。只在本地 standalone 或 disposable fixture 运行；本次准备阶段已在本地 standalone harness 上运行并记录 PASS，未对任何真实域名运行。

## 6. 回滚与停止条件（暂缓，待本地验收和负责人评估）

回滚步骤：

```sh
cd /opt/payease/app
docker compose -f deploy/standalone/gray/compose.gray.yaml stop
sudo mv /opt/payease/data /opt/payease/data.failed.$(date -u +%Y%m%dT%H%M%SZ)
sudo cp -a /opt/payease/backups/<备份时间戳>/data /opt/payease/data
# 恢复同一备份中的 config.json、权限和 scanner-secrets 后启动上一版本
git checkout --detach <上一版本-SHA>
docker compose -f deploy/standalone/gray/compose.gray.yaml up -d
```

回滚后必须重新核对 `/healthz`、`/readyz`、`/version`、H5 auth、后台自检和 `seqNull=0`。以下任一情况必须立即停止业务验证并回滚：demo OTP 出现在非 gray 配置或 Telegram 响应；公司为空、超过一家或绑定与域名不一致；`/healthz`/`/readyz` 失败；buildId 与记录基线不一致；`/api/h5/auth` 返回错误公司或错误 mode；Telegram 路径返回 `demoCode`；后台 channel selfcheck 非 `ok`；audit `seqNull` 非 0；配置检查、备份完整性、TLS/Caddy 验证或 scanner 健康检查失败；发现真实手机号、真实客户数据、真实 Token 被用于测试。

## 7. 明确禁止

本手册不授权 Codex 或任何自动任务连接、登录、部署、重启服务、改 DNS/Cloudflare、迁移数据库、写业务数据或向 Telegram 发送消息。所有 VPS 操作由负责人/运维在另行批准后执行。
