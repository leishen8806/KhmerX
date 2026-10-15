# KhmerX Android · Flutter 技术架构

- 版本：**v3（2026-10-07，Architecture Reconciliation 后）**——已纳入 CR-001 全部冻结决策（Option B、AF-6、OD-5）、统一术语，并与 `04` v2、`07` v2 对账
- 状态：**G0 = FAIL / RECOVERY；G1 = HOLD；G2 = HOLD；G3 = BLOCKED BY CR-001**（Codex 独立验收 `11` 为 FAIL）。**G0 的唯一施工输入是 `10-G0-implementation-contract.md`，与本文冲突时以 `10` 为准**（`10` 基于对 `mobile/` 真实代码的取证与依赖解析实验）。`04` v2 已对接，剩余 Review Item 见 `09`。
- 事实优先级：现有代码 → `02-api-contract.md` → `01-requirements.md` → `07-CR-001-quote-contract.md`（后端变更契约）→ `04-ux-architecture.md` → `03-ui-design-brief.md`（已被 04 取代）
- 范围：Android 客户端（Flutter）。**原则上复用现有后端**；仅允许解决 Android 主流程阻断问题的**最小后端契约增量**（§29：CR-001 报价、CR-002 assetlinks）。不假设 `/api/mobile/*`、Bearer、JWT。
- 本文不含视觉设计；路由命名已采纳 `04` v2。
- **统一术语**：Create 前 = **借款报价 / Loan Quote**；Create 前确认 = **报价确认 / Quote Confirmation**；放款后 = **还款账单 / Repayment Bill**。API 兼容名 `billing`、`confirm_bill`、`billConfirmed(At)` 可保留，领域与产品文档不得混叫 Bill / Quote。

## 决策冻结记录（2026-10-07）

| 编号 | 决策 | 落点 |
|---|---|---|
| Q-A1 | **不接受“先 create、后看借款报价”**。正式流程固定为：选金额与期限 → 获取服务端借款报价（Loan Quote）→ 用户报价确认（Quote Confirmation）→ Create（`quoteId` + `billConfirmed=true`，**Option B**）→ 条款 → 签名 → Apply。新增后端能力 **CR-001**（无副作用报价）。**G3 BLOCKED BY CR-001**；G0、G1、G2 不受影响 | §13、§29、ADR-012 |
| Q-A2 | KYC：**服务端是可恢复草稿的唯一持久化来源**；内存只保存当前页未保存编辑；**磁盘不保存完整 KYC PII**；分组完成/离开/切后台/Save & Exit 时保存。**不承诺**杀进程后当前分组未保存的输入不丢 | §12.2、ADR-013 |
| Q-A3 | `ruleVersion` 不一致：**只读降级 + 强制升级提示**；不得用旧选项值猜测提交 | §12.4 |
| 重试 | **Default retry = OFF**。仅 `GET /api/h5/auth`、`GET /api/h5/state`、`GET /api/kyc` 在 HTTP 层允许有界重试；所有写操作**不得**由 Provider 自动重试，只能由 **Command + 幂等 + 显式重试策略**控制 | §6.2、§10.1、§19.3、ADR-011 |
| Cookie | **采用 `cookie_jar` + 公司分区加密持久化 + 4-Cookie 白名单**，不自研 Cookie 语义 | §7、ADR-003b |
| 边界 | “完全不改后端”调整为“**原则上复用现有后端；允许最小契约增量**”。**CR-002**（`assetlinks.json`）非阻断，只阻塞 App Links 最终验收 | §29 |
| G0 | 可立即开工，范围与禁区见 §25 | §25 |
| CR-001 冻结项 | **OD-1 TTL=15 分钟；OD-2 持久化 `loan_quotes`；OD-3 Option B；OD-4 Strategy A；OD-11 AF-6 修复纳入（P0，G3 BLOCKING）**；**OD-5**：100 笔上限不得再硬编码为生产规则，改为显式配置（生产默认不用） | `07` §26 |
| G3 解除 | 需 8 项全部满足：`CR-001 APPROVED` + `Quote API IMPLEMENTED` + `AF-6 IDEMPOTENCY FIX IMPLEMENTED` + `QUOTE/CREATE ATOMICITY PASS` + `CONTRACT TEST PASS` + `CONCURRENCY TEST PASS` + `UNKNOWN-OUTCOME RETRY TEST PASS` + `ANDROID INTEGRATION TEST PASS` | §25.2 |

## 0. 与任务书的偏差与新发现（先看这里）

以下是读代码、核实依赖与评审后得出的结论，已在正文落实。

| # | 事实 / 偏差 | 影响 | 落点 |
|---|---|---|---|
| D1 | `requestId` 是 **`/api/h5/state` 请求体里的业务幂等键**，不是 HTTP 层概念 | 用 **`TraceIdInterceptor`（仅本地日志）+ `PendingOperation` 服务**，而不是 `RequestIdInterceptor` | §6、§19 |
| D2 | **Riverpod 3.x 默认自动重试失败的 provider**（已核实官方迁移文档） | **Default retry = OFF**，不为 Provider 设任何重试例外；唯一的重试机制是 HTTP 层对三个白名单 GET 的有界重试（避免重试叠加） | §6.2、§10.1、§19.3 |
| D3 | `POST /api/h5/state` 把**所有领域错误**统一成同一句 400（“操作未完成，请确认…”），只有 `KycError` 才有具体文案 | 贷款冲突必须**重新拉取状态后诊断**，不能按文案分支 | §17、§18 |
| D4 | **没有报价接口**，`create` 才生成借款报价，且创建后无法撤销、占用“进行中申请”名额 | **已决策（Q-A1）：新增 CR-001 无副作用报价；G3 BLOCKED** | §13、§29 |
| D5 | **没有获取 KYC 选项/规则的接口** | **已决策（Q-A3）**：`ruleVersion` 不一致 → 只读降级 + 强制升级提示 | §12.4 |
| D6 | 需求要“不丢草稿”，安全要求“PII 不落盘” | **已决策（Q-A2）**：服务端保存 + 内存编辑；不承诺杀进程不丢当前分组未保存输入 | §12.2 |
| D7 | 服务端 `requests` 去重只在**成功路径**记录；被拒绝的请求不会记录 | 被明确拒绝后可用**新的 requestId**；只有“结果不确定”才复用旧的 | §19 |
| D8 | 工程**不含 `ios/`**（本期仅 Android，`flutter create --platforms=android`） | 与任务书示意目录不同 | §3 |
| D9 | ~~自研 Cookie Jar~~ → **改为 `cookie_jar` + 自定义加密存储 + 公司分区 + 白名单**（评审修正） | Cookie 解析与生命周期交给成熟组件，不自造认证基础设施 | §7 |
| D10 | `payease_visitor` 对客户鉴权**非必需**（客户身份由公司 + 会话 Cookie 决定），但仍按浏览器行为保存 | 缺失不应报错 | §7 |
| D11 | 服务端 `save` 也会调用 `cleanProfile`：**格式不合法的字段（如未输完的电话）、重复联系人关系、区县与省份不匹配都会让整个 `save` 返回 400** | “离开/切后台时尽力保存”必须**只提交通过格式校验的字段**，未通过的留在内存 | §12.2 |
| D12 | 签约接口 `POST /api/loan/sign` **没有 `requestId`** | 不可幂等；歧义结果靠状态诊断 | §18.3 |
| D13 | **AF-6（P0）**：`create` 目前不是真正幂等——进行中申请检查（`store.ts:20`）先于 `requestId` 去重（`domain.ts:18`），成功后丢响应再用同一 `requestId` 重试会得到 409 | 此前 §19 “服务端对已处理 requestId 直接返回现状”对 `create` **不成立**；已更正，并加客户端兜底（按 `loan.billing.quoteId` 判定已成功） | §19.2、§18.2、`07` §11 |
| D14 | 术语冻结：借款报价 / 报价确认 / 还款账单 | Domain 模型改为 `LoanQuote`、`RepaymentBill`；旧 `Billing` 名废止 | §5.4、§13 |
| D15 | **“剩余应还”服务端没有字段**，`repay` 内部为 `amount + fee − paid`；`postloan` 现无罚息逻辑 | 还款账单的“剩余”只能是**派生显示值**，需标注并预留替换为服务端字段 | §13.6 |
| D16 | Option B：新流程不调用 `confirm_bill`；但同一客户经 Web/Mini App 创建的 `kyc_approved` 未确认贷款仍存在 | App 必须保留 `confirm_bill` 兼容动作接续 Legacy 贷款 | §13 |

## 1. Architecture Overview

```
┌────────────────────────────── Presentation (04 v2 已对账，剩余 Review Item 交 Codex) ─────────────────────────────┐
│ Screens / Widgets  ── 只读 UiState、发出 Intent，不碰 Dio / SecureStorage / 路径字符串            │
└───────────────▲──────────────────────────────────────────────────────────┬────────────────────────┘
                │ watch                                                    │ intent
┌───────────────┴──────────────────────────────────────────────────────────▼────────────────────────┐
│ Application：Controller / Notifier（Riverpod 3），OperationRunner，ConflictResolver               │
└───────────────▲──────────────────────────────────────────────────────────┬────────────────────────┘
                │ domain models                                            │ call
┌───────────────┴────────────────────────┐    ┌───────────────────────────▼────────────────────────┐
│ Domain：模型、枚举、校验器、Repository  │◄───│ Data：Api、DTO、Mapper、Repository 实现             │
│ 接口、Failure                           │    └───────────────────────────┬────────────────────────┘
└────────────────────────────────────────┘                                │
┌─────────────────────────────────────── Core（基础设施，不含业务）───────▼────────────────────────┐
│ network（Dio+拦截器）· session（公司 Cookie Jar）· storage（SecureKv/快照）· error · logging      │
│ localization · feature_flags · security · idempotency · money                                    │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                         │ HTTPS + Cookie + Origin
                         api.khmerx.org（standalone 代理 → 现有 Worker，不改动）
```

关键性质：
1. **直接复用现有 H5 接口**，用“浏览器兼容客户端”方式接入：Cookie 会话 + `Origin`。
2. **会话属于公司**：一切会话、缓存、待定操作、语言偏好按 `companyId`（及 `customerId`）隔离。
3. **服务端决定一切金融事实**：金额、借款报价、还款账单、状态、审批、资金结果。客户端只映射展示。
4. **写操作永不离线排队、永不被隐式自动重试**（HTTP 层、Riverpod 层都禁止）；写操作的重试只能由 Command + 幂等 + 显式重试策略决定（§19.3）。

## 2. Architecture Principles

| # | 原则 | 具体约束 |
|---|---|---|
| P1 | Feature owns feature logic. Core owns infrastructure. | `core/` 不 import `features/`；feature 不实现网络、存储、日志细节 |
| P2 | Server is the source of truth | 不创建独立业务状态机；`LoanUiStage` 只是对服务端当前状态的**展示映射** |
| P3 | Fail closed | 缺公司作用域的请求直接抛错；存储解密失败视为登出并清空；未知 enum 值走 `unknown` 分支而不是崩溃 |
| P4 | Isolation by default | 所有 key、provider family、CancelToken 组都携带 `CompanyId`（需要时加 `CustomerId`） |
| P5 | Sensitive data stays in memory | 证件图、签名、KYC 明文资料、密码、OTP 不落盘；Cookie 与小型快照只进安全存储 |
| P6 | No hidden retries | Default retry = OFF；仅 `GET /api/h5/auth`、`/api/h5/state`、`/api/kyc` 在 HTTP 层有界重试；POST 不自动重试；Riverpod 无重试例外 |
| P7 | Typed failures, no string handling in UI | 服务端中文文案只在 `ServerMessageCatalog` 出现一次 |
| P8 | Explicit over magic | 公司作用域由**绑定公司的 `ApiClient` 实例**与 `family(CompanyId)` provider 显式承载，不依赖全局“当前公司”隐式状态 |
| P9 | Contract tests are fixtures | 所有 DTO/Mapper 测试使用来自真实响应形态的 JSON 夹具 |

## 3. Directory Structure

```
mobile/                                   # E:\KhmerX\KhmerX\mobile（新目录，不触碰现有文件）
├── pubspec.yaml
├── analysis_options.yaml
├── l10n.yaml
├── config/                               # 非密钥配置：--dart-define-from-file
│   ├── dev.json  └── prod.json           # staging 预留，目前无真实环境（见 §24）
├── assets/
│   ├── kyc/options.json                  # 服务端 lib/kyc/options.json 的副本（带 ruleVersion）
│   └── fonts/NotoSansKhmer-*.ttf
├── tool/
│   └── sync_kyc_options.dart             # 开发期从仓库复制 options.json 并校验版本
├── android/                              # 无 ios/
├── lib/
│   ├── main.dart
│   ├── app/
│   │   ├── app.dart
│   │   ├── bootstrap/                    # 启动顺序、全局错误钩子、ProviderScope(retry 关闭)
│   │   ├── config/                       # AppConfig、Environment
│   │   ├── router/                       # RouterGate、routes（采纳 04 命名）、DeepLinkHandler
│   │   └── theme/                        # KhmerXTheme（Light/Dark，采纳 04 令牌）
│   ├── core/
│   │   ├── network/                      # ApiClient（每公司一个 Dio 实例）、DioFactory、Endpoints（含重试白名单）、interceptors/
│   │   ├── session/                      # CompanyCookieStore（cookie_jar）、SecureKvCookieStorage、WhitelistCookieJar、CompanySessionStore、SessionManager、ReturnIntent、ServerClock
│   │   ├── storage/                      # SecureKv、KeySchema、SnapshotStore、SensitiveBytesStore、TempFileSweeper
│   │   ├── error/                        # Failure 体系、ErrorMapper、ServerMessageCatalog
│   │   ├── idempotency/                  # OperationKey、PendingOperation、RequestIdGenerator、PendingOperationStore、OperationRunner
│   │   ├── localization/                 # LocaleController、StatusLabelMapper、EnumLabelMapper、arb 在 lib/l10n
│   │   ├── logging/                      # SafeLogger、RedactionPolicy
│   │   ├── feature_flags/                # FeatureFlags、RemoteFeatureConfig（接口）
│   │   ├── security/                     # SecureWindow、LifecycleMask
│   │   └── money/                        # Money（整数美分）、MoneyFormatter
│   ├── features/
│   │   ├── company/   { data/ domain/ application/ presentation/ }
│   │   ├── auth/
│   │   ├── home/
│   │   ├── kyc/
│   │   ├── loan/      # state、借款报价、创建、申请、条款与签名
│   │   ├── contract/
│   │   └── settings/
│   ├── l10n/ app_en.arb  app_km.arb  app_zh.arb
│   └── shared/ { widgets/ models/ utils/ }
├── test/
│   ├── unit/  data/  state/  security/  architecture/  fixtures/
└── integration_test/
```

**为什么这样拆**
- `core/` 只放“与业务无关、可被多 feature 复用”的基础设施，且**不依赖 `features/`**。`session`、`idempotency` 虽然带业务色彩，但它们只处理“公司作用域 + 操作键”这类抽象，不理解贷款或 KYC 的含义。
- `features/` 内部固定四层：`domain`（模型、校验、仓库接口）、`data`（API、DTO、Mapper、仓库实现）、`application`（Notifier/Controller/Runner）、`presentation`（页面，待 UX）。
- `loan/` 比任务书示意更大：它同时拥有“状态、借款报价、报价确认与创建、申请、条款、签名”，因为这些共享同一个服务端状态与冲突诊断；`contract/` 只做合同查看。
- `shared/` 仅放无业务含义的通用 Widget/工具，**不得放 Repository 或 Provider**。
- 不放 `ios/`：本期不交付 iOS，目录里不留死代码。

## 4. Dependency Direction

```
presentation ──► application ──► domain ◄── data
                      │                       │
                      └──────────► core ◄──────┘
features/A ─✗─► features/B   （跨 feature 只能依赖对方 domain 的 barrel 文件或 core 抽象）
core ─✗─► features
domain ─✗─► flutter / dio / secure_storage（domain 是纯 Dart）
presentation ─✗─► dio / flutter_secure_storage / data
application ─✗─► Navigator / BuildContext / go_router
data ─✗─► application / presentation
```

**强制方式**：`test/architecture/dependency_rules_test.dart` 扫描 `lib/**` 的 import，违反即失败（CI 门禁）。允许例外必须写入白名单并附理由。

## 5. Domain Model

所有模型为**不可变**纯 Dart 类（`final` 字段、`==`/`hashCode` 手写或用 `equatable`）。**不使用 `freezed`**（减少代码生成面；失败类型使用 Dart 3 `sealed class`）。

### 5.1 Company
| 类型 | 说明 |
|---|---|
| `CompanyId`（`extension type` 包装 `String`） | 构造时校验 `^t_[a-f0-9-]{36}$`，非法抛 `FormatException`；用于 key 前缀与 Cookie |
| `CompanySummary` | `id`、`name`、`languages: EnabledLanguages`、`lastUsedAt` |
| `EnabledLanguages` | `{en, km, zh}` 三个 bool，来自 `GET /api/h5/auth` |
| `ActiveCompany` | `CompanySummary` + `CompanyAuthState` 引用 |
| `RecentCompanies` | 按 `lastUsedAt` 排序的列表，上限 10 |
| `CompanySession` | `companyId`、`customerId?`、`expiresAt?`（会话 JSON 给出的毫秒时间戳）、`registration: RegistrationState` |

### 5.2 Auth
- `AuthSession`：`customerId`、`phoneMasked`、`mode`、`expiresAt`、`phoneVerified`、`verificationCompleted`、`hasPassword`。
- `RegistrationPolicy`：`phoneVerification`、`passwordSetup`（`channelId` 仅记录，不由 App 使用）。
- `AuthSnapshot`：`company name`、`authenticated`、`session?`、`policy`、`languages`、`pending: OtpChallenge?`。
- `OtpChallenge`：`id`（64 hex）、`phoneMasked`、`expiresAt`、`retryAt`、`purpose(login|reset)`。
- `PhoneNumber`（值对象）：构造时执行与服务端一致的归一化（去空格、括号、短横）并校验 `^\+[1-9]\d{7,14}$`。**不在日志、不在快照中以明文出现**。
- `SessionState`（sealed）：`SignedOut | SignedIn | RegistrationIncomplete(missing: phoneVerification|passwordSetup) | Expired`。

### 5.3 Money
`Money`：`extension type` 包装 `int cents`。仅提供：比较、安全加法（`isSafeInteger` 范围检查）、格式化。**无 `double` 构造与乘除**。`MoneyFormatter.format(Money, Locale)` 输出两位小数 + `USD`/`$`（格式细节待 UX）。

### 5.4 Loan
- `LoanId`（uuid 字符串包装）。
- `LoanStatus`：`registered, kycPending, needsInfo, kycApproved, decisionPending, approved, rejected, signed, active, closed, unknown(raw)`；`LoanStatus.fromWire(String)` 未知值落 `unknown`，**不抛异常**。
- `Loan`：`id`、`status`、`principal: Money`、`fee: Money`、`paid: Money`、`wallet: Money`、`createdAt`、`dueAt?`、`signedAt?`、`quote: LoanQuote?`（API 字段 `billing`）、`quoteConfirmedAt?`（API 字段 `billConfirmedAt`）、`hasContract: bool`、`borrowerName`。**不含服务端 `note`、`approvalActor` 等内部字段**。
- `LoanQuote`（Domain 名；API 兼容名 `Bill` / 字段 `billing`）：`quoteId`、`principal`、`deduction`、`interest`、`service`、`upfront`、`net`、`total`（均 `Money`）、`termDays`、`currency`、`interestTiming`、`serviceTiming`，以及（来自 Create 前的 Quote）`pricingVersion`、`createdAt`、`expiresAt`。**客户端只展示，不计算**。同一个类型既用于 Create 前的 Quote 响应，也用于创建后 `loan.billing` 中被接受的快照。
- **Create 前的借款报价**即上面的 `LoanQuote`（响应 `Quote`，契约见 `07` §7.3）。**G3 BLOCKED**：创建申请前展示给用户的唯一费用来源。不得再另设 `Quote` 与 `Billing` 两个并行领域类型。
- `RepaymentBill`（放款后，`active`/`closed`）：`total`、`paid`、`remaining`（**派生显示值**，见 §13.6）、`dueAt`、还款记录（来自 `entries`/事件的客户可见部分）。**只在贷款进入 `active` 后使用该名称。**
- `LoanEvent`：`id`、`loanId`、`action`、`at`。**不映射 `note`**（可能含员工信息，审计 B-01）。
- `Contract`：`loanId`、`principal`、`fee`、`termDays`、`signedAt`、`borrowerName`、`currency`、`termsVersion`（只读展示用的子集）。
- `TermsDocument`：`version`、`blocks: List<TermsBlock(type, text)>`。
- `LoanSnapshot`（缓存用）：`loans`、`kycStatus`、`revision`、`fetchedAt`。

### 5.5 KYC
- `KycStatus`：`draft, submitted, needsInfo, approved, rejected, unknown`。
- `KycCase`：`id`、`revision`、`status`、`ruleVersion`、`profile`、`review?`、`loanOffer?`。**忽略服务端 `missing`、`score`、`external`、`scope`**。
- `KycProfile`：`values: Map<KycFieldId, String>`、`files: Map<KycSlot, KycFileRef>`、`consent`、`declarationVersion`、`location?`。
- `KycFieldId`、`KycSlot`：枚举，`wire` 值与服务端一致（如 `idFront`、`contact1Phone`）。
- `KycFileRef`：`id`、`slot`、`type`、`size`、`sha256`。
- `KycOption`：`apiValue`、`label: KycOptionLabel`（见 §12.3）。
- `KycReview`：`decision`、`reason`（**审核员原文，不翻译**）、`at`。
- `KycDraft`：`baseRevision`、`values`、`files`、`dirtyFields`、`dirtySlots`、`consent`、`declarationVersion`、`location?`——**仅内存**。

### 5.6 Idempotency
`OperationKey`、`PendingOperation`、`OperationState`（`inFlight | unknown`），见 §19。

## 6. API Client

### 6.1 构成
```
ApiClient（薄封装：getJson / postJson / postBytes / getBytes）
 └── Dio（**每家公司一个实例**：dioFor(CompanyId)；baseUrl = AppConfig.baseUrl，仅 HTTPS）
     └── 拦截器（顺序固定）
```
- **公司作用域由实例绑定**：`ApiClient` 只能通过 `CompanyId` 构造（`Provider.family`），**不存在“当前公司”全局默认**，也没有“可选公司参数”。每个 Dio 实例绑定**该公司自己的** `WhitelistCookieJar`（§7），因此请求只会带本公司 Cookie，响应 Cookie 也只会写入本公司。
- 切换公司：旧公司的 `ApiClient` 随 provider 销毁 `dio.close(force: true)`，进行中请求被取消；其迟到的响应因实例绑定而**只写旧公司 jar**，不会污染新公司。
- `Endpoints`：集中描述每个接口——`path`、`method`、`requiresSession`、`sensitiveBody`、`bodyLimitBytes`、`retry`（见 6.2）。日志脱敏、401 判定、重试资格都读这张表，**Repository 不手写路径字符串**。
- 公共 API 类：`AuthApi`、`StateApi`、`KycApi`、`LoanApi`（条款、签名；CR-001 之后含 `quote`）、`ContractApi`、`LocaleApi`、`FileApi`。只做序列化与 DTO 解析，不含业务判断。

### 6.2 拦截器（请求顺序）
| 顺序 | 拦截器 | 职责 |
|---|---|---|
| 1 | `BaseHeadersInterceptor` | `User-Agent: KhmerX-Android/<version>+<build>`、`Accept`。**不发送任何 `oai-*` 头**。校验请求主机必须等于配置主机，否则拒绝 |
| 2 | `OriginInterceptor` | 对 POST/PUT/PATCH/DELETE 设置 `Origin: <scheme>://<host>`，**由 `AppConfig.baseUrl` 推导**，不在任何 Repository 手写 |
| 3 | `CookieManager`（`dio_cookie_manager`，已核实 3.5.0，依赖 `cookie_jar ^4.0.0`） | 使用该公司的 `WhitelistCookieJar`：请求带 Cookie，响应解析 `Set-Cookie`（含多值、删除、过期）。**`payease_company` 由 `CompanyCookieStore` 预置在 jar 中**（见 §7），不在拦截器里拼头 |
| 4 | `TraceIdInterceptor` | 每次 HTTP 尝试生成本地 trace id 放入 `extra`，只用于日志关联，**不发送给服务端** |
| 5 | `SafeLoggingInterceptor` | 只记录：方法、`Endpoint` 名、状态码、耗时、trace id、字节数。**永不记录 URL 查询值、请求头、请求体、响应体**（所有端点默认视为敏感） |
| 6 | `RetryInterceptor` | **仅对 `Endpoints.retry != none` 的端点生效**；见下方白名单 |
| 7 | `ErrorMappingInterceptor` | 把 `DioException` 与非 2xx 响应转换为 `Failure`（§17） |

**重试白名单（Default retry = OFF）**
- `Endpoints.retry` 默认 `RetryPolicy.none`。
- **仅以下三个 GET** 设为 `RetryPolicy.boundedGet(maxAttempts: 2)`：`GET /api/h5/auth`、`GET /api/h5/state`、`GET /api/kyc`。条件：连接错误、超时、503；指数退避加抖动（约 0.5s、1.5s）；**4xx、429 一律不重试**。
- 其他任何 GET（条款、合同、文件下载）与全部 POST **默认不重试**；要加入白名单必须评审并更新本表。
- **Provider 层不做任何重试**（避免与 HTTP 层相乘），见 §10.1。
- 所有写操作的重试语义见 §19.3。

### 6.3 超时
| 场景 | connect | send | receive |
|---|---|---|---|
| 普通 JSON | 10s | 15s | 20s |
| 文件/签名上传（≤10MB） | 10s | 60s | 30s |
| 文件下载 | 10s | 15s | 60s |
| 登出（尽力而为） | 5s | 5s | 5s |

### 6.4 401 / 409 / 429 / 503 / 离线
| 情形 | 处理 |
|---|---|
| 401 且端点 `requiresSession` | 映射为 `AuthFailure.sessionExpired`；`ApiClient` 通知 `SessionManager.invalidate(companyId)`（只清会话 Cookie，保留 visitor/browser/company）；**不自动重试** |
| 401 在登录类端点 | 视为凭据错误，**不触发会话失效** |
| 401“登录页面已失效”（browser Cookie 缺失） | 映射 `loginPageExpired`。`AuthRepository` 按 §19.3 的 `PreconditionRecoveryOnce` 执行**一次**：`GET /api/h5/auth` 刷新 browser Cookie 后重放原请求（服务端在副作用之前就拒绝，安全） |
| 409 | 映射 `ConflictFailure`，交给 `ConflictResolver`（§18），**绝不走通用错误提示** |
| 429 | `RateLimitFailure(retryAfter)`，读 body 的 `retryAfter` 与 `Retry-After` 头；**不自动重试** |
| 503 / 5xx | `ServiceUnavailableFailure`；三个白名单 GET 有界重试，其余不重试 |
| 连接失败 / DNS | `OfflineFailure` |
| 超时 | `TimeoutFailure`；对写操作保持 `PendingOperation=unknown`（§19） |

### 6.5 二进制
- **上传**：`postBytes(endpoint, Uint8List, headers, onProgress, cancelToken)`，`Content-Type: application/octet-stream`，**不是 multipart**。发送前本地检查 16 B ≤ 大小 ≤ 10 MB。**不自动重试**，用户主动重试。
- **下载**：`getBytes` 使用 `ResponseType.bytes`，不写磁盘；超过 10MB 或与声明不符则丢弃并报错。
- 响应体不经过任何磁盘缓存；`Cache-Control: no-store`。

### 6.6 证书固定（接口预留）
`PinningPolicy` 抽象：默认 `NoPinning`；`IOHttpClientAdapter` 可选挂接 SPKI 校验。是否启用取决于需求 Q8，**启用前需要证书轮换预案**，默认关闭。

## 7. Cookie Session Architecture

### 7.1 方案：`cookie_jar` + 公司分区加密持久化 + 白名单
**不自研 Cookie 语义。** Cookie 不只是 `name=value`，还涉及 expiry、domain、path、Secure、HttpOnly、SameSite、`Set-Cookie` 解析与删除。这些交给成熟组件；我们只增加三件事：
1. **公司分区**：每家公司一个独立的 jar 与存储命名空间；
2. **加密持久化**：用自定义 `Storage` 把 jar 数据写入 `SecureKv`（Keystore 保护），不写普通明文文件；
3. **白名单**：只允许 4 个 Cookie 进入 jar。

已核实（2026-10-07，pub.dev）：`cookie_jar 4.0.9` 支持通过继承 `Storage` 自定义存储，`PersistCookieJar` 支持 `storage` 与 `ignoreExpires`；`dio_cookie_manager 3.5.0` 依赖 `dio ^5.2.0`、`cookie_jar ^4.0.0`。**`Storage` 的确切方法签名、`persistSession` 参数是否存在，以 4.0.9 实际 API 为准，在 G0 用最小 spike 核实**（我读到的文档摘要未列出 `persistSession`）。

### 7.2 Cookie 白名单
| 名称 | 来源 | 校验 | 存储 | 过期 |
|---|---|---|---|---|
| `payease_visitor` | 代理 | `^[a-f0-9-]{36}\.[a-f0-9]{64}$` | 存 | 30 天；**缺失不是错误**（D10） |
| `payease_h5_browser` | 服务端（`GET /api/h5/auth`） | `^[a-f0-9]{64}$` | 存 | 24 小时 |
| `payease_h5_session` | 服务端（登录成功） | `^[a-f0-9]{64}$` | 存 | 24 小时绝对 |
| `payease_company` | **App 预置**（`CompanyCookieStore.seedCompany`） | 必须等于该 jar 所属 `CompanyId` | 存（设较长有效期以保证被持久化） | — |

规则：
- 其他任何 `Set-Cookie`（名称不在白名单、格式不符）**一律丢弃**。
- `payease_company` **只接受 App 预置**；若响应里出现同名 `Set-Cookie` 且值不等于本公司 ID，丢弃并记高优先级日志。
- 带 `Max-Age=0` 或过去 `Expires` 的白名单 Cookie 表示删除，交给 `cookie_jar` 处理。
- `Secure` 仅在 https 基址下要求。

### 7.3 组件
| 组件 | 职责 |
|---|---|
| `SecureKvCookieStorage(companyId)` | 继承 `cookie_jar` 的 `Storage`，读写落到 `SecureKv`，key 前缀 `v1/co/{companyId}/cookiejar/`。存储异常抛 `StorageFailure`，**不静默忽略（fail closed）** |
| `WhitelistCookieJar` | 实现 `CookieJar` 的**装饰器**：`saveFromResponse` 先按 7.2 过滤再委托给内层 `PersistCookieJar`；`loadForRequest`、`delete` 等直接委托。**不自己解析 Cookie 语义** |
| `CompanyCookieStore` | 为每个 `CompanyId` 装配 `WhitelistCookieJar(PersistCookieJar(storage: SecureKvCookieStorage))`；`seedCompany(companyId)`；`clearSession(companyId)`（**只删除 `payease_h5_session`**，保留其他三个）；`clearCompany(companyId)`（删除该前缀全部条目） |
| `CompanySessionStore` | 对外统一入口：`jarFor(CompanyId)`、`clearSession`、`clearCompany`、`events` 流 |
| `SessionManager` | `restore`、`onLoggedIn`、`invalidate(reason)`、`logout`；发出 `SessionEvent`（`restored | signedIn | expired | loggedOut | invalidated`） |
| `SessionRestore` | 冷启动恢复，见 7.4 |
| `SessionExpiry` | 本地判断：会话 Cookie 的过期时间（取自 jar）与会话 JSON 的 `expiresAt`；**以服务端 401 为准**，无续期接口，不做本地续期 |
| `SessionInvalidation` | 触发源：登出、会话 401、重置密码成功、公司被移除、存储解密失败；效果：清会话 Cookie、清该客户快照与内存敏感数据、保存 `ReturnIntent` |
| `ReturnIntent` | `{companyId, location, createdAt}`；仅路由字符串，**不含 PII**；TTL 30 分钟；只在**同一公司**登录成功后消费 |
| `ServerClock` | 从响应 `Date` 头维护服务器时间偏移，用于验证码倒计时 |

### 7.4 隔离保证
- **三重隔离**：① 每公司独立 Dio 实例（§6.1）；② 每公司独立 jar；③ 存储 key 以 `companyId` 为前缀。
- 公司 A 的响应 Cookie 无法写入公司 B（实例绑定）；`clearSession(A)` 不影响 B。
- 必须有测试：两家公司并发请求与切换，断言 jar 内容与存储 key 互不可见。

### 7.5 冷启动恢复
```
App start
  → 读取 activeCompanyId / 公司列表（SecureKv）
     ├─ 无公司 → /company/select
     └─ 有公司 → 装配该公司的 jar（seedCompany）
          ├─ 无会话 Cookie 或本地已过期 → 视为未登录
          └─ 有 → 以缓存快照渲染骨架（仅当会话看起来有效）
  → GET /api/h5/auth（白名单 GET，有界重试）
       ├─ authenticated=true → 刷新 session/policy/languages → 路由到 home 或注册补全
       ├─ authenticated=false → 清会话 Cookie 与快照 → /auth/login
       ├─ 403 公司无效/停用 → 标记公司不可用 → /company/select
       └─ 离线：
            有会话 Cookie + 本地未过期 + 有快照 → 只读离线模式进 home（写操作禁用）
            否则 → 展示可重试的启动失败页
```
**规则**：宁可多一次 `GET /api/h5/auth`，也不凭本地状态当作已登录；渲染缓存只是体验优化，随后必须被服务端结果确认或清除。

## 8. Company Context

### 8.1 域模型与职责
`features/company` 负责：解析/校验公司链接、选择与切换、最近公司列表、公司名与语言开关缓存。**不负责登录**。

### 8.2 公司选择流程
```
输入（扫码 / 粘贴链接 / App Link）
  → 解析：scheme=https，host ∈ {khmerx.org}，path=/app，query c=CompanyId（严格正则）
  → 非法：不发请求，提示
  → 用该 CompanyId 的作用域调用 GET /api/h5/auth
       ├─ 200：保存为最近公司（名称、languages），设为 active
       ├─ 403：公司无效/停用 → 不保存
       └─ 离线：不保存，提示稍后重试
```
- **公司 ID 不是秘密，选择只是定位，不是授权**。未登录前不展示任何客户数据。
- 切换公司：设置 `activeCompanyId` → 通知所有 `family(companyId)` provider 重建 → 销毁旧公司的 `ApiClient`（`dio.close(force: true)`，取消进行中请求）→ 路由重新走 Gate。不清除旧公司数据（登出才清）。

### 8.3 Storage Key 方案（`SecureKv`，前缀版本化）
| Key | 内容 | 备注 |
|---|---|---|
| `v1/app/activeCompanyId` | `CompanyId` | |
| `v1/app/companies` | `[{id,name,lastUsedAt,languages}]` | 无 PII，上限 10 |
| `v1/co/{companyId}/cookiejar/*` | `cookie_jar` 存储条目（仅 4 个白名单 Cookie，经 `SecureKv` 加密） | **凭据** |
| `v1/co/{companyId}/prefs` | `{locale}` | |
| `v1/co/{companyId}/lastCustomerId` | 不透明 `customerId` | 冷启动读快照用 |
| `v1/co/{companyId}/cu/{customerId}/snapshot` | `LoanSnapshot` JSON | ≤64KB |
| `v1/co/{companyId}/cu/{customerId}/pending-ops` | `PendingOperation[]` | 无 PII |
| `v1/co/{companyId}/return-intent` | `ReturnIntent` | TTL 30 分钟 |

规则：
- **所有 key 由 `KeySchema` 生成**，禁止在其他位置拼接字符串。
- 快照、待定操作必须同时带 `companyId` 与 `customerId`；`customerId` 变化（同公司换账号）视为不同命名空间。
- 版本升级：`v1 → v2` 时 `StorageMigrator` **清除快照与待定操作**；Cookie 不迁移（要求重新登录更安全）。
- 删除公司：`clearCompany(companyId)` 删除 `v1/co/{companyId}/**` 全部 key。

## 9. Router

> 路由命名已采纳 `04-ux-architecture.md` v1（见 9.1 与 `06-contract-review.md`）；presentation 层的页面实现仍等待 04 按 RC 修订完成。Gate 逻辑与路由名无关。

### 9.1 路由表（采纳 04 v2 命名）

> 来源 `04-ux-architecture.md` v2 §4。路由命名由 Codex 负责；本文只负责 Gate 与路由守卫的技术规则。

```
/startup
/company/select   /company/scan   /company/paste-link
/auth/login   /auth/telegram-consent   /auth/telegram-code   /auth/password   /auth/set-password
/auth/recover   /auth/recover/code   /auth/recover/reset
/home   /loans   /loans/:loanId   /messages          （Main Shell：首页 / 借款 / 消息 / 我的）
/kyc   /kyc/identity   /kyc/contacts   /kyc/employment-assets   /kyc/bank   /kyc/consent   /kyc/files
/kyc/submitted   /kyc/needs-info   /kyc/update-required
/loan/apply   /loan/quote   /loan/quote/confirm   /loan/bill/:loanId   /loan/terms/:loanId   /loan/sign/:loanId
/loan/result/:loanId   /loan/status/:loanId   /loan/contract/:loanId
/me   /me/language   /me/company   /me/password   /me/about
/feature/repay/:loanId   /feature/withdraw/:loanId                          （FeatureFlags 控制，关闭时路由层拒绝）
```
- `/loan/quote`、`/loan/quote/confirm` 依赖 CR-001，**G3 BLOCKED**，Gate 在 G3 解除前不得放行这两个路由。
- `/loan/bill/:loanId`：路径名沿用，**界面称“借款报价摘要”**；Option B 下它是只读摘要，仅用于接续 Legacy 创建、尚未报价确认的贷款时才出现“确认借款报价”动作（兼容 `confirm_bill`）。
- `/feature/*`：除隐藏入口外，**`RouterGate` 在开关关闭时拒绝进入**。
- Gate 目标映射：启动未就绪 → `/startup`；无公司/公司不可用 → `/company/select`；未登录 → `/auth/login`；注册未完成 → `/auth/set-password`；KYC 约束页面且未通过 → `/kyc`。

### 9.2 Gate（`RouterGate`，单点 `redirect`）
`RouterGate` 是一个 `Listenable`，聚合：`BootState`、`activeCompany`、`SessionState`、`RegistrationState`、`KycStatus`。`redirect` 严格按序判断：

| 顺序 | 条件 | 去向 |
|---|---|---|
| 1 | 启动未就绪 | `/boot` |
| 2 | 无 active company | `/company/select` |
| 3 | 公司不可用 | `/company/select`（带原因） |
| 4 | 未登录 | `/auth/*`（并保存 `ReturnIntent`） |
| 5 | 已登录但注册未完成（`policy.phoneVerification && !verificationCompleted` 或 `policy.passwordSetup && !hasPassword`） | `/auth/password-setup`（或对应补全页） |
| 6 | 受 KYC 约束的页面（如 `/loan/new`）且 `kyc != approved` | `/kyc` |
| 7 | 其他 | 放行 |

**Gate 只做“体验一致性”引导；真正的授权永远由服务端判断**（客户端 Guard 被绕过不会带来越权）。

### 9.3 Deep Link
`app_links 7.2.2`（已核实）监听 `https://khmerx.org/app?c=t_…`：
```
parse → 验证 host/path/query → CompanyId 校验
  → 与 active 相同：按 Gate 继续
  → 不同：调用公司选择流程（§8.2）校验并切换；若当前已登录另一家公司，由 UX 决定是否确认（技术上切换安全，会话互不影响）
  → 进入 Gate
```
- Android 清单需 `autoVerify` 的 App Links 声明；**需要在 `khmerx.org` 放 `/.well-known/assetlinks.json`（基础设施依赖，见 §29）**。
- 未验证域名时 Android 会弹选择器，功能仍可用，所以不阻塞开发，只阻塞体验验收。

### 9.4 会话过期 / Return Intent
```
任意页面 → 401(sessionExpired)
 → SessionManager.invalidate → 保存 ReturnIntent(当前 location)
 → Gate → /auth/login → 登录成功
 → ReturnIntent.consume()：同公司且未过期 → 回到原位；否则 /home
```
内存中的 KYC 草稿、表单输入**随进程保留**，登录后回到原位仍在（D6）。

## 10. State Management（Riverpod 3.4.3，已核实）

### 10.1 规范
| 角色 | 实现 | 职责 | 禁止 |
|---|---|---|---|
| **Provider** | `Provider` / `Provider.family` | 依赖注入（Api、Repository、Store、Config） | 持有可变业务状态 |
| **Notifier / AsyncNotifier** | `NotifierProvider` / `AsyncNotifierProvider` | Controller：持有 **UI State**，处理用户意图，调用 Repository / Runner | 引用 `BuildContext`、`Navigator`、`Dio`、`SecureStorage` |
| **Repository（domain 接口 + data 实现）** | 普通类 | 返回领域模型，抛 `Failure` | 操作路由、持有 UI 状态 |
| **Domain State** | `AsyncNotifier` 暴露 `AsyncValue<领域快照>`（如 `LoanSnapshot`） | 数据 + 新鲜度（`fetchedAt`、`revision`） | 混入表单/步骤等 UI 状态 |
| **UI State** | `sealed class`/不可变类 | 页面级状态：步骤、表单、提交中、冲突提示 | 直接使用 DTO |

- 不使用 `StateProvider`、`StateNotifierProvider`、`ChangeNotifierProvider`（Riverpod 3 已移入 legacy）。
- **Default retry = OFF**（D2、ADR-011）：`ProviderScope(retry: (retryCount, error) => null, ...)`，**不为任何 Provider 设置重试例外**。有界重试只存在于 HTTP 层的三个白名单 GET（§6.2），避免与 Provider 重试相乘。
- 任何**写操作绝不在 provider 构建期执行**，只在用户意图触发的 Notifier 方法内通过 `OperationRunner`/明确的 Command 执行；重试语义见 §19.3。
- 架构测试断言：根 `ProviderScope` 的 retry 为 OFF；写操作入口只在 `OperationRunner` 或明确的 Command 方法中。
- 参数化：使用 `Notifier`/`AsyncNotifier` 的构造参数（Riverpod 3 取消 `FamilyNotifier`），`companyId`/`customerId` 作为参数。
- 公司隔离：所有 feature 数据 provider 以 `CompanyId` 为参数；`activeCompanyProvider` 变化时自动重建。
- Riverpod 3 对“不在可见区域的 provider 默认暂停”，**定时刷新不得依赖 provider 内部 Timer**，而用生命周期事件触发（resume / 下拉刷新）。

### 10.2 数据流
```
Widget ──intent──► Controller(Notifier) ──► Repository ──► ApiClient ──► Dio
Widget ◄──UiState── Controller ◄──domain/Failure── Repository ◄──DTO→Mapper── Api
```
```
API DTO（json_serializable，宽容解析，忽略未知字段）
   ↓ Mapper（纯函数，data/mappers）
Domain Model（不可变，含 unknown 兜底）
   ↓ Controller 组合
UI State
```
- **API Model 不得直接作为 UI State**；DTO 不出 `data/` 层。
- 导航：Controller 不导航；UI 用 `ref.listen` 监听一次性事件（`sealed` 的 `UiEvent`），或由 `RouterGate` 根据状态重定向。

## 11. Auth Architecture

### 11.1 组件
| 类 | 职责 |
|---|---|
| `AuthApi` | 6 个端点：`GET /api/h5/auth`、`POST …/send`、`…/verify`、`…/account`（仅 `password_login`、`set_password`）、`…/recovery`、`…/logout`。**不提供 `register` 方法（编译期不存在）** |
| `AuthRepository` | 组合 Api + `SessionManager`，输出 `AuthSnapshot`/`OtpChallenge`/`AuthSession` |
| `AuthController`（`AsyncNotifier<AuthState>`） | 状态：`Booting | SignedOut | SignedIn | RegistrationIncomplete`；意图：`bootstrap`、`requestOtp`、`verifyOtp`、`passwordLogin`、`setPassword`、`startRecovery`、`completeRecovery`、`logout` |
| `OtpChallenge` / `PasswordLogin` / `PasswordSetup` / `PasswordRecovery` / `Logout` / `SessionRestore` | 见下 |

### 11.2 流程
- **bootstrap**：`GET /api/h5/auth` → `AuthSnapshot`。登录页每次进入都先执行，确保 browser Cookie 有效（Max-Age 仅 24 小时）。
- **requestOtp**：本地 `PhoneNumber` 校验 + 用户同意标志 → `POST /send`。
  - 验证码经 **Telegram Gateway** 发送，**不存在短信回退**；错误“号码无效/未注册”映射为 `AuthFailure.otpUndeliverable`（引导安装 Telegram/核对号码）。
  - 倒计时用 `retryAt − ServerClock.now()`；`expiresAt` 同理。
- **verifyOtp**：6 位数字本地校验 → `POST /verify`。成功后服务端建号并下发会话 Cookie；随后**再次 `GET /api/h5/auth`** 获取 `policy`（verify 响应不含 policy）。
- **passwordLogin**：`POST /account {password_login}`，响应含 `policy`；失败统一提示，不区分账号是否存在。
- **setPassword**：本地 12–128 位校验 → `POST /account {set_password}`；成功后再 `GET /api/h5/auth` 刷新 `hasPassword`。
- **recovery**：`send` → `reset`（两次密码一致 + 12–128 位）。成功后**旧会话全部失效**，本地同步清会话 Cookie，回到登录。
- **logout**：先 `POST /logout`（5 秒超时，**尽力而为**），**无论成功与否**都清当前公司会话 Cookie、该客户快照、内存敏感数据；不影响其他公司。
- **注册门槛**：登录后读取 `policy`；`passwordSetup && !hasPassword` 时必须先设置密码，否则业务接口会 403。
- 24 小时会话到期后：用密码（已设置）或验证码重新登录；本期**不做**“保存密码 + 生物识别”（需求 Q2）。

### 11.3 状态机（`SessionState`）
```
Booting ──restore──► SignedOut | SignedIn | RegistrationIncomplete | Expired
SignedOut ──verify/passwordLogin──► SignedIn | RegistrationIncomplete
RegistrationIncomplete ──setPassword──► SignedIn
SignedIn ──401/logout/reset──► SignedOut(Expired)
```

## 12. KYC Architecture

### 12.1 组件
| 类 | 职责 |
|---|---|
| `KycApi` | `GET /api/kyc`、`POST /api/kyc`、`POST /api/kyc/files`、`GET /api/kyc/files?id=` |
| `KycRepository` | `load()`、`save(draft)`、`submit(draft)`、`uploadFile(...)`、`fetchFileBytes(...)` |
| `KycDraftController` | 持有 `KycDraft`（内存），分步保存，触发冲突解决 |
| `KycValidator` | 本地规则校验（镜像服务端规则，**服务端仍是权威**） |
| `KycOptionRegistry` | 选项数据（见 §12.3） |
| `KycUploadService` | 选图/压缩/校验/上传管线 |
| `KycConflictResolver` | revision 冲突三方合并（§18） |

### 12.2 草稿与持久化边界（Q-A2 已冻结）

```
Server = 可恢复草稿的唯一持久化来源
Memory = 当前页面尚未保存的编辑
Disk   = 不保存完整 KYC PII
```
- **服务端草稿**是真相。`save`（`action:'save'`）带完整 `profile` 与 `revision`；`files` 只传 `{id}`。
- **本地编辑**只在内存（`KycDraft`），并记录 `dirtyFields`/`dirtySlots`（相对 `baseRevision`），用于冲突合并。
- **不写磁盘**：`KycDraft` 不落盘；快照里不含任何 KYC 字段；日志不含字段值。
- `consent` 的 `declarationVersion` 取 `GET /api/kyc` 返回的 `profile.declarationVersion`，不写死。
- 签名**不属于 KYC 提交**，由 `/api/loan/sign` 单独完成。

**保存时机（`KycAutoSaveCoordinator`）**
| 触发 | 行为 |
|---|---|
| 点击“继续”（分组完成） | **同步保存**，成功才进入下一分组；失败则留在当前页并提示 |
| 切换 KYC 分组 | 保存（尽力而为） |
| 离开 KYC 流程 | 保存（尽力而为） |
| App 进入后台（`paused`） | 保存（尽力而为，可能被系统中断） |
| “Save & Exit” | 同步保存，成功后退出 |

**D11 约束：保存载荷必须能通过服务端 `cleanProfile`。** 服务端 `save` 也会校验格式与规则，任何一项不合法整个请求就失败。因此 `KycSavePayloadBuilder` 只提交**通过本地格式校验**的字段：
- 电话格式不合法（如未输完）、选项值不在选项内、超长 → **该字段不提交，留在内存**；
- 联系人关系重复、联系人电话重复、区县与省份不匹配 → **不提交造成冲突的字段**；
- 车辆材料出现多份 → 不提交多余的一份。
“继续”（同步保存）则必须校验当前分组全部字段合法，否则**不放行**并在界面定位错误。

**验收标准（替代旧表述）**
> **任何已经成功保存到服务端的 KYC 分组，杀进程重开后都可恢复；当前尚未完成服务器保存的字段可能需要重新输入。**

不承诺“用户输入每个字后，强制杀进程也绝不丢失”。
同一进程内的会话过期/重新登录（FR-2.10）：内存中的 `KycDraft` 保留，登录后回到原位仍在。

### 12.3 Option Registry
```dart
// 类型方案：apiValue 与展示标签分离，禁止“标签 == 提交值”
final class KycOption {
  final String apiValue;          // 提交给服务端的固定字符串，原样发送，永不翻译
  final KycOptionLabel label;
}
sealed class KycOptionLabel {}
final class LocalizedKey extends KycOptionLabel { final String l10nKey; }          // 固定中文值的选项（性别、婚姻、关系、车辆、住房）
final class BundledBilingual extends KycOptionLabel { final String en; final String km; } // options.json 的 "English / ភាសាខ្មែរ"
```
- 固定中文值：`gender(男/女)`、`marital(已婚/未婚)`、联系人关系（父母、配偶、亲属、朋友、村长、公司主管）、`vehicle(摩托车/嘟嘟车/汽车/无)`、`housing(租房/个人房产/无)`、`bankName(ABA Bank/ACLEDA Bank/Wing)`。`apiValue` 为中文字面量，**展示走 ARB**。
- `options.json` 类选项（education、workType、industry、position、income、tenure）：标签为 “English / ភាសាខ្មែរ”；按 ` / ` 拆分，km→高棉部分，en→英文部分，**zh 回退为英文部分**（服务端没有中文标签，不自行翻译）。
- 省/区县来自 `regions`；校验“区县属于省份”。
- 内置文件 `assets/kyc/options.json`，由 `tool/sync_kyc_options.dart` 从服务端 `lib/kyc/options.json` **复制并校验 `version`**（只读源文件，不修改仓库现有代码）。

### 12.4 `ruleVersion` 不一致策略（Q-A3 已冻结）
没有任何接口能在线获取选项，**无法刷新**。冻结为：**只读降级 + 强制升级提示**。
1. `ruleVersion` 等于内置副本 → 正常。
2. 不等 →
   - **不允许继续编辑、不允许提交 KYC**，**不允许用旧选项值猜测提交**；
   - 展示**强制升级提示**（`ForceUpdateRequired` 状态，引导到应用商店；商店链接由配置提供）；
   - 仍允许查看 KYC 状态、审核意见、已上传材料概览；KYC 已 `approved` 的客户**贷款流程不受影响**（不依赖选项）；
   - 记录脱敏日志（版本号，不含 PII）。
3. 没有“最低版本”接口，该机制只能由 `ruleVersion` 不一致触发。

理由：用错误选项值提交会产生语义错误或被服务端拒绝；新增必填字段客户端无法得知。

### 12.5 `KycValidator`（镜像规则）
必填（含条件必填）、`≤240` 字符、电话 `^\+[1-9]\d{7,14}$`（去空格括号短横）、姓名类转大写、选项合法性、联系人关系不重复、联系人电话不重复、联系人 3 要么全填要么全空、上司姓名与电话成对、区县属于省份、车辆材料**恰好一份**、`rentContract`/`propertyCertificate` 随 `housing` 条件必填、材料槽位可见性。输出 `KycIssue(fieldId|slot, ruleKey)`，映射为本地化文案；**不展示服务端 `missing` 中文**。以 `test/unit/kyc_validator_test.dart` 的**对照向量**防止与服务端规则漂移（向量按 `lib/kyc/core.ts` 人工整理并评审，见风险 R6）。

### 12.6 上传
`KycUploadService.upload(slot, source)` 管线：
```
选择（image_picker / file_picker）
 → 立即读入内存 Uint8List，并删除插件产生的临时文件（TempFileSweeper）
 → 按槽位校验类型：JPEG/PNG/PDF 魔数；selfie、signature、vehiclePhoto 禁止 PDF
 → 图片重编码压缩（内存内，宽高上限 + 逐级降质量）至 ≤ 10MB，且 ≥ 16 B
 → POST 原始字节，头 x-kyc-slot，Origin 自动
 → 返回 KycFileRef，写入 KycDraft.files（不立即保存；随分组 save 一并提交）
```
- 服务端按 sha256 去重 → **用户主动重试安全**；不自动重试。
- 取消：`CancelToken`；失败不影响已有文件。
- **预览**：`FileApi.getBytes` → `SensitiveBytesStore`（内存 LRU，≤8 张/≤20MB，按 `companyId+customerId` 隔离，**会话失效/登出/切换公司立即清空**）→ `Image.memory`（`cacheWidth` 限制解码尺寸）。**不使用基于磁盘的图片缓存库**。
- `signature` 槽位被 `/api/kyc/files` 拒绝，签名只走 §13.4。

### 12.7 状态监视
`KycStatusWatcher`：`resume` 与下拉刷新时重取（间隔 ≥30 秒），读取 `GET /api/h5/state` 的 `kyc.status`；`submitted` 时只读。

## 13. Loan Architecture

> **G3 BLOCKED**（8 项解除条件见 §25.2 与 `07` §27）。后端契约以 `07-CR-001-quote-contract.md` 为准，**本章不重复契约细节，只定义客户端如何消费**。

### 13.1 组件
| 类 | 职责 |
|---|---|
| `StateApi` | `GET/POST /api/h5/state` |
| `QuoteApi` / `QuoteRepository` | **（CR-001，BLOCKED）** `fetchLoanQuote(amount, termDays)` → `LoanQuote`，无副作用 |
| `LoanRepository` | `fetchState()` → `LoanStateSnapshot`；`createLoan(quote)`（携带 `quoteId` + `billConfirmed:true`）、`apply`；（Legacy）`confirmLoanQuote`（映射 `confirm_bill`）；（受开关）`withdraw`、`repay` |
| `LoanController` | `AsyncNotifier<LoanStateSnapshot>`：先给缓存，再网络刷新（SWR）；`revision` 未变则不重建 UI |
| `LoanStageMapper`（纯函数） | `(KycStatus, List<Loan>) → HomeStage`，对应 `01` 的首页状态；**只映射当前服务端状态，不推断下一状态** |
| `RepaymentBillMapper`（纯函数） | 把 `active/closed` 贷款映射为 `RepaymentBill`（见 §13.6） |
| `LoanUiState` | 页面状态（提交中、冲突提示、未知结果、确认弹窗等） |

### 13.2 `/api/h5/state` 使用约束
- 新流程使用动作：`create`（携带 `quoteId` + `billConfirmed:true`，Option B）、`apply`，以及开关控制下的 `withdraw`、`repay`。**新流程不调用 `confirm_bill`**；`confirm_bill` 仅用于接续 **Legacy 创建、尚未报价确认**的贷款（同一客户可能经 Web/Mini App 创建）。**不使用** `confirm_kyc`、`submit_kyc`、`resubmit`、`sign`。
- `create` 参数（CR-001 之后）：`requestId`、`name`（≥2）、`amount ∈ {3000,5000,10000,50000}`、`termDays ∈ {14,28}`、`consent:true`、`quoteId`、`billConfirmed:true`。客户端**永远携带** `quoteId`，不依赖“缺省也接受”（Strategy A 下旧路径仍被服务端接受，但 Android 不使用）。
- `billConfirmedAt` 的业务含义（新流程）：**用户确认创建该 Loan 所依据 Loan Quote 的时间**。
- 写操作必须经 `OperationRunner`（§19）。
- 响应是全量状态：Mapper 过滤客户相关字段，丢弃 `note`、内部人员字段、`bots`、`entries` 的内部信息。

### 13.3 申请流程（冻结，Q-A1 / Option B）
```
选择金额 + 期限
   ↓  QuoteRepository.fetchLoanQuote()      ← 无副作用，不创建 Loan，不占用名额；TTL 15 分钟
展示借款报价：本金 / 费用 / 到账金额 / 应还总额 / 期限 / 有效期（全部来自服务端）
   ↓  用户报价确认（Quote Confirmation）
create（quoteId + billConfirmed=true + requestId）     ← 服务端校验并消费 Quote；同时写入 billConfirmedAt
   ↓
Terms（服务端 termsVersion）→ Signature（PNG，原始字节）→ Apply
```
- **客户端不计算、不估算任何费用**（禁止用 `pricing` 参数推算）。
- 借款报价过期、无效、定价变化（含指纹不一致）、参数不一致 → `ConflictKind.quoteExpired / quoteInvalid / quoteChanged`：**重新获取借款报价并要求用户重新报价确认**，不静默使用新数字。
- **Option B**：用户已在报价页确认同一个 `quoteId`，`create` 成功后**不再要求再次 `confirm_bill`**，可直接进入条款。
- **Create 的未知结果（AF-6）**：见 §19.2。后端修复前，同一 `requestId` 重试可能得到 409；客户端以 `loan.billing.quoteId === 已确认 quoteId` 判定已成功。后端修复后，同一 `requestId` 重放直接返回原成功结果。
- **G3 解除前**：不实现 `create` 的入口；`LoanStageMapper`、状态展示、合同查看等不依赖报价的部分可先做。

### 13.4 条款与签名
| 类 | 职责 |
|---|---|
| `TermsRepository` | `GET /api/loan/sign?loan=` → `TermsDocument`（含 `termsVersion`），**仅内存缓存** |
| `TermsVersion` | 值对象，来自服务端，**不得写死** |
| `SignatureController` | 管理画布笔画（内存）、清除、空判断 |
| `SignatureEncoder` | 画布 → PNG 字节（内存，`toByteData(png)`），**不写磁盘** |
| `SignRequest` | `{loanId, termsVersion, pngBytes}` |
| `LoanApi.sign` | `POST /api/loan/sign`，头：`x-loan-id`、`x-loan-consent: true`、`x-loan-terms`；`Origin` 自动 |
- 签名前置：贷款 `kyc_approved` 且 `billConfirmedAt` 有值（Option B 下 `create` 已写入）；读完条款才允许同意（UX 实现，Controller 提供 `termsRead` 标志）。
- **签名文件的 `created_at` 必须晚于 `billConfirmedAt`**（服务端校验）：Option B 下签名发生在 `create` 之后，自然满足。
- **每次签名重新画**，不复用旧图（服务端按内容去重会导致第二笔失败）。
- 签名接口无 `requestId`，**不可幂等**：失败/歧义时刷新状态诊断（§18.3），不自动重试。
- 签名位图提交后立即丢弃。

### 13.5 提现与还款
Repository 方法存在但**入口受 `FeatureFlags` 控制，且 Repository 内再次校验开关**（纵深防御）：开关关闭时抛 `FeatureDisabledError`。后端接入 KESS 后此模块重写（需求 FR-7.4）。

### 13.6 还款账单（Repayment Bill）与“派生显示值”
- **事实**：服务端 state 中没有“剩余应还”字段；`repay` 内部用 `left = amount + fee − paid`（`domain.ts:66`），且 `fee = billing.total − principal`；`lib/postloan/core.ts` 现无会改变应还金额的罚息或计息逻辑。
- **决策**：`RepaymentBillMapper` 展示 `total`（`billing.total`）、`paid`（`loan.paid`）、`dueAt`；**`remaining` 允许作为派生显示值**，且仅此一处、仅用 `Money` 的整数减法（`total − paid`），**禁止用于任何提交、校验或资金决策**（还款金额上限以服务端校验为准）。
- **约束**：该派生值必须在代码与文档中标注为 `DERIVED_DISPLAY`；一旦后端引入罚息、逾期费、KESS 对账或出现 `paid` 之外的抵扣，**必须改为读取服务端字段**。已记为后端建议项（非阻断，见 `09`）：由服务端直接返回 `remaining`/`dueNow`。
- **术语**：只在贷款进入 `active` 后使用“还款账单”；放款前的费用一律称“借款报价”。

## 14. File Architecture
| 能力 | 方案 |
|---|---|
| 选图 | `image_picker`（Android 系统相册/相机）；PDF 用 `file_picker`（`withData: true`）。**选择后立即读入内存并删除插件复制的缓存文件** |
| 临时文件清扫 | `TempFileSweeper`：每次选择后、应用启动时、登出/切换公司时清扫缓存目录中本应用产生的选择文件；有安全测试验证 |
| 压缩 | 内存内重编码（不使用写文件的压缩 API） |
| 上传 | 原始字节 POST，不是 multipart |
| 下载预览 | 带 Cookie 取字节 → `SensitiveBytesStore`（内存 LRU）→ `Image.memory` |
| 签名 | 画布→PNG 字节，**仅内存** |
| 持久化 | **证件图、签名图永不落盘**；Dart 字符串无法清零，属于已知限制（R10） |

## 15. Cache Architecture

### 15.1 缓存什么
快照 `LoanSnapshot`：贷款列表与状态（金额以美分整数）、KYC 状态、`revision`、`fetchedAt`、语言偏好、条款**版本元数据**（不缓存条款正文）。**不缓存 `LoanEvent`**（避免内部信息），时间线在线加载。

### 15.2 不缓存什么
证件图、签名图、完整身份证号、银行账号原值、密码、OTP、明文 Cookie 文件、任意原始响应体、KYC 资料内容。

### 15.3 存储与策略
- 存储：`SnapshotStore` → `SecureKv`，key 见 §8.3，单快照 ≤64KB，超限丢弃。
- **TTL**：快照仅在“会话看起来有效”时用于渲染，且距 `fetchedAt` ≤ 24 小时（与会话生命周期一致）；过期按无缓存处理。
- **SWR**：先渲染快照，再后台请求；响应的 `revision` 与快照相同则不重建 UI，不同则替换并回写。
- 写入时以**请求发起时的 `(companyId, customerId)`** 为键，提交前校验仍等于当前作用域，否则丢弃（防切换竞态）。
- 刷新节流：前台自动刷新间隔 ≥30 秒；下拉强制刷新；`resume` 超过 60 秒才刷新。
- **离线**：读缓存，**写操作禁用并说明原因**；`ConnectivityService`（`connectivity_plus`）仅作提示，真实以请求失败为准。
- 失效：登出、401、公司移除、`customerId` 变化、`StorageMigrator` 升级。

## 16. Localization

- 语言：`en`、`km`、`zh`，`gen-l10n` + ARB（`app_en/km/zh.arb`）。
- **可用语言 = 三种固定语言 ∩ `GET /api/h5/auth` 的 `languages` 开关**（管理端控制）。选定公司前：设备语言属于 `{en, km}` 则用之，否则 `en`。
- 当前语言被管理端关闭时，自动切到可用语言（优先 `en`）并通知用户（文案待 UX）。
- 偏好保存于 `v1/co/{companyId}/prefs`；切换时调用 `POST /api/h5/locale` 仅作同步（服务端不返回该偏好，**不依赖其回读**）。
- 字体：内置 Noto Sans Khmer 并设置 `fontFamilyFallback`，高棉文行高不低于设计令牌（令牌待 UX）。
- ARB 键一致性有测试（三份文件键集合必须一致）。

### 16.1 映射层
| 映射 | 输入 → 输出 |
|---|---|
| `StatusLabelMapper` | `LoanStatus` / `KycStatus` → l10n key（`unknown` → 通用文案） |
| `EnumLabelMapper` | 事件 `action`、选项 `apiValue` → l10n key |
| `ServerMessageCatalog` | `(HTTP 状态码, 端点, 服务端文案)` → `Failure` 种类 + l10n key（集中，见 §17） |
| `KycIssueMapper` | `KycIssue.ruleKey` → l10n key |
| `ReviewReasonPolicy` | 决定哪些服务端文本原样展示 |

### 16.2 服务端中文内容的分类处理
| 内容 | 处理 |
|---|---|
| `error`（错误） | 经 `ServerMessageCatalog` 映射为本地文案；**未命中**用按状态码分类的通用文案，**不直接展示中文原文** |
| `loan.note`（状态说明） | **不展示**；用 `StatusLabelMapper`（需求 Q4 默认同意） |
| `missing[]`（缺项） | **忽略**；用本地 `KycValidator` |
| `review.reason`（审核员意见） | **原文展示**在“审核员意见（原文）”容器内，标记**未翻译**；**不做机器翻译，也不当作服务端事实改写** |
| 条款 `blocks` | 中文原文展示 + “条款为中文原文”标识（需求 Q3 待法务） |
| 事件 `action` | 已知 → 映射标签；未知 → “有更新”通用文案 |
| 用户自己的数据（姓名等） | 原样展示 |

## 17. Error Architecture

### 17.1 类型
```dart
sealed class Failure implements Exception { const Failure({this.retry}); final RetryMeta? retry; }
final class OfflineFailure extends Failure {}
final class TimeoutFailure extends Failure {}
final class ServiceUnavailableFailure extends Failure {}
final class AuthFailure extends Failure { final AuthFailureKind kind; }
final class ConflictFailure extends Failure { final ConflictKind kind; }
final class RateLimitFailure extends Failure { final int retryAfterSeconds; }
final class ValidationFailure extends Failure { final ValidationKind kind; }
final class OperationRejectedFailure extends Failure {}   // /api/h5/state 统一 400，原因不明（D3）
final class NotFoundFailure extends Failure {}
final class PayloadFailure extends Failure {}             // 413/415 或客户端预检失败
final class StorageFailure extends Failure {}             // 安全存储读写/解密失败
final class UnknownFailure extends Failure {}
```
`AuthFailureKind`：`sessionExpired, invalidCredentials, loginPageExpired, registrationIncomplete(step), companyUnavailable, otpUndeliverable, otpInvalid, otpExpired, otpAttemptsExhausted, phoneBoundToAnotherAccount, identityUnavailable, crossSite`。
`ConflictKind`：`kycRevision, kycLocked, loanState, quoteChanged, quoteExpired, quoteInvalid, alreadySigned, applicationChanged, kycVersionChanged, preconditionMissing, activeApplicationExists, kycNotApproved, concurrentUpdate, unknown`。

### 17.2 映射
`ErrorMapper.map(statusCode, endpoint, serverMessage)`：
1. 先按状态码粗分（401/403/404/409/413/415/429/5xx/网络）。
2. 再查 `ServerMessageCatalog`（**精确或前缀匹配，规范化空白**）得到具体 `Kind` 与 l10n key。
3. 未命中：按状态码给默认 `Kind`（409 → `ConflictKind.unknown` → 触发刷新；400 on state POST → `OperationRejectedFailure`）。
4. 输出：**稳定的内部类型 + l10n key + 重试元数据**。**中文字符串只存在于 `ServerMessageCatalog` 一处**，UI 与 Controller 不出现。

### 17.3 初始目录（来自已读代码，需联调补全）
| 状态码 | 端点 | 服务端文案（摘要） | 映射 |
|---|---|---|---|
| 401 | 需会话 | 客户登录已失效，请重新验证手机号 | `AuthFailure.sessionExpired` |
| 401 | `send/verify/recovery` | 登录页面已失效，请刷新后重试 | `loginPageExpired`（有界恢复一次） |
| 401 | `account` | 手机号或密码不正确… | `invalidCredentials` |
| 401 | 任意 | 请先进入有权访问的私有测试工作区 | `identityUnavailable`（部署异常，高优先级日志） |
| 403 | POST | 不允许跨站操作 | `crossSite`（**视为客户端缺陷**：Origin 未设置，记录高优先级日志） |
| 403 | 业务 | 请先在客户账号设置中完成手机号验证… / 设置密码… | `registrationIncomplete(step)` |
| 403 | 任意 | 公司工作区无效 / 公司已停用或不可访问 | `companyUnavailable` |
| 400 | `send` | 该号码暂不能接收 Telegram 验证码… | `otpUndeliverable` |
| 400 | `verify` | 验证码不正确，请重新输入 / 尝试次数已用完… | `otpInvalid` / `otpAttemptsExhausted` |
| 409 | `verify` | 验证码已失效、正在核验或尝试次数已用完… | `otpExpired` |
| 409 | `verify` | 该手机号已绑定其他账号… / 请验证当前账号注册时填写的手机号 | `phoneBoundToAnotherAccount` |
| 409 | `kyc` 保存 | 资料版本已变化，请重新加载 / 资料已被其他操作更新… | `kycRevision` |
| 409 | `kyc` 保存/上传 | 当前资料已锁定… / 资料已锁定，无法上传 | `kycLocked` |
| 409 | `state create` | 请先完成当前申请，再发起新的申请 | `activeApplicationExists` |
| 409 | `state create` | 请先完成 KYC 资料审核… | `kycNotApproved` |
| 409 | `state apply` | 请完成当前申请的费用确认与手写签约… | `preconditionMissing` |
| 409 | `state` | 审核资料版本已变化，请联系审核人员 | `kycVersionChanged` |
| 409 | `sign` | 本申请已保存签名合同… | `alreadySigned` |
| 409 | `sign` | 请先通过 KYC、创建申请并确认费用，再签约 | `preconditionMissing` |
| 409 | `sign` | 申请或审核资料已变化… / 申请已变化，请刷新 | `applicationChanged` |
| 400 | `state` POST | **操作未完成，请确认申请归属、当前状态与填写内容后重试**（所有领域错误同此文案） | `OperationRejectedFailure`（需诊断，D3） |
| 413 | 上传 | 上传内容过大 | `PayloadFailure` |
| 429 | 任意 | 请求过于频繁，请稍后再试 | `RateLimitFailure(retryAfter)` |

目录通过**契约测试夹具**固化；新增/变化的文案由 `UnknownFailure` 与脱敏日志暴露，联调时补全。

## 18. Conflict Resolution

**409 是一等公民，不是异常。** 统一入口 `ConflictResolver`，输出 `ConflictResolution`（sealed），由 Controller 转成 UI 状态（呈现方式待 UX）。

```dart
sealed class ConflictResolution {}
final class Refreshed extends ConflictResolution { final Latest latest; }           // 已刷新，请用户确认后继续
final class MergedAndRetried extends ConflictResolution {}                          // 已合并并成功重试
final class RequiresReconfirmation extends ConflictResolution { final Reason reason; final Latest latest; }
final class AlreadyDone extends ConflictResolution { final Latest latest; }         // 其实已成功
final class NoLongerApplicable extends ConflictResolution { final Latest latest; }  // 状态已前进/后退，当前操作失效
final class Unresolved extends ConflictResolution {}                                // 提示稍后重试
```

### 18.1 KYC revision 冲突
```
save → 409(kycRevision)
 → GET /api/kyc 取最新（remote）
 → 若 remote.status 不是 draft/needs_info → NoLongerApplicable（只读，说明已锁定）
 → 三方合并（base=draft.baseRevision 时的值，local=用户内存值，remote=最新值）：
      字段/槽位：用户在本次编辑中修改过（dirty） → 保留 local；其余 → 取 remote
      两边都改且不同 → 保留 local，并标记 ConflictNotice(remoteChangedFields)
 → 用 remote.revision 重新 save（仅一次，用户本次意图的延续）
 → 仍 409 → Unresolved（停止，保留内存草稿，提示重试）
```
- 审核员“代修改”会使状态变 `needs_info` 并改动字段：同一流程处理。
- `ruleVersion` 变化 → 转 §12.4 只读降级。

### 18.2 贷款操作冲突（D3：不能靠文案）
`/api/h5/state` 的 400“统一文案”与 409 都进入 `LoanConflictResolver.diagnose(expectation, latestState)`：
1. **歧义结果先于诊断**：若是超时/断连（结果不确定），**先用同一个 `requestId` 重发**（§19），不诊断。对 `create`，重发后若收到 `409 ACTIVE_APPLICATION_EXISTS`（后端 AF-6 修复前的旧行为）或 `QUOTE_ALREADY_USED`，**刷新状态并用 `loan.billing.quoteId` 与已确认的 `quoteId` 比对**：相同 → `AlreadyDone`，不是错误。
2. 明确被拒（有响应）→ `GET /api/h5/state` 取最新，与**操作期望**比较：
   - 目标状态已达成（例如 `apply` 后状态已是 `decision_pending`）→ `AlreadyDone`。
   - `loan.status` 与期望前置不符 → `NoLongerApplicable`。
   - `billing.quoteId` 与用户确认的不同 → `RequiresReconfirmation(quoteChanged)`，展示新借款报价并要求重新报价确认。
   - **（CR-001 之后）`create` 因报价过期/无效/定价变化被拒 → `RequiresReconfirmation(quoteExpired)`：重新获取 Quote，展示新数字并要求用户重新确认；不静默使用新报价，也不复用旧 `requestId`。**
   - 报价已确认但合同缺失/失效 → `RequiresReconfirmation(contractMissing)`，回到签名。
   - KYC `revision` 变化 → `RequiresReconfirmation(kycVersionChanged)`，并刷新 KYC。
   - 其余 → `Unresolved`（“稍后重试”）。
3. **有具体文案的 409**（如 `activeApplicationExists`）按目录直接映射 `Kind`，并刷新状态。

### 18.3 签约 409
`sign` 无 `requestId`，不可幂等。处理：
- 409 或结果不确定 → 刷新状态：已有合同 → `AlreadyDone`（进入 `apply`）；`billConfirmedAt` 缺失 → 要求先完成报价确认（Legacy 贷款用兼容动作 `confirm_bill`）；`id`/`quoteId` 变化 → 要求重新确认并**重新签名**；其余 `Unresolved`。
- 签名位图提交后即丢弃；重签要重新画。

## 19. Idempotency

### 19.1 概念
| 类型 | 说明 |
|---|---|
| `OperationKey` | `{companyId, customerId, type, loanId?, fingerprint}`；`type ∈ create/confirmLoanQuote(Legacy)/apply/withdraw/repay`；`fingerprint` = 语义载荷的稳定哈希（create：name+amount+termDays；confirmBill/apply：quoteId；repay：cents） |
| `PendingOperation` | `{key, requestId, state(inFlight|unknown), createdAt, attempts}` |
| `RequestIdGenerator` | 生成 `kx-<uuid v4>`（满足服务端 8–100 字符；服务端再加客户前缀） |
| `PendingOperationStore` | 经 `SecureKv` 持久化，key 见 §8.3；**不含 PII** |
| `OperationRunner` | 唯一的写操作入口（含互斥与恢复） |
| `RetryRecovery` | 对 `unknown` 的恢复策略 |

### 19.2 规则
- **同一逻辑动作的重试 = 同一个 `requestId`；新的动作 = 新的 `requestId`。**
- **写前持久化**：发送前先落盘 `PendingOperation`，再发请求；App 被杀后仍可恢复原 `requestId`。
- 结果判定：
  | 结果 | 处理 |
  |---|---|
  | 2xx 成功 | 标记完成，应用最新状态，**删除** pending（下次同类动作用新 id） |
  | 服务端明确拒绝（400/403/404/409，有响应） | **删除** pending（D7：被拒请求不会被服务端记录，之后可用新 id）。**例外（AF-6）**：`create` 收到 `409 ACTIVE_APPLICATION_EXISTS` / `QUOTE_ALREADY_USED` 时，**先**刷新状态并按 `loan.billing.quoteId` 判定是否其实已成功，再决定是否删除 pending；判定为已成功则按成功处理 |
  | 结果不确定（超时、断连、5xx/503） | 保留为 `unknown` |
- **恢复**（App 启动、回到前台、进入相关页面）`recoverPending()`：
  - 非资金类（`create/confirmLoanQuote/apply`），**TTL 10 分钟内**：用**同一个 `requestId` 重发**。
    - 对 `apply`、`confirm_bill`：服务端对已处理的 `requestId` 直接返回现状，安全。
    - **对 `create`（AF-6，P0）**：**后端修复前，服务端并不会直接返回原结果**——进行中申请检查先于去重，同一 `requestId` 重发会得到 `409`。因此 `create` 的恢复判定必须是：重发 →（200）成功；或（409 `ACTIVE_APPLICATION_EXISTS` / `QUOTE_ALREADY_USED`）→ `GET state`，**存在 `loan.billing.quoteId === 本次确认的 quoteId` 的贷款即判定成功**，否则才是真正冲突。后端修复后（`07` §11），同一 `requestId` 重放直接返回原成功结果，上述兜底无害且保留。
  - 资金类（`withdraw/repay`，且仅当功能开关打开）：**不自动重发**，先拉取最新状态并**请用户确认**后再决定（避免用户已遗忘的操作被执行）。
  - 超过 TTL：不再重发，只刷新状态并清除记录；再次操作使用新的 `requestId`，依靠服务端状态校验兜底（`create` 有 Quote 一次性消费与“已有进行中申请”限制，客户端按 `billing.quoteId` 判定是否已成功；`apply`/`confirm_bill` 有状态前置，`repay` 有 `≤剩余应还`）。
- **互斥**：同一 `OperationKey` 同时只允许 1 个在途；同一客户的状态变更串行执行（内存队列，**不是离线队列**），避免 revision 竞争。
- **禁止**：HTTP 层自动重试 POST；Riverpod 自动重试；在 provider 构建期执行写。
- 其他幂等：文件上传靠服务端 sha256 去重（用户主动重试安全）；KYC 保存靠 `revision`；签名靠状态诊断（§18.3）。

### 19.3 重试策略总表（Command + Idempotency + Explicit Retry Policy）

**原则**：重试**只能**由 `Command + 幂等 + 显式重试策略`决定，**不能**由 Provider 或通用拦截器隐式发生。每个写操作在 `Endpoints` 与 `OperationRunner` 中声明自己的 `RetryPolicy`：

| 操作 | RetryPolicy | 说明 |
|---|---|---|
| `GET /api/h5/auth`、`GET /api/h5/state`、`GET /api/kyc` | `BoundedGet(2)`（HTTP 层） | 仅连接错误、超时、503 |
| 其他 GET（条款、合同、文件下载） | `None` | 用户手动刷新；加入白名单需评审 |
| `POST /auth/send`、`/recovery send` | `None`，**例外** `PreconditionRecoveryOnce` | 仅当 401“登录页面已失效”（服务端在副作用之前就拒绝）：刷新 browser Cookie 后重放**一次**；需测试覆盖 |
| `verify`、`password_login`、`set_password`、`recovery reset`、`logout`、`locale` | `None` | `logout` 尽力而为，失败也清本地 |
| `state`：`create`、`apply`、（Legacy）`confirm_bill`、（开关）`withdraw`、`repay` | `ReuseRequestId`（`OperationRunner`，§19.2） | 由用户动作或恢复流程触发，**不是自动循环**；资金类恢复需用户确认 |
| `quote`（CR-001） | `None` | 报价是 POST，但不属于“明确安全的 GET”；HTTP 层不重试，由用户主动重试；客户端按 `(amount, termDays)` 缓存未过期报价以减少请求 |
| `kyc save`、`kyc submit` | `None`，**例外** `ConflictResolver` 合并后显式重试**一次** | 属于用户本次意图的延续，有界 1 |
| 文件上传 | `None` | 用户主动重试；服务端按 sha256 去重 |
| `sign` | `None` | 无 `requestId`，歧义靠状态诊断 |

**全局规则**：Riverpod `retry` 全局为 `null`（OFF），**不设任何 Provider 级例外**；`create / confirm_bill / apply / sign / KYC save / KYC submit / 密码类操作 / logout` **不得**由 Provider 自动重试。以架构测试断言：`ProviderScope` 的 retry 为 OFF，且写操作入口只在 `OperationRunner` 或明确的 Command 方法里。

## 20. Security

| 项 | 方案 |
|---|---|
| 安全存储 | `flutter_secure_storage 11.2.0`（已核实）。**解密/读取失败 = fail closed**：清空全部 key，视为登出 |
| Android 备份 | `allowBackup=false` + 排除加密存储的数据提取规则，避免密文迁到无密钥设备 |
| 传输 | 仅 HTTPS；`networkSecurityConfig` 禁止明文流量（仅 dev 构建为 `10.0.2.2` 放行）；release 不信任用户证书 |
| `FLAG_SECURE` | `SecureWindow`：原生侧 `MethodChannel` 在 `MainActivity` 设置，release 默认开启（禁止截屏、屏蔽最近任务缩略图） |
| 后台遮挡 | `LifecycleMask`：`inactive/paused` 时覆盖应用内容（与 `FLAG_SECURE` 互补） |
| 无内置机密 | 不含 Bot Token、Gateway Token、DB 密钥、任何服务端密钥；CI 加扫描 |
| 日志 | `SafeLogger` + `RedactionPolicy`（§22） |
| 权限 | `INTERNET`、`CAMERA`（扫码/拍照）；定位**仅用户主动触发时**申请，不声明联系人/短信/存储读取权限 |
| 包可见性 | 为打开 Telegram 声明 `<queries>` |
| 发布 | `--obfuscate --split-debug-info`；签名密钥不入库 |
| 剪贴板 | 不主动写入敏感内容；验证码输入框不开启自动保存 |
| 密码 | **不保存密码**，不实现“记住密码”；密码只在内存里经 `TextEditingController` 存活，提交后清空 |
| 依赖 | CI 运行依赖漏洞检查，锁定版本 |
| 待确认 | 证书固定、root 检测、反调试（需求 Q8）；已预留 `PinningPolicy` 接口 |

## 21. Feature Flags
- `BuildTimeFeatureFlags`：来自 `--dart-define`，字段：`withdrawEnabled=false`、`repayEnabled=false`（默认关闭）。
- `RemoteFeatureConfig`：**仅接口**（`Future<RemoteFlags> fetch()`），本期**无实现、无后端依赖**；规则：未来远程配置**只能进一步关闭，不能开启**构建期关闭的功能。
- 双重守卫：UI 入口读取开关；`LoanRepository.withdraw/repay` 内再校验。

## 22. Logging

- `SafeLogger`：`debug/info/warn/error(event, fields)`；字段值必须是 `LogField`，经 `RedactionPolicy` 处理后才输出。release 只保留 `warn/error`；**仅内存环形缓冲，不写文件、不上传**（崩溃上报产品见 Q-A4）。
- `RedactionPolicy`：
  - **字段名黑名单**（大小写不敏感，包含匹配）：`password, passwd, code, otp, phone, cookie, set-cookie, authorization, token, session, bankAccount, bankHolder, surname, givenName, address, contact*, supervisor*, signature, id*, selfie, body`。
  - **值模式**：手机号 → `***1234`；64 位十六进制（会话、browser、challengeId）→ `[hex64]`；长数字串（银行账号）→ `***末4位`。
  - 异常消息与堆栈同样先脱敏再记录。
- **默认所有端点视为敏感**（`Endpoints.sensitiveBody=true`），拦截器不输出请求/响应体与 Cookie。
- `FlutterError.onError`、`PlatformDispatcher.onError` 接入 `SafeLogger`。
- 测试：脱敏对照测试 + 拦截器测试断言输出不含 Cookie、体、手机号、OTP。

## 23. Testing

### 23.1 分层
| 层 | 内容 | 位置 |
|---|---|---|
| Unit | Mapper、`KycValidator`、`Money`/`MoneyFormatter`、`ErrorMapper`、`StatusLabelMapper`、`EnumLabelMapper`、`LoanStageMapper`、Cookie 解析、`KeySchema`、`RedactionPolicy` | `test/unit` |
| Repository | 用自写 `FakeHttpAdapter` + **真实形态 JSON 夹具**测试 Repository 与 Api | `test/data` |
| State | `ProviderContainer` + 覆盖，测 Controller/Notifier（含冲突、幂等、SWR） | `test/state` |
| Architecture | 依赖方向、禁止 import、`Endpoints` 唯一路径来源 | `test/architecture` |
| Security | 见 §23.3 | `test/security` + `integration_test` |
| Integration | 对**本地模拟服务**（实现契约的 Dart HTTP 服务）跑端到端 | `integration_test` |

### 23.2 集成场景（必须全部覆盖）
公司选择；验证码登录；密码登录；会话恢复；登出；KYC 保存；KYC revision 409；文件上传；KYC 提交；报价（CR-001，契约冻结后）；创建申请（携带 `quoteId`）；确认账单；条款；签名；apply；401、403、409、429、503；离线。另含：Origin 缺失导致 403 的负向用例（证明拦截器生效）、`loginPageExpired` 有界恢复、`unknown` 操作的同 `requestId` 恢复、`ruleVersion` 不一致只读降级。

### 23.3 安全测试
- 公司 A 无法读取公司 B 的快照、Cookie、待定操作。
- 登出只清当前公司会话；其他公司仍有效。
- **磁盘无明文 PII**：流程结束后扫描应用数据目录（documents、cache、support、`shared_prefs`、文件目录），断言不含哨兵姓名/手机号/银行账号，且无 JPEG/PNG/PDF 魔数文件。
- 无敏感日志（Cookie、体、OTP、手机号）。
- 解密失败 fail closed。
- 切换公司时在途请求的响应不写入新公司。

### 23.4 真实环境冒烟（联调，非自动化）
目前**没有 staging**，只有生产入口：
- `GET /api/h5/auth` → 200，并下发 browser Cookie。
- `POST /api/h5/auth/logout`（体 `{}`）→ 200：证明 `Origin` 与 Cookie 生效（无副作用）。
- 注意：**不要在生产自动化发送验证码**。

## 24. Build / Environment

| 环境 | baseUrl | 说明 |
|---|---|---|
| `dev` | 本地模拟服务（模拟器用 `http://10.0.2.2:<port>`） | 仅 debug；`Origin` 由 baseUrl 推导，自动匹配模拟服务 |
| `staging` | **目前不存在，保留名称，不假设 URL** | 有真实 staging 后再启用 |
| `production` | `https://api.khmerx.org` | 唯一真实入口（项目方确认） |

- 配置：`--dart-define-from-file=config/<env>.json`，**仅含非密钥**：`baseUrl`、功能开关、日志级别、构建标识。**任何密钥不得进入构建配置**。
- Android：`productFlavors`（`dev`、`prod`）；`dev` 使用 `applicationIdSuffix`，且仅 `prod` 声明 `khmerx.org` App Links。
- `minSdk`：使用 Flutter 默认并在 G0 核实官方支持范围（需求 Q5）。
- 发布：开启混淆与符号分离；签名密钥由 CI 注入。

### 24.1 Android 工具链与 JDK 口径（G0 实施事实；详见 `19-G0-gate-contract-correction.md`）
- 实施事实（来自 `17`/`18`，独立复验确认）：Flutter 3.47.0 / Dart 3.13.0；AGP 8.11.1；Gradle 8.14.1；Kotlin 2.4.0；Java source/target 与 Kotlin `jvmTarget` 为 17。
- **四个独立的 Java 概念**：A System `JAVA_HOME`、B PATH Java、C Flutter Tool Selected JDK（Flutter 按 `jdk-dir` → Android Studio JDK → `JAVA_HOME` → PATH 的顺序选择，源码核实；用户级配置 `%APPDATA%\.flutter_settings`）、D Gradle Build JDK（项目内 `org.gradle.java.home`；含 daemon 与 launcher 两个 JVM，launcher 继承 C）。
- **Project Build Contract**：D 为批准的兼容 JDK（当前 JDK 17）并有证据，且干净构建通过——**阻断**。
- **Developer Environment Requirement**：C、A、B——**Informational**，与 JDK 17 不同记 P2；建议用 `flutter config --jdk-dir` 在开发者/CI 环境设置。
- 已登记 P2 债务：`org.gradle.java.home` 为机器绝对路径（可移植性）；Gradle 8.14.x 不支持 Java 25 作运行 JVM（launcher 风险）；Flutter 对 Gradle/AGP 旧版本的未来支持警告。

## 25. Development Gates

### 25.1 并行轨道与汇合

```
TRACK A  Codex  ───────────► 04-ux-architecture.md ──┐
TRACK B  Trae   ───────────► G0 Foundation ───────────┤
TRACK C  Claude ─► 05 修订 + CR-001 契约草案 ──────────┤
                                                       ▼
                         Contract Review（04 + 05 + CR-001）
                                                       ▼
                         G1 Company + Auth → G2 KYC → G3 Loan（BLOCKED）→ G4 → G5
```
- **G0 不依赖 UX、不依赖 CR-001，现在即可开工。**
- **G1 Entry** 需要 04 UX Contract 与 Contract Review 通过。
- **G3 `BLOCKED`**：8 项解除条件（§25.2）未全部满足前不得开工；其中 CR-001 契约冻结只是第 1 项。
- CR-002（`assetlinks.json`）**非阻断**：不阻塞 G0/G1 主开发，只阻塞 App Links 最终验收。

### 25.2 Gate 状态（2026-10-07，Architecture Reconciliation）

| Gate | 状态 | 说明 |
|---|---|---|
| **G0** | **FAIL / RECOVERY** | Codex 验收 FAIL（`11`）。恢复范围、任务卡、验收标准见 **`10-G0-implementation-contract.md`**；报告写入 `08-G0-implementation-report.md`（由 Trae 编写） | **JDK 验收口径已按 `19` 更正**：阻断项为 Gradle Build JDK 兼容 + 干净构建；Flutter Tool JDK 为环境项。
| **G1** | **HOLD** | Codex 建议 HOLD（`11`）。放行条件见 `10` §8：G0 Contract implemented + G0 tests pass + APK build pass + **Codex G0 Review PASS（无 P0/P1）**，另需三方 Gate Review，以及 Codex 修订 `04` 的 R-3、R-5、R-12（见 `09`） |
| **G2** | **HOLD** | 依赖 G1 Exit；另需 `04` 的 R-4（401 草稿措辞）、`options.json` 副本版本确认 |
| **G3** | **BLOCKED** | 解除需 **8 项全部满足**（见下）。缺任何一项保持 BLOCKED |

**G3 解除条件**：`CR-001 APPROVED` + `Quote API IMPLEMENTED` + `AF-6 IDEMPOTENCY FIX IMPLEMENTED` + `QUOTE/CREATE ATOMICITY PASS` + `CONTRACT TEST PASS` + `CONCURRENCY TEST PASS` + `UNKNOWN-OUTCOME RETRY TEST PASS` + `ANDROID INTEGRATION TEST PASS`。

### 25.3 G0 报告必须包含（供对账用）
> **已被 `10-G0-implementation-contract.md` §5（17 个章节的 Report Contract）取代，以 `10` 为准。** 下列为早期的 7 项摘要，保留仅供对照。

Trae 完成 G0 后提交报告，至少回答：
1. 实际目录与依赖版本（`pubspec.lock` 摘要），与 §3、§30 的差异；
2. **Cookie**：`cookie_jar` 的 `Storage` 真实签名、`persistSession`、仅删除会话 Cookie 的实现方式；白名单 4 个 Cookie 的测试；公司分区测试；`payease_company` 预置方式；
3. **重试**：根 `ProviderScope` 的 retry 为 OFF 的断言；`Endpoints.retry` 仅三个 GET；429 与 POST 不重试的测试；
4. **Origin**：POST 的 `Origin` 由拦截器统一设置的测试；缺失时模拟服务返回 403；
5. 真实冒烟结果（`GET /api/h5/auth`、`POST /api/h5/auth/logout`），**不得发送验证码或创建任何业务数据**；
6. 架构依赖测试、脱敏测试、`flutter analyze`、`flutter build apk --debug` 结果；
7. 与本文的**任何偏差**及理由。

### G0 — Foundation（可立即开工）
**允许做**
```
Flutter Android 工程（--platforms=android）
App Bootstrap（含 Riverpod retry = OFF）
Environment / AppConfig
Dio（每公司实例）+ 拦截器 + Endpoints 表
cookie_jar + SecureKvCookieStorage + WhitelistCookieJar（公司分区）
SecureKv / KeySchema
go_router 基础设施（仅 /startup、/company/select、/auth/login、/auth/set-password、/home 占位与 Gate；路由名采纳 04）
Localization 基础设施（ARB、字体、语言解析）
SafeLogger / RedactionPolicy
FeatureFlags（构建期）+ RemoteFeatureConfig 接口
App Links 基础设施（Manifest 声明、链接解析器；不接业务路由）
Failure / ErrorMapper / ServerMessageCatalog
Money；Network State（connectivity_plus）
（SecureWindow、LifecycleMask、TempFileSweeper 推迟到 G1，见 10 的 SC-2；core/idempotency 推迟到 G3，见 SC-1）
测试基础（含模拟服务骨架、架构测试）
```
**禁止做（等 04 UX Contract 与评审）**
```
KYC 页面 · Loan 页面 · 完整 Router · Home UI · Design System · 业务 Widget
```
- **Entry**：本文评审通过。
- **Exit**：
  - **真实冒烟（§23.4）**通过（`GET /api/h5/auth` 200 并下发 browser Cookie；`POST /api/h5/auth/logout` 返回 200，证明 Origin 与 Cookie 生效）；
  - **`cookie_jar` spike 结论落档**：`Storage` 签名、`persistSession`、仅删除会话 Cookie 的做法、`dio_cookie_manager` 与预置 `payease_company` 的行为均已核实；
  - 架构依赖测试、Cookie 隔离测试、脱敏测试、Origin 测试、重试策略测试全部绿；
  - `flutter analyze` 零问题；`flutter build apk --debug` 成功。
- **Tests**：拦截器顺序与 Origin、Cookie 白名单与往返、公司隔离、`Endpoints.retry` 仅三个 GET、429/POST 不重试、Riverpod 重试 OFF 断言、脱敏、KeySchema、架构。
- **Blocking**：无。

### G1 — Company + Auth
- **Entry**：G0 Exit；**04 UX Contract + Contract Review 通过**。
- **Tasks**：公司解析/选择/切换；`RouterGate`；冷启动恢复；OTP 登录、密码登录、设密码、找回、登出；`ReturnIntent`；App Link 路由接入；`ServerClock`。
- **Exit**：集成场景（公司、OTP、密码、恢复、登出、401 Return Intent、`loginPageExpired` 有界恢复）通过；跨公司隔离安全测试通过。
- **Blocking**：UX 路由与登录页；CR-002 仅阻塞 App Link 体验验收。

### G2 — KYC
- **Entry**：G1 Exit。
- **Tasks**：`KycOptionRegistry` + 同步工具；`KycValidator`；`KycSavePayloadBuilder`；`KycRepository`；`KycDraftController`；`KycAutoSaveCoordinator`；`KycUploadService`；`SensitiveBytesStore`；冲突解决；`ruleVersion` 只读降级与升级提示；状态监视。
- **Exit**：KYC 保存、revision 409、文件上传、提交场景通过；**“已保存分组杀进程可恢复”测试**通过；磁盘无 PII 测试通过；校验器对照向量通过；`ruleVersion` 不一致时禁止编辑与提交。
- **Blocking**：UX KYC 页面；`options.json` 副本版本确认。

### G3 — Loan Application　**BLOCKED**
- **Entry（8 项全部满足）**：`CR-001 APPROVED` + `Quote API IMPLEMENTED` + `AF-6 IDEMPOTENCY FIX IMPLEMENTED` + `QUOTE/CREATE ATOMICITY PASS` + `CONTRACT TEST PASS` + `CONCURRENCY TEST PASS` + `UNKNOWN-OUTCOME RETRY TEST PASS` + `ANDROID INTEGRATION TEST PASS`（最后一项在 G3 实现期间完成并作为 Exit 条件；其余 7 项为开工前提）。
- **Tasks**：`QuoteRepository`；`LoanRepository`；`OperationRunner` + `PendingOperationStore`；`createLoan(quote)`；条款与签名；`apply`；Legacy `confirmLoanQuote`；`LoanConflictResolver`（含 `quoteExpired`、未知结果判定）。
- **Exit**：借款报价 → 报价确认并创建 → 条款 → 签名 → apply 场景通过；创建前确实看到服务端借款报价；`create` 未知结果重试（含 AF-6 兜底）测试通过；409 诊断测试通过；Android 对真实后端集成测试通过。
- **Blocking**：**CR-001 与 AF-6**；UX 借款报价/报价确认/签名页面。

### G4 — Loan Lifecycle
- **Entry**：G3 Exit。（`LoanStageMapper`、详情、合同、缓存等不依赖报价的部分可在 G2 后并行预做，但不得绕过 G3 的 Entry 合入主流程。）
- **Tasks**：首页 `LoanStageMapper`；借款记录与详情；合同查看；快照缓存 + SWR；离线只读；设置（语言、改密、公司切换、退出）；受开关控制的提现/还款最小实现。
- **Exit**：全部集成场景（含离线、429、503）通过；缓存隔离与 PII 测试通过。
- **Blocking**：UX 首页/详情页面。

### G5 — Release Candidate
- **Entry**：G4 Exit。
- **Tasks**：真机兼容（多品牌/多 Android 版本/小屏/大字体）；高棉文渲染检查；安全清单（`FLAG_SECURE`、备份、网络安全配置、混淆）；依赖漏洞检查；生产冒烟；App Links 验证；性能指标核对。
- **Exit**：§27 DoD 全部满足；`flutter build appbundle --release` 成功；无高危开放缺陷。
- **Blocking**：**CR-002（`assetlinks.json`）上线**；合规确认（Q9）；签名密钥。

## 26. Trae Task Breakdown

> 每个任务卡可独立派发。**Files** 为 `lib/` 下相对路径。除特别标注外，测试与实现同 PR 提交。

### FND-01 工程骨架与依赖规则
- **Responsibility**：创建 Android 工程、依赖、目录、架构测试。
- **Files**：`pubspec.yaml`、`analysis_options.yaml`、`test/architecture/dependency_rules_test.dart`、`main.dart`。
- **Dependencies**：无。**Public Interfaces**：无。
- **Tests**：架构测试。 **DoD**：`flutter analyze` 零问题；架构测试能因违规失败。

### CORE-CONFIG-01 配置与环境
- **Responsibility**：`AppConfig`、`Environment`、`--dart-define-from-file`。
- **Files**：`app/config/*`、`config/*.json`。
- **Public**：`AppConfig{baseUrl, origin, flags, logLevel}`。 **Tests**：配置解析、`origin` 推导、非 https 在 release 拒绝。
- **DoD**：任何配置文件不含密钥。

### CORE-STORAGE-01 安全存储与 Key 方案
- **Responsibility**：`SecureKv`、`KeySchema`、`StorageMigrator`、解密失败 fail closed。
- **Files**：`core/storage/*`。 **Public**：`SecureKv{read,write,delete,deletePrefix}`、`KeySchema`。
- **Storage**：§8.3。 **Errors**：`StorageFailure`。
- **Tests**：key 生成、`deletePrefix`、解密失败清空、版本迁移。 **DoD**：除 `KeySchema` 外无处拼 key。

### CORE-SESSION-01 公司 Cookie 与会话（`cookie_jar`）
- **Responsibility**：`SecureKvCookieStorage`、`WhitelistCookieJar`、`CompanyCookieStore`、`CompanySessionStore`、`SessionManager`、`ServerClock`、`ReturnIntent`。
- **Files**：`core/session/*`。 **Dependencies**：CORE-STORAGE-01；`cookie_jar`。
- **Public**：`jarFor(CompanyId)`、`seedCompany`、`clearSession`（只删会话 Cookie）、`clearCompany`、`SessionEvent` 流。
- **Storage**：`v1/co/{companyId}/cookiejar/*`。 **Errors**：`StorageFailure`（fail closed）。
- **Tests**：白名单与格式校验（含 `payease_company` 值必须等于本公司）、`Max-Age/Expires` 与删除、**跨公司隔离**、重启恢复、`clearSession` 保留其他 Cookie、`ReturnIntent` TTL。
- **DoD**：非白名单 Cookie 不落盘；G0 spike 结论落档；**不出现自研 Cookie 解析**。

### CORE-NET-01 网络层
- **Responsibility**：`ApiClient`、`DioFactory`（每公司实例）、`Endpoints`、7 个拦截器、超时、**重试白名单**、二进制上传/下载。
- **Files**：`core/network/**`。 **Dependencies**：CORE-SESSION-01、CORE-ERR-01、CORE-LOG-01。
- **API**：见 `02-api-contract.md`。 **Errors**：全部映射为 `Failure`。
- **Tests**：Origin 自动设置（缺失时模拟服务返回 403，证明拦截器生效）、Cookie 往返、公司实例绑定（无法构造无公司的客户端）、`Endpoints.retry` **仅三个 GET**、429 与 POST 不重试、二进制大小边界。
- **DoD**：Repository 中无手写路径、无手写 Origin、无 Cookie 操作；跨公司响应 Cookie 不串；Riverpod 重试 OFF 的断言测试存在。

### CORE-APPLINK-01 App Links 基础设施（G0）
- **Responsibility**：Manifest 的 `autoVerify` 声明（仅 `prod` flavor）、`app_links` 接入、`CompanyLinkParser`（严格校验 host、path、`c` 参数）。
- **Files**：`app/router/deep_link_parser.dart`、`android/app/src/prod/AndroidManifest.xml`。
- **Tests**：合法/非法链接边界；非法不发请求。 **DoD**：不接业务路由；`assetlinks.json` 由 CR-002 提供，不阻塞合入。

### CORE-ERR-01 错误体系
- **Responsibility**：`Failure` 体系、`ErrorMapper`、`ServerMessageCatalog`。
- **Files**：`core/error/*`。 **Tests**：§17.3 全表夹具；未命中兜底；400 on state → `OperationRejectedFailure`。
- **DoD**：中文字符串仅在目录文件出现（测试用 grep 断言）。

### CORE-LOG-01 日志与脱敏
- **Files**：`core/logging/*`。 **Tests**：字段名、值模式、拦截器无体/Cookie。 **DoD**：release 无 `debug` 输出。

### CORE-L10N-01 本地化基础
- **Files**：`l10n/*.arb`、`core/localization/*`、字体资源。
- **Responsibility**：三语 ARB、语言解析（设备 ∩ 管理端开关）、状态/枚举映射骨架。
- **Tests**：ARB 键一致、语言解析、`unknown` 兜底。 **DoD**：高棉文真机渲染检查通过。

### CORE-IDEM-01 幂等与待定操作
- **Files**：`core/idempotency/*`。 **Storage**：`pending-ops`。
- **Public**：`OperationRunner.run(key, build)`、`recoverPending()`。
- **Tests**：复用 `requestId`、被拒删除、不确定保留、TTL、资金类不自动重发、互斥、App 重启恢复。
- **DoD**：任何写操作只能通过 `OperationRunner`（架构测试断言）。

### CORE-SEC-01 安全能力（**推迟到 G1**，不在 G0 范围；见 `10` SC-2）
- **Files**：`core/security/*`、Android `MainActivity`、`network_security_config.xml`。
- **Tests**：`TempFileSweeper` 清扫、磁盘 PII 扫描、`FLAG_SECURE` 真机检查。 **DoD**：`allowBackup=false`、明文流量禁止。



### CORE-MONEY-01 / CORE-FLAGS-01
- `Money`/`MoneyFormatter`（仅整数美分）；`FeatureFlags`/`RemoteFeatureConfig` 接口。
- **Tests**：格式化、溢出、开关默认 false。

### COMPANY-01 公司选择与切换
- **Files**：`features/company/**`。 **API**：`GET /api/h5/auth`。
- **Public**：`CompanyLinkParser`、`CompanyController`、`RecentCompaniesRepository`。
- **State**：`activeCompanyProvider`、最近公司。 **Routes**：`/company/*`（待 UX）。
- **Errors**：`companyUnavailable`。 **Tests**：链接解析边界、校验失败不发请求、切换后 family 重建。
- **DoD**：未登录不展示客户数据。

### AUTH-01 认证数据层与仓库
- **Files**：`features/auth/{data,domain}`。 **API**：6 个认证端点。
- **Public**：`AuthRepository`、`PhoneNumber`、`OtpChallenge`。 **Errors**：`AuthFailure.*`、`RateLimitFailure`。
- **Tests**：夹具、Mapper、`loginPageExpired` 有界恢复、无 `register`。 **DoD**：`AuthApi` 无 `register`。

### AUTH-02 认证控制器与会话状态
- **Files**：`features/auth/application/*`。 **State**：`AuthState`、`SessionState`。
- **Tests**：登录/建号/设密/找回/登出状态机；登出本地必清。 **DoD**：登出网络失败仍清本地。

### ROUTER-01 路由与 Gate（G1；采纳 04 路由命名，RC-5 修正后开工）
- **Files**：`app/router/*`。 **Routes**：§9。
- **Tests**：Gate 七级顺序、ReturnIntent、App Link 解析。 **DoD**：Gate 只引导，不替代服务端授权。

### KYC-01 选项与校验
- **Files**：`features/kyc/domain/*`、`assets/kyc/options.json`、`tool/sync_kyc_options.dart`。
- **Tests**：选项拆分、`apiValue` 不被翻译、对照向量、`ruleVersion` 降级。 **DoD**：提交值与服务端枚举一致。

### KYC-02 KYC 数据层与草稿
- **Files**：`features/kyc/{data,application}/*`。 **API**：`GET/POST /api/kyc`。
- **State**：`KycDraft`（内存）。 **Tests**：save/submit 夹具、revision、不落盘。

### KYC-03 冲突解决
- **Files**：`features/kyc/application/kyc_conflict_resolver.dart`。 **Tests**：三方合并全分支、仅重试一次、锁定只读。

### KYC-04 材料上传与预览
- **Files**：`features/kyc/application/kyc_upload_service.dart`、`core/storage/sensitive_bytes_store.dart`。 **API**：`/api/kyc/files`。
- **Tests**：槽位类型、压缩边界、PDF 限制、重试幂等、LRU 清空、无磁盘残留。

### KYC-05 自动保存与载荷构建
- **Files**：`features/kyc/application/kyc_auto_save_coordinator.dart`、`kyc_save_payload_builder.dart`。
- **Responsibility**：按 §12.2 的时机保存；构建**只含合法字段**的 `save` 载荷（D11）；“继续”同步保存并阻断。
- **Tests**：电话未输完不提交且不导致 400；关系/电话重复不提交冲突字段；切后台尽力保存；已保存分组杀进程可恢复；**磁盘无 PII**。
- **DoD**：不存在把完整 KYC 草稿写本地的代码路径。

### LOAN-01 贷款数据层
- **Files**：`features/loan/{data,domain}/*`。 **API**：`/api/h5/state`。
- **Public**：`LoanRepository`、`LoanStage`。 **Tests**：Mapper（忽略 `note`/内部字段）、未知状态、`LoanStageMapper` 13 条件。

### LOAN-02 写操作与冲突诊断（**BLOCKED**，仅 `create` 部分）
- **Files**：`features/loan/application/*`。 **Dependencies**：CORE-IDEM-01、QUOTE-01。
- **Tests**：`apply`/Legacy `confirmLoanQuote` 幂等（可先行）；`createLoan(quote)` 带 `quoteId` + `billConfirmed:true`；**`create` 未知结果判定**（同 `requestId` 重发；409 后按 `billing.quoteId` 兜底，AF-6）；D3 诊断（报价变、状态变、已完成）；`quoteExpired` 重新报价确认。
- **DoD**：不存在不带 Quote 的 `create` 入口；任何位置不出现客户端费用计算；新流程不调用 `confirm_bill`。

### QUOTE-01 借款报价（**BLOCKED**）
- **Responsibility**：`QuoteApi`、`QuoteRepository`、`Quote` 领域模型、报价展示所需状态。
- **Files**：`features/loan/{data,domain,application}/quote_*`。 **API**：`07` 冻结后的契约（`POST /api/loan/quote`，响应含 `expiresAt`、`errorCode`）。
- **Tests**：Mapper（夹具来自冻结契约）、过期/无效/定价变化、无副作用（断言不触发状态变化）。
- **DoD**：契约冻结且联调环境可用；客户端无费用公式。

### LOAN-03 条款与签名
- **Files**：`features/loan/{data,application}/terms_*`、`signature_*`。 **API**：`/api/loan/sign`。
- **Tests**：头完整、PNG 编码、版本取自服务端、409 诊断、不落盘。

### LOAN-04 缓存与离线
- **Files**：`core/storage/snapshot_store.dart`、`features/loan/application/loan_controller.dart`。
- **Tests**：SWR、TTL、revision 去重、跨公司/客户隔离、离线禁写、竞态丢弃。

### CONTRACT-01 合同查看 / SETTINGS-01 设置 / HOME-01 首页
- 合同：`GET /api/kyc/contract`；设置：语言（`languages`）、改密、公司切换、退出、**移除公司 / 清除全部数据**（调用 `CompanySessionStore.clearCompany`，需二次确认；与“退出登录只清当前公司会话”区分，`04` §2）；首页：`LoanStageMapper` 驱动。
- **Tests**：各自夹具与状态；语言被关闭自动切换。

### TEST-INT-01 集成与模拟服务
- **Files**：`integration_test/**`、`test/support/fake_server.dart`。 **Tests**：§23.2 全部场景。
- **DoD**：模拟服务仅实现契约，**不替代生产冒烟**。

## 27. Definition of Done（全局）

1. `flutter analyze` 零问题；全部单元/仓库/状态/架构/安全测试通过；§23.2 集成场景全部通过。
2. `flutter build apk --debug` 与 `flutter build appbundle --release` 成功。
3. 架构规则测试无违规；**无处手写路径、Origin、Cookie、key 字符串**。
4. 安全：磁盘无明文 PII 与证件图；日志无敏感内容；`FLAG_SECURE` 与 `allowBackup=false` 生效；解密失败 fail closed。
5. 业务：提现/还款默认关闭；写操作仅经 `OperationRunner`；无离线写队列；金额全程整数美分，客户端不计算借款报价或还款账单。
6. 本地化：三语键一致；高棉文真机无截断；服务端中文不直接展示（审核员意见与条款原文除外并有标识）。
7. 对照 §30 的检查单逐项通过。
8. 未修改任何现有 Web/H5/后端文件。

## 28. Architecture Risks

| # | 风险 | 影响 | 应对 |
|---|---|---|---|
| R1 | 登录依赖 Telegram Gateway，无短信回退 | 无 Telegram 用户无法注册 | 明确引导；与产品评估后端回退 |
| R2 | 服务端无错误码且 `state` POST 统一 400 | 映射易漏、冲突需诊断 | 目录 + 兜底 + 诊断；联调补全；推动后端加错误码 |
| R3 | 无报价接口，创建即承诺（D4） | 用户在不知费用时被迫创建不可撤销申请，产品与合规风险 | **已决策：CR-001 无副作用报价，G3 BLOCKED**；风险转为 R15 |
| R4 | KYC 选项无在线来源（D5） | 规则变更后旧版 App 只读 | 版本对齐发版节奏；强制更新机制由产品评估 |
| R5 | 生产入口依赖 standalone 代理行为（Origin、Cookie `Secure`、头剥离） | 部署变化导致失效 | G0 冒烟 + 发布前冒烟；契约标注依赖 |
| R6 | 校验器与服务端规则漂移 | 提交被拒 | 对照向量 + 联调；服务端为权威 |
| R7 | 全量拉取 state | 流量/耗电 | 节流 + 缓存；推动后端条件请求 |
| R8 | Riverpod 3 自动重试被遗漏 | 写操作重复风险 | Default retry OFF + 根 `ProviderScope` 断言测试 + 架构测试（ADR-011） |
| R9 | 插件落盘临时文件（选图/文件选择） | PII 残留 | `TempFileSweeper` + 磁盘扫描测试 |
| R10 | Dart 字符串无法清零 | 内存中 PII 存续 | 缩短存活（登出/切换清理）；接受并记录 |
| R11 | `flutter_secure_storage` 在特定机型/备份还原下读取失败 | 异常登出 | fail closed + 友好提示；G5 多机型验证 |
| R12 | 目录非 git 仓库，多方并行 | 冲突与丢失 | 建议立即版本管理 |
| R13 | 审计修复可能改变接口（尤其 F-01 还款） | 契约失效 | 开关隔离；契约文档同步 |
| R14 | 无 staging | 无法安全联调写流程 | 模拟服务 + 生产只做无副作用冒烟；建议建立 staging |
| R15 | **CR-001 报价未冻结或延期** | G3 无法开工，主流程无法交付 | 尽早出契约草案并评审；G0–G2、状态展示、合同查看等不依赖报价的部分并行推进；严禁客户端估算 |
| R16 | `cookie_jar` 的 `Storage` 与 `persistSession` 行为与预期不符 | Cookie 持久化或“只删会话 Cookie”无法实现 | G0 spike 先行核实；回退方案为在装饰器层自行维护白名单快照（仍不自解析 Cookie 语义） |

## 29. Backend / Infra Dependencies

**边界**：原则上复用现有后端；允许解决 Android 主流程阻断问题的**最小后端契约增量**。除 CR-001 外，主流程不依赖其他后端改动。

### CR-001 Pre-Application Loan Quote　**G3 Blocking Dependency**
> **唯一权威契约：`07-CR-001-quote-contract.md`。** 本文不再重复契约细节，避免两份文档漂移。

摘要（以 `07` 为准）：
- 新增无副作用 `POST /api/loan/quote`；不创建 Loan，不占用名额。
- `create` 携带 `quoteId` + `billConfirmed:true`（**Option B**），服务端校验并消费 Quote，Loan 使用 Quote 的快照；新流程不再调用 `confirm_bill`。
- **已冻结**：TTL 15 分钟（OD-1）、持久化 `loan_quotes`（OD-2）、Option B（OD-3）、Strategy A（OD-4）、AF-6 修复纳入（OD-11）；OD-5：100 笔上限改为显式配置，生产默认不启用。
- **AF-6（P0，G3 BLOCKING）**：`create` 必须成为真正的命令幂等，且 Quote 消费 + Loan 创建 + 幂等结果在同一 CAS 边界内。
- 定价校验用 `pricingFingerprint`，不只是 `pricingVersion`；对外统一 `QUOTE_NOT_FOUND`，内部区分客户/公司不匹配。
- 状态：`PROPOSED`，待 `07` §28 签署。**截至 2026-10-07，仓库内四份后端副本均无任何实现。**

### CR-002 `assetlinks.json`　**非阻断**
- 在 `khmerx.org` 的 `/.well-known/assetlinks.json` 提供 Android App Links 验证文件（官网为静态站点，属站点配置变更）。
- **不阻塞 G0/G1 主开发**；**阻塞 App Links 最终验收（G5）**。未验证时 Android 会弹选择器，功能仍可用。

### 其他（建议，不阻塞）
建立 staging 环境与测试公司。

### 未来改进（本期不依赖）
稳定错误码；条件请求（`ETag`/`revision`）；条款译文；邀请码解析；Telegram 深链登录（Bot webhook）；KESS 支付；推送。

## 30. Open Questions

### 已冻结（2026-10-07）
Q-A1（报价先行，CR-001）、Q-A2（KYC 持久化边界）、Q-A3（`ruleVersion` 只读降级 + 强制升级）、Cookie 方案（`cookie_jar`）、重试策略（Default OFF）、后端边界（最小契约增量）。见文首决策记录。

### 仍需决策
| 编号 | 问题 | 建议 |
|---|---|---|
| **CR-001 剩余项** | OD-6 限流数值、OD-7 `errorCode` 范围、OD-8、OD-9、OD-10、OD-12 幂等键复用检测、OD-13 容量上限的显式配置机制（均不阻断实现） | 见 `07` §26.2 |
| Q-A4 | 崩溃上报（Sentry/Firebase 等）会产生数据出境，是否需要？ | 本期不接入，仅本地脱敏日志 |
| Q1–Q10 | 见 `01-requirements.md` §8（深链触达、生物识别、条款译文、`note` 隐藏、性能与最低版本、开关来源、埋点、证书固定、合规、客服入口） | 同需求文档建议 |

### 技术待核实（G0 解决）
- `cookie_jar 4.0.9` 的 `Storage` 方法签名、`PersistCookieJar` 的 `persistSession`、**仅删除会话 Cookie** 的做法；`dio_cookie_manager 3.5.0` 在已预置 `payease_company` 时的 `Cookie` 头行为。
- Flutter 3.47 的 Android 最低支持版本与 `minSdk`。
- G1 及以后才引入的包（`file_picker`、`flutter_image_compress`、`geolocator`、`url_launcher`、`package_info_plus`、`json_serializable` 等）的当前版本（引入时用 `flutter pub add` 取最新并锁定）。`connectivity_plus` 已由 `10` §2.3 验证为 7.3.2。
- `flutter_secure_storage 11.x` 在目标机型上的读写行为与备份排除规则。
- 代理对 `Origin`、`Secure` Cookie 的实际行为（G0 冒烟）。

### 依赖版本（2026-10-07 经 pub.dev 核实）
`dio 5.11.1`、`dio_cookie_manager 3.5.0`、`cookie_jar 4.0.9`、`flutter_riverpod 3.4.3`、`go_router 18.0.2`、`flutter_secure_storage 11.2.0`、`app_links 7.2.2`、`mobile_scanner 7.4.2`（G1 才引入）、`image_picker 1.2.4`（G2 才引入）。

**G0 冻结依赖集以 `10-G0-implementation-contract.md` §2.3 为准**——该集合已在 Flutter 3.47.0 / Dart 3.13.0 的隔离环境中**实际解析通过**（2026-10-07），解析版本含 `intl 0.20.3`、`connectivity_plus 7.3.2`、`equatable 2.1.0`、`flutter_lints 6.0.0`、`mocktail 1.0.5`。**G0 修正的假设**：① `intl` 不再手写 `^0.19.0`，改为 `any`，由 SDK 自带 `flutter_localizations`（`intl ^0.20.3`）决定；② 本地化只用 gen-l10n，不用 `flutter_intl`；③ 测试用 `mocktail`，G0 不使用 `mockito`/`build_runner`/代码生成；④ `mobile_scanner` 不属于 G0。

## Architecture Decision Records

### ADR-001 Flutter as customer native client
- **Context**：需要 Android 原生客户端；运营/机构后台继续 Web。
- **Decision**：Flutter（本期仅 Android）作为客户端；不重写后台。
- **Why**：单代码库为将来 iOS 留路径；团队已有 Flutter 环境（3.47.0）。
- **Consequences**：需自行处理 Cookie、本地化、安全存储；iOS 另需 macOS。
- **Rejected**：WebView 包装 H5（无法满足 `FLAG_SECURE`/PII 不落盘/原生相机体验）；原生 Kotlin（与未来 iOS 不共享）。

### ADR-002 Reuse H5 API with minimal contract increments
- **Context**：Web/H5/Mini App 与现有后端行为不应被破坏；但个别缺口（无报价）阻断主流程。
- **Decision**：原则上直接调用 `/api/h5/*`、`/api/kyc/*`、`/api/loan/*`；**仅允许最小后端契约增量**（CR-001 报价、CR-002 assetlinks）。
- **Why**：契约来自真实代码；绝大部分功能零后端改动即可交付，同时不在客户端复制金融规则。
- **Consequences**：受限于现有接口缺陷（中文错误、全量状态、无选项接口）；G3 依赖 CR-001。
- **Rejected**：新增 `/api/mobile/*` 整套接口（范围过大）；完全禁止后端改动（会迫使客户端估算费用）。

### ADR-003 Cookie session instead of Bearer token
- **Context**：现有认证以 HttpOnly Cookie 会话 + `Origin` 同源校验。
- **Decision**：App 维护 Cookie 会话，POST 自动设置 `Origin`。
- **Why**：无需后端变更；与服务端会话撤销、`credential_version` 机制一致。
- **Consequences**：Cookie 即凭据，须安全存储并按公司隔离；会话绝对 24 小时。
- **Rejected**：Bearer/JWT（需新增后端能力）。

### ADR-003b `cookie_jar` + company-scoped encrypted persistence
- **Context**：认证依赖 Cookie；Cookie 语义（expiry、domain、path、Secure、SameSite、删除、解析）易错，自研会制造不必要的认证基础设施风险。
- **Decision**：使用 `cookie_jar` + `dio_cookie_manager`；自定义 `Storage` 写入 `SecureKv`；每公司独立 jar 与存储前缀；以 `WhitelistCookieJar` 装饰器只允许 4 个 Cookie（`payease_visitor`、`payease_company`、`payease_h5_browser`、`payease_h5_session`）。
- **Why**：成熟组件负责语义；我们只增加分区、加密落盘与白名单。
- **Consequences**：需在 G0 核实 `Storage` 签名、`persistSession`、仅删会话 Cookie 的做法；`payease_company` 由 App 预置进 jar。
- **Rejected**：自研最小 Cookie Jar（评审认为不应自造 Cookie 语义）；明文文件型 `PersistCookieJar`（凭据明文落盘）；Bearer/JWT（需新增后端能力）。

### ADR-004 Company-scoped session
- **Context**：服务端会话绑定 `owner`（公司 ID）；同手机号在不同公司是不同账号。
- **Decision**：所有会话、缓存、待定操作、偏好按 `companyId`（及 `customerId`）隔离；公司作用域由绑定公司的 `ApiClient` 实例与独立 Cookie jar 承载。
- **Why**：避免串号与跨公司数据泄露。
- **Consequences**：切换公司需重建 provider、取消旧请求；实现略复杂。
- **Rejected**：全局“当前公司”隐式状态（存在竞态）。

### ADR-005 Riverpod
- **Context**：需要可测试、可覆盖的状态管理；Riverpod 3.x 默认自动重试失败的 provider。
- **Decision**：`flutter_riverpod 3.4.3`，`Notifier/AsyncNotifier`；**Default retry = OFF**（见 ADR-011）。
- **Why**：依赖注入与测试覆盖友好；与分层匹配。
- **Consequences**：不使用 legacy provider；不依赖 provider 内定时器刷新。
- **Rejected**：Bloc（样板更多）；Provider（功能不及）。

### ADR-006 go_router
- **Context**：需要 Gate、深链、StatefulShell。
- **Decision**：`go_router 18.0.2`。
- **Why**：声明式 + 深链 + `redirect` 适配 Gate。
- **Consequences**：路由表待 UX；Gate 集中。
- **Rejected**：自写 Navigator 2.0；auto_route（代码生成）。

### ADR-007 Dio
- **Context**：需要拦截器、取消、进度、二进制、超时分级。
- **Decision**：`dio 5.11.1`。
- **Why**：拦截器与适配器生态成熟。
- **Consequences**：需限制重试与统一错误映射。
- **Rejected**：`http`（拦截器与取消弱）。

### ADR-008 Server-driven financial rules
- **Context**：借款报价、还款账单、状态、审批、资金结果都在服务端。
- **Decision**：客户端不计算借款报价或还款账单、不推断下一状态；`LoanStage` 仅映射当前状态；**费用只来自服务端借款报价（Loan Quote）**。
- **Why**：避免与服务端不一致与篡改面。
- **Consequences**：需要 CR-001 报价能力；冲突需刷新后诊断。
- **Rejected**：客户端用 `pricing` 估算借款报价。（唯一例外：还款账单的“剩余”为 `total − paid` 的派生显示值，见 §13.6。）

### ADR-009 No offline write queue
- **Context**：金融写操作。
- **Decision**：离线禁用写；只持久化幂等键用于恢复。
- **Why**：避免过期动作在不知情时被执行。
- **Consequences**：离线只能读缓存。
- **Rejected**：离线队列 + 后台同步。

### ADR-010 Build-time feature flags for withdraw/repay
- **Context**：F-01 使客户可单方执行；后端将改为 KESS 通道。
- **Decision**：构建期开关默认关闭，Repository 内再校验；预留仅可收紧的远程配置接口。
- **Why**：无需后端即可安全隔离。
- **Consequences**：调整需发版。
- **Rejected**：远程配置（需后端）；默认开启。

### ADR-011 Default retry OFF, explicit retry policy
- **Context**：Riverpod 3.x 默认自动重试；金融写操作重复提交代价高；重试若同时存在于 Provider 与 HTTP 层会相乘。
- **Decision**：`Default retry = OFF`。**仅** `GET /api/h5/auth`、`GET /api/h5/state`、`GET /api/kyc` 在 HTTP 层有界重试（≤2 次，仅连接错误/超时/503）；Provider 层**不设任何重试例外**；所有写操作只能由 **Command + Idempotency + Explicit Retry Policy**（§19.3）控制。
- **Why**：可预测、可测试、可审计；写操作的重试必须是显式、有幂等保障的业务动作。
- **Consequences**：失败后的恢复由用户操作或明确的恢复流程触发；需要架构测试断言重试配置。
- **Rejected**：全局开启自动重试；给 Provider 设置按需重试；HTTP 层对所有 GET 重试。

### ADR-012 Loan Quote before create（CR-001）
- **Context**：`create` 会产生不可撤销的申请并占用名额，用户在不知道借款报价时就被迫创建；`create` 还不是真正幂等（AF-6）。
- **Decision**：新增**无副作用**借款报价；流程固定为“借款报价 → 报价确认 → 创建（`quoteId` + `billConfirmed=true`，Option B）→ 条款 → 签名 → 申请”；`create` 的幂等缺陷（AF-6，P0）纳入同一 CR；G3 在 8 项条件满足前 BLOCKED。
- **Why**：保证费用在承诺前明确展示，不在客户端复制费用公式；Option B 避免重复确认与“已创建未确认”的中间态；修复 AF-6 才能让“未知结果后重试”可靠。
- **Consequences**：需要后端最小增量；客户端处理报价过期/无效并要求重新报价确认；Legacy 创建的未确认贷款仍需 `confirm_bill` 兼容动作；在后端修复前客户端按 `billing.quoteId` 兜底判断。
- **Rejected**：先 `create` 再展示借款报价；创建前只弹“不可撤销”确认；客户端用 `pricing` 参数估算；Option A（创建后再单独确认）、Option C（报价仅预览后再确认一次）。

### ADR-013 KYC persistence boundary
- **Context**：需求要不丢草稿，安全要求 PII 不落盘。
- **Decision**：服务端是草稿唯一持久化来源；内存保存当前页未保存编辑；磁盘不存完整 KYC PII；分组完成、切换、离开、切后台、Save & Exit 时保存；保存载荷只含通过格式校验的字段。
- **Why**：安全边界清晰；已保存分组可恢复。
- **Consequences**：强杀进程可能丢失当前分组未保存输入（已冻结接受）。
- **Rejected**：本地完整草稿落盘；加密短期本地草稿（增加 PII 驻留面）。

## Architecture Review Checklist

| 项 | 状态 | 位置 |
|---|---|---|
| 没有 `/api/mobile/*` | ✅ | §0、ADR-002 |
| 没有 Bearer Token 假设 | ✅ | ADR-003 |
| 后端改动仅限最小契约增量（CR-001、CR-002） | ✅ | §29 |
| Cookie 按 Company 隔离（实例 + jar + key 前缀） | ✅ | §6.1、§7 |
| 使用 `cookie_jar`，不自研 Cookie 语义 | ✅ | §7、ADR-003b |
| Cookie 仅 4 个白名单，加密持久化 | ✅ | §7.2、§7.3 |
| POST 自动设置 Origin | ✅ | §6.2 |
| Default retry = OFF；仅三个 GET 有界重试 | ✅ | §6.2、§19.3、ADR-011 |
| 写操作不由 Provider 自动重试 | ✅ | §10.1、§19.3 |
| 24h Session Expiry 已处理 | ✅ | §7.3、§7.5 |
| 401 Return Intent 已处理 | ✅ | §9.4 |
| Telegram Gateway OTP 已处理 | ✅ | §11 |
| 无 SMS fallback | ✅ | §11、R1 |
| KYC revision / 409 已处理 | ✅ | §18.1 |
| KYC 保存载荷只含合法字段（D11） | ✅ | §12.2 |
| KYC option API value 未翻译 | ✅ | §12.3 |
| `ruleVersion` 不一致：只读降级 + 强制升级 | ✅ | §12.4 |
| 文件上传不是 multipart | ✅ | §6.5、§12.6 |
| `requestId` 可持久恢复 | ✅ | §19 |
| Money 使用 cents | ✅ | §5.3 |
| 客户端不计算贷款费用；费用仅来自 Quote | ✅ | §13、ADR-008、ADR-012 |
| 创建申请前用户已看到服务端借款报价 | ⛔ **BLOCKED**（G3 八项条件） | §13.3、§25.2、`07` |
| Option B：新流程不调用 `confirm_bill`，Legacy 贷款可接续 | ✅ | §13.2、D16 |
| AF-6（`create` 非真正幂等）已被技术方案正确考虑 | ✅（客户端兜底 + 后端修复列为 G3 条件） | §19.2、§18.2、D13 |
| 术语统一（借款报价 / 报价确认 / 还款账单） | ✅ | §5.4、§13 |
| “剩余应还”派生显示值已标注并预留替换 | ✅ | §13.6、D15 |
| Terms Version 来自 Server | ✅ | §13.4 |
| Signature 不长期落盘 | ✅ | §13.4、§14 |
| Sensitive PII 不落盘（含 KYC 草稿） | ✅ | §12.2、§15、ADR-013 |
| Offline 无写队列 | ✅ | §15、ADR-009 |
| Withdraw / Repay 默认关闭 | ✅ | §21 |
| km/en/zh 架构完整 | ✅ | §16 |
| Server 中文错误集中映射 | ✅ | §17 |
| Trae 可按模块直接施工 | ✅ | §26 |
| G0 边界与禁区明确 | ✅ | §25 |
| 所有 Gate 有测试与退出标准 | ✅ | §25 |
| UX Contract 已对接 | 🟡 **04 v2 已对账**：RC-1 至 RC-7 声明已修；剩余 Review Item 见 `09` | `09-architecture-reconciliation.md`、§9 |

**结论**：技术架构范围内满足检查单，**G0 可立即开工**。待满足：① Codex 按 `06-contract-review.md` 修订 04（优先 RC-5 → RC-2/RC-3 → RC-4/RC-1）；② CR-001 契约冻结（G3）。Contract Review 已完成（结论见 06）。CR-002 仅影响 G5 的 App Links 验收。

