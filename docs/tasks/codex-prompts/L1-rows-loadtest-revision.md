# L1 压测 Contract 修订：baseline 与 rows 两种场景

状态：修订版 v2　核对基线：`origin/main` = `8109cac`（代码基线与 `90f5939` 相同，之后只合并了状态文档）
适用卡：L1（原 P1 + P8）拆为 **L1-A（fixture）** 与 **L1-B（rows 场景）**
原则：**本文冻结所有会影响结果可信度的行为**；Codex 不得在实现时自行决定本文已写明的事项，遇到本文没写的，按"冻结的默认"处理并写进 PR "假设"段。

---

## 0. 结论速览

- baseline 与 rows 是**两个不同的测试**：baseline 测"认证前置 → KYC 读取 → 上传 → 保存 → 提交 → 状态轮询"，**不是**客户分片写入性能；rows 才测客户分片。两者的报告、文件名、结论不得混用。
- rows 的最小合法流程：`GET 状态 → 同步屏障 → POST create → POST confirm_bill → GET 轮询校验`；不使用 KYC 保存/提交，不包含签名、贷款申请提交、审批、放款、还款。
- 账号与会话采用"专用测试租户 + 离线 fixture + 预置短期会话"；**不开启 demo 认证，不加认证绕过接口，不改任何业务代码**。
- 本轮 rows 的**实现可以开始（本地）**；**灰度执行仍被阻塞**，原因见 §11（灰度配置样例本身启动不了，先修 Q4）。

## 1. 已核实事实（附代码依据）

| # | 事实 | 依据 |
|---|---|---|
| F1 | 客户 `create` 要求该客户 KYC 已审核通过，否则 409 | `lib/store.ts::mutate`：`creationCase?.status!=='approved'` → `请先完成 KYC 资料审核…` |
| F2 | `create` 成功后贷款状态为 **`kyc_approved`**，并写入 `kycCaseId/kycRevision` | `mutate`：`target.status='kyc_approved'` |
| F3 | KYC 保存/提交写 `kyc_cases`/`kyc_files`，不写客户分片，不能证明分片写入 | ARC-01-lite §6；`/api/kyc` 路由 |
| F4 | B0 手机号 = `+1202555` + `100 + ((__VU+__ITER)%100)`，600 VU 只对应 100 个身份 | `scripts/loadtest/b0-main-flow.js:135` |
| F5 | demo 认证需要 `isTestMode()`，否则 503 `AUTH_DEMO_FORBIDDEN`；灰度禁止 `KHMERX_TEST_MODE=true`（standalone 启动即拒绝） | `lib/h5-auth-core.ts::config`、`deploy/standalone/server.mjs` |
| F6 | `lib/loan-signing.ts::saveLoanSignature` 仍直接访问旧租户 JSON；贷款全链路尚未切到分片 | 状态文档 2026-10-15、ARC-01-lite §7 |
| F7 | `scripts/customer-rows/seed-5000.mjs` 只生成虚构**贷款**数据（`synthetic-customer-NNNNN`/`synthetic-loan-NNNNN`），没有账号、会话、KYC | 脚本内容 |
| F8 | 客户 API 鉴权链：网关身份头 + 证明 → `payease_company` Cookie（须是 `team_companies` 里有效的 `t_<uuid>`）→ `payease_h5_session` Cookie（64 位十六进制，库里存 SHA-256）→ `h5_sessions.owner/mode/expires_at/credential_version` 全匹配 → 注册完成守卫 | `app/h5-auth.ts::customer`、`lib/h5-auth-core.ts::getSession`、`lib/registration-policy.ts` |
| F9 | 写接口强制 `Origin`（须在允许列表内）、`Content-Type: application/json`、请求体 ≤ 4096 字符 | `lib/http/route.ts::readJsonBody`、`lib/request-security.ts` |
| F10 | **幂等键是请求体里的 `requestId`（8–100 字符）**，服务端改写为 `<customerId前16位>:<requestId前80位>` 存入该客户的 `requests`；`X-Request-Id` 头只是追踪编号，`X-Idempotency-Key` 头服务端不读取 | `lib/domain.ts::customerAction`、`applyAction` |
| F11 | 重复 `create`（不同 requestId）会返回 409（`请先完成当前申请，再发起新的申请`）；乐观锁耗尽返回 409 `CONFLICT`（`其他操作刚刚更新了记录，请重试`）——**两者的 `code` 都是 `CONFLICT`** | `mutate`、ARC-00 |
| F12 | `confirm_bill` 是合法的客户写操作（状态须为 `registered/needs_info/kyc_pending/kyc_approved`），要求 `billConfirmed:true` 与 `quoteId==loan.billing.quoteId`；`create` 后（t_ 租户）贷款带 `billing`；写 `billConfirmedAt` | `lib/domain.ts` case `confirm_bill` |
| F13 | 状态 GET/POST 在 `CUSTOMER_ROWS=on` 时只读写该客户一行；`CUSTOMER_ROWS` 是**运行时全局**绑定，不是按租户的开关 | `lib/customer-shards.ts::customerRowsMode`、`lib/store.ts` |
| F14 | 旧租户 JSON 有 1.5MB 上限，超过抛 `WORKSPACE_PAYLOAD_LIMIT`；600 笔贷款在 `off` 模式下可能触达该上限 | `lib/workspace-payload.ts` |
| F15 | 网关对 `/api/*` 按**真实客户端 IP** 每分钟 240 次限流；压测机是单一 IP，不放大倍率会大量 429（倍率只在 local/gray 生效） | `deploy/standalone/server.mjs`、S-LT1 |
| F16 | standalone 启动时把 `cfg.companies` 写入 `team_companies`，并遍历 `company.accounts`、使用 `company.slug`；种入的状态里机器人 `phoneVerification:false, passwordSetup:false` | `deploy/standalone/server.mjs` 130–139 行 |
| F17 | `team_companies` 必填列：`id`（须匹配 `^t_[a-f0-9-]{36}$`）、`name`、`slug`（唯一）、`active`、`default_department` | `drizzle/0000…`、`lib/team/server.ts::companyByCookie` |
| F18 | 会话 token 存库为 `sha256(token)` 十六进制；`getSession` 需 `s.mode == 运行时 PAYEASE_AUTH_MODE`、`credential_version` 与账号一致、`expires_at`（秒）未过期 | `lib/h5-auth-core.ts` |
| F19 | 注册完成守卫：`telegram` 模式下除"Telegram 已验证账号"外都要求 `verification_completed=1`；租户机器人 `passwordSetup !== false` 时要求账号有密码哈希 | `lib/registration-policy.ts` |

**不得违反**：不新增公开认证绕过接口；不改贷款业务规则；不放宽生产限制；不修改鉴权、KYC、签约或迁移代码来配合压测；不调用 Telegram、不发送验证码。

## 2. 两种场景（冻结）

### 2.1 baseline：KYC 基线
- 流程（沿用 B0，不改行为）：`GET /api/h5/auth`（认证预检）→ `POST /api/h5/auth/send` → `POST /api/h5/auth/verify`（演示验证码）→ `GET /api/kyc` → 4 次 `POST /api/kyc/files`（虚构 JPG）→ `POST /api/kyc`（save）→ `POST /api/kyc`（submit）→ 轮询状态。
- 计入压测的步骤：上述全部；**认证前置的 3 步使用 demo 认证，只能在允许 demo 的本地环境运行**（F5）。
- 报告限制：身份数 = 100（F4）；报告首行固定写"baseline：身份数 100，不代表 N 个客户"；结果**不得**命名为"客户分片写入性能"。
- **灰度不能跑 baseline**（需要 demo 认证），除非另有"合成会话版 baseline"的契约（OPEN-5，本轮不做）。

### 2.2 rows：客户分片
目标：单租户、N 个不同 `customerId`（默认 N=50 本地验收，N=600 为灰度/大规模），并发访问真实客户状态 API。

**每个虚拟用户（VU）= 一个客户 = 一个预置会话，一对一，禁止取模复用。**

每个 VU 一次迭代，步骤（全部走真实 HTTP，经网关/代理）：

| 步 | 请求 | 期望 | 用途 |
|---|---|---|---|
| 1 | `GET /api/h5/state` | 200；`kyc.status=='approved'`；`state.loans.length==0`；`revision==0` | 校验 fixture 与会话有效 |
| 2 | 等待同步屏障 `START_AT`（见 §6） | — | 让写入集中到同一时间窗口 |
| 3 | `POST /api/h5/state` `{action:'create', role:'mini', amount:5000, name:'SYNTH <序号>', consent:true, termDays:14, requestId:'<runId>-<序号>-create'}` | 200；`state.loans.length==1`；`loan.status=='kyc_approved'`；`loan.customerId==自己`；有 `billing.quoteId` | 分片写入第 1 次 |
| 4 | `POST /api/h5/state` `{action:'confirm_bill', role:'mini', loanId, billConfirmed:true, quoteId:<步骤 3 返回>, requestId:'<runId>-<序号>-bill'}` | 200；`loan.billConfirmedAt` 非空；`status` 仍为 `kyc_approved` | 分片写入第 2 次（合法、同一客户的第二次写） |
| 5 | `GET /api/h5/state` ×3（间隔 1 秒） | 与步骤 4 返回一致；`loans.length==1`；归属为自己 | 读回校验（持久化与一致性） |

- 金额必须取 `[3000,5000,10000,50000]` 之一；`name` ≥ 2 字符；请求体 ≤ 4096 字符（F9）。
- **本轮不包含**：KYC 保存/提交、`apply`、`sign`、审批、放款、还款。**不得虚构"保存贷款资料""提交贷款"。**
- **不持续压测**：每客户一次迭代（共 2 次写 + 4 次读）。`create` 每客户只能成功一次（F11），所以不循环 `create`；"已有申请冲突"一律算失败，**不得**视为成功。需要更长窗口时只能用更多客户（新 runId + 新 fixture），不得复用已写入数据。
- 重复运行：新 runId、新 fixture、新租户（§4）。

### 2.3 off / on 对照
- 同一 rows 场景分别在 `CUSTOMER_ROWS=off` 与 `on` 下各跑一次，使用**两套独立、等价的 fixture**（两个 runId、两个专用租户）：`CUSTOMER_ROWS` 是运行时全局绑定（F13），切换需重启/重配运行时，因此 **先跑完 off（租户 A），再切换配置、重启，再用新 fixture（租户 B）跑 on**；禁止在同一份已写入数据上切开关复跑。
- 两套 fixture 的参数（客户数、金额、名字规则、会话有效期）必须相同，只有 runId/租户/客户 ID 不同。
- `off` 下 600 笔贷款可能触达 1.5MB 上限（F14）：出现 `WORKSPACE_PAYLOAD_LIMIT` 时**单独统计并写入报告**，它是结论的一部分，不是脚本错误。

## 3. 虚构账号与会话准备（fixture）

### 3.1 环境边界（硬规则）
1. **两种 profile，二选一**，由 `--profile` 指定：
   - `local-harness`：仅本地。数据目录必须是仓库 `.wrangler/state`（`scripts/dev-app-backend` 的本地库），目标 URL 仅 `127.0.0.1`/`localhost`。
   - `gray-config`：仅灰度。必须传 `--config <运行时 config.json 的只读副本>` 与 `--d1-dir <灰度 D1 目录>`；**只能由人工操作员在灰度源站上运行**，Codex 不得运行。
2. **默认 dry-run**；写入必须同时给 `--apply` 与 `--confirm <指纹>`。dry-run 打印"目标摘要"与其指纹（见 3.2），操作员核对后才能带指纹重跑。
3. **拒绝写入的情况**：`--profile` 缺失；config 缺失（gray-config）；`bindings.PAYEASE_ENV` 不是 `local`/`gray`；config 的任何主机含 `payease.khmerx.org`、`admin.khmerx.org`、`api.khmerx.org`、`payeas.khmerx.org`；gray-config 下 `KHMERX_TEST_MODE==true`；`PAYEASE_AUTH_MODE` 不是 `demo`/`telegram`；找不到 `team_companies` 表；`--d1-dir` 不在允许根目录内（`/data/d1` 或仓库 `.wrangler/state`）；指纹不匹配。
4. **不能只靠传 `--env gray` 自证**：环境判断来自 config 里的实际绑定值与 D1 目录里的实际库，不来自命令行参数。
5. **只新增、不修改**：不修改现有客户、不重置整库、不触碰生产。所有写入限定在本 runId 的**专用租户**（§3.3）。

### 3.2 目标摘要与指纹
dry-run 输出并哈希（SHA-256，取前 12 位作为指纹）：`profile、PAYEASE_ENV、PAYEASE_AUTH_MODE、CUSTOMER_ROWS、主机列表、D1 库文件路径与大小、现有 team_companies 数量、现有 h5_accounts 数量、将创建的客户数、runId、租户 ID`。不含任何密钥。

### 3.3 必要记录矩阵（rows 场景所需的**全部**记录）

| 表 | 记录 | 关键字段与规则 |
|---|---|---|
| `team_companies` | 1 条专用租户 | `id='t_'+uuid`；`name='LOADTEST-<runId>'`；`slug='loadtest-<runId>'`（唯一）；`active=1`；`default_department='<id>:ops'`；`pricing_json` 省略（走默认费率） |
| `demo_workspaces` | 该租户 1 条 | `payload` = 与 standalone 种入一致的初始状态：`loans:[]`、两个机器人均 `enabled:true, phoneVerification:false, passwordSetup:false`、其余数组为空；`revision=0` |
| `h5_accounts` ×N | 每客户 1 条 | `customer_id='synthetic-<runId>-NNNNN'`（全局唯一）；`owner=租户`；`phone_key='synthetic:<runId>:NNNNN'`（满足 `(owner,phone_key)` 唯一）；`phone_mask='+000 •••• NNNN'`（不可拨打）；`mode=运行时 PAYEASE_AUTH_MODE`；`phone_verified=1`、`verification_completed=1`（**合成断言**：为了通过 `telegram` 模式下的真实守卫，见 F19）；`password_hash=NULL`（因专用租户机器人 `passwordSetup:false`）；`credential_version=0`；`source_channel='SY'`；`customer_ref` 省略 |
| `h5_sessions` ×N | 每客户 1 条 | `token_hash=sha256(随机 32 字节十六进制)`；`owner=租户`；`customer_id` 同上；`phone_mask` 同上；`mode` 同账号；`expires_at=<秒>`，默认 now+7200；`credential_version=0` |
| `kyc_cases` ×N | 每客户 1 条 | `id=uuid`；`owner=租户`；`customer_id`；`revision=1`；`status='approved'`；`updated_at`；`payload`=按 `lib/kyc/server.ts::seal(value,'case:'+id)` 同算法加密的最小合法 `CasePayload`（使用目标运行时的 `KYC_DATA_SECRET`，仅在目标主机上读取，不落盘、不打印） |

- **不创建**：`team_units`、`team_assignments`、`team_members`、`kyc_files`、初始贷款、客户分片、`loan_index`、公开编号。这些在 `create` 时由真实代码生成。因此该租户**只适用于 `/api/h5/state`**，不适用于 KYC 页面或员工视图（脚本输出与 README 必须写明）。
- 如果目标租户的机器人配置要求密码（`passwordSetup !== false`），脚本**拒绝**生成伪造哈希；可选参数 `--with-password` 用与 `lib/h5-auth-core.ts` 相同的 `v2:600000:<salt>:<hash>` 格式 + 随机丢弃的密码生成合法哈希，默认不启用。
- 账号标识全部虚构，不使用可拨打手机号，不向 Telegram 发任何消息。fixture 在报告里必须标注 **"synthetic fixture：非 Telegram 注册、非认证压测"**。

### 3.4 会话语义
- 随机、独立、短期（默认 2 小时，最长 6 小时）；每客户一个；库里只存哈希。
- `mode` 必须等于运行时 `PAYEASE_AUTH_MODE`（灰度是 `telegram`，本地 harness 是 `demo`）；不一致则拒绝。
- 不修改任何守卫；注册完成、版本、过期校验都按真实代码通过。
- 逐项核实真实 API 所需的请求要素（缺一不可，k6 脚本必须全部带上）：
  - Cookie：`payease_h5_session=<token>`、`payease_company=<租户 id>`（显式带，不依赖网关补写）；
  - `Origin: https://<Host>`（POST 必带，须在允许列表；本地 harness 用代理允许的来源）；
  - `Content-Type: application/json`（POST）；
  - 网关身份：经真实网关时由网关注入（`payease_visitor` Cookie 由网关签发，VU 第一次请求可不带）；经本地 harness 时用 `K6_USER_ID/K6_USER_EMAIL`（同 B0）；
  - 直连源站时用 `--origin-ip` 与 `--host`（沿用 B0 白名单规则）。

### 3.5 manifest（敏感测试凭据）
格式（JSON，`formatVersion:1`）：
```
{ "formatVersion":1, "synthetic":true, "runId":"...", "createdAt":"ISO", "expiresAt":"ISO",
  "target":{"profile":"local-harness|gray-config","env":"local|gray","authMode":"demo|telegram",
            "customerRows":"off|shadow|on","tenantId":"t_...","hosts":["testapi.khmerx.org"],"configFingerprint":"<12位>"},
  "customers":[{"index":1,"customerId":"synthetic-<runId>-00001","sessionToken":"<64hex>"}, ...],
  "integrity":{"count":N,"sha256":"<对 customerId 与 token 哈希拼接的摘要>"} }
```
- **含明文会话 token，属于敏感凭据**：不入 Git（`scripts/loadtest/manifests/` 与 `*.manifest.json` 写入 `.gitignore`）、不进报告、不打印、日志只出现 `index` 与 `customerId`。
- 存放：Linux 文件权限 `600`、目录 `700`；Windows 用 `icacls` 去除继承并只授予当前用户。传输：通过人工安全渠道（如 `scp` 到压测机的个人目录），**禁止**放在任何公开下载目录（包括 `/opt/payease/downloads`）。
- **k6 启动前的预检（`scripts/loadtest/rows-preflight.mjs`，任一失败即拒绝运行）**：`customers.length ≥ VUS`；`customerId` 唯一；`sessionToken` 唯一且格式为 64 位十六进制；`expiresAt` 晚于"当前时间 + 预计测试时长 + 10 分钟"；`target.hosts` 包含本次 `--host`/`BASE_URL` 的主机；`target.customerRows` 与操作员声明的本次模式一致；文件权限不宽于 600（Linux）。
- 撤销与删除：测试结束后执行 `fixture cleanup`（§3.6）撤销库里的会话；然后删除 manifest 文件（Linux 用 `shred -u`，Windows 删除后清空回收站），并在 README 写明磁盘残留的风险。

### 3.6 清理
- 清理独立于准备：`fixture cleanup --manifest <文件>`，默认 dry-run，`--apply --confirm <指纹>` 才执行。
- 只允许处理 **manifest 里记录的专用租户与客户**：先校验 `team_companies.name` 以 `LOADTEST-` 开头且 `slug`/`id` 与 manifest 一致；校验 `h5_accounts` 中该租户的 `customer_id` 集合与 manifest 完全相同（多一个、少一个都拒绝）；再按主键删除：`h5_sessions`、`h5_accounts`、`kyc_cases`、`customer_workspaces`、`loan_index`、`demo_workspaces`、`public_identifiers`（仅限该租户 owner）、`team_companies`。
- **禁止**宽泛前缀删除（如 `DELETE … LIKE 'synthetic-%'`）、禁止整租户之外的删除、禁止清空整库。删除前后输出各表行数对照，写入 `cleanup-report.json`。

## 4. 请求、重试与统计口径（冻结）

### 4.1 幂等与重试
- 写请求的幂等键 = 请求体 `requestId`（F10），格式固定 `<runId>-<序号>-<动作>`，**同一操作的所有重试使用同一个 `requestId`**。`X-Request-Id` 头每次请求单独生成，只用于追踪。
- **超时后的结果不确定**：写请求超时/连接中断时，可能已经写入。处理：用**同一 `requestId` 重发**。**注意两个动作的服务端行为不同**（`lib/store.ts::mutate` 在进入 `applyAction` 的幂等检查之前，先做"已有未结束申请"检查）：`confirm_bill` 重发走 `applyAction` 幂等，返回 200 且不重复写；**`create` 重发（无论 requestId 是否相同）在第一次已成功时返回 409 `请先完成当前申请，再发起新的申请`，不是 200**。因此 `create` 重发得到该 409 时**不是失败**，必须 `GET /api/h5/state` 判定：恰好 1 笔、归属自己、状态 `kyc_approved` → 计入 `create_ok_after_replay`（单列，不并入首次成功）；0 笔 → `create_missing`；多于 1 笔 → `duplicate_loans`。最终以 §6 的一致性校验为准。
- 重试规则：

| 响应 | 处理 |
|---|---|
| 409 且 `error` 含"其他操作刚刚更新了记录"（乐观锁耗尽） | 可重试，最多 3 次，退避 `100ms×2ⁿ + 随机 0–100ms`，上限 1s |
| 409 其他（例如首次 `create` 即返回"请先完成当前申请…"） | **不重试，算失败**（业务冲突）；仅"`create` 重发后的该 409"例外，见上 |
| 网络错误/超时 | 同 `requestId` 重发，最多 2 次，退避同上；`create` 重发得到"请先完成当前申请"的 409 时按上文用 GET 判定，不重试、不直接算失败 |
| 502/503/504（含网关过载 503 + `Retry-After`） | 遵守 `Retry-After`（上限 5s），最多 2 次 |
| 429 | **不重试**，计入 `rate_limited`；本次运行若 429 占请求 > 0.5%，报告首行标注 **INVALID：被限流**（应先调高灰度网关倍率） |
| 400/401/403/404/413/5xx 其他 | 不重试，算失败 |

- 由于两类 409 的 `code` 都是 `CONFLICT`（F11），上表对"乐观锁 409"的识别依赖中文提示文本，**这是脆弱的启发式**：报告必须写明"乐观锁冲突按提示文本识别（OPEN-1）"。

### 4.2 指标
- **HTTP 409** 数、**业务 `CONFLICT`（code）** 数、**客户端重试次数**（按触发原因：409 乐观锁、超时、5xx）分别统计，互不合并。
- **服务端内部乐观锁重试成功次数目前不可观测**：报告中写 `unavailable`，**不得写 0**。
- 每个客户的最终结果必须落入且仅落入一类，所有类别之和 = 计划客户数 N（失败或提前终止的客户**不得**从分母消失）：`completed`、`not_started`、`aborted`、`create_failed`、`confirm_failed`、`create_ok_after_replay`（超时/重发后经 GET 确认的成功，单列）、`create_missing`（读回时没有贷款）、`duplicate_loans`、`wrong_owner_loan`、`status_mismatch`、`bill_not_confirmed`。
- **冲突率 < 1%** 的定义（写死）：分母 = 全部**首次**写请求数（create 与 confirm_bill，各自首次发送，不含重试）；分子 = 首次请求即返回"乐观锁 409"的数量；重试产生的 409 另列"重试期 409"，不进入该比率；同时报告"重试后仍失败"的客户数。
- 延迟：对 `create`、`confirm_bill`、`state_get` 分别给出 p50/p95/p99；每秒请求数；写阶段与读阶段分别统计。

### 4.3 "600 并发"的诚实口径
- 启动 600 个 VU ≠ 600 个同时在途请求。脚本使用同步屏障（§6）让写入集中；报告必须同时给出：**VU 数、计划屏障时刻、实际观测到的写请求最大同时在途数**（由 per-request CSV 的区间扫描线算出，不是 k6 参数）。
- 观测并发 < 目标并发 × 0.8 时，报告首行标注"**观测并发不足**"，该结果不得用于闸门 E。
- 统计窗口：**写窗口** = [首个 `create` 发出时刻, 最后一个 `confirm_bill` 返回时刻]；**读回窗口** = 其后的轮询。吞吐与延迟按窗口分别给出；窗口长度、客户数写入报告。

## 5. 安全预检、执行、清理的顺序（Runbook，写进 README）

1. **预检（只读）**：`fixture plan`（dry-run）→ 核对摘要与指纹 → 确认目标不是生产。
2. **准备**：`fixture apply --confirm <指纹>`（人工，在目标主机上）→ 生成 manifest → 通过安全渠道传到压测机。
3. **预检（压测机）**：`rows-preflight`（manifest 唯一性、有效期、目标绑定）→ 失败则停止。
4. **抽样冒烟**：3 个客户跑完整流程（`GET` → `create` → `confirm_bill` → `GET`），失败则停止（说明 fixture 与实际配置不匹配）。
5. **正式运行**：`run-rows.sh`（k6）→ 生成原始 CSV + 报告 JSON。
6. **校验**：`verify-rows`（§6）：读回校验、跨客户访问、错误 owner、会话失效、重复请求、超时后重试；库内核查（本地）。
7. **清理**：`fixture cleanup`（dry-run → apply）→ 删除 manifest。
8. **归档**：报告（无 token）提交到 `scripts/loadtest/reports/`。

## 6. 同步与校验细节

- **同步屏障**：运行脚本在启动 k6 前计算 `START_AT = 现在 + 15 秒`（毫秒时间戳）并通过环境变量传入；每个 VU 完成步骤 1 后 `sleep` 到 `START_AT` 再发步骤 3。屏障时刻与每个 VU 实际发出时刻（相对 START_AT 的偏移）写入 CSV。
- **per-request CSV**：必须使用 `k6 --out csv=…` 保存每个请求的时间戳与耗时；`scripts/loadtest/analyze-rows.mjs` 用区间扫描线算出写请求最大同时在途数、每秒请求数与窗口。
- **verify-rows**（Node，HTTP + 库）：
  - 读回：对每个 manifest 客户 `GET /api/h5/state`，分类到 §4.2 的结果类别。
  - **会话失效**：另备 3 个"已过期"和 3 个"已撤销"的 fixture 会话（fixture 额外生成，不计入 N）→ 期望 401 `AUTH_REQUIRED`。
  - **跨客户访问**：客户 A 的会话对客户 B 的 `loanId` 执行 `confirm_bill` → 期望 404（`申请不存在或不属于当前客户`）。
  - **错误 owner**：带**第二个**专用租户的 `payease_company` 与客户 A 的会话 → 期望 401。
  - **重复请求**：① `create`：对已成功的客户用同一 `requestId` 重发 → **期望 409（`请先完成当前申请，再发起新的申请`）**，随后 `GET` 显示 `loans.length` 仍为 1、`revision` 不变（这是当前代码的真实行为，契约按它冻结）；② `confirm_bill`：用同一 `requestId` 重发 → 期望 200，`revision` 不变、`billConfirmedAt` 不变。
  - **提交成功但客户端超时**：对 3 个未使用的客户，发出 `create` 后立刻销毁连接（不读响应），轮询到贷款出现（≤10 秒），再用同一 `requestId` 重发 → 期望该重发返回 409（同上）或 200，二者都接受，但最终必须只有 1 笔贷款，且分类为 `create_ok_after_replay`。
  - **库内核查（本地独立打开 SQLite，只读）**：`on` 模式：`customer_workspaces` 与 `loan_index` 各恰好 N 行（该租户），**旧 `demo_workspaces.payload` 里该租户没有任何 fixture 客户的贷款**；`off` 模式：旧 JSON 里有 N 笔贷款，`customer_workspaces` 无该租户行。不得只相信运行参数。

## 7. 拆卡

### L1-A：fixture、manifest、预检与清理
- 分支：`feat/server/L1-A`（`Line: server`）；依赖：无（可基于 `origin/main`）。
- **允许修改**：`scripts/loadtest/fixture/**`（新增）、`scripts/loadtest/rows-preflight.mjs`（新增）、`scripts/loadtest/.gitignore`（新增）、`tests/loadtest-fixture.test.mjs`（新增，用临时 SQLite 测试）、`scripts/loadtest/README.md`（仅追加 fixture/runbook 章节）。
- **可导入但不得修改**：`scripts/dev-app-backend/common.mjs`（`openDevDb`）、`scripts/customer-rows/common.mjs`；需要写库时可使用 Node 自带的 `node:sqlite`。
- **禁止修改**：`lib/**`、`app/**`、`drizzle/**`、`deploy/**`、`scripts/customer-rows/**`、`scripts/dev-app-backend/**`、已有的 `b0-main-flow.js`。
- **自查**：`npm test`、`npm run typecheck`、`npm run lint`、`git diff --check`、手动 dry-run 输出与拒绝场景。
- **回退**：删除新增文件即可；不涉及迁移与业务代码。

### L1-B：rows 场景、统计与本地验收
- 分支：`feat/server/L1-B`（`Line: server`）；依赖：L1-A 已评审通过（可堆叠）。
- **允许修改**：`scripts/loadtest/rows-flow.js`、`run-rows.sh`、`analyze-rows.mjs`、`verify-rows.mjs`（均新增）、`scripts/loadtest/README.md`（追加 rows 章节）、`tests/loadtest-rows.test.mjs`（新增）。
- **禁止修改**：同 L1-A 的禁止项；`b0-main-flow.js`（baseline 保持原样）。
- **自查**：同上；**本地 50 个不同客户**真实 HTTP 跑通并保留报告（见 §8）。
- **回退**：删除新增文件即可。
- 任一卡超过 400 行 → 拆成有顺序的子 PR（例如 L1-A1 `fixture` / L1-A2 `cleanup+preflight`）。

## 8. 客观验收

1. 本地 **50 个不同客户**通过真实 HTTP API 完成 rows 全流程（`off` 与 `on` 各一次，各用独立 fixture），报告文件保留在 `scripts/loadtest/reports/`（不含 token）。
2. 生成一份 **600 客户 manifest**，`rows-preflight` 的唯一性、会话独立性、目标绑定、有效期检查全部通过（不要求实际压测 600）。
3. `on` 模式下独立核查库：`customer_workspaces` 与 `loan_index` 各 50 行；旧租户 JSON 无 fixture 客户贷款。`off` 模式反之。
4. 最终状态不一致的客户数 = 0，且全部 50 个客户都计入统计（各类别之和 = 50）。
5. `verify-rows` 的六类检查（会话失效、跨客户访问、错误 owner、重复请求、提交成功但客户端超时、库内核查）全部有结果且符合期望。
6. `fixture` dry-run 不写库（对库前后做行数对比）；生产域名、缺失/模糊的 config、PAYEASE_ENV 非 local/gray、指纹不符均被拒绝（各有测试）；cleanup 不会删除 runId 之外的数据（构造一份无关数据验证它仍在）。
7. 不调用 Telegram、不发验证码、不新增认证绕过、不放宽任何正式域名规则（diff 中无 `lib/**`、`app/**`、`deploy/**` 改动）。
8. 本地结果在报告首行标注"本地 harness，非灰度、非 600 客户实测"，**不冒充灰度或 600 的结果**。
9. 灰度执行与资源采样由**人工**完成；缺少人工提交的报告与资源 CSV 时，L2、Q12 继续 BLOCKED。

## 9. 报告必须包含（首行即写）

场景（`rows`/`baseline`）、fixture runId、`git rev-parse HEAD`、实际配置（`PAYEASE_ENV`、`PAYEASE_AUTH_MODE`、`CUSTOMER_ROWS`、`PAYEASE_LIMIT_SCALE`、`PAYEASE_GATEWAY_RATE_SCALE`）、主机/直连方式、客户数 N、VU 数、k6 版本、屏障时刻、**观测并发**、窗口长度、各类别客户数、冲突率与分母、重试统计、`WORKSPACE_PAYLOAD_LIMIT` 次数、"服务端内部乐观锁重试：unavailable"、`INVALID`/`观测并发不足` 标记（如有）。

## 10. 给 Codex 的提示词

### L1-A
```
【任务】L1-A：虚构账号 fixture、manifest、预检与清理。严格按 docs/tasks/codex-prompts/L1-rows-loadtest-revision.md 的 §1、§3、§5、§7、§8 实现；遇到该文档没写明的行为，按"冻结的默认"处理并写进 PR "假设"段，不要自行决定关键行为。
先读：该文档全文、docs/tasks/decision-log.md、lib/h5-auth-core.ts（getSession、digest）、lib/registration-policy.ts、lib/team/server.ts（companyByCookie、pricingFor）、lib/kyc/server.ts（seal/unseal 与 case 载荷）、deploy/standalone/server.mjs（companies 种入段）、scripts/dev-app-backend/common.mjs、scripts/customer-rows/common.mjs、drizzle/ 中 h5_accounts/h5_sessions/kyc_cases/team_companies/demo_workspaces 的建表与追加列。
允许/禁止修改与自查见 §7 的 L1-A；不得修改 lib/**、app/**、deploy/**、drizzle/**。
要点：profile 两种；默认 dry-run；--apply 必须带 --confirm <指纹>；§3.1 的拒绝条件逐条有测试；§3.3 的记录矩阵一条不少、也不多；会话只存哈希；manifest 权限与 .gitignore；rows-preflight 的全部检查；cleanup 只按 manifest 主键删除并核对客户集合。
不得使用 demo 认证绕过，不得生成伪造密码哈希，不得调用 Telegram。测试用临时 SQLite，不碰真实库。PR 小于 400 行，超过则拆成有顺序的子 PR。
```

### L1-B
```
【任务】L1-B：rows 场景、统计与本地验收。严格按 docs/tasks/codex-prompts/L1-rows-loadtest-revision.md 的 §2、§4、§5、§6、§7、§8、§9 实现，依赖 L1-A（可堆叠）。
先读：该文档全文、scripts/loadtest/b0-main-flow.js 与 run-b0.sh（沿用其主机白名单与 --origin-ip/--host 机制）、app/api/h5/state/route.ts、lib/domain.ts（create 与 confirm_bill）、lib/http/route.ts。
要点：每 VU 一个客户一个会话（按 manifest 下标，禁止取模）；步骤严格为 §2.2 的 5 步；同步屏障；写请求 requestId 在请求体里、重试复用；重试规则按 §4.1 表；乐观锁 409 按提示文本识别并在报告标注为启发式；服务端内部重试写 unavailable；k6 --out csv 保留逐请求数据并由 analyze-rows.mjs 算观测并发；verify-rows 完成六类检查；报告字段按 §9。
不得修改 b0-main-flow.js；不得新增 KYC 保存/提交、签名、审批等步骤；本地 50 客户 off/on 各跑一次并保留报告。PR 小于 400 行，超过则拆分。
```

## 11. 剩余 OPEN 问题

| # | 问题 | 影响 | 处理 |
|---|---|---|---|
| OPEN-1 | 乐观锁 409 与业务 409 的 `code` 都是 `CONFLICT`，客户端只能靠提示文本区分 | 冲突率有启发式误差 | 另开服务端小卡：给乐观锁冲突加稳定判别（例如 `params.reason` 或专用 code）；在此之前报告标注启发式 |
| **OPEN-2（阻塞灰度）** | `deploy/standalone/gray/config.json.example` **启动不了且客户 API 不可用**：① `companies[0]` 没有 `slug` 与 `accounts`（`server.mjs` 会遍历 `company.accounts`、插入 `slug`，启动即异常）；② 公司 id `gray-public-company` 不符合 `^t_[a-f0-9-]{36}$`，网关补写的 `payease_company` 会被拒绝（`公司工作区无效`）；③ 缺少 `PAYEASE_AUTH_MODE`（缺省为 disabled，客户接口 503），以及 `KYC_DATA_SECRET`、`CUSTOMER_ROWS`、`TELEGRAM_BOT_TOKEN_*` 说明 | 灰度上任何 rows/baseline 都无法运行 | **Q4 返修**：修正样例并附"启动前自检"脚本；L2 解除阻塞前必须完成 |
| OPEN-3 | 灰度 fixture 由谁、在哪个路径、如何处理 D1 写锁（网关在线时 SQLite 写锁短暂占用） | 人工步骤可能失败 | 默认：操作员在源站上运行，`busy_timeout=5000`、每批 50 行事务、失败即中止并报告；需要苏晨确认 D1 文件路径（`/data/d1/...`）与是否允许在线写入 |
| OPEN-4 | 灰度 rows 运行所需的限流倍率：压测机单 IP，`/api/*` 每分钟 240 次（F15）；600 客户约 3600 次请求/分钟 | 不放大会出现大量 429 | 默认：灰度 `PAYEASE_GATEWAY_RATE_SCALE=30`（仅 local/gray 生效）并写入报告；上线前恢复 1 |
| OPEN-5 | baseline 在灰度无法运行（需要 demo 认证） | 灰度只能做 rows | 本轮不做"合成会话版 baseline" |
| OPEN-6 | `off` 模式 600 客户可能触达 1.5MB 上限 | `off` 结果可能整体被限制截断 | 按 §2.3 单独统计 `WORKSPACE_PAYLOAD_LIMIT`，这是对照的组成部分 |
| OPEN-8 | `create` 的幂等重放返回 409 而非 200：`mutate` 的"已有未结束申请"检查先于 `applyAction` 的 requestId 检查，客户端超时后重试体验差 | 压测靠 GET 判定，可行但不优雅 | 本契约不改业务代码；另开服务端小卡（Q 档外，需评审）：同一客户同一 requestId 的重放应返回当前状态 200。完成前按 §6 的 409 预期验收 |
| OPEN-7 | `confirm_bill` 在 `kyc_approved` 之后是否算"合法的第二次写" | 若产品认为不合法，则 rows 只剩 1 次写 | 依据 `lib/domain.ts` 判定为合法；若要改，需产品确认 |

---

**L1 CONTRACT: READY**（本地范围；灰度范围 BLOCKED，见 OPEN-2）
**CODEX IMPLEMENTATION: GO**（L1-A、L1-B，仅本地 harness 与单元测试；**HOLD**：任何灰度/VPS 执行）
**OPEN BLOCKERS**：OPEN-2（灰度配置样例无法启动，阻塞 L2）；OPEN-3（灰度 fixture 的人工操作细节）；OPEN-1/4/5/6/7 为记录项，不阻塞本地实现。
