# KhmerX Android 客户端 · 现有接口契约

- 版本：**v3（2026-10-08，据 `43` 对账：错误码/REQUEST_FAILED、repay/withdraw 后端阻断、无 100 单数量检查、未知状态回退、剩余应还派生、P1 字段边界、Mini App 专属）**；v2（2026-10-07，术语与 AF-6 事实对账）
- 来源：直接阅读 `E:\KhmerX\KhmerX` 现有代码得出，**不是设计稿**。Android 客户端按本文调用**现有**接口，不要求后端改动。
- 标记：**[读码]** 已读到对应代码；**[未读]** 未读代码，仅知道路径存在；**[待验证]** 依赖部署环境，需联调确认。
- 适用部署：生产入口为 `api.khmerx.org` / `payease.khmerx.org` 的 standalone 代理（`deploy/standalone/server.mjs`），`PAYEASE_AUTH_MODE=telegram`（均由项目方确认）。
- 后端行为随版本变化，本文描述的是**当前实现**，不是永久产品政策保证；以联调结果为准。F-01（客户自行还款）已在当前代码中被后端阻断（见 3.6）。

## 1. 基础约定

### 1.1 主机
| 主机 | 说明 |
|---|---|
| `https://api.khmerx.org` | **App 使用**。只放行 `/api/*`，其余路径返回 404 JSON。 |
| `https://payease.khmerx.org` | Web 客户端主机，App 不用。 |

代理只接受白名单 Host，其余返回 400。

### 1.2 Cookie（App 必须像浏览器一样维护）[读码]
| Cookie | 谁设置 | 作用 | 备注 |
|---|---|---|---|
| `payease_visitor` | 代理，首次响应下发 | 访客身份（签名值 `uuid.hmac`），代理据此注入身份头 | HttpOnly，30 天。没有它每次请求都会被分配新访客。 |
| `payease_company` | **App 自己发送** | 选定公司，格式 `t_<uuid>`，正则 `^t_[a-f0-9-]{36}$` | 缺省时代理补成第一家公司。格式不对或公司已停用返回 403。 |
| `payease_h5_browser` | 服务端，`GET /api/h5/auth` 下发 | 64 位十六进制的浏览器标识，验证码挑战与它绑定 | **Max-Age 24 小时**；缺失时 send/verify 返回 401“登录页面已失效”。 |
| `payease_h5_session` | 服务端，登录成功下发 | 会话凭据，64 位十六进制 | HttpOnly，SameSite=Strict，**24 小时绝对过期**，无滑动续期。 |

要点：
- 会话与公司绑定（`owner` = 公司 ID）。**换公司 = 另一套会话**，Cookie 必须按公司分开存放。
- 会话 Cookie 就是凭据，必须存入安全存储，不能写普通文件。
- 请求头带的 `oai-*` 会被代理剥离，App 不要依赖。

### 1.3 请求头与跨站校验 [读码]
所有 **POST** 都做同源校验：
- `Origin` 必须**严格等于** `https://api.khmerx.org`（与请求实际 Host 一致）。原生客户端需手动设置，否则一律 403“不允许跨站操作”。
- `Content-Type` 必须以 `application/json` 开头（JSON 接口）。
- 二进制上传接口（KYC 文件、签名）不要求 JSON，但仍要求 `Origin`。

### 1.4 请求体大小
| 接口 | 上限 |
|---|---|
| `/api/h5/*`（含 `/api/h5/state`、`/api/h5/locale`） | **4096 字节** |
| `POST /api/kyc` | 50000 字节 |
| 文件上传、签名上传 | 10 MB（`KYC_FILE_MAX_BYTES`），且不得小于 16 字节 |

超限返回 413。

### 1.5 响应与错误
- 成功响应带 `Cache-Control: no-store`。
- 错误体为 JSON：`{"error":"<中文提示>","code":"<标识>","retryAfter":<秒，可选>}`。字段语义：
  - **`error`**：**消息文本（中文）**，仅供日志/兜底，不得作为本地化文案或程序分支依据。
  - **`code`**：当前实现下，经 `json()`/`failure()` 输出的每个 `error` 响应体**都会带有 `code`**（`lib/h5-auth.ts` 的 `json()` 调用 `addErrorCode`，`lib/error-codes.ts`）。来源分两类：**显式码**（`AuthError.code`、`KycError.code`，如 `CUSTOMER_SETTLEMENT_FORBIDDEN`、`AUTH_DEMO_FORBIDDEN`、`TELEGRAM_INITDATA_REPLAY`、`FUNDING_LIMIT_EXCEEDED`）；**推断码**（没有显式码时由 HTTP 状态与中文文案**子串匹配**推断，如 `AUTH_REQUIRED`、`FORBIDDEN`、`NOT_FOUND`、`CONFLICT`、`RATE_LIMITED`、`REQUEST_FAILED`…）。**推断码依赖文案子串，并非稳定枚举**；`code` 的值集合不是封闭契约。
  - **不得假设"所有接口一定带 `code`"**：未经 `json()`/`failure()` 的响应（或未读到的路由）可能没有 `code`。客户端必须把 `code` 视为**可选**，缺失时回退到"HTTP 状态 + 通用本地化文案"。
  - **`retryAfter`**：**可选的限流元数据**（秒），仅在限流类错误（`AuthError` 带 `retryAfter`）出现；此时响应同时带 `Retry-After` 头。客户端按契约/需求的钳制规则使用，不假设它存在。
- **`POST /api/h5/state` 的失败折叠**见 3.5：非 KYC 类底层失败统一折叠为 HTTP 400 `{"error":"操作未完成，请确认申请归属、当前状态与填写内容后重试","code":"REQUEST_FAILED"}`。**Android MUST NOT 从 `REQUEST_FAILED` 推断原始业务原因**（见 3.5）。

| 状态码 | 含义 |
|---|---|
| 400 | 参数或业务规则不满足（文案具体） |
| 401 | 未登录、会话失效、`browser` 标识缺失 |
| 403 | 跨站、公司无效、注册步骤未完成（需先验证手机或设密码）、非本人资源 |
| 404 | 资源不存在或不属于当前客户 |
| 409 | **状态已变化、版本冲突、前置条件不满足**（业务正常分支，需刷新重试） |
| 413 / 415 | 请求过大 / 格式无效 |
| 429 | 限流 |
| 503 | 服务不可用，或登录服务未配置 |

## 2. 登录与账号

### 2.1 `GET /api/h5/auth` [读码]
进入登录页、选定公司后调用。无需登录。若缺少 `payease_h5_browser`，响应会 `Set-Cookie` 下发。
```json
{
  "company": "公司名 | null",
  "authenticated": false,
  "session": null,
  "mode": "telegram",
  "pending": null,
  "policy": {"channelId": "bot-1", "phoneVerification": true, "passwordSetup": true},
  "languages": {"en": true, "km": true, "zh": false}
}
```
- `languages` 由管理端设置，决定 App 可选语言。
- `policy.passwordSetup`：为 true 时，登录后**必须设置密码**才能进入业务接口（否则 403）。
- `policy.phoneVerification`：telegram 模式下恒为 true（Mini App 静默登录的账号除外，App 不适用）。
- `pending`：同一浏览器标识下尚未用完的验证码挑战，可用于恢复“输入验证码”界面。

### 2.2 发送验证码 `POST /api/h5/auth/send` [读码]
```json
{"phone": "+85512345678", "consent": true}
```
- 手机号去掉空格、括号、短横后须匹配 `^\+[1-9]\d{7,14}$`。
- `consent` 必须为 `true`（用户明确同意接收验证码）。
- 成功：
```json
{"challengeId":"<64位hex>","phoneMasked":"+855 •••• 5678","expiresAt":1700000000000,"retryAt":1700000060000,"mode":"telegram","message":"验证码请求已提交，请查看 Telegram 的 Verification Codes 会话"}
```
- 验证码由 **Telegram Gateway** 发送到用户 Telegram 的 “Verification Codes” 会话。**用户必须安装 Telegram 且该手机号已注册 Telegram，没有短信回退**。
- 限流：同一手机号 5 次/小时且重发间隔 60 秒；同一浏览器标识 10 次/小时；同一公司 30 次/小时。
- 有效期 5 分钟（`expiresAt` 为毫秒时间戳）。
- Telegram 返回“号码无效或未注册”时 400，文案提示核对手机号。

### 2.3 校验验证码 `POST /api/h5/auth/verify` [读码]
```json
{"challengeId": "<64位hex>", "code": "123456"}
```
- 成功：`{"authenticated":true,"session":{...}}`，并 `Set-Cookie` 下发会话。**首次验证成功即创建账号**（telegram 模式下不能“仅凭手机号注册”）。
- 5 次错误后挑战作废，需重新获取；校验期间有 20 秒锁；挑战一次性。
- 同一手机号已绑定其他账号时返回 409。

`session` 字段：
```json
{"customerId":"<hmac>","phoneMasked":"+855 •••• 5678","mode":"telegram","expiresAt":1700086400000,"phoneVerified":true,"verificationCompleted":true,"hasPassword":false}
```

### 2.4 密码 `POST /api/h5/auth/account` [读码]
| action | 请求体 | 说明 |
|---|---|---|
| `password_login` | `{"action":"password_login","phone":"+855…","password":"…"}` | 成功返回 `{authenticated,session,policy}` 并下发会话。失败统一 401“手机号或密码不正确”。限流：同号 5 次/15 分钟，同浏览器 10 次/15 分钟。 |
| `set_password` | `{"action":"set_password","password":"…","currentPassword":"…(已有密码时必填)"}` | 需已登录。**长度 12–128**。成功后其他会话被撤销。 |
| `register` | — | **telegram 模式下恒返回 409**，App 不使用。 |

### 2.5 找回密码 `POST /api/h5/auth/recovery` [读码]
- 发送：`{"action":"send","phone":"+855…","consent":true}`（同 2.2，挑战用途为 reset）
- 重置：`{"action":"reset","challengeId":"…","code":"123456","password":"…","confirmPassword":"…"}`
- 成功：`{"ok":true,"message":"…"}`，**旧会话全部失效**，需用新密码重新登录；密码 12–128 位，两次须一致。

### 2.6 退出 `POST /api/h5/auth/logout` [读码]
请求体任意 JSON（如 `{}`），成功 `{"authenticated":false}`，服务端撤销会话并解除浏览器标识绑定。

### 2.7 语言偏好 `POST /api/h5/locale` [读码]
`{"locale":"en"|"km"|"zh"}`，需登录。仅保存账号偏好，**是否允许使用某语言以 2.1 的 `languages` 为准**。

### 2.7a Mini App 专属能力（Native Android 不得假设存在）
- **Telegram 静默登录** `POST /api/h5/auth/telegram`（头 `X-Telegram-Init-Data`）：依赖 Telegram `initData`，**MINI APP ONLY**。
- **Telegram 提醒订阅/绑定** `GET/POST /api/telegram`（订阅需携带 `initData`）：**MINI APP ONLY**。
- Native Android 仍使用既有合同：**Telegram Gateway 验证码（`send`/`verify`）、密码登录、会话恢复、找回**；不因 Mini App 存在静默登录而改变。P1 不得假设上述两项能力存在。

### 2.8 登录后的门槛 [读码]
业务接口（`state`、`kyc`、`loan/sign` 等）都会检查注册完成度，不满足返回 **403**：
- `policy.phoneVerification` 为 true 且 `verificationCompleted` 为 false → “请先完成手机号验证”
- `policy.passwordSetup` 为 true 且 `hasPassword` 为 false → “请先设置密码”

因此登录后 App 必须先读 `session` 与 `policy`，必要时跳转设密码页。

## 3. 贷款状态 `/api/h5/state`

> **术语（2026-10-07 冻结）**：本文描述的是**现有 API**，字段与动作名保持不变（`billing`、`confirm_bill`、`billConfirmed`、`billConfirmedAt`），但在领域与产品层统一称呼为：
> **借款报价 / Loan Quote**（Create 前；创建后保存在 `loan.billing`）、**报价确认 / Quote Confirmation**（`billConfirmed:true`、旧动作 `confirm_bill`）、**还款账单 / Repayment Bill**（放款后的应还总额、已还、剩余、到期日）。不要求为术语修改旧 API。

### 3.1 `GET /api/h5/state` [读码]
```json
{
  "state": {"loans":[...],"bots":[...],"events":[...],"entries":[...],"notifications":[...],"requests":[]},
  "revision": 12,
  "kyc": {"status":"approved"} ,
  "pricing": { "version":1, "termDays":14, "...": "..." }
}
```
- `state` 已按当前客户过滤：只含本人贷款及其事件、分录、通知；`requests` 恒为空。
- `kyc` 为 `null`（尚无 KYC 记录）或 `{status}`，status ∈ `draft | submitted | needs_info | approved | rejected`。
- `pricing` 为公司定价；非公司工作区时为 `null`。
- **整份状态全量返回，没有条件请求或增量**（`revision` 可在客户端用于判断是否变化）。
- 客户端应**忽略未知字段**。`loan` 与 `events` 中含内部字段（如 `approvalActor`、事件备注里的员工信息），App 不展示。
- `state.events` 是**平铺数组**（已按当前客户的贷款过滤；服务端以 `unshift` 写入，数组为最新在前）；`state.loans` 同为最新在前。P1 对字段的**消费边界**见 3.7。

### 3.2 `Loan` 对象（客户端使用的字段）[读码]
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string(uuid) | 贷款编号 |
| `status` | enum | 见 3.4 |
| `amount` | int | **本金，单位美分** |
| `fee` | int | 费用，美分 |
| `paid` | int | 已还，美分 |
| `wallet` | int | 钱包余额，美分 |
| `createdAt` / `dueAt` / `signedAt` | ISO 时间 | `dueAt` 放款后才有 |
| `billing` | 借款报价对象（兼容名 `Bill`） | 创建申请时被接受的**借款报价**快照，见 3.3 |
| `billConfirmedAt` | ISO 时间 | **用户确认创建该 Loan 所依据借款报价的时间**（旧流程中为 `confirm_bill` 的时间） |
| `contract` | string | 合同 JSON 字符串，签约后才有 |
| `note` | string | **中文**状态说明，不可作为本地化文案 |
| `name` | string | 借款人姓名（大写） |

金额全部为**整数美分**，币种 USD，展示时除以 100 并保留两位。

### 3.3 `billing` 对象（领域名 Loan Quote，兼容名 `Bill`）[读码]
`quoteId`、`principal`、`deduction`、`interest`、`service`、`upfront`、`net`、`total`、`currency:'USD'`、`termDays`，以及定价参数（`deductionBps`、`annualInterestBps` 或 `monthlyInterestBps`、`interestTiming`、`serviceTiming`、`serviceBps`、`version`）。
- `net` = 到账金额；`total` = 应还总额；`upfront` = 放款时预扣部分。
- `quoteId` 是借款报价的唯一标识，**报价确认（`confirm_bill`）与提交申请（`apply`）都必须回传它**，报价变化后旧 `quoteId` 会被拒绝。目前它在 `create` 时才由服务端生成（CR-001 之后将在 Create 前由 Quote 接口生成，见 `07`）。
- 费用由**服务端计算**，客户端只展示，不要自行重算。

### 3.4 贷款状态机 [读码]
```
(创建) kyc_approved ──confirm_bill（Legacy 报价确认）──▶ kyc_approved(billConfirmedAt)
   ──[POST /api/loan/sign 手写签名]──▶ kyc_approved(已有合同)
   ──apply──▶ decision_pending ──[机构审批，后台]──▶ signed ──[机构放款，后台]──▶ active ──还清──▶ closed
decision_pending ──[机构拒绝]──▶ rejected
```
| status | 含义 | 谁推进 | App 可做 |
|---|---|---|---|
| `kyc_approved` | 申请已创建，待报价确认/签约/提交 | 客户 | 确认借款报价（Legacy）→ 签名 → 提交 |
| `decision_pending` | 已提交，待机构审批 | 后台 | 只读 |
| `signed` | 审批通过，待放款 | 后台 | 只读 |
| `active` | 已放款，还款中 | 后台（员工登记还款） | 只读（**客户 repay/withdraw 被后端阻断，见 3.6**） |
| `closed` | 已结清 | — | 只读（**不提供提现**，见 3.6） |
| `rejected` | 未通过 | — | 只读，可发起新申请 |
| `registered` `kyc_pending` `needs_info` `approved` | 旧流程/领域层遗留状态（`registered` 是 `applyAction('create')` 的领域默认值，客户路径已覆盖；`approved` 在当前审批路径中继续转 `signed`） | — | 按只读展示，不报错（见 3.7 未知/遗留回退） |
| **任何其它字符串**（未知/未来状态） | 未定义 | — | **只读回退，见 3.7** |

### 3.5 `POST /api/h5/state`：客户可用动作 [读码]
通用：`{"action":"…","requestId":"<8–100 字符>","loanId":"…", …}`
- **`requestId` 是幂等键**。服务端按“客户 ID 前 16 位 + requestId”去重（`lib/domain.ts:18`，成功后记入 `requests`）。**同一次用户操作的重试必须复用同一个 `requestId`，新的操作才生成新的**，建议用 UUID 并持久化到成功为止。
- **⚠ `create` 目前不是真正幂等（AF-6，P0，已读码确认）**：`mutate` 中“进行中申请”检查（`lib/store.ts:20`）先于 `requestId` 去重执行。`create` 已成功但响应丢失后，用**同一个 `requestId` 重试会得到 409「请先完成当前申请」**，而不是原结果。其余动作（`confirm_bill`、`apply`）的前置检查不会先于去重拦截（`withdraw`、`repay` 在进入 `mutate` 之前就被路由层阻断，见 3.6）一次成功的重试（`apply` 在 KYC 之后又被改动的极端情况除外）。**客户端兜底**：`create` 结果不确定后若收到该 409，`GET state`，若存在 `loan.billing.quoteId` 等于本次确认的 `quoteId` 的贷款，则判定为已成功。后端修复见 `07` §11。
- `create` 之外的动作都要求 `loanId` 属于当前客户，否则 400/404。
- 响应同 3.1（完整最新状态）。并发冲突时服务端内部最多重试 4 次，仍冲突返回错误“其他操作刚刚更新了记录，请重试”。
- **错误形状（以真实 handler `app/api/h5/state/route.ts` 为准）**：
  - **客户 `repay`/`withdraw`**：在 `mutate` 之前被路由层拒绝 → HTTP **403** `{"error":"还款或提现需通过机构审核及受支持的支付渠道处理","code":"CUSTOMER_SETTLEMENT_FORBIDDEN"}`（见 3.6）。
  - **`KycError`**（`lib/store.ts` 等抛出的带状态码的错误，如 404「申请不存在或不属于当前客户」、409「请先完成当前申请」「请先完成 KYC 资料审核」「审核资料版本已变化」、403「请由客户在 H5 会话操作」、400「请选择 14 天或 28 天贷款期限」、`validLoanContract` 的 409）：保持**自己的 HTTP 状态与 `error`**，`code` 为显式码或推断码。
  - **其它任何失败（非 `KycError` 的普通 `Error`）一律折叠**为 HTTP **400**：`{"error":"操作未完成，请确认申请归属、当前状态与填写内容后重试","code":"REQUEST_FAILED"}`（`code` 由 `addErrorCode` 对该文案推断得到）。被折叠的包括：金额/姓名/同意校验失败、`requestId` 无效、`quoteId` 不匹配（「请核对并确认当前费用账单」）、状态不允许（「申请状态已变化，请刷新后重试」）、乐观并发重试 4 次仍冲突（「其他操作刚刚更新了记录，请重试」）、不支持的动作等。
  - **Android MUST NOT infer original backend/business reason from `REQUEST_FAILED`。** 客户端只能把它映射为**通用的本地化"操作未完成，请刷新后重试"**，并建议刷新状态；**不得**猜测或展示"余额不足 / 状态错误 / 支付失败 / 金额非法"等隐藏原因。
  - 认证类外层失败（无会话、Origin/Content-Type、体积、注册未完成）走 `failure()`：保留 `AuthError` 的状态与显式 `code`，限流带 `retryAfter`。

| action | 额外参数 | 前置条件 | 结果 |
|---|---|---|---|
| `create` | `name`（≥2 字符）、`amount`（**仅 3000/5000/10000/50000 美分**）、`termDays`（**仅 14 或 28**）、`consent:true` | KYC 案件状态必须是 `approved`（否则 409）；**不能已有未结束的申请**（状态非 `closed`/`rejected`，否则 409）。**当前客户 create 路径中不存在 100 单（或任何）贷款数量上限**（见 7.11） | 新建贷款：领域默认 `registered`，**客户路径在持久化前覆盖为 `kyc_approved`**（`lib/store.ts:41`），并绑定 KYC 案件/版本、附加 `billing`（租户 owner）；响应中的状态即 `kyc_approved`。**此时借款报价已生成但尚未确认** |
| `confirm_bill`（Legacy 报价确认） | `loanId`、`billConfirmed:true`、`quoteId` | 状态 ∈ registered/needs_info/kyc_pending/kyc_approved；`quoteId` 须等于当前借款报价 | 记录 `billConfirmedAt`。**新流程（Option B）不再调用**，仅用于接续 Legacy 创建、尚未确认的贷款 |
| `apply` | `loanId`、`billConfirmed:true`、`quoteId` | 状态 = `kyc_approved`；**必须已完成签名合同**；KYC 版本未变 | status=`decision_pending` |
| `withdraw` | — | — | **BACKEND BLOCKED：HTTP 403 `CUSTOMER_SETTLEMENT_FORBIDDEN`，见 3.6。Android 不得暴露可执行的提现动作** |
| `repay` | — | — | **BACKEND BLOCKED：HTTP 403 `CUSTOMER_SETTLEMENT_FORBIDDEN`，见 3.6。Android 不得实现客户还款命令** |

不要使用 `confirm_kyc`、`submit_kyc`、`resubmit`、`sign`（旧流程动作，新流程由 KYC 接口与签名接口取代）。

### 3.6 提现与还款（重要）— **BACKEND BLOCKED**
- **客户 `repay` 与 `withdraw` 被后端阻断**：`POST /api/h5/state` 在调用 `mutate` 之前即对 `repay`/`withdraw` 抛出 `KycError(…,403,'CUSTOMER_SETTLEMENT_FORBIDDEN')`，线上表现为 **HTTP 403** `{"error":"还款或提现需通过机构审核及受支持的支付渠道处理","code":"CUSTOMER_SETTLEMENT_FORBIDDEN"}`（`app/api/h5/state/route.ts`）。领域层 `customerAction` 另有第二道防线（`lib/domain.ts:90`：除非 `allowInternalSettlement`，且当前无任何调用方设置它）。
- **不存在任何开关**：代码中**没有** feature flag / build-time flag / 远程开关能放开客户还款或提现；不得再使用"功能开关之后默认关闭""隐藏但可用"之类描述。H5 界面里的"去还款/提现"按钮是 **MOCK（界面外壳，提交必被 403）**。
- **Android 当前路线图：MUST NOT 实现客户还款命令；MUST NOT 暴露可执行的提现动作**（除非未来 Backend Contract 另行解锁）。只读的还款信息（应还/已还/剩余/到期日）见 3.7。
- 底层结算在领域层仅为**记账**（`测试还款`/`测试提现` 分录，无真实转账、无支付通道）；员工登记还款与机构回调不属于客户接口。真实还款将来若走支付通道，需新的 Backend Contract。

### 3.7 客户端兼容与显示派生规则（P1 消费边界）
**3.7.1 贷款状态兼容**
- 已知当前状态：`kyc_approved`、`decision_pending`、`signed`、`active`、`closed`、`rejected`。
- 已知遗留/领域状态：`registered`、`kyc_pending`、`needs_info`（贷款状态，**不等同于 KYC `needs_info`**）、`approved`。
- **Unknown/future loan status values MUST be treated as read-only fallback states。** 即：已知（当前/遗留）→ 正常映射；**未知字符串** → 内部可保留原值（脱敏日志用）、渲染通用只读"状态更新中"UI、**不得崩溃**、**不得推断生命周期含义**、**不得**依据未知值提供任何改变状态的 CTA；**不得**把未知值默认成 `registered` 或映射为任何已知业务状态。
- 状态标签由客户端按状态值本地化；服务端 `note` 为中文且可含员工文案，**不展示**。

**3.7.2 显示派生（DISPLAY DERIVATION；非后端字段、非价格计算）**
| 展示项 | 来源 | 规则 |
|---|---|---|
| 剩余应还 | `amount`、`fee`、`paid`（服务端事实字段） | `remaining = max(0, amount + fee − paid)`，整数美分。服务端**没有**权威"剩余/outstanding"字段；H5 `mini-client` 与 `lib/postloan/core.ts` 用同一算术。**这是只读展示派生，不是贷款价格计算，不改变 amount/fee/paid。** |
| 应还总额 | `amount + fee` | 同上（`billing.total` 在默认定价下与其一致，但不作为替代来源） |
| 短编号 | `id` | **DISPLAY DERIVATION**：纯 UI 截取/缩写，不是后端字段 |
| 期限 | `billing.termDays` | 缺失按 14（与 H5 一致） |
| 实际到账 | `billing.net` | 缺失用 `amount`（与 H5 一致）；不暗示已到账 |

**为什么必须 `max(0, …)`**：历史数据、舍入或员工登记差异可能使 `paid > amount + fee`；此时 UI **不得显示负的剩余金额**，显示 0。

**3.7.3 P1 字段使用边界（对齐 Product Remap V3 附录 B；不扩大 P1 产品范围）**
| 页面 | 使用的已有字段 |
|---|---|
| Home | `kyc.status`（`null`⇒未开始）；`state.loans[]` 的 `id`、`status`、`amount`、`fee`、`paid`、`dueAt`、`billConfirmedAt`、`contract`（仅判断存在）、`billing.termDays/net/total`（摘要） |
| 借款记录 | `state.loans[]`：`createdAt`、`billing.termDays`（缺失 14）、`amount`、`status`、`id`（短编号为 DISPLAY DERIVATION）。排序：`createdAt` 降序（缺失排最后） |
| 只读借款详情 | `status`、`amount`、`billing.termDays`、`billing.net`、应还总额（`amount+fee`）、`paid`、剩余应还（3.7.2）、`dueAt`、`billing.principal/net/total` 摘要、最近 5 条事件 |
| **忽略的内部字段** | `customerId`、`kycCaseId`、`kycRevision`、loan 内 `phoneMasked`、`approvalActor`、`approvalCheckedBy`、`fundingActor`、`fundingCheckedBy`、`note`、`signature`、`kyc`（legacy）、`demoDays`、`wallet`、`botId`、`bots[]`/`activeBotId`、`entries`、`notifications`、`requests`、`pricing`、`revision`（P3 才用）。未知字段一律忽略 |

**3.7.4 最近 5 条事件**：`state.events` 是**平铺**数组（已按客户贷款过滤），不按贷款分组。P1 必须：**按 `loanId` 过滤 → 按事件时间 `at` 降序（稳定）→ 取前 5**。仅展示 `action` 的本地化映射（未知 `action` ⇒ 通用「办理进度已更新」）；`note`/`role` 不展示。

## 4. KYC

### 4.1 读取 `GET /api/kyc` [读码]
首次访问自动创建 `draft` 记录。
```json
{
  "id":"<case id>", "revision":3, "status":"draft", "updatedAt":"…",
  "profile":{"values":{"surname":"…"},"files":{"idFront":{"id":"…","slot":"idFront","name":"idFront.jpg","type":"image/jpeg","size":123456,"sha256":"…"}},"consent":false,"declarationVersion":"kyc-data-consent-v2","location":null},
  "phoneVerified":true, "ruleVersion":"kyc-2026-09-21-v1",
  "review":{"decision":"needs_info","reason":"…","at":"…"},
  "score":{...}, "missing":["姓","身份证正面"],
  "loanOffer":{"id":"…","amount":5000,"fee":300,"termDays":14,"billing":{...},"billConfirmedAt":"…"} ,
  "external":{...}, "scope":"…"
}
```
- `status`：`draft`（可编辑）｜`submitted`（待审核，锁定）｜`needs_info`（待补件，可编辑，`review.reason` 为原因）｜`approved`（通过，锁定）｜`rejected`（未通过，锁定）。
- `missing` 为**服务端计算的缺项文案（中文）**，仅作提示，App 应在本地按规则自行判断必填并本地化显示。
- `revision` 是乐观锁版本，保存时必须原样回传。
- **`GET /api/kyc` 首次访问会初始化并创建 `draft` 案件（副作用），不是纯只读查询**；`review.reason` 为中文员工文案，响应另含员工相关字段（如 `review.actor`、`checklist`）。
- **KYC `needs_info` 的产品分层**：API 层它是可编辑/可重提的（`POST /api/kyc` save/submit 在 `draft`/`needs_info` 下允许）。**P1 仅从 `GET /api/h5/state` 的 `kyc.status` 展示 `needs_info` 状态；不调用 `GET /api/kyc`、不展示 `review.reason`、不提供编辑/重提。P2 才启用 `GET /api/kyc`、审核意见、编辑、补件与重提。**
- `ruleVersion` 是字段/选项规则版本（见 4.5）。

### 4.2 保存/提交 `POST /api/kyc` [读码]
```json
{"action":"save"|"submit","revision":3,"profile":{"values":{...},"files":{"idFront":{"id":"<文件id>"}},"consent":true,"declarationVersion":"kyc-data-consent-v2","location":{"lat":11.55,"lon":104.9,"accuracy":20,"capturedAt":"2026-10-07T00:00:00Z"}}}
```
- 仅 `draft`、`needs_info` 可保存，否则 409。
- `revision` 与服务端不一致返回 409“资料版本已变化，请重新加载”：**App 应重新 GET 后合并本地编辑再提交**。
- `files` 里只传 `{id}`（先用 4.3 上传得到文件 id）。同一个 slot 的文件必须与上传时的 slot 匹配。
- `submit` 时服务端校验必填项，缺项返回 400 并列出中文缺项。
- 成功返回与 4.1 相同的完整视图（含新的 `revision`）。
- `consent:true` 时 `declarationVersion` 必须是当前授权版本（取 GET 返回的 `profile.declarationVersion`），否则 400“请重新阅读并确认”。
- `location` 可选：`lat∈[-90,90]`、`lon∈[-180,180]`、`accuracy≥0`、`capturedAt` 为 ISO 时间；**设备定位属自愿授权，不是核验**。
- 签名**不放在 KYC 提交里**，由 `/api/loan/sign` 单独完成。

### 4.3 上传文件 `POST /api/kyc/files` [读码]
- 请求体为**原始二进制**（不是 multipart）；头 `x-kyc-slot: <slot id>`；`Content-Type` 建议 `application/octet-stream`；必须带正确 `Origin`。
- 仅 `draft`、`needs_info` 可上传，否则 409。
- 类型由**文件头魔数**判定，不信任 Content-Type：JPEG、PNG、PDF。`selfie`、`signature`、`vehiclePhoto` **不接受 PDF**。
- 大小 16 字节–10 MB；每客户最多 40 份（含历史版本与未完成上传）。
- 成功返回 `FileRef`：`{id,slot,name,type,size,sha256}`。**相同内容重复上传会复用旧记录，网络重试是安全的**。
- `slot=signature` 在此接口被拒绝。

### 4.4 读取文件 `GET /api/kyc/files?id=<文件id>` [读码]
返回原始字节；`Content-Type` 为实际类型；PDF 以 `attachment` 下发。必须带会话，客户只能取自己的文件。**缩略图不能用 URL 直接加载，需自带 Cookie 取字节后本地解码，且不落盘（见需求文档）**。

### 4.5 字段与选项规则 [读码：`lib/kyc/core.ts`、`lib/kyc/options.json`]
**重要：下拉选项的 `value` 是提交给服务端的固定字符串，必须原样发送，展示用的标签才可本地化。**

| 分组 | 字段 id（必填/可选） |
|---|---|
| identity | `surname`、`givenName`、`gender`、`education`、`marital`、`province`、`district`、`address`（均必填） |
| contacts | 联系人 1、2 必填，3 可选：`contact{n}Relation`、`contact{n}Name`、`contact{n}Phone` |
| employment | 必填：`workType`、`company`、`industry`、`position`、`income`、`tenure`；可选：`supervisorName`、`supervisorPhone`（须成对）、`vehicle`、`housing` |
| bank | `bankName`、`bankAccount`、`bankHolder`（均必填） |
| consent | `consent:true` + 当前 `declarationVersion` |

规则：
- 姓名类字段（`surname`、`givenName`、联系人/上司姓名、`bankHolder`）服务端**统一转大写**。
- 电话类字段（联系人、上司）须 `^\+[1-9]\d{7,14}$`，保存前去空格括号短横。
- 每个字段最长 240 字符；有选项的字段值必须在选项内。
- 联系人关系不能重复；联系人电话不能重复；联系人 3 要么三项全填要么全空。
- `district` 必须属于所选 `province`（`regions` 数据）。
- 选项取值来源：`gender`（`男`/`女`）、`marital`（`已婚`/`未婚`）、联系人关系（`父母`、`配偶`、`亲属`、`朋友`、`村长`、`公司主管`）、`vehicle`（`摩托车`、`嘟嘟车`、`汽车`、`无`）、`housing`（`租房`、`个人房产`、`无`）、`bankName`（`ABA Bank`、`ACLEDA Bank`、`Wing`）为**固定中文值**；`education`、`workType`、`industry`、`position`、`income`、`tenure` 与省/区县来自 `options.json`（值为英文，标签为“English / ភាសាខ្មែរ”双语）。
- **App 需内置 `options.json` 的副本，并用 `ruleVersion` 校验**；版本不一致时提示更新应用或降级为只读，避免提交服务端不认的值。

材料槽位（slot）：
| slot | 必填 | 说明 |
|---|---|---|
| `idFront`、`idBack`、`selfie` | 是 | 身份证正反面、自拍 |
| `incomeProof` | 是 | 收入/工作证明 |
| `vehicleInvoice`、`vehicleContract`、`vehiclePhoto` | 视 `vehicle` | 选了车辆类型（非“无”）时，**三者恰好上传一份**；未选车辆时不可见 |
| `rentContract` | `housing=租房` 时必填 | |
| `propertyCertificate` | `housing=个人房产` 时必填 | |
| `signature` | — | 仅用于合同签名，由 4.2 之外的接口处理 |

## 5. 签约

### 5.1 读取条款 `GET /api/loan/sign?loan=<贷款id>` [读码]
前置：贷款属于当前客户；KYC 已 `approved`。
```json
{"loan":{...},"blocks":[{"type":"title|heading|paragraph","text":"…"}],"termsVersion":"loan-terms-zh-v1-f363b1d8c58c"}
```
- `blocks` 是条款正文，**目前只有中文**（`loan-terms-zh.json`）。`termsVersion` 以服务端为准，**不得写死**。

### 5.2 提交手写签名 `POST /api/loan/sign` [读码]
- 请求体：**PNG 或 JPEG 的原始字节**（不接受 PDF），16 字节–10 MB。
- 必须带头：`x-loan-id: <贷款id>`、`x-loan-consent: true`、`x-loan-terms: <5.1 返回的 termsVersion>`、正确的 `Origin`。
- 前置：贷款 `status=kyc_approved` 且**已报价确认**（`billConfirmedAt` 有值）；KYC 已 approved 且版本与贷款记录一致；该贷款**尚未有合同**。
- 成功：`{"ok":true,"contract":{...}}`。
- 409 常见原因：申请或审核资料已变化、已签过、借款报价未确认。**这是正常业务分支**：重新拉取状态后让用户重新确认再签。
- 同一份签名图用于第二笔贷款时可能因内容去重而失败，**每次签名都应是新画的图**。

### 5.3 查看合同 `GET /api/kyc/contract?loan=<贷款id>` [读码]
`{"contract":{...},"blocks":[...]}`；未签名返回 404。

## 6. 端到端调用顺序

**首次使用**
1. 选定公司（写入 `payease_company`）→ `GET /api/h5/auth`（取公司名、语言、策略，并拿到浏览器标识 Cookie）
2. `POST /auth/send` → `POST /auth/verify`（建号并登录）
3. 若 `policy.passwordSetup` 且 `!hasPassword` → `POST /auth/account {set_password}`
4. `GET /api/kyc` → 分步 `POST /api/kyc {save}` + 文件上传 → `POST /api/kyc {submit}` → 等待后台审核（App 轮询或下拉刷新 `GET /api/h5/state` 的 `kyc.status`）
5. 审核通过 →
   - **现有流程（Legacy，Web/Mini App 仍在用）**：`POST /api/h5/state {create}` → `{confirm_bill}` → `GET /api/loan/sign` → `POST /api/loan/sign` → `{apply}`
   - **Android 目标流程（CR-001 之后，G3 BLOCKED）**：`POST /api/loan/quote`（借款报价）→ 用户报价确认 → `POST /api/h5/state {create, quoteId, billConfirmed:true}` → `GET /api/loan/sign` → `POST /api/loan/sign` → `{apply}`；**不再调用 `confirm_bill`**。详见 `07` §20。
6. 等待机构审批与放款（后台操作）→ `active`

**再次打开**：恢复 Cookie → `GET /api/h5/auth`，`authenticated:true` 则直接进首页；会话 24 小时过期，过期后用 `password_login`（已设密码）或验证码重新登录。

## 7. 已知限制与对 App 的约束（汇总）

1. 错误 `error` 文案与状态说明均为中文；当前 JSON 错误体通常带 `code`（显式或推断，**可选且非封闭枚举**，见 1.5）；借款条款只有中文。
2. 无增量或条件请求，状态全量返回。
3. 会话绝对 24 小时，浏览器标识 Cookie 同样 24 小时，每次进登录页都要先 `GET /api/h5/auth`。
4. 选项值为固定字符串（部分为中文），需内置并随 `ruleVersion` 校验。
5. 不能选渠道：渠道由服务端当前业务机器人决定（telegram 模式下验证码账号的 `channel_id` 为空，策略取默认业务渠道）。
6. 无邀请码解析、无 Telegram 深链登录、无推送接口。
7. **`withdraw`、`repay`：BACKEND BLOCKED（HTTP 403 `CUSTOMER_SETTLEMENT_FORBIDDEN`，无任何开关）**；Android 当前路线图不得实现（见 3.6）。
8. 已补读但本文仅作边界说明：`/api/kyc/geocode`（地址标准化，路由内无限流）、`/api/analytics/events`（`source` 仅接受 `mini_app`/`h5`）、`/api/telegram`（**MINI APP ONLY**，见 2.7a）。`/api/h5/auth` 的其余分支未全部覆盖。
9. **没有报价接口**：借款报价只在 `create` 之后产生，且创建后无法撤销、占用“进行中申请”名额。**CR-001（`POST /api/loan/quote`，无副作用；`create` 携带 `quoteId` 与 `billConfirmed:true`，Option B）已决策，契约见 `07-CR-001-quote-contract.md`。** 该接口**目前不存在**（截至 2026-10-07 在仓库的四份后端副本中均无 `/api/loan/quote` 路由与 `loan_quotes` 表），本文不把它当作现有契约；Android 贷款申请（G3）为 BLOCKED。
10. **`create` 不是真正幂等（AF-6，P0）**：见 3.5。G3 解除条件之一是后端修复并通过未知结果重试测试。
11. **贷款数量上限**：当前客户 `create` 路径（`POST /api/h5/state` → `mutate` 前置检查 → `customerAction`/`applyAction('create')` → 客户路径覆盖 → 持久化）中**不存在 100 单（或任何）贷款数量检查**（无 `loans.length`/`>=100`/`MAX_LOANS` 守卫，**CONFIRMED ABSENT**）；仅保留"不能已有未结束申请"（409）与 KYC `approved` 前置。**这是当前实现行为，不是永久产品政策保证。**
12. **还款账单的“剩余”**：服务端没有单独的“剩余应还”字段（领域内部 `repay` 用 `amount + fee − paid`）；`postloan` 无改变应还金额的罚息逻辑（已核查 `lib/postloan/core.ts`）。客户端只能做**显示派生**：`remaining = max(0, amount + fee − paid)`（见 3.7.2，含负值保护）。
13. 联调待验证：代理对 `Origin` 的处理、Cookie 的 `Secure` 属性（依赖 `x-forwarded-proto`）、生产的 Telegram Gateway 是否已配置。

## 附录　对账变更记录（v3，据 `43`）

| 项 | Finding | Correction | Evidence | Final status |
|---|---|---|---|---|
| 43-P1-1 | `error.code` 未同步（旧文称"没有错误码字段"） | 重写 1.5：`error`=消息、`code`=当前路径输出（显式/推断，可选，非封闭枚举）、`retryAfter`=可选限流元数据；7.1 同步 | `lib/h5-auth.ts` `json()`/`failure()`；`lib/error-codes.ts` | **CLOSED** |
| 43-P1-1b | `POST /api/h5/state` 的 `REQUEST_FAILED` 折叠未记录 | 3.5：KycError 保持自身状态；其余普通 Error 统一 400 `REQUEST_FAILED`；**Android 不得推断原因**，只映射通用本地化失败 | `app/api/h5/state/route.ts`（inner catch）；`addErrorCode('操作未完成，…')`→`REQUEST_FAILED` | **CLOSED** |
| 43-P1-2 | repay/withdraw 仍写成客户可直接执行/功能开关 | 3.5 表、3.6、7.7：BACKEND BLOCKED、HTTP 403 `CUSTOMER_SETTLEMENT_FORBIDDEN`、无开关、Android 不得实现 | `state/route.ts` 路由层拒绝；`lib/domain.ts:90`；全仓无 FEATURE_/ENABLE_ 开关 | **CLOSED** |
| 43-P1-3 | 写了硬编码 100 单上限 | 3.5 create 行、7.11：当前 create 路径**无数量检查（CONFIRMED ABSENT）**，注明为当前实现行为 | `lib/domain.ts:38-44`、`lib/store.ts`；检索无命中 | **CLOSED** |
| 43-P1-4 | 缺未知贷款状态回退 | 3.4 增行、3.7.1：未知/未来状态只读回退，不默认成 `registered`，不推断含义，不给改变状态的 CTA | 43 §7；Remap V3 §8.2 | **CLOSED** |
| 43-P1-5 | 剩余应还缺 clamp | 3.7.2、7.12：`max(0, amount+fee−paid)`，DISPLAY DERIVATION，含负值保护 | `components/mini-client.tsx`；`lib/postloan/core.ts` | **CLOSED** |
| 43-P2-1 | P1 state 字段边界未对齐 | 3.7.3、3.7.4：Home/借款记录/详情字段表；忽略字段；事件过滤/排序/取 5；短编号为 DISPLAY DERIVATION | Remap V3 附录 B；`customerState` 平铺 events | **CLOSED** |
| 43-P2-2 | `needs_info` 的 P1/P2 边界未明示 | 4.1：P1 仅从 state 展示状态，不调 `GET /api/kyc`/不显示 reason/不编辑；P2 才启用；并保留 GET 首次访问建案副作用 | `lib/kyc/server.ts` | **CLOSED** |
| 43-P2-3 | Mini App-only 未完整标注 | 2.7a：静默登录与 Telegram 提醒订阅为 MINI APP ONLY；Native 仍用 Gateway/密码/会话恢复 | `login.tsx`；`/api/telegram` | **CLOSED** |
| 43-#6 | create 状态结论 | 保持不变并显式写入 3.5 create 行：领域默认 `registered`；前置 KYC approved；落库/响应 `kyc_approved` | `lib/domain.ts:43`；`lib/store.ts:25,41` | CLOSED（原本正确，已更明确） |

**自检**：43 P0 OPEN = 0；43 P1 OPEN = 0；43 P2 OPEN = 0。未改动：Cookie 契约、Origin、会话、KYC 上传/revision、签名、requestId、CR-001 设计。
