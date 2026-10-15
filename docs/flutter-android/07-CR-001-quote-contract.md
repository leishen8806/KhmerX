# CR-001 · Pre-Application Loan Quote（申请前借款报价）

```
Status:        PROPOSED   （待 §28 Approval Record 签署；决策已冻结，见下）
Version:       v2 · 2026-10-07（Architecture Reconciliation 后）
Owner:         Claude（契约起草）
Consumers:     Backend · Android(Flutter) · QA · Security/Compliance
G3 STATUS:     BLOCKED
G0 / G1 / G2:  NOT BLOCKED BY CR-001
Priority:      AF-6（create 幂等缺陷）= P0 · G3 BLOCKING
```

**G3 解锁条件（8 项全部满足才可解除，缺任何一项 G3 = BLOCKED）**
1. `CR-001 APPROVED`
2. `Quote API IMPLEMENTED`
3. `AF-6 IDEMPOTENCY FIX IMPLEMENTED`
4. `QUOTE/CREATE ATOMICITY PASS`
5. `CONTRACT TEST PASS`
6. `CONCURRENCY TEST PASS`
7. `UNKNOWN-OUTCOME RETRY TEST PASS`
8. `ANDROID INTEGRATION TEST PASS`

**生命周期**：`PROPOSED → REVIEWED → APPROVED → IMPLEMENTED → VERIFIED`。本文当前为 **PROPOSED**，不代替任何人勾选。

**统一术语（2026-10-07 冻结）**

| 阶段 | 名称 | API 兼容名（保留，不为术语改 API） |
|---|---|---|
| Create 前 | **借款报价 / Loan Quote** | 响应 `Quote`；创建后落在 `loan.billing` |
| Create 前确认 | **报价确认 / Quote Confirmation** | `billConfirmed:true`（随 `create`）；旧动作 `confirm_bill` |
| 放款后的债务 | **还款账单 / Repayment Bill** | `paid`、`billing.total`、`dueAt` 等 |

本文**不再混用 Bill / Quote**：Create 前一律称“借款报价”；`billing`、`Bill`、`confirm_bill`、`billConfirmed(At)` 仅作为**既有代码与 API 的兼容名**出现。`billConfirmedAt` 在新流程里的业务含义：**用户确认创建该 Loan 所依据的 Loan Quote 的时间**。

**已冻结决策（2026-10-07，不再作为 Open Question）**

| 编号 | 决策 |
|---|---|
| OD-1 | Quote TTL = **15 分钟** |
| OD-2 | Quote = **持久化 `loan_quotes`** |
| OD-3 | 报价确认 = **Option B**（`create` 携带 `quoteId` + `billConfirmed=true`，不再单独 `confirm_bill`；旧 action 保留给 Legacy 流程） |
| OD-4 | 兼容 = **Strategy A**（服务端向后兼容，Mobile 先行） |
| OD-5 | 原“每工作区 100 笔”**禁止继续硬编码为生产业务规则**，改为**显式配置**；生产默认不使用开发期限制，Sandbox/Test 可配置 |
| OD-11 | **AF-6 修复纳入 CR-001**（P0，G3 BLOCKING） |

**核心原则**
1. **借款报价是报价，不是申请。** 用户必须先看到服务端计算的借款报价，再决定是否创建正式 Loan。
2. Flutter **不计算**金融规则，只展示服务端借款报价。
3. **Create 必须验证并消费 Quote。**
4. **`requestId` 继续承担 Create 的命令幂等。** `quoteId ≠ requestId`。
5. G3 在 CR-001 完成并验证之前保持 BLOCKED。

**证据约定**：标 `FACT` 的内容已对照真实代码核实（附文件与行号，行号为 2026-10-07 的 `E:\KhmerX\KhmerX`）；`RISK` 为风险；`REQUIRED CHANGE` 为必须的后端改动；`OPEN DECISION` 为仍待项目方决策，附推荐。**截至 2026-10-07，仓库内四份后端副本（`KhmerX`、`deploy-stage`、`deploy-stage-4bceda1`、`deploy-stage-f95932b`）均未包含本 CR 的任何实现。**

---

## 1. Summary

新增一个**无副作用**的报价接口 `POST /api/loan/quote`，返回服务端按当前定价计算的借款报价（Loan Quote）快照（Quote）。`create` 改为必须携带 `quoteId` 与报价确认，服务端重新校验并**消费**该 Quote，创建的 Loan 使用 Quote 中**同一份**借款报价快照。

结果流程：

```
KYC approved → 选择 amount + termDays → POST /api/loan/quote → 展示借款报价（Loan Quote）
→ 用户明确确认 → create（quoteId + billConfirmed + requestId）→ terms → signature → apply
```

## 2. Problem Statement

现有流程（`POST /api/h5/state`）：

```
KYC approved → 选择 amount + termDays → action=create
→ 服务端创建 Loan，并在同一步生成 billing / quoteId
→ 客户端第一次看到借款报价（Loan Quote） → confirm_bill → terms → sign → apply
```

`create` **不是纯报价动作**：

| 事实 | 位置 |
|---|---|
| 创建正式 Loan（`loans.unshift`，status `registered`，随后置为 `kyc_approved`） | `lib/domain.ts:44-45`、`lib/store.ts:39` |
| 占用“进行中申请”名额：只要存在非 `closed/rejected` 的 Loan，就不能再次 `create` | `lib/store.ts:20` |
| 借款报价（`billing`、`quoteId`、`fee`）在 `create` 之后才生成 | `lib/store.ts:42` |
| 客户**没有 cancel 动作**：`roles` 表中不存在取消类动作 | `lib/domain.ts:14` |

因此用户在**不知道实际费用、到账金额、应还总额**的情况下，就被迫创建一笔不可撤销、且占用名额的正式申请。**不得**以“客户端自己计算费用”或“创建后再让用户决定是否继续”替代。

## 3. Goals

1. 用户在创建 Loan 之前，看到服务端计算的**借款报价（Loan Quote）**。
2. 创建出的 Loan 的借款报价（`billing`）**与用户确认的 Quote 完全一致**（不得“显示旧价、创建时静默改新价”）。
3. Quote 与 Loan 严格区分，**不预生成 Loan ID**。
4. 引入 Quote 生命周期（TTL、失效、一次性消费）。
5. 为 Quote 与 `create` 的失败引入稳定 `errorCode`。
6. 不破坏现有 Web / H5 / Mini App，不替换现有贷款状态机。

## 4. Non-Goals

不实现 Flutter UI；不做 Codex UX；不重构 Loan Domain；不引入支付系统、不改 KESS、不改放款与还款流程；不改运营后台与持牌机构后台；不替换贷款状态机；不统一改造全站错误 Schema（见 §14）。

## 5. Current Behavior

### 5.1 现有 `create` 的真实行为（FACT）

| # | 行为 | 位置 |
|---|---|---|
| C1 | 入口 `mutate()`；客户路径再经 `customerAction()`，对 `requestId` 加前缀 `customer.id.slice(0,16)+':'+requestId.slice(0,80)` | `lib/store.ts:16`、`lib/domain.ts:84-88` |
| C2 | **进行中申请检查**：`state.loans.some(l=>l.customerId===customer.id && !['closed','rejected'].includes(l.status))` → `KycError 409`「请先完成当前申请，再发起新的申请」 | `lib/store.ts:20` |
| C3 | **KYC 前置**：`findCase(owner, customer.id)`，状态不是 `approved` → `KycError 409`「请先完成 KYC 资料审核…」 | `lib/store.ts:23` |
| C4 | **金额**：必须 ∈ `{3000,5000,10000,50000}`（美分），否则抛一般 `Error`；`name` ≥ 2 字符；`consent===true`；必须有可用业务机器人 | `lib/domain.ts:38-45` |
| C5 | **租户上限**：`s.loans.length>=100` → 抛一般 `Error` | `lib/domain.ts:39` |
| C6 | **期限与借款报价（`billing`）**仅在 `owner.startsWith('t_')`（公司工作区）时生成：`termDays = p.termDays ?? 14`，必须 ∈ `{14,28}`；`calculateBill(amount, {...pricingFor(owner), termDays}, crypto.randomUUID())`；`loan.billing = bill`；`loan.fee = bill.total - bill.principal` | `lib/store.ts:42` |
| C7 | **原子写入**：`UPDATE demo_workspaces SET payload=?, revision=revision+1 WHERE owner=? AND revision=? AND (KYC 记录仍 approved 且 revision 未变)`，失败则重读重试，最多 4 次 | `lib/store.ts:18-54` |
| C8 | **`requestId` 去重**：`input.requests.includes(p.requestId)` 则直接返回原状态；成功后 `s.requests.push(p.requestId)` | `lib/domain.ts:18`、`:76` |
| C9 | **错误出口**：`/api/h5/state` 对非 `KycError` 的异常**统一返回同一句 400**「操作未完成，请确认申请归属、当前状态与填写内容后重试」 | `app/api/h5/state/route.ts:9` |

### 5.2 `confirm_bill` / `apply` / 签约与 `quoteId` 的真实关系（FACT）

| # | 行为 | 位置 |
|---|---|---|
| B1 | `confirm_bill`：状态 ∈ `registered/needs_info/kyc_pending/kyc_approved`；要求 `billConfirmed===true` 且（有 `billing` 时）`p.quoteId === loan.billing.quoteId`；写入 `billConfirmedAt` | `lib/domain.ts:52` |
| B2 | `apply`：状态必须 `kyc_approved`；有 `billing` 时要求 `billConfirmed===true` 且 `quoteId` 匹配；并要求**已有已签合同**（`validLoanContract`） | `lib/domain.ts:58`、`lib/store.ts:35-37` |
| B3 | **签约前置**：`loan.billConfirmedAt` 必须存在，且状态 `kyc_approved` | `lib/loan-signing.ts:16`、`lib/kyc/server.ts:60` |
| B4 | **时序约束**：签名文件的 `created_at` 必须晚于 `billConfirmedAt`（否则“请为当前申请重新手写签名”） | `lib/kyc/server.ts:61` |
| B5 | **合同绑定借款报价**：合同条款内嵌整份 `billing`，`validLoanContract` 校验 `billing.quoteId` 与 Loan 一致；`contractHash` 覆盖该内容 | `lib/kyc/server.ts:62`、`lib/loan-signing.ts:8` |

结论：`quoteId` 今天只存在于 `Loan.billing` 内，在 `create` 时生成，并已是 `confirm_bill` → 签约 → `apply` → 合同的**核心绑定键**。把 Quote 的 `quoteId` 直接作为 `loan.billing.quoteId`，**不改变下游任何绑定逻辑**。

### 5.3 定价与借款报价计算（FACT；代码中称 Bill / billing）

| # | 行为 | 位置 |
|---|---|---|
| P1 | `calculateBill(principal, pricing, quoteId)` 是**确定性**函数：同样的 `principal + pricing + quoteId` 得到同样的借款报价；`quoteId` 由调用方传入 | `lib/pricing.ts:6` |
| P2 | `Bill` = `Pricing` 字段（`feeModel`、`version`、`deductionBps`、`annualInterestBps`、`interestTiming`、`serviceBps`、`serviceTiming`、`termDays`）+ `quoteId`、`principal`、`deduction`、`interest`、`service`、`upfront`、`net`、`total`、`currency:'USD'` | `lib/pricing.ts:3,6` |
| P3 | 公司定价来自 `team_companies.pricing_json`，经 `normalizePricing` 规范化；无配置时用 `defaultPricing`（`version: 0`） | `lib/team/server.ts:16`、`lib/pricing.ts:4,8` |
| P4 | 管理员改价时 `version = current.version + 1` | `lib/team/server.ts:67` |
| P5 | 金额全程整数美分；`Math.round` 取整；放款预扣 `upfront ≥ principal` 会抛错 | `lib/pricing.ts:6` |

### 5.4 Architecture Findings

> 每条标记 FACT / RISK / REQUIRED CHANGE。无法绕开的发现不隐藏。

| 编号 | 类型 | 发现 | 影响与处理 |
|---|---|---|---|
| **AF-1** | FACT | `calculateBill` 确定性且 `quoteId` 为外部传入（P1）。**Quote 可以完整复用现有定价与计算**，不需要新公式 | 采用同一函数生成 Quote，保证 Quote 与最终 Loan 的借款报价同源 |
| **AF-2** | FACT / RISK | 管理员改价会递增 `version`（P4），但 `pricing_json` 还可能被迁移、种子数据、standalone 初始化写入，**不保证递增 `version`**（未逐一核实其他写入点） | `pricingVersion` 不足以证明价格未变。**REQUIRED CHANGE**：Quote 同时保存 `pricing_fingerprint`（规范化定价内容的哈希），Create 时比对指纹与版本（§12） |
| **AF-3** | FACT | 期限校验只在 `owner.startsWith('t_')` 分支且在 `applyAction` 之后（C6）；金额校验在 `applyAction` 内（C4） | Quote 必须自行完整校验 `amount ∈ 集合`、`termDays ∈ {14,28}`，**对所有请求统一**，不依赖 `create` 的分支行为 |
| **AF-4** | FACT | `quoteId` 目前只在 `create` 内由 `crypto.randomUUID()` 生成（C6），不存在持久化的“报价”概念 | **REQUIRED CHANGE**：新增 Quote 的生成与存储；`create` 不再自己生成 `quoteId`（带 `quoteId` 时） |
| **AF-5** | FACT | `confirm_bill` 要求 `quoteId` 匹配（B1）；签约要求 `billConfirmedAt`（B3），且签名必须晚于它（B4） | 决定了 Create 后报价确认的处理方式，见 §10（冻结 Option B） |
| **AF-6** | **FACT / REQUIRED CHANGE · P0 · G3 BLOCKING** | **`create` 目前不是真正幂等的。** 进行中申请检查（`store.ts:20`）发生在 `mutate` 内、**先于** `requestId` 去重（`domain.ts:18`，在 `store.ts:38` 才被调用）。因此“`create` 已成功但响应丢失，客户端用同一 `requestId` 重试”时，会先命中 C2，返回 **409「请先完成当前申请」**，而不是返回已创建的状态 | **REQUIRED CHANGE**：把“`requestId` 已处理 → 直接返回现状”前移到所有资格检查之前（§11）。这也会修正 `05` §19 对 `create` 的幂等假设；在后端修复前，客户端需按 §20 用 `loan.billing.quoteId` 做兜底判断 |
| **AF-7** | FACT / RISK | 整个租户状态在 `demo_workspaces` 的**单行 JSON** 中，以 `revision` 做 CAS（C7）。好处：Loan 创建与 Quote 绑定可以在同一次 CAS 内原子完成；风险：行大小（单行 JSON 随申请与 `requests` 增长，`requests` 永不清理），以及开发期 100 笔上限（C5，OD-5 已决策改为显式配置） | 以 **`loan.billing.quoteId` 作为“已消费”的权威来源**（随 Loan 在同一次 CAS 内写入）。Quote 表只做签发/审计/失效，不做消费裁决（§8、§17） |
| **AF-8** | FACT | `/api/h5/state` 把非 `KycError` 统一折叠成同一句 400（C9） | **REQUIRED CHANGE**：所有带 `errorCode` 的新错误必须以 `KycError` 子类（或同等“透传型”错误）抛出，不得落入折叠分支 |
| **AF-9** | FACT | 现有限流函数 `limit()` 位于 `lib/h5-auth-core.ts` 且**未导出**，数据在 `h5_limits` 表；`/api/h5/state` 与 `/api/loan/sign` 没有限流 | **IMPLEMENTATION NOTE**：Quote 限流需导出或复用该机制（§15），不阻塞契约 |
| **AF-10** | FACT / RISK | `create` 的 `loans.length>=100` 上限对**正式租户**同样生效（C5），触发时返回被折叠的 400 | 否则会出现“Quote 成功、Create 失败”。**已决策（OD-5）**：该上限**不得继续硬编码为生产业务规则**，改为**显式配置**；生产默认不启用，Sandbox/Test 可配置。Quote 资格检查仅在配置了上限时才纳入该检查 |
| **AF-11** | FACT / REQUIRED CHANGE | 迁移由 standalone 脚本按文件名顺序执行，并按 `--> statement-breakpoint` 切分语句；`drizzle/meta/_journal.json` 与迁移文件数量不一致（审计 F-10） | **REQUIRED CHANGE**：新增迁移的**每条语句**都用 `--> statement-breakpoint` 分隔，编号取实现时的下一个可用编号；不依赖 drizzle journal |
| **AF-12** | **FACT / RISK** | **服务端无法识别请求来自 Android 还是 Web**：来源由客户端自报，Origin 与 Cookie 对两者完全相同 | “仅 Mobile 强制 Quote”**无法由服务端强制**，除非引入服务端策略（公司级开关）。见 §19 |
| **AF-13** | FACT | `/api/h5/state` 与新接口的 JSON 请求体都经 `input()`：同源校验、`application/json`、**≤4096 字节** | `create` 新增 `quoteId`、`billConfirmed` 字段后仍远小于上限 |

## 6. Proposed Behavior

1. `POST /api/loan/quote`：校验资格与参数 → 用 `pricingFor` + `calculateBill` 计算 → **持久化 Quote 快照** → 返回借款报价。**不改变任何业务数据。**
2. `create` 携带 `quoteId` 与 `billConfirmed:true`：服务端重新校验 Quote，**使用 Quote 中的借款报价快照**创建 Loan，同时记录报价确认；该 Quote 被消费，且只能绑定一个 Loan。
3. 失败返回稳定 `errorCode`。

## 7. Quote API

### 7.1 端点决策（冻结一个方案）

| | **方案 A：`POST /api/loan/quote`（推荐，冻结）** | 方案 B：`POST /api/h5/state` + `action=quote` |
|---|---|---|
| 语义 | 独立只读式报价；与 `/api/loan/sign` 同族 | 复用状态变更管道 |
| 副作用风险 | **无**。不经过 `mutate`，不读写 `demo_workspaces` 的 CAS | `mutate`/`applyAction` 是写管道：新增 action 需登记 `roles`，一旦疏漏就会产生状态变化、`requests` 追加、事件与通知 |
| 响应体积 | 只返回借款报价 | 现有接口返回**整份状态**（含全部贷款） |
| 错误契约 | 独立处理器，可原生返回 `errorCode` | 受 C9 折叠分支影响，必须额外绕开 |
| 限流 | 独立挂接 | 与写入口共用，难以区分 |
| 兼容 | 对 Web/H5 零影响 | 新增 action 对旧客户端无影响，但污染状态机入口 |

**冻结：方案 A。** 理由：Quote 的核心约束是“无副作用”，不应让它流经唯一的写管道；独立端点还能避开 C9 的错误折叠。

### 7.2 请求

```http
POST /api/loan/quote
Content-Type: application/json
Origin: https://api.khmerx.org
Cookie: <会话 Cookie；公司由 payease_company 决定>
```
```json
{ "amount": 5000, "termDays": 14 }
```

| 字段 | 类型 | 规则 |
|---|---|---|
| `amount` | integer，**美分** | 必须 ∈ `{3000, 5000, 10000, 50000}`（即 $30 / $50 / $100 / $500） |
| `termDays` | integer | 必须 ∈ `{14, 28}` |

- **不传** `companyId`、`customerId`：公司来自 `payease_company` Cookie（与现有接口一致），客户来自会话。
- 认证、同源、JSON、≤4096 字节、注册完成度检查，**与现有客户接口一致**（`customer(request)` + `input(request)`）。
- 未知字段忽略且不回显。

### 7.3 响应 `200`

```json
{
  "quoteId": "b3c1c0a2-…",
  "principal": 5000,
  "deduction": 0,
  "interest": 35,
  "service": 500,
  "upfront": 535,
  "net": 4465,
  "total": 5000,
  "currency": "USD",
  "termDays": 14,
  "interestTiming": "upfront",
  "serviceTiming": "upfront",
  "pricingVersion": 0,
  "createdAt": "2026-10-07T08:00:00.000Z",
  "expiresAt": "2026-10-07T08:15:00.000Z"
}
```
> 示例数值仅为**说明**，按 `defaultPricing`（`version:0`、年化 18%、服务费 10%、均放款时预扣）与 `calculateBill` 手算：`interest = round(5000×1800×14/365/10000) = 35`，`service = 500`，`upfront = 535`，`net = 4465`，`total = 5000`。**不是规范值。**

| 字段 | 说明 |
|---|---|
| `quoteId` | 全局唯一、**不透明**（UUID）；**不等于任何 Loan ID**，响应中**不包含 Loan ID** |
| `principal` `deduction` `interest` `service` `upfront` `net` `total` | **整数美分**，字段含义与现有 `Bill`（领域名 Loan Quote）完全一致（`net` = 到账金额；`total` = 到期应还总额；`upfront` = 放款时预扣合计） |
| `currency` | 固定 `"USD"` |
| `termDays` | 与请求一致 |
| `interestTiming` `serviceTiming` | `"upfront"` / `"repayment"`，决定费用在放款时预扣还是到期收取，客户端据此**选择说明文案**，不据此计算 |
| `pricingVersion` | 对应 `Pricing.version` |
| `createdAt` `expiresAt` | ISO 8601 UTC；到期判断以服务端为准，客户端用 `ServerClock` 做倒计时展示 |

- 响应头与现有一致：`Cache-Control: no-store`。
- **不**返回 `fee`（避免与 `loan.fee = total − principal` 的语义混淆）。
- 不返回费率 bps 之外的内部定价配置；`Bill` 中已有的费率字段**不要求**在 Quote 中返回（客户端不得据其推算）。

### 7.4 复用策略（避免行数膨胀）
同一客户、同一 `amount + termDays`、同一 `pricing_fingerprint`，且已有**未过期、未使用**的 Quote 且剩余有效期 ≥ **5 分钟**（OPEN DECISION OD-9，推荐值）时，**返回已有 Quote**（同一 `quoteId`、原 `expiresAt`）；否则签发新的。此行为是幂等的读式操作，不会产生业务记录。

## 8. Quote Data Model

### 8.1 存储决策
**持久化到 D1 表 `loan_quotes`**，而非单实例内存或仅无状态令牌。理由：

| 维度 | 持久化表（推荐，冻结） | 无状态签名令牌 | 单实例内存 |
|---|---|---|---|
| 可追踪/审计 | ✅ 每份报价可追溯 | ❌ 无记录 | ❌ |
| 多实例 / 重启 | ✅ | ✅ | ❌（standalone 单进程重启即丢失） |
| 主动失效（改价、风控） | ✅ | ❌ 只能等过期 | ❌ |
| 保存借款报价快照 | ✅ 与最终 Loan 同源 | 需把借款报价塞进令牌 | — |
| 实现成本 | 一张表 + 清理 | 需密钥管理与域分离 | 低但不可接受 |

**消费裁决不依赖该表**（AF-7）：权威来源是 `loan.billing.quoteId`（与 Loan 同一次 CAS 写入）；表中的 `used_at/loan_id` 为镜像，可自愈（§17）。

### 8.2 `loan_quotes`（最小模型）

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | TEXT PK | = `quoteId`（UUID） |
| `owner` | TEXT NOT NULL | 公司工作区 ID（`t_…`），与现有表一致 |
| `customer_id` | TEXT NOT NULL | 当前会话的客户 ID（HMAC，不含 PII） |
| `amount` | INTEGER NOT NULL | 美分 |
| `term_days` | INTEGER NOT NULL | 14 / 28 |
| `pricing_version` | INTEGER NOT NULL | |
| `pricing_fingerprint` | TEXT NOT NULL | 规范化定价（不含 `termDays`）的哈希，AF-2 |
| `quote_snapshot_json` | TEXT NOT NULL | **完整借款报价快照（代码类型 `Bill`）**（含 `quoteId`），创建 Loan 时原样使用 |
| `created_at` | TEXT NOT NULL | ISO |
| `expires_at` | TEXT NOT NULL | ISO |
| `used_at` | TEXT NULL | 消费镜像 |
| `loan_id` | TEXT NULL | 消费镜像 |
| `invalidated_at` | TEXT NULL | 主动失效 |
| `invalid_reason` | TEXT NULL | 如 `pricing_changed` |

索引：`(owner, customer_id, created_at)`；`(expires_at)` 供清理。主键即 `id`。
迁移：新增一条迁移，**每条语句以 `--> statement-breakpoint` 分隔**（AF-11）。过期后保留 N 天（建议 30 天，OPEN DECISION OD-1 一并确认）再清理，用于审计。

## 9. Quote Lifecycle

```
Created ──► Valid ──► Used          （被 create 消费：loan.billing.quoteId 写入）
              │
              ├──► Expired          （now ≥ expires_at）
              └──► Invalidated      （定价变更 / 主动失效）
```

| 属性 | 规则 |
|---|---|
| **TTL** | **OPEN DECISION OD-1：推荐 15 分钟，可选范围 10–30 分钟。** 依据：现有系统没有“报价”概念可参考；会话 24 小时、验证码 5 分钟是认证语义，不适用。报价需覆盖“阅读费用 + 决定 + 点击确认”，故不宜低于 10 分钟；又需让价格/KYC 变化尽快被发现，故不宜超过 30 分钟。**即使在 TTL 内，`pricing_fingerprint` 变化也会使 Quote 失效**，所以较长 TTL 不会带来静默改价的风险 |
| 绑定维度 | `owner`（公司）+ `customer_id` + `amount` + `term_days` + `pricing_version` + `pricing_fingerprint` |
| 并存 | 同一客户可同时持有多份有效 Quote（不同金额/期限） |
| 一次性 | 一份 Quote **至多绑定一个最终 Loan** |
| 失效触发 | ① 到期；② `pricing_fingerprint` 与当前不符（Create 时检测，必要时由改价流程批量标记 `invalidated_at`）；③ Create 成功后该客户其余有效 Quote 因“已有进行中申请”不可再被使用（可懒标记） |
| KYC 变化 | **不让 Quote 失效**，而由 Create 重新校验 KYC（§13） |

## 10. Create Integration

### 10.1 新的 `create` 请求

```json
{
  "action": "create",
  "requestId": "kx-6f1e…",
  "name": "SOK DARA",
  "amount": 5000,
  "termDays": 14,
  "consent": true,
  "quoteId": "b3c1c0a2-…",
  "billConfirmed": true
}
```
- `quoteId`、`billConfirmed:true` 为新增字段。`name`、`consent` 等沿用现有校验。
- 其余字段（含 `botId`）按现有行为。

### 10.2 报价确认方案比较，**冻结 Option B**

| | Option A | **Option B（冻结）** | Option C |
|---|---|---|---|
| 流程 | 报价确认 → `create` → **再** `confirm_bill` | 报价确认 → `create`（携带 `quoteId` + `billConfirmed:true`，**同时记录 `billConfirmedAt`**） | 报价仅预览 → `create` 后借款报价（Loan Quote）**再次**确认 |
| 写操作数 | 2 | **1** | 2 |
| 用户重复确认 | 是（服务端没有记录“报价阶段”确认） | **否** | 是（且数字完全相同，无意义） |
| 中间态 | 有：已创建但未确认（失败会留下该状态） | **无** | 有 |
| 对既有逻辑的影响 | 无 | 仅在 `create` 内多写一个时间戳；`confirm_bill`/签约/`apply`/合同**全部不变** | 无 |
| 审计 | 两次事件 | 一次 `create` 事件，备注“按报价确认费用” | 两次事件 |

**为何不破坏合同与审计**：`billConfirmedAt` 只是现有 B1/B3 的前置条件，Option B 只是在 `create` 时提前、原子地写入；签名时序约束 B4（签名晚于 `billConfirmedAt`）自然满足，因为签名发生在 `create` 之后；`billing.quoteId` 连续性（B5）不变。
**服务端语义要求**：`billConfirmedAt` 取 `create` 成功的服务器时间，且**仅当请求带有效 `quoteId` 并且 `billConfirmed===true` 时**写入；缺少 `billConfirmed` → 拒绝（`400`，`QUOTE_CONFIRMATION_REQUIRED`）。`confirm_bill` 仍保留给 Web 旧流程，对已确认的 Loan 重复调用保持现有行为（`billConfirmedAt` 不被覆盖）。
**回退**：若后端评审否决 B，则降级为 Option A，由客户端在 `create` 成功后**立即**以同一 `quoteId` 调用 `confirm_bill`（未确认中间态已在 `04` 首页状态矩阵中存在）。

### 10.3 服务端校验清单与**固定判定顺序**
以下顺序保证客户端得到**确定**的错误码（例如“已被消费”先于“已有进行中申请”）：

| 序 | 检查 | 失败 → errorCode |
|---|---|---|
| 0 | `requestId`（带前缀）已在 `requests` 中 → **直接返回当前状态，成功**（AF-6 的 REQUIRED CHANGE） | — |
| 1 | 会话有效、注册完成、Origin、JSON | `AUTH_REQUIRED` / `REGISTRATION_INCOMPLETE` / `ORIGIN_REJECTED` |
| 2 | `amount`、`termDays` 合法；`name`、`consent` | `QUOTE_INVALID_AMOUNT` / `QUOTE_INVALID_TERM`（其余沿用现有） |
| 3 | `quoteId` 存在，且 `owner` 与 `customer_id` 均匹配 | 对外统一 `QUOTE_NOT_FOUND`（内部区分 `QUOTE_COMPANY_MISMATCH` / `QUOTE_CUSTOMER_MISMATCH`，见 §14） |
| 4 | 未被消费（表 `used_at` 为空 **且** 工作区内没有 `loan.billing.quoteId === quoteId`） | `QUOTE_ALREADY_USED` |
| 5 | 未失效、未过期 | `QUOTE_EXPIRED` |
| 6 | 请求的 `amount`、`termDays` 与 Quote 一致 | `QUOTE_PARAMETER_MISMATCH` |
| 7 | `pricing_fingerprint` 与当前一致（并比对 `pricing_version`） | `QUOTE_PRICING_CHANGED` |
| 8 | **KYC 仍为 `approved`**（沿用 `store.ts:23` 与 CAS 内的 KYC 守卫） | `KYC_NOT_APPROVED` |
| 9 | **无进行中申请**（沿用 `store.ts:20`） | `ACTIVE_APPLICATION_EXISTS` |
| 10 | 租户容量：**仅当显式配置了上限时**检查（生产默认不启用，OD-5） | `LOAN_CAPACITY_REACHED` |
| 11 | 通过后：用 Quote 的 `quote_snapshot_json` 建 Loan，`billConfirmedAt = now`，`fee = total − principal`，CAS 写入 | — |

**不得**：因为客户端传了 `quoteId` 就信任它；**不得**在 Create 时用当前定价重新计算（只用快照）。

## 11. Idempotency（Command Idempotency · AF-6 · P0 · G3 BLOCKING）

| 概念 | 含义 | 规则 |
|---|---|---|
| `quoteId` | 服务端**定价快照**（借款报价） | 可被读取/校验多次；**至多成功消费一次** |
| `requestId` | **`create` 命令的幂等键** | 同一逻辑 `create` 的重试必须复用同一个 `requestId`；**`quoteId` 不能替代 `requestId`** |

### 11.1 目标行为（必须实现）

```
create request
 ↓
lookup (customer, requestId)         ← 必须是 mutate 内的第一步，先于一切资格检查
 ├─ already completed
 │    → 返回【原始成功结果】：HTTP 200 + 完整 state，不重新校验、不重新消费 Quote、不新增 Loan
 └─ not processed
      ↓ validate（会话、参数）
      ↓ validate / consume quote（§10.3）
      ↓ 资格（KYC、进行中申请、可选容量）
      ↓ create loan
      ↓ save idempotency result
```

**原子性要求**：`Quote consumption` + `Loan creation` + `Idempotency result` 必须处于**同一个 CAS 边界**（§17）。
- **Idempotency result 的定义**：同一次状态写入中，① `requestId`（带客户前缀）追加到 `requests`；② 新 Loan 记录 `createRequestId`（内部字段，**不得出现在客户投影里**）。因此“按 (客户, `requestId`) 查找”可以定位到该次 `create` 创建的 Loan。
- **重放返回什么**：HTTP 200 与**当前**完整 state（响应形态与首次成功一致）；创建的 Loan 由 `createRequestId`/`billing.quoteId` 确定。Loan 此后若已推进状态，返回的是其当前状态（保证“无二次副作用且结果为成功”，而不是冻结的历史响应体）。
- **“已处理”的判定必须在 `store.ts:20`、`:22`、`:23` 之前**（即进行中申请、归属、KYC 检查之前）：先校验 `requestId` 格式（8–100 字符），再按与 `customerAction` 相同的方式计算带前缀的键 `customer.id.slice(0,16) + ':' + requestId.slice(0,80)` 并查 `state.requests`。
- **重放时不得重新校验**：即使此后定价已变、Quote 已过期、KYC 已被重审，**同一 `requestId` 的重放仍返回原成功结果**（命令已经完成，不是新命令）。

### 11.2 规则
1. **Quote 请求**：可重复；不产生业务记录；复用策略见 §7.4。
2. **同一 `requestId` 重复 Create** → 返回原成功结果（11.1）。
3. **同一 `quoteId` + 不同 `requestId`**：第二次 Create 必须被拒绝，判定顺序第 4 步返回 `QUOTE_ALREADY_USED`。
4. Create 重试如何识别“已消费 Quote + 同 `requestId`”：第 0 步按 `requestId` 直接返回成功；若 `requestId` 不同，则第 4 步按 `loan.billing.quoteId` 与表镜像识别为已消费。
5. **客户端兜底**（后端修复前适用；修复后无害）：`create` 结果不确定（超时/断连）时，**先用同一 `requestId` 重发**；若得到 `ACTIVE_APPLICATION_EXISTS`（修复前的旧行为）或 `QUOTE_ALREADY_USED`，则 `GET state`，**若存在 `loan.billing.quoteId === 该 quoteId` 的 Loan，则判定为已成功（AlreadyDone）**，否则才是真正冲突。此判断是确定性的，因为 Loan 内借款报价（`billing`）携带同一个 `quoteId`。
6. **（推荐，OD-12，非阻断）幂等键复用检测**：Loan 同时保存 `createFingerprint`（`quoteId + amount + termDays + name` 的哈希）。同一 `requestId` 但载荷不同 → `409 IDEMPOTENCY_KEY_REUSED`，避免客户端缺陷把不同请求误判为重放。

### 11.3 范围说明
- 现状核查：**只有 `create` 受 AF-6 影响。** `confirm_bill`、`apply`、`withdraw`、`repay` 的前置检查不会先于去重拦截一次成功的重试（`apply` 在 KYC 之后又被改动的极端情况除外）。因此本 CR 只要求修复 `create` 路径，不重构其余动作。
- 后果：本修复同时改善现有 Web / Mini App 的 `create` 重试行为（更幂等），测试 B-01、I-01 覆盖回归。

## 12. Pricing Versioning

冻结原则：**Quote 保存 pricing 快照；Create 时若定价已变化 → 拒绝并要求重新 Quote。** 不得“Quote 显示旧费用，Create 偷偷改成新费用”。

- 比对对象：`pricing_fingerprint`（AF-2）为准，`pricing_version` 为辅。指纹 = 规范化后 `{version, deductionBps, annualInterestBps, interestTiming, serviceBps, serviceTiming}` 的哈希（`termDays` 单列，不入指纹）。
- 变化时返回 `QUOTE_PRICING_CHANGED`（`409`）。客户端行为：重新获取 Quote，展示新数字，**要求用户重新确认**。
- 已创建的 Loan 的借款报价（`billing`）永远是创建时的快照，后续改价不影响（现有行为）。

## 13. Eligibility / KYC

**Quote 阶段**（资格预检，避免给出用户无法执行的报价）：
1. 公司上下文必须是公司工作区（`t_…`）；
2. KYC 状态必须为 `approved`，否则 `409 KYC_NOT_APPROVED`；
3. 不得存在进行中申请（非 `closed/rejected` 的 Loan），否则 `409 ACTIVE_APPLICATION_EXISTS`；
4. 租户容量：仅当显式配置了上限时检查（生产默认不启用，OD-5）；
5. `amount`、`termDays` 合法。

**Create 阶段**：上述 2、3 **重新检查**。KYC 重审后状态变化时，旧 Quote **不得绕过** KYC：沿用 CAS 内的 KYC 守卫（`store.ts:52`，要求 KYC 记录仍为 `approved` 且 `revision` 未变）。

> Quote 的资格检查是**体验性预检**，Create 的检查才是**权威**。两者之间状态可能变化，所以 Create 必须全部重做。

## 14. Error Contract

### 14.1 范围与兼容
**本 CR 仅为 Quote API 与“携带 `quoteId` 的 `create`”引入 `errorCode`**；不统一改造全站 Error Schema。
- 响应形态（**增量**，旧字段不变）：
  ```json
  { "error": "<人读文案，沿用现有中文风格>", "errorCode": "QUOTE_EXPIRED", "retryAfter": 30 }
  ```
  `retryAfter` 仅在限流时出现。
- 旧 API 与旧客户端：**行为不变**；多出的 `errorCode` 字段会被忽略。
- 实现要求（AF-8）：新错误必须走“透传型”错误类型，**不得**被 `/api/h5/state` 的折叠分支吞掉。
- **未知 `errorCode` 的客户端处理**：按 HTTP 状态码回退到通用文案。
- 建议后续单独立项（如 CR-003）把 `errorCode` 推广到全站。

### 14.2 错误码表

| `errorCode` | HTTP | 触发 | 说明 |
|---|---|---|---|
| `AUTH_REQUIRED` | 401 | 无有效会话 | 与现有 401 一致 |
| `REGISTRATION_INCOMPLETE` | 403 | 未完成手机验证/设密码 | 与现有 403 一致 |
| `ORIGIN_REJECTED` | 403 | 同源校验失败 | 与现有 403 一致 |
| `QUOTE_INVALID_AMOUNT` | 400 | `amount` 不在允许集合 / 非整数 | |
| `QUOTE_INVALID_TERM` | 400 | `termDays` 不在 `{14,28}` | |
| `QUOTE_CONFIRMATION_REQUIRED` | 400 | `create` 带 `quoteId` 但缺 `billConfirmed:true` | Option B |
| `KYC_NOT_APPROVED` | 409 | KYC 非 `approved` | Quote 与 Create 均可能返回 |
| `ACTIVE_APPLICATION_EXISTS` | 409 | 已有进行中申请 | |
| `LOAN_CAPACITY_REACHED` | 409 | 显式配置的租户容量上限 | **仅在配置了上限时可能返回；生产默认不出现**（OD-5） |
| `QUOTE_NOT_FOUND` | 404 | `quoteId` 不存在，**或不属于当前公司/客户** | **对外统一**，避免泄露他人报价是否存在 |
| `QUOTE_EXPIRED` | 409 | 已过期或已被标记失效 | |
| `QUOTE_PARAMETER_MISMATCH` | 409 | 请求的 `amount`/`termDays` 与 Quote 不一致 | 篡改或客户端错误 |
| `QUOTE_PRICING_CHANGED` | 409 | 定价指纹/版本已变化 | 需重新 Quote |
| `QUOTE_ALREADY_USED` | 409 | Quote 已绑定 Loan | |
| `RATE_LIMITED` | 429 | 触发限流，带 `retryAfter` 与 `Retry-After` 头 | |
| `SERVICE_UNAVAILABLE` | 503 | 服务暂不可用 | |
| `QUOTE_CUSTOMER_MISMATCH` | — | 报价属于其他客户 | **仅内部/审计码**：对外返回 `QUOTE_NOT_FOUND`；写安全日志 |
| `QUOTE_COMPANY_MISMATCH` | — | 报价属于其他公司 | **仅内部/审计码**：同上 |

> **有意偏离之处**：任务要求定义 `QUOTE_CUSTOMER_MISMATCH` / `QUOTE_COMPANY_MISMATCH`。本文定义了它们，但**不对外返回**，以免攻击者通过差异枚举他人的 `quoteId`。如评审认为需要对外区分，请在 §26 提出。

状态码风格与现有一致：校验失败 `400`、不存在 `404`、状态/版本冲突 `409`、限流 `429`、不可用 `503`。

## 15. Security

- **认证**：`customer(request)`（Cookie 会话、公司隔离、注册完成度）；**不引入** Bearer Token 或 `/api/mobile/*`。
- **同源**：POST 必须 `Origin: https://api.khmerx.org`（经 `input()`），**仅 HTTPS**。
- **所有权**：`quoteId` 必须同时属于当前 `owner` 与 `customer_id`；不一致一律对外 `QUOTE_NOT_FOUND`。
- **不信任客户端**：金额、费用、期限只来自 Quote 快照；Create 不接受客户端提交的任何借款报价数字。
- **防枚举**：`quoteId` 为随机 UUID；不泄露存在性。
- **限流（IMPLEMENTATION NOTE，不阻塞契约）**：现有 `limit()` 未导出（AF-9）。建议沿用 `h5_limits` 表的机制，键如 `quote|{owner}|{customerId}`。
  - 目标：防滥用与 DoS，同时**不让正常切换金额/期限的用户频繁 429**。用户最多有 4 种金额 × 2 种期限 = 8 个组合；客户端会按组合缓存 Quote 并按 §7.4 复用。
  - **OPEN DECISION OD-6（推荐，无历史数据可据）**：每客户 30 次 / 10 分钟；每公司 600 次 / 10 分钟（软上限，只告警）；不做按 IP 限流（入口代理会改写来源）。超限返回 `429 RATE_LIMITED`。
- **请求体**：≤4096 字节、JSON、未知字段忽略。

## 16. Audit / Logging

- **Quote 签发即审计**：`loan_quotes` 的行本身就是可追踪记录（含 `quote_snapshot_json` 快照）。
- **请求日志可记录**：`quoteId`、客户引用（`customer_id` 的 HMAC，不是手机号）、`owner`、`amount`、`termDays`、`pricing_version`、`created_at`、`expires_at`、结果码、请求 trace id。
- **不得记录**：密码、OTP、Cookie、Token、完整 KYC 资料、手机号明文。
- **不产生资金审计事件**：Quote 不写入 `entries`、不写 `events`、不发通知。**只有正式 `create` 才进入 Loan 事件与审计。**
- **安全日志**：`QUOTE_CUSTOMER_MISMATCH` / `QUOTE_COMPANY_MISMATCH`、大量 `QUOTE_NOT_FOUND`、限流命中，写安全事件。
- `create` 事件备注建议：“按报价确认费用（quoteId 前 8 位）”，不含金额以外的 PII。

## 17. Transaction Boundary

现有原子性来自对 `demo_workspaces` 单行的 CAS（C7）。`create` 带 Quote 时，**Quote 消费 + Loan 创建 + 幂等结果**在同一次 CAS 内：

```
mutate(owner, p, customer)   // 沿用现有 ≤4 次重试
 loop:
  读取 state（revision = r）
  ① (customer, requestId) 已处理？→ 直接返回原成功结果               ← AF-6：必须是第一步
  ② 资格：KYC approved、无进行中申请、（可选）容量
  ③ Quote 校验（§10.3 第 3–7 步）
  ④ 构造 next：loan.billing = Quote.quote_snapshot_json（快照，不重算）
               loan.billConfirmedAt = now；loan.fee = total − principal
               loan.createRequestId = 带前缀的 requestId；requests 追加同一键   ← 幂等结果
  ⑤ CAS：UPDATE demo_workspaces … WHERE owner=? AND revision=r
          AND KYC 记录仍 approved 且 revision 未变                       ← 现有守卫
  ⑥ 成功 → 镜像：UPDATE loan_quotes SET used_at=?, loan_id=? WHERE id=? AND used_at IS NULL
     失败（CAS 丢失）→ 重读（若此时已被他人消费 → QUOTE_ALREADY_USED / ACTIVE_APPLICATION_EXISTS；
                              若 requestId 此时已出现 → 返回原成功结果）
```

- **原子裁决边界 = 步骤⑤**：Loan、`billing.quoteId`、`createRequestId` 与 `requests` 记录在同一次 CAS 里一起落库；因此**不会**出现“Quote 已标记使用但 Loan 创建失败”，也**不会**出现“Loan 已创建但幂等结果/Quote 绑定缺失”。
- **步骤⑥是镜像**，失败不影响业务；它可被幂等重放，并由“对账修复”补齐（若表中 `used_at` 为空但存在 `loan.billing.quoteId === id` 的 Loan，则补写）。**消费判断始终同时查两处**（§10.3 第 4 步），所以镜像延迟不会造成重复消费。
- **不要**用“先标记 Quote 已用、再创建 Loan”的顺序。
- **风险（RISK）**：D1 的 `batch` 只在语句**抛错**时回滚，0 行更新不算失败，所以不宜把“表更新 + 工作区更新”做成依赖彼此成功的批处理。保持“单行 CAS 为权威”最稳妥。若未来 Loan 拆为关系表（审计 F-14 方向），应在 `loans.quote_id` 与 `loans.create_request_id` 上加**唯一约束**，把消费与幂等裁决落到数据库约束。
- 验收：测试 A-01 至 A-05（§22）。

## 18. Concurrency

| 场景 | 期望 | 机制 |
|---|---|---|
| 双击 Create（同 `requestId`） | **只创建一次**；第二次返回相同结果 | 第 0 步 `requestId` 去重 + CAS |
| 两个设备同时 Create（同客户） | **只产生一个进行中 Loan** | 同一行 CAS：先到者成功，后到者重读后命中 `ACTIVE_APPLICATION_EXISTS` 或 `QUOTE_ALREADY_USED` |
| 同一 Quote 被两个 Create 同时消费（不同 `requestId`） | **最终只绑定一个 Loan** | CAS + `loan.billing.quoteId` 唯一性（重读后判定已消费） |
| Quote 与改价并发 | 不出现“显示旧价、创建新价” | Create 必比对 `pricing_fingerprint`，不一致即 `QUOTE_PRICING_CHANGED` |
| Quote 与 KYC 重审并发 | 旧 Quote 不绕过 KYC | CAS 内 KYC 守卫 |

## 19. Backward Compatibility

**必须回答**：现有 Web / Telegram Mini App / H5 是否继续允许**不带 `quoteId` 的 `create`**？

| | **Strategy A：向后兼容（推荐，冻结 Phase 1）** | Strategy B：所有客户端强制 Quote |
|---|---|---|
| 服务端行为 | `quoteId` **可选**：携带则**完整校验并消费**；不携带则走**现有旧路径**，行为完全不变 | `quoteId` 必填，旧调用被拒绝 |
| 是否需要改 Web/H5/Mini App | **否**（符合“本期原则上不改 Web/H5”） | **是**：必须同步升级，否则现有客户创建申请会全部失败 |
| 金融规则一致性 | 存在两条路径：Quote 路径与旧路径。**但旧路径是既有行为，并未因本 CR 变差** | 单一路径，最一致 |
| 风险 | Android 的“先报价”由客户端流程与契约测试保证，**服务端无法识别请求来自 Android**（AF-12），不能强制 | 发布协调风险高，回滚困难 |

**冻结（Phase 1）：Strategy A。** 即“Mobile rollout first，服务端向后兼容”。
**防止规则分叉不可控**：
1. 两条路径**共用同一个 `calculateBill`** 与同一份 `pricingFor`，不复制公式；
2. Quote 路径创建的 Loan 与旧路径创建的 Loan 在 `billing` 结构上**完全一致**，下游（确认、签约、`apply`、合同）无需区分；
3. **Phase 2（另立 CR，不在本 CR 范围）**：增加**公司级服务端策略** `quote_required`（默认关闭）。待 Web/Mini App 升级后，按公司逐步打开，打开后该公司**所有客户端**必须带 `quoteId`。这是唯一能由服务端强制“先报价”的方式。

**OPEN DECISION OD-4**：确认采用 Strategy A（Phase 1）。

## 20. Client Call Sequence

```
GET /api/h5/state                         → 读 kyc.status、是否有进行中 Loan
  └ kyc 必须 approved 且无进行中申请（否则不进入申请流程）
选择 amount + termDays
POST /api/loan/quote                      → 展示服务端 Quote（本金、各项费用、到账、应还、期限、剩余有效期）
用户明确确认
POST /api/h5/state  action=create
        {requestId, name, amount, termDays, consent:true, quoteId, billConfirmed:true}
  └ 响应：完整 state；新 Loan.billing.quoteId == quote.quoteId，billConfirmedAt 已设置
GET  /api/loan/sign?loan=<id>             → 条款与 termsVersion（取自服务端）
POST /api/loan/sign                       → 手写签名（PNG/JPEG 原始字节；晚于 billConfirmedAt）
POST /api/h5/state  action=apply
        {requestId, loanId, billConfirmed:true, quoteId: loan.billing.quoteId}
```
说明：
- **Option B 下不再调用 `confirm_bill`**（回退到 Option A 时，在 `create` 成功后立即用同一 `quoteId` 调用）。
- `name` 取自 KYC 资料（姓 + 名，大写），与现有 H5 一致（`mini-client.tsx` 申请页做法）。
- `create` 的 `requestId` 在用户点击确认时生成并**持久化到成功为止**（`05` §19）。
- 报价过期倒计时用 `ServerClock`；过期后需重新获取并**重新确认**。
- 客户端按 `(amount, termDays)` 缓存 Quote（内存），切换组合时优先使用未过期的缓存，减少请求。

## 21. Flutter Contract

> 仅为**契约级**类型描述，不是实现代码。Flutter **不得**重新计算、修改或推测 Quote。

**`LoanQuoteRequest`**
```
amount:   int   // 美分，∈ {3000,5000,10000,50000}
termDays: int   // ∈ {14,28}
```
**`LoanQuoteResponse`**（全部来自服务器；金额为 `Money`（整数美分））
```
quoteId, principal, deduction, interest, service, upfront, net, total,
currency('USD'), termDays, interestTiming, serviceTiming,
pricingVersion, createdAt, expiresAt
```
**`LoanQuoteFailure`**
```
kind: invalidAmount | invalidTerm | kycNotApproved | activeApplicationExists | capacityReached
      | notFound | expired | parameterMismatch | pricingChanged | alreadyUsed | confirmationRequired
      | rateLimited(retryAfter) | authRequired | registrationIncomplete | unavailable | unknown
errorCode: String?     // 服务端稳定码；未知码按 HTTP 状态回退
```
**`CreateLoanRequest`**
```
action: 'create'
requestId, name, amount, termDays, consent: true, quoteId, billConfirmed: true
```

客户端规则：
1. 报价页必须展示：**Principal、Fees（利息与服务费分项）、Net Amount（到账）、Total Due（应还总额）、Term**，数字全部来自服务器；按 `interestTiming`/`serviceTiming` 选择“放款时扣除 / 到期支付”的说明。
2. `quoteId` 过期/定价变化/参数不一致 → **重新获取 Quote 并要求重新确认**，不静默替换数字。
3. 任何位置**不得**出现费用公式或费率换算。
4. `ACTIVE_APPLICATION_EXISTS` 在 `create` 之后出现时，先按 §11.5 判断是否其实已成功。

## 22. Contract Tests

> 以下用例是 `CONTRACT TEST PASS` 的最小集合；每条应能对**真实后端**自动运行。

**Quote**
| ID | 用例 | 期望 |
|---|---|---|
| Q-01 | 合法 `amount` + 合法 `termDays` | `200`，借款报价字段齐全；与同参数、同定价的 `calculateBill` 结果逐字段一致 |
| Q-02 | `amount` 非法（如 4000、浮点、负数、字符串） | `400 QUOTE_INVALID_AMOUNT` |
| Q-03 | `termDays` 非法（如 7、30） | `400 QUOTE_INVALID_TERM` |
| Q-04 | KYC 非 `approved` | `409 KYC_NOT_APPROVED` |
| Q-05 | 已有进行中 Loan | `409 ACTIVE_APPLICATION_EXISTS` |
| Q-06 | 响应不含任何 Loan ID；`quoteId` 与任何 `loan.id` 不同 | 通过 |
| Q-07 | 同参数在剩余有效期 ≥ 阈值时重复请求 | 返回同一 `quoteId`（OD-9） |

**无副作用**
| ID | 用例 | 期望 |
|---|---|---|
| S-01 | Quote 前后对比 `demo_workspaces`（`payload`、`revision`） | **完全不变** |
| S-02 | Quote 前后对比 Loan 数量与状态、`entries`（台账）、`events`、`notifications`、钱包、KYC 记录与 `revision` | **完全不变** |
| S-03 | 连续大量 Quote（限内） | 不产生任何 Loan，不占用名额；之后仍可 `create` |

**安全**
| ID | 用例 | 期望 |
|---|---|---|
| X-01 | 客户 A 的 `quoteId` 被客户 B 用于 `create` | `404 QUOTE_NOT_FOUND`（对外）；安全日志记录 `QUOTE_CUSTOMER_MISMATCH` |
| X-02 | 公司 A 的 `quoteId` 用于公司 B | `404 QUOTE_NOT_FOUND`；日志 `QUOTE_COMPANY_MISMATCH` |
| X-03 | 无会话 | `401 AUTH_REQUIRED` |
| X-04 | 错误或缺失 `Origin` | `403 ORIGIN_REJECTED` |
| X-05 | 响应对“不存在的 quoteId”与“他人的 quoteId”**不可区分** | 通过 |
| X-06 | 超过限流阈值 | `429 RATE_LIMITED` 且带 `retryAfter` |

**过期与定价**
| ID | 用例 | 期望 |
|---|---|---|
| E-01 | 过期 Quote 用于 `create` | `409 QUOTE_EXPIRED`，不产生 Loan |
| P-01 | Quote 后管理员改价（`version+1`）再 `create` | `409 QUOTE_PRICING_CHANGED`，不产生 Loan |
| P-02 | 在**不递增 `version`** 的情况下修改 `pricing_json` 内容 | 仍被指纹检出 `QUOTE_PRICING_CHANGED`（AF-2） |
| P-03 | 已创建的 Loan 在后续改价后 | `billing` 不变 |

**篡改**
| ID | 用例 | 期望 |
|---|---|---|
| T-01 | Quote `amount=5000`，`create` 用 `amount=10000` | `409 QUOTE_PARAMETER_MISMATCH` |
| T-02 | Quote `termDays=14`，`create` 用 `termDays=28` | `409 QUOTE_PARAMETER_MISMATCH` |
| T-03 | `create` 带 `quoteId` 但缺 `billConfirmed:true` | `400 QUOTE_CONFIRMATION_REQUIRED` |
| T-04 | `create` 请求里夹带客户端自算的费用字段 | 被忽略，Loan 使用 Quote 快照 |

**幂等与消费**
| ID | 用例 | 期望 |
|---|---|---|
| I-01 | 同一 `requestId` 重复 `create`（含“首个成功后重试”） | **返回成功，且 Loan 数量不变**（验证 AF-6 已修复） |
| I-02 | 同一 `quoteId` + 不同 `requestId` 第二次 `create` | `409 QUOTE_ALREADY_USED` |
| I-03 | `create` 成功后，创建的 `loan.billing` 与 Quote 的 `quote_snapshot_json` 逐字段一致，`billing.quoteId == quoteId`，`billConfirmedAt` 已设置 | 通过 |
| I-04 | Option B：后续 `GET /api/loan/sign` → `POST /api/loan/sign` → `apply` 无需 `confirm_bill` 即可完成 | 通过 |

**并发**
| ID | 用例 | 期望 |
|---|---|---|
| C-01 | 同一 `requestId` 并发 N 次 `create` | 只创建 1 笔 Loan |
| C-02 | 同客户两设备并发 `create`（不同 `requestId`，不同 Quote） | 只产生 1 笔进行中 Loan |
| C-03 | 同一 Quote 被两个不同 `requestId` 并发消费 | 最终只绑定 1 笔 Loan |
| C-04 | `create` 与 KYC 重审并发 | 旧 Quote 不绕过 KYC |

**兼容**
| ID | 用例 | 期望 |
|---|---|---|
| B-01 | 旧 `create`（不带 `quoteId`，Strategy A） | 行为与现状完全一致 |
| B-02 | 旧路径创建的 Loan 与 Quote 路径创建的 Loan，在 `confirm_bill`/签约/`apply`/合同上的行为一致 | 通过 |

**原子性（`QUOTE/CREATE ATOMICITY PASS`）**
| ID | 用例 | 期望 |
|---|---|---|
| A-01 | `create` 的 CAS 因 revision 冲突而丢失（并发写入） | **无 Loan、无 `requests` 新记录、Quote 仍未被消费**；重试后只成功一次 |
| A-02 | 故障注入：CAS 成功之后、镜像写之前进程中断 | Loan 存在；用同一 Quote + 不同 `requestId` 再 `create` → `QUOTE_ALREADY_USED`（以 `loan.billing.quoteId` 为权威）；对账修复后表中 `used_at/loan_id` 补齐 |
| A-03 | 故障注入：CAS 之前任一步骤抛错 | **无 Loan、无 `requests` 记录、Quote 仍可使用** |
| A-04 | 全量一致性扫描 | 不存在“`requests` 有记录但无对应 Loan”或“有 Loan 但无 `requests`/`createRequestId`” |
| A-05 | 成功的 `create` 之后读取 | 同一次 `revision` 增量内，`loan.billing.quoteId`、`billConfirmedAt`、`createRequestId`、`requests` 均已存在 |

**未知结果重试（`UNKNOWN-OUTCOME RETRY TEST PASS`）**
| ID | 用例 | 期望 |
|---|---|---|
| U-01 | 首次 `create` 已成功，**响应被丢弃**；用**同一 `requestId`** 重试 | **200，返回原成功结果，Loan 数量不变**（验证 AF-6 修复） |
| U-02 | U-01 的重试发生在**报价过期之后** | 仍返回原成功结果（重放不重新校验） |
| U-03 | U-01 的重试发生在**管理员改价之后** | 仍返回原成功结果 |
| U-04 | 首次 `create` 已成功，响应丢失；用**不同 `requestId`** 重试 | `409 QUOTE_ALREADY_USED`；客户端按 `billing.quoteId` 判定已成功 |
| U-05 | **（回归保护，针对修复前的旧行为）** 同一 `requestId` 重试得到 `409 ACTIVE_APPLICATION_EXISTS` | 客户端 `GET state` 后找到 `billing.quoteId === 该 quoteId` 的 Loan → 判定已成功，不报错 |
| U-06 | 首次请求**未到达服务端**（连接失败）；用同一 `requestId` 重试 | 正常创建，仅一笔 Loan |
| U-07 | `confirm_bill`/`apply`/`withdraw`/`repay` 的同类重试 | 仍保持幂等（回归） |
| U-08 | 同一 `requestId` 但载荷不同（OD-12 启用时） | `409 IDEMPOTENCY_KEY_REUSED` |

## 23. Migration Plan

| 阶段 | 内容 |
|---|---|
| M1 | **契约评审与签署**：确认 §26 中**仍开放**的决策（OD-6 至 OD-10、OD-12、OD-13）并签署 §28；其余已冻结 |
| M2 | **后端实现（按此顺序）**：① **AF-6 修复**（`create` 的 `requestId` 查找前移 + `createRequestId`，P0，可独立先行上线，因其对 Legacy 向后兼容）；② 新增迁移（`loan_quotes`，每条语句 `--> statement-breakpoint`）与 `POST /api/loan/quote`；③ `create` 的 Quote 校验与消费；④ `errorCode`；⑤ 限流；⑥ 容量上限改为显式配置 |
| M3 | **契约测试**（§22）在测试库全部通过；上线时新迁移随部署执行 |
| M4 | **Android 集成测试**对真实后端（测试公司）通过，解除 G3 |
| M5（另立 CR） | Phase 2：公司级 `quote_required` 策略，随 Web/Mini App 升级逐公司开启 |

部署次序：**先后端（向后兼容，旧客户端不受影响），再 Android。** 因 Strategy A，Web/H5/Mini App 在整个过程中无需改动。

## 24. Rollback Plan

- **后端回滚**：恢复部署即可。`loan_quotes` 是**新增表**，回滚后可保留不用；已创建的 Loan 的借款报价（`billing`）是快照副本，**不依赖该表**，因此不受影响。
- **功能降级**：保持 Strategy A，`create` 不带 `quoteId` 的旧路径始终可用，Web/H5 不受影响。
- **Android 侧**：G3 在 CR-001 验证前不上线；若线上发现 Quote 问题，可由构建参数禁用申请入口（不会降级为“先创建后看借款报价”）。
- **迁移回滚**：无破坏性变更（仅新增表）；不需要数据回滚。
- **`requestId` 去重前移**属于行为修正（AF-6），回滚后恢复旧行为；客户端兜底（§11.5）对两种行为都安全。

## 25. Risks

| # | 风险 | 应对 |
|---|---|---|
| R1 | `pricing_json` 被不递增 `version` 的路径修改（AF-2） | 指纹比对 + 测试 P-02 |
| R2 | 服务端无法区分 Android 与 Web（AF-12），Phase 1 无法强制“先报价” | Strategy A 接受；Phase 2 公司级策略；契约测试与 Android 集成测试保障客户端行为 |
| R3 | 两条 `create` 路径的长期分叉 | 共用 `calculateBill`/`pricingFor`；Loan 结构一致；Phase 2 收敛 |
| R4 | 单行 JSON + CAS 的规模（AF-7）；开发期 100 笔上限改为显式配置后，生产不再有人为上限，状态行会持续增长 | 监控状态行大小；长期拆表（审计 F-14）并加唯一约束；OD-5 |
| R5 | 镜像写失败导致表与工作区短暂不一致 | 消费判断同时查两处；对账修复 |
| R6 | Quote 滥用（刷报价） | 限流 + TTL + 复用策略 + 清理 |
| R7 | `errorCode` 仅覆盖 Quote 与 `create+quote`，其他接口仍靠中文文案 | 另立 CR-003 全站推广；客户端对未知码回退 |
| R8 | 迁移执行方式（AF-11）导致新表建表失败/部分执行 | 每条语句带 breakpoint；在 standalone 流程中演练 |
| R9 | AF-6 修复影响现有 Web 的 `create` 重试表现 | 属于“更幂等”的正向变化；测试 B-01、I-01 覆盖 |

## 26. Decisions

### 26.1 已冻结（2026-10-07，不再讨论）
| 编号 | 决策 | 内容 |
|---|---|---|
| OD-1 | Quote TTL | **15 分钟**。过期记录保留期建议 30 天（审计用，非阻断） |
| OD-2 | 存储 | **持久化 `loan_quotes`**；消费权威仍是 `loan.billing.quoteId`（§8、§17） |
| OD-3 | 报价确认 | **Option B**：`create` 携带 `quoteId` + `billConfirmed=true`，服务端同时写入 `billConfirmedAt`；Android **不再单独调用 `confirm_bill`**；旧 action 保留供 Legacy 流程 |
| OD-4 | 兼容 | **Strategy A**：`quoteId` 可选（携带则完整校验并消费；不携带走旧路径）；Mobile 先行；Phase 2 公司级 `quote_required` 另立 CR |
| OD-5 | 租户申请上限 | “每工作区 100 笔”**不得继续硬编码为生产业务规则**；改为**显式配置**；**生产默认不使用开发期限制**；Sandbox/Test 可配置。仅在配置了上限时 Quote 预检与 `create` 才检查并返回 `LOAN_CAPACITY_REACHED` |
| OD-11 | AF-6 | **纳入本 CR**，P0，G3 BLOCKING |

### 26.2 仍开放（均不阻断“后端实现开工”，在评审中确认即可）
| 编号 | 决策 | 推荐 |
|---|---|---|
| OD-6 | 限流数值 | 每客户 30/10 分钟；每公司 600/10 分钟（软）；实现后可调 |
| OD-7 | `errorCode` 范围 | 仅 Quote 与 `create+quote`；全站另立 CR-003 |
| OD-8 | `QUOTE_CUSTOMER/COMPANY_MISMATCH` 是否对外区分 | **不对外区分**（对外统一 `QUOTE_NOT_FOUND`，§14） |
| OD-9 | Quote 复用阈值 | 剩余有效期 ≥ 5 分钟则复用 |
| OD-10 | Phase 2 公司级 `quote_required` 的立项时间 | 随 Web/Mini App 升级计划 |
| OD-12 | 幂等键复用检测（`IDEMPOTENCY_KEY_REUSED`） | 纳入（§11.2 第 6 点），非阻断 |
| OD-13 | OD-5 的显式配置机制（部署级环境变量 / 公司级设置） | 先做部署级配置，未设置 = 不限；是否细化到公司级由后端决定 |

## 27. Gate Criteria

```
G3 STATUS: BLOCKED
```
**解除 G3 需要以下 8 项全部满足，缺任何一项 G3 = BLOCKED：**

| # | 条件 | 证据 |
|---|---|---|
| 1 | `CR-001 APPROVED` | §28 由人员签署 |
| 2 | `Quote API IMPLEMENTED` | `POST /api/loan/quote` 与 `loan_quotes` 迁移已部署到测试环境 |
| 3 | `AF-6 IDEMPOTENCY FIX IMPLEMENTED` | `create` 的 `requestId` 查找前移并记录 `createRequestId` |
| 4 | `QUOTE/CREATE ATOMICITY PASS` | §22 A-01 至 A-05 |
| 5 | `CONTRACT TEST PASS` | §22 Q / S / X / E / P / T / I / B 全部 |
| 6 | `CONCURRENCY TEST PASS` | §22 C-01 至 C-04 |
| 7 | `UNKNOWN-OUTCOME RETRY TEST PASS` | §22 U-01 至 U-08 |
| 8 | `ANDROID INTEGRATION TEST PASS` | Android 对真实后端完成：报价 → 报价确认并创建 → 条款 → 签名 → apply，含过期、改价、409、未知结果重试 |

**不受 CR-001 阻塞**：G0、G1、G2；以及 G3 之外不依赖报价的部分（状态展示、合同查看、缓存等）。

**当前评估**
> **READY FOR BACKEND CONTRACT REVIEW。**
> 所有会阻断实现的决策（OD-1、OD-2、OD-3、OD-4、OD-5、OD-11）**已冻结**；仍开放的 OD-6 至 OD-10、OD-12、OD-13 均不阻断实现。
> **后端实现开工的唯一剩余前置条件是 §28 Approval Record 的签署（`APPROVED`）。** 在此之前状态保持 `PROPOSED`，**不得开始后端实现，G3 保持 BLOCKED。**
> 建议实现顺序：**AF-6 修复（P0，可先独立上线）→ Quote API → Create 集成 → `errorCode` → 限流 → 容量配置**。

## 28. Approval Record

```
Product:
Architecture:
Backend:
Android:
QA:
Security/Compliance:

Decision:
[ ] APPROVED
[ ] REJECTED
[ ] NEEDS REVISION
```

> 以上由相关人员填写。本文起草人不代为勾选。

---

### 附录 A　与其他文档的衔接（截至 2026-10-07 对账结果，详见 `09-architecture-reconciliation.md`）

- `01`、`02`、`05`：已按本文 v2 同步（术语、Option B、AF-6、OD-5、G3 八项条件）。
- `04`（Codex，v2）：整体与本文一致，但有待 Codex 修订的 Review Item（见 `09`）：`/loan/quote/confirm` 的 API 仍写 `confirm_bill`（Option B 下不应调用）；报价页仍写“不依赖稳定 errorCode”且 `expiresAt` 标为可选（本文已冻结为必有、TTL 15 分钟、`errorCode` 在 Quote 与 `create+quote` 上提供）；页首与 §15、§16 仍写“07 当前工作区缺失”。
- `06`：RC-1 至 RC-7 已由 `04` v2 声明修复；Gate 状态以 `09` 为准。

### 附录 B　本文引用的代码位置汇总

`lib/store.ts:16-56`（`mutate`，含 20、23、35-37、38、39、42、52）；`lib/domain.ts:14,18,38-45,52,58,66,76,84-92`；`lib/pricing.ts:3-8`；`lib/team/server.ts:16,67`；`lib/loan-signing.ts:8,16`；`lib/kyc/server.ts:60-62`；`app/api/h5/state/route.ts:9`；`lib/h5-auth.ts:14-15`（`sameOrigin`/`input`）；`components/mini-client.tsx`（Web 现有 `create` 调用，含 `termDays`、`consent`、`botId`，**无** `quoteId`）。

