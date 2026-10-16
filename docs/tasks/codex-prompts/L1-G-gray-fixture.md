# L1-G 契约：灰度 fixture 与灰度压测（gray-config 档）

状态：v1　核对基线：`origin/main` = `0dc5f92`（含 Q4 返修 #44、L1-A1/A2、L1-B、幂等修复 #42）
前置契约：`docs/tasks/codex-prompts/L1-rows-loadtest-revision.md`（以下简称"L1 契约"）。**本文只定义 L1 契约里 §3.1 所说 `gray-config` 档的实现、灰度侧压测入口和人工流程；L1 契约里已冻结的 rows 流程、重试/统计口径、数据集拆分、清理七项归属检查、墓碑规则一律沿用，不得改动。**
范围：**Codex 只写代码和测试，在本地 Docker 里验证；不得登录或操作 159.223.77.134、165.22.108.5，不得对任何 khmerx.org 域名发请求。** 灰度实际执行是人工步骤，且仍受 §9 的前置条件限制。

---

## 0. 结论速览

- 灰度上能跑的只有 **rows**（baseline 需要 demo 认证，灰度禁止）。
- fixture 在**源站 159.223.77.134 上、在一个一次性 Node 容器里**运行，直接读写灰度的 D1 目录；压测在 **165.22.108.5** 上经 k6 发起。
- 因为 D1 由运行中的 Miniflare 进程持有，**写入前必须停掉应用容器**（约几分钟停机，灰度可接受，见 D-03）。不做"在线写入"。
- 灰度 fixture 与压测使用**与本地同一套数据集、manifest、预检、清理代码**，只新增 `gray-config` 档和灰度目标放行，不另写一套。
- 灰度同样会留下失效租户与审计墓碑（L1 契约 OPEN-9，已默认接受）。

## 1. 已核实事实

| # | 事实 | 依据 |
|---|---|---|
| G1 | A1 的 `target()` 只接受 `local-harness`（回环地址 + 检出内 `.wrangler/state`）；L1-B 的 `rows-flow.js`、`rows-preflight.mjs`、`verify-rows.mjs` 都写死回环地址和本地 Miniflare；`run-rows.sh` 提示"loopback origin required" | `scripts/loadtest/fixture/core.mjs`、`rows-flow.js:7`、`rows-preflight.mjs:8`、`verify-rows.mjs:17` |
| G2 | 灰度应用在容器里读 `/data/config.json`，D1 由 Miniflare 持久化到 `/data/d1`（宿主机 `/opt/payease/data/d1/miniflare-D1DatabaseObject/<哈希>.sqlite`），应用是唯一持有该库的进程 | `deploy/standalone/server.mjs:15,29` |
| G3 | 维护开关 `/data/gray-closed` 只让网关返回 503（`/healthz`、`/readyz`、`/version` 除外），**不会让应用放开数据库**；要独占 D1 必须停容器 | `deploy/standalone/maintenance.mjs`、`gray-hours.sh` |
| G4 | 灰度认证模式是 `telegram`；账号与会话的 `mode` 必须等于运行时 `PAYEASE_AUTH_MODE`；`telegram` 模式的注册完成守卫对非 Telegram 已验证账号要求 `verification_completed=1`（L1 契约 F19，**迄今只在 demo 模式下由真实代码测过**） | `lib/registration-policy.ts`、`lib/h5-auth-core.ts` |
| G5 | 网关只在请求**没带** `payease_company` 时才补写公司 Cookie；客户端自带的专用租户 Cookie 原样保留 | `deploy/standalone/server.mjs:214` |
| G6 | 网关为每个请求合成访客身份（`payease_visitor`，首次由服务端签发），请求 URL 用 `https://<Host>` 构造，所以 `Origin: https://<Host>` 通过同源校验；灰度配置没设 `PAYEASE_ALLOWED_ORIGINS`，不需要设 | `server.mjs:203-211`、`lib/request-security.ts` |
| G7 | 灰度启动时已为公共租户（`cfg.companies[0]`）建立 `team_service_settings(auto_assign=1)`、机构和贷后部门；L1 fixture 的专用租户**不创建** `team_service_settings`（L1 契约 F22），不受影响，也不得改动公共租户 | `server.mjs:130-139` |
| G8 | `/api/*` 网关限流按真实客户端 IP 每分钟 240 次；倍率 `PAYEASE_GATEWAY_RATE_SCALE` 仅在 local/gray 且非正式域名生效；写在 `config.json` 里，改动要重启容器 | `server.mjs:151-154,202` |
| G9 | 灰度 Caddy 使用 `tls internal`（自签），直连源站 IP 的 HTTPS 客户端无法校验证书；B0 目前没有跳过校验的机制，只有 `--origin-ip/--host` 与 `LOADTEST_ALLOWED_HOSTS` 白名单 | `deploy/standalone/Caddyfile.gray`、`run-b0.sh`、`b0-main-flow.js:54-68` |
| G10 | `check-config.mjs` 已能判定灰度配置是否可部署（拒绝占位符、demo、非灰度域名）；容器基础镜像是 `node:22.22.1-bookworm-slim`（自带 `node:sqlite`） | PR #44、`deploy/standalone/Dockerfile` |
| G11 | 现有 `backup.sh` 依赖 rclone 远端；不适合作为"写库前的恢复点" | `deploy/standalone/gray/backup.sh` |

## 2. 角色分工

| 谁 | 做什么 |
|---|---|
| Codex（苏晨） | 写 L1-G1、L1-G2 代码与测试，在**本机 Docker** 验证；PR 交 Claude 评审 |
| 技术负责人（owner） | 批准每一次灰度执行窗口、批准改 `CUSTOMER_ROWS` 或限流倍率（独立闸门）、合并 PR |
| 操作员（苏晨本人，人工） | 在 159.223.77.134 上停/启容器、运行 fixture 命令；在 165.22.108.5 上运行压测；传输 manifest |
| Claude | 契约、评审、闸门结论；不登录服务器 |

## 3. gray-config 档的实现要求（L1-G1）

### 3.1 入口与运行环境
- 命令仍是 `node scripts/loadtest/fixture/cli.mjs plan|apply|cleanup`，新增 `--profile gray-config`，参数：
  `--config /run/config.json`、`--d1-dir /data/d1`、`--base-url https://testapi.khmerx.org`、`--expect-rows off|on|shadow`、`--dataset`、`--run-id`、`--count`、`--output-dir /out/manifests`，写入时另需 `--apply --confirm <指纹> --app-stopped --backup-ref <文件>`。
- **只允许在容器内运行**：要求环境变量 `L1G_CONTAINER=1`（人工命令里显式设置）、`process.platform==='linux'`、`--d1-dir` 的 `realpath` 必须正好是 `/data/d1` 之内且无符号链接、库文件 `nlink==1`。不满足一律拒绝。
- 运行用户必须是 `1000:1000`（与应用同属主，写出的库文件及 WAL 不改变属主）；`getuid()!==1000` 拒绝。
- 容器无网络（`--network none`）：代码中**不得**发起任何网络请求，不得读取 `PAYEASE_*` 以外的环境变量。

### 3.2 目标核验（任一失败即拒绝，且零写入）
1. 读取 `--config`，**只提取以下字段**，其余（尤其 Telegram 令牌、`sessionSecret`、`accessPassword` 等）不得解析进日志、不得写入任何输出：`host`、三个 hosts 列表、`PAYEASE_ENV`、`KHMERX_TEST_MODE`、`PAYEASE_AUTH_MODE`、`CUSTOMER_ROWS`、`KYC_DATA_SECRET`、`KYC_DATA_KEY_ID`（可选）、`companies[0].id/slug`。
2. 必须通过 `deploy/standalone/gray/check-config.mjs` 的 `checkConfig(config)`（**只读导入**，不复制其规则），且结果 `deployable===true`；样例/占位符一律拒绝。
3. `PAYEASE_ENV==='gray'`、`KHMERX_TEST_MODE==='false'`、`PAYEASE_AUTH_MODE==='telegram'`；`--expect-rows` 必须等于配置里的 `CUSTOMER_ROWS`（防止"以为是 on 实际是 off"）。
4. `--base-url` 的主机必须等于 `testapi.khmerx.org`（默认；放行集合在代码里写死为 `testapi.khmerx.org`、`testpayease.khmerx.org`，不接受命令行扩展），协议 `https:`；任何包含 `payease.khmerx.org`、`payeas.khmerx.org`、`admin.khmerx.org`、`api.khmerx.org`（不带 `test` 前缀）的 URL 或配置主机一律拒绝。
5. **D1 库归属**：在 `--d1-dir/miniflare-D1DatabaseObject/` 下只允许恰好**一个**含 `team_companies` 的库，且其中存在 `id==companies[0].id` 且 `slug` 相同的公共租户；0 个或多个 → 拒绝。
6. `--app-stopped` 必须显式给出；`--backup-ref` 指向的文件必须存在、大小>0、修改时间在 30 分钟内、**不在** `--d1-dir` 之内（由操作员在停应用后用 `tar` 生成，见 §7）。这两项是对操作员声明的校验，工具无法自行证明应用已停，因此指纹摘要里写入这两项的声明值，供评审追溯。
7. `--output-dir` 的真实路径必须是 `/out/manifests`，目录属主 1000、权限 `700`，不得是符号链接；manifest 文件创建权限 `600`（沿用 A1 `privateFile` 的 Linux 检查，并**新增**对目录权限的检查，修复 L1-A 评审 P2-1）。
8. 打开库时 `PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE`；拿不到锁（说明应用仍在运行）立即中止。

### 3.3 写入内容
- **与 L1 契约 §3.3 / §3.3a 完全一致**（专用租户 + Ops 部门 + 账号/会话/KYC；五种数据集）。差异仅有：
  - `mode` 用 `telegram`；账号 `phone_key`、`phone_mask` 沿用虚构格式，**不得**写入 `channel_id`、Telegram 用户 ID 或任何真实标识；
  - `phone_verified=1`、`verification_completed=1`（G4，必须由 §5.1 的真实 `telegram` 模式测试证明足够）；
  - KYC 载荷用配置里的 `KYC_DATA_SECRET`（及可选 `KYC_DATA_KEY_ID`）加密，仅在内存中使用；
  - manifest 的 `target`：`profile:'gray-config'`、`env:'gray'`、`authMode:'telegram'`、`customerRows`=配置值、`hosts:['testapi.khmerx.org']`、`baseUrl:'https://testapi.khmerx.org'`、`configFingerprint`=对"允许提取的非机密字段"的哈希前 12 位。
- 公共租户及其全部记录**不得被读写之外的任何方式触碰**；apply 与 cleanup 都要对"非本 runId 的全部表内容"做前后哈希对比（沿用 A2 `unrelated()`；灰度库较大时，哈希只覆盖行数+稳定列摘要的实现需在 PR 中说明，且不得降低对公共租户相关表的覆盖）。
- 会话默认有效期 2 小时，上限 6 小时；**manifest 的 `expiresAt` 必须早于下一个灰度关闭时刻**（周六 17:45，见 D-08）；工具不知道当前星期，所以由操作员在窗口计划里保证，评审以 runbook 为准。

### 3.4 清理与库内核查
- `cleanup` 沿用 L1 契约 §3.6 的七项归属检查与删除顺序，同样需要停应用、`--app-stopped`、备份引用、`--confirm`。
- 新增只读子命令 `db-check`（供 `verify-rows` 的"库内核查"在灰度使用）：输入 manifest，输出**仅计数与布尔结论**（`customer_workspaces`/`loan_index`/旧工作区贷款/分单/审计数量，是否符合 `off`/`on` 预期，Ops 部门是否唯一，是否存在非 fixture 客户），**不得**输出 token、客户标识明文清单或配置字段。同样需要应用已停。
- 清理后租户 `active=0` 保留、审计保留（沿用墓碑规则）；报告写明"灰度累计墓碑数量"。

## 4. 压测侧要求（L1-G2）

修改范围见 §8；**本地回环行为与现有测试必须保持不变**。

1. **目标放行**：`rows-flow.js`、`rows-preflight.mjs`、`verify-rows.mjs` 新增灰度放行，条件**全部**成立才允许：manifest `profile==='gray-config'`、`env==='gray'`；`BASE_URL` 等于 manifest `baseUrl` 且主机在 §3.2-4 的放行集合；环境变量 `LOADTEST_ALLOWED_HOSTS` 同时包含该主机名与 `ORIGIN_IP`；`ORIGIN_IP` 为合法 IPv4 且等于 `159.223.77.134`（写死为默认放行 IP，其他 IP 需改代码并经评审）。
2. **直连源站**：沿用 B0 的 `--origin-ip/--host` 思路，用 k6 的 `hosts` 选项把主机名解析到 `ORIGIN_IP`；**仅在直连源站时**设置 `insecureSkipTLSVerify:true`（G9），其他任何情况（含本地回环以外的目标但未设 `ORIGIN_IP`）一律保持校验；报告首行必须写"灰度直连源站，已跳过证书校验，未经 Cloudflare"。
3. **经 Cloudflare 的运行**不在本卡范围（会引入 Cloudflare 的限流、挑战和不同的客户端 IP 语义）；需要时另开契约。
4. 请求要素沿用 L1 契约 §3.4：`payease_company=<专用租户>`、`payease_h5_session=<token>`、`Origin: https://testapi.khmerx.org`、`Content-Type: application/json`；**不得**自带 `payease_visitor`（由网关签发）。
5. `verify-rows.mjs` 在灰度档只执行 HTTP 类检查（读回分类、会话失效、跨客户访问、错误 owner、`create`/`confirm_bill` 重放、提交成功但客户端超时）；**库内核查**在灰度由 §3.4 的 `db-check` 在源站完成，其结论由操作员把 JSON 带回，`verify-rows` 的灰度报告只引用该 JSON，不得自行打开任何数据库。
6. 报告首行在 L1 契约 §9 的基础上增加：目标（`testapi.khmerx.org` 直连 `159.223.77.134`）、`PAYEASE_GATEWAY_RATE_SCALE` 与 `PAYEASE_LIMIT_SCALE` 的**实际值**（由操作员填入命令参数 `--declared-scales`，因压测机读不到配置）、`CUSTOMER_ROWS` 实际值、"synthetic fixture：非 Telegram 注册、非认证压测"。**灰度结果不得命名为"600 并发验证"，除非观测并发达到目标的 80%（L1 契约 §4.3）。**
7. 资源采样仍由 `sample-resources.sh` 在 159.223.77.134 上运行（README 已写明），本卡不改。

## 5. 必须补充的验收

### 5.1 L1-G1（全部在本机 Docker，`node:22.22.1-bookworm-slim`，`--network none`）
1. A1/A2 现有专项测试在该镜像里全部通过（证明代码在 Node 22 可运行，不依赖 Node 25）。
2. 构造"类灰度"环境：临时目录模拟 `/data`，含一份通过 `checkConfig` 的真实形状 `config.json`（随机伪造密钥）、应用全部真实迁移的 D1 目录（外键开启、触发器完整）、并按 `server.mjs:130-139` 的同样 SQL 种入公共租户（测试中注明"必须与 server.mjs 一致"，并加一个对源文件相关片段的断言以防漂移）。
3. **`telegram` 模式真实 create**：用 A2 的运行时适配（真实 `mutate`/`ensureAssignment`/`getSession`/`requireRegistrationComplete`，配置 `PAYEASE_AUTH_MODE=telegram`），对 fixture 客户通过注册守卫并 `create`、`confirm_bill` 成功（**这是 G4 的唯一证明**；失败则说明 `verification_completed=1` 不足，必须停下更新本契约，不得自行加字段）。
4. 拒绝场景各一个且"零写入"（整库快照前后相同）：非容器环境、非 `/data/d1` 路径、符号链接、`nlink>1`、非 1000 用户、`checkConfig` 失败（样例、占位符、demo、`KHMERX_TEST_MODE=true`、`PAYEASE_ENV` 非 gray）、`--expect-rows` 不符、基准 URL 为正式域名/非 https/非放行主机、库中无公共租户或有多个候选库、缺 `--app-stopped`、缺/过期/位于 d1 内的 `--backup-ref`、输出目录权限或属主不符、库被另一连接持有写锁。
5. 公共租户全部相关行在 apply 和 cleanup 前后内容哈希不变。
6. **机密不外泄**：对 `plan/apply/cleanup/db-check` 的全部 stdout、stderr、报告文件做扫描，不得出现配置里任何机密值（含 Telegram 令牌、`sessionSecret`、`accessPassword`、`KYC_DATA_SECRET`）、会话 token 或客户标识明文清单。
7. L1 契约 §8-9 的 a–h 在 `gray-config` 档下对应成立（含：清理后仅留墓碑与审计、未使用数据集完整删除、外键始终开启、触发器 SQL 不变）。
8. `git diff` 中无 `lib/**`、`app/**`、`drizzle/**`、`deploy/**` 改动。

### 5.2 L1-G2
1. 现有 L1-B 全部测试保持通过（回环行为不变）。
2. 放行逻辑单元测试：只有 §4-1 的全部条件成立才放行；缺任一条件、正式域名、非 `ORIGIN_IP`、`http:`、`insecureSkipTLSVerify` 在非直连时开启，均拒绝。
3. 测试**不得解析或访问任何 khmerx.org 域名或 159.223.77.134**（网络隔离容器内运行）。
4. 对一个本机的自签 HTTPS 测试服务器（模拟网关的最小子集：`/api/h5/state` 与 Cookie/Origin 校验）跑一遍 `smoke` 级别（3 客户）rows 流程，证明灰度放行路径、`hosts` 解析、证书跳过、Cookie/Origin 要素和报告首行均正确；该测试服务器是测试夹具，不得冒充灰度证据。
5. 报告字段按 §4-6；token 不出现在报告里。

## 6. 数据集与时间窗口（灰度）

- 每个窗口：`smoke`(3) → `main`(N) → `timeout`(3) → `aux`(6) → `wrong-owner`(0)，五个 manifest，各自独立 runId；**冒烟客户不得进入正式运行**（沿用）。
- 默认规模：先 `main=100` 的灰度冒烟级运行，再按 owner 批准的规模（300/600）；每档都是新的 `main` 数据集（不复用已写入的客户）。
- `off` 与 `on` 对照：切换 `CUSTOMER_ROWS` 需要改 `config.json` 并重建容器，**属于独立闸门，需 owner 批准**；两种模式各用全新的一套数据集，且切换前先清理上一模式的数据集。
- 所有窗口避开周六 17:45 之后；周六不扩量（D-08）。

## 7. 人工操作流程（源站 159.223.77.134 与压测机 165.22.108.5）

> 全部由人工执行，Codex 不得执行。命令为模板，路径以实际部署为准。`$REPO=/opt/payease/app`。

**准备（一次性）**
```
install -d -o 1000 -g 1000 -m 700 /opt/payease/loadtest /opt/payease/loadtest/manifests
```

**A. 写入 fixture（源站，停机窗口）**
1. 确认 `check-config.mjs` 对 `/opt/payease/data/config.json` 为 PASS，`/healthz` 正常，owner 已批准本窗口与规模。
2. `cd $REPO && docker compose -f deploy/standalone/gray/compose.gray.yaml stop payease`
3. 备份恢复点（应用已停）：`tar -C /opt/payease/data -czf /opt/payease/loadtest/d1-before-<runId>.tgz d1`
4. dry-run：
```
docker run --rm --network none --user 1000:1000 -e L1G_CONTAINER=1 \
  -v $REPO:/app:ro -v /opt/payease/data:/data -v /opt/payease/data/config.json:/run/config.json:ro \
  -v /opt/payease/loadtest:/out -w /app node:22.22.1-bookworm-slim \
  node scripts/loadtest/fixture/cli.mjs plan --profile gray-config --config /run/config.json --d1-dir /data/d1 \
  --base-url https://testapi.khmerx.org --expect-rows off --dataset main --run-id <runId> --count 100
```
5. 核对摘要与指纹；原参数再加 `apply --apply --confirm <指纹> --app-stopped --backup-ref /out/d1-before-<runId>.tgz --output-dir /out/manifests`，对五个数据集依次执行。
6. `docker compose ... start payease`；等 `curl -fsS http://127.0.0.1:4300/readyz` 正常。
7. 通过安全渠道（`scp`，目标为压测机个人目录）传 manifest；传完后在源站**保留**（cleanup 需要）。

**B. 压测（压测机 165.22.108.5）**
8. 源站同时启动 `sample-resources.sh`。
9. `LOADTEST_ALLOWED_HOSTS=159.223.77.134,testapi.khmerx.org`，带 `ORIGIN_IP=159.223.77.134`、`BASE_URL=https://testapi.khmerx.org`、`--declared-scales` 运行 `run-rows.sh`：先 `smoke`，再 `main`；再跑 `verify-rows` 的 HTTP 检查（`timeout`、`aux`、`wrong-owner`）。
10. 报告与资源 CSV 提交到 `scripts/loadtest/reports/`（无 token）。压测机上的 manifest 在用完后 `shred -u`。

**C. 库内核查与清理（源站，停机窗口）**
11. 再次 `stop payease`，重新做 §A-3 的备份（`d1-after-<runId>.tgz`）。
12. 对每个数据集：`db-check`（只读）→ `cleanup` dry-run → 核对 → `cleanup --apply --confirm <指纹> --app-stopped --backup-ref ...`。
13. `start payease`，等 `/readyz`；删除源站上的 manifest（`shred -u`）；备份 tgz 按需保留或删除（含虚构数据）。
14. 把 `db-check` 与 `cleanup-report.json`（仅计数与哈希）交给 Claude 评审。

**回退**：任一步异常 → 停应用 → 用对应 `d1-before-<runId>.tgz` 还原 `/opt/payease/data/d1`（先 `mv` 当前目录留底，再 `tar -xzf`）→ 启动并核对 `/readyz`；还原动作由 owner 批准。

## 8. 拆卡与允许范围

### L1-G1：gray-config 档、`db-check`、测试
- 分支 `feat/server/L1-G1`（`Line: server`），基于最新 `origin/main`。
- **允许修改**：`scripts/loadtest/fixture/**`、`tests/loadtest-fixture.test.mjs`、`tests/loadtest-gray-fixture.test.mjs`（新增）、`scripts/loadtest/README.md`（追加灰度章节，含 §7 命令）。
- **只读导入**：`deploy/standalone/gray/check-config.mjs`。
- **禁止修改**：`lib/**`、`app/**`、`drizzle/**`、`deploy/**`、`b0-main-flow.js`。
- 同时修复 L1-A 评审 P2：manifest 目录权限检查（§3.2-7）；拒绝一切 `*.khmerx.org` 的 local-harness 配置主机；补足被拒绝场景测试（其余禁止表、`loan_index` 不符、旧工作区陌生贷款）。
- PR < 400 行；超过按"gray-config 目标核验/写入"与"db-check/清理/测试"拆为有顺序的子 PR。

### L1-G2：灰度压测入口
- 分支 `feat/server/L1-G2`（`Line: server`），依赖 L1-G1 评审通过（可堆叠）。
- **允许修改**：`scripts/loadtest/{rows-flow.js,run-rows.sh,rows-preflight.mjs,verify-rows.mjs,analyze-rows.mjs}`、`tests/loadtest-rows*.test.mjs`、`tests/loadtest-gray-rows.test.mjs`（新增）、`scripts/loadtest/README.md`（追加）。
- **禁止修改**：同 G1；`b0-main-flow.js`。
- PR < 400 行，超过则拆。

## 9. 灰度执行前置条件（缺一则 HOLD）

1. L1-G1、L1-G2 已评审通过并合并。
2. 灰度源站已部署：`config.json` 填入真实凭据，`check-config.mjs` 为 PASS；`/healthz`、`/readyz` 正常；`testapi.khmerx.org` 不再 521；Caddy/TLS/Cloudflare 就绪（人工）。
3. owner 书面批准本次窗口、规模，以及限流倍率设置（G8：单 IP 压测需放大 `PAYEASE_GATEWAY_RATE_SCALE`，建议 30；仅 local/gray 生效；压测后恢复 1）。
4. 操作员确认停机窗口可接受（默认接受，D-03）。
5. 压测机 165.22.108.5 已装 k6 与本仓库脚本；`LOADTEST_ALLOWED_HOSTS` 已设置。

## 10. 给 Codex 的提示词

### L1-G1
```
【任务】L1-G1：fixture 的 gray-config 档、db-check 与测试。严格按 docs/tasks/codex-prompts/L1-G-gray-fixture.md 的 §1、§3、§5.1、§8 实现；L1 契约（L1-rows-loadtest-revision.md）里已冻结的内容一律沿用，不得改动；遇到两份契约都没写的行为，按"冻结的默认"处理并写进 PR "假设"段。
先读：本文全文、L1 契约、scripts/loadtest/fixture/*.mjs、tests/loadtest-fixture.test.mjs、deploy/standalone/server.mjs（第 15、29、130-140、214 行）、deploy/standalone/gray/check-config.mjs、lib/registration-policy.ts、lib/h5-auth-core.ts。
只在本机 Docker（node:22.22.1-bookworm-slim，--network none）里验证；不要登录或操作 159.223.77.134 / 165.22.108.5，不要对任何 khmerx.org 域名发请求；不改 lib/**、app/**、drizzle/**、deploy/**。
特别注意：§5.1-3 要用真实代码在 telegram 模式下证明 verification_completed=1 足够；失败就停下并汇报，不要自行加字段。机密（Telegram 令牌、sessionSecret、accessPassword、KYC_DATA_SECRET、会话 token）不得出现在任何输出。PR 小于 400 行，超过就拆。
```

### L1-G2
```
【任务】L1-G2：灰度压测入口。严格按 docs/tasks/codex-prompts/L1-G-gray-fixture.md 的 §4、§5.2、§8 实现，依赖 L1-G1（可堆叠）。
先读：本文全文、L1 契约、scripts/loadtest/{rows-flow.js,run-rows.sh,rows-preflight.mjs,verify-rows.mjs,analyze-rows.mjs,run-b0.sh}。
本地回环行为与现有测试必须保持不变；灰度放行条件必须全部成立（profile、主机、ORIGIN_IP、LOADTEST_ALLOWED_HOSTS）；证书校验仅在直连源站时跳过；测试不得访问任何 khmerx.org 域名或 159.223.77.134；不改 b0-main-flow.js 和 lib/**、app/**、drizzle/**、deploy/**。PR 小于 400 行，超过就拆。
```

## 11. 剩余 OPEN 问题

| # | 问题 | 默认 / 处理 |
|---|---|---|
| L1G-1 | 停应用写库的停机窗口 | 默认接受（D-03）；owner 在每个窗口前批准 |
| L1G-2 | 经 Cloudflare 的灰度压测 | 不在本卡；另开契约，且受 Cloudflare 限流/挑战影响 |
| L1G-3 | 限流倍率与 `CUSTOMER_ROWS` 切换的闸门 | 每次改动由 owner 批准，改完需重启容器；压测后恢复 |
| L1G-4 | 工具无法自证应用已停 | 以 `BEGIN IMMEDIATE` 拿不到锁即中止 + 操作员声明 + 备份引用追溯；不引入新机制 |
| L1G-5 | 灰度库上"全库内容哈希"的开销 | 实现需在 PR 说明；公共租户相关表必须完整覆盖 |
| L1G-6 | 墓碑与审计在灰度累积（L1 契约 OPEN-9） | 默认接受；灰度库整体废弃时一并清除 |
| L1G-7 | 灰度外的真实验证：Telegram 凭据、DNS/TLS、ClamAV | 属人工与 Q14，不由本卡验证 |

---

**L1-G CONTRACT: READY**
**L1-G1 IMPLEMENTATION: GO**（仅代码与本机 Docker 测试）
**L1-G2 IMPLEMENTATION: GO**（依赖 L1-G1 评审通过后堆叠）
**GRAY / VPS EXECUTION: HOLD**（§9 前置条件未满足，且需 owner 逐窗口批准）
**OPEN BLOCKERS**：灰度真实凭据与 DNS/TLS/Cloudflare 就绪（人工）；owner 对停机窗口、限流倍率和规模的批准；L1G-1…7 为记录项，不阻塞本地实现。
