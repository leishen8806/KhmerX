# CR-004 · Repayment & Payment Reconciliation（还款与支付对账）

```
Status:     PROPOSED — READY FOR CODEX FINAL RE-REVIEW（v3，据 64 窄幅修复 P1-R1/P1-R2 + P2；未自批；不授权实施）
Version:    v3 · 2026-10-09（v2 备份：57-CR-004-repayment-payment-reconciliation.md.pre65.bak；v1 备份：…pre63.bak）
Owner:      Claude（契约起草）
Phases:     P6-A（线下转账 + 人工确认）→ P6-B（KHQR/Bakong 应用内支付 + 自动对账）
Decisions:  DEC-2 = C · ARC-1（一个权威还款账本）· DEC-1 = A（单一运营机构）— 见 55
Depends:    CR-007 §3（共享财务权威：position、财务串行化、结清、政策绑定）· CR-012（错误/重试）· CR-005（资金确认→ACTIVE）
Blocks:     P6-A / P6-B。本 CR 实施并验收前，客户 repay 保持被阻断
Evidence:   HEAD d916b45，2026-10-09
```

**核心原则**
1. P6-A 与 P6-B 是**两个录入渠道，不是两套会计**；二者**只**通过同一个过账服务 `postRepayment()` 写入**同一个权威还款账本**。不存在第二条人工会计路径。
2. 客户端对任何还款金额/余额**零权威**；不得自报 `paymentVerified` 或等价信任字段。
3. 整数美分；服务端权威；幂等 + 财务版本并用；无离线变更队列；安全日志；可审计迁移；稳定错误码（CR-012）。

---

## 1. Problem（现状事实）
| # | FACT | 证据 |
|---|---|---|
| F1 | 客户 `repay`/`withdraw` 路由层 403 `CUSTOMER_SETTLEMENT_FORBIDDEN`；领域层第二道防线 | `app/api/h5/state/route.ts`；`lib/domain.ts` |
| F2 | 领域 `repay`：`active`；`cents` 安全整数、`>0`、`<= amount+fee−paid`（**不允许超额**）；`paid += cents`；`paid===amount+fee` → `closed`；写 `entries`/`events`/`notifications` | `lib/domain.ts` |
| F3 | `admin_repay`：仅 Admin；非测试模式需 `emergencyId`；`reference` `/^[A-Z0-9_-]{6,80}$/`；**`paymentVerified` 为请求体自报布尔值**；经 `applyAction('repay')` 入账 | `lib/team/admin-funds.ts` |
| F4 | `team_repayment_receipts`：`PRIMARY KEY(tenant_id, reference)`——**主键不含贷款**，因此现状同一银行流水号无法入账两次；`loan_id, cents, actor, created_at` 另存 | `drizzle/0013_service_routing.sql` |
| F5 | 幂等：领域 `requestId`（8–100 字符）按载荷摘要绑定；`admin_*` 用 `userId:requestId` + 摘要，冲突 409 `IDEMPOTENCY_PAYLOAD_MISMATCH` | `lib/domain.ts`；`admin-funds.ts` |
| F6 | **应急授权（已更正）**：现状为**一次性消费**（原子置 `consumed`）、**批准需 MFA 步进**、**仅申请人可使用**、范围须含 `funding`；**但 `loanId/action/cents` 仅在消费时被记录（`consumed_*`），并未对照预先绑定的授权目标做校验**——它**不是**"绑定到具体贷款/动作/金额"的授权。`admin` 角色仍不在 `highRiskRoles` 中。分类：**PARTIALLY CLOSED — REQUIRES HARDENING** | `lib/team/emergency.ts`；`lib/team/server.ts` |
| F7 | 机构回调：HMAC-SHA256 over `[institutionId, timestamp, nonce, rawBody].join('\n')`；±300 秒；nonce TTL 600 秒；`(institution_id, idempotency_key)` 与 `(institution_id, event_id)` 去重；按机构密钥（`INSTITUTION_CALLBACK_SECRETS_JSON`）；事件含 `repayment.confirmed`、`payment.failed` | `app/api/institution/callback/route.ts` |
| F8 | **回调事件无消费者**，永远停在 `received` | `lib/institution-event-plans.ts`；检索 |
| F9 | **回调入库缺陷（CONFIRMED OPEN）**：批内 `INSERT OR IGNORE` nonce 后，事件行**无条件**插入，重放 nonce 配新幂等键仍产生事件 | `callback/route.ts` |
| F10 | 没有真实支付通道；其它写入还款的服务端路径：无 | 检索 |
| F11 | **存储事实**：权威状态同在一个 D1 数据库；`batch()` 为 SQL 事务（须测试证明）；`demo_workspaces` 是每主体一行的共享 JSON 文档（行级 CAS） | 见 CR-007 F6/F7 |

## 2. Domain Model
> **权威 = `repayment_ledger`（D1 SQL 表，append-only）**；`demo_workspaces.payload` 中的 `paid/status/entries` 是**兼容投影**，非财务正确性的一部分。

| 实体 | 职责 | 关键字段 |
|---|---|---|
| **Repayment** | 客户可见的一笔还款意图 | `id, loanId, customerId, tenantId, channel, amountCents, currency, status, idempotencyKey, createdAt, expiresAt?` |
| **RepaymentAttempt** | 该意图下的一次具体尝试（人工声明/通道支付）；至多一个产生过账 | `id, repaymentId, kind, status, providerReference?, bankReference?, proofFileId?` |
| **PaymentIntent** | 自动渠道通道侧对象，1:1 Attempt | `id, attemptId, provider, providerReference, amountCents, currency, qrPayload?, deeplink?, expiresAt, status` |
| **ProviderCallback** | 经验签的事件（复用 `institution_callback_events` 并补消费者与状态机） | `status: received→processing→applied|rejected|dead_letter` |
| **ReconciliationRecord** | 外部事实 ↔ Attempt ↔ 账本 | `outcome ∈ {MATCHED, AMOUNT_MISMATCH, LOAN_MISMATCH, DUPLICATE, ORPHAN, OVERPAYMENT, EXCEPTION}, blocksSettlement` |
| **RepaymentLedgerEntry** | **权威过账**，不可变 | `id, tenantId, loanId, direction(CREDIT|REVERSAL), amountCents, currency, allocations[{component, cents}], channel, attemptId, sourceType, sourceRef, idempotencyKey, financialVersionAfter, postedBy, postedAt, receiptNo, reversesEntryId?` |
| **ExternalSourceBinding**（新，P1-R1） | 外部货币事实（银行流水号/通道参考/机构事件资金参考）**至多一次**绑定到一个金融对象 | `tenantId, channel, sourceRefNormalized, loanId, amountCents, currency, customerId, ledgerEntryId, firstBoundAt`；**`PRIMARY KEY(tenant_id, channel, source_ref_normalized)`——不含 `loanId`** |
| **RepaymentReceipt** | 由**已确认账本事实**派生的视图（不存独立金额） | `receiptNo, loanId, amountCents, currency, channel, postedAt, referenceMasked, remainingAfterCents` |
- 账本触发器 `RAISE(ABORT)` 禁止更新/删除；纠错只能 `REVERSAL` 过账（含原因、双人审批、MFA）。**对已结清贷款的冲正 = 受控重开**，规则与原子顺序见 **CR-007 §3.5.1**（唯一权威）；`VOIDED` 贷款拒绝冲正。
- `team_repayment_receipts` 并入账本：旧表保留只读（审计）；**迁移时将其全部行回填到 `ExternalSourceBinding`（`channel=MANUAL_TRANSFER`）**，以延续"同一银行流水号不可二次入账"的现状保护，新唯一性**不得弱于** F4。

## 3. Channels
`channel ∈ { MANUAL_TRANSFER, KHQR, BAKONG }`，由**通道配置**驱动（启用/展示名/人工指引），适配接口 `PaymentProvider { createIntent, verifyCallback, normalize, queryStatus }`；`MANUAL_TRANSFER` 无 `createIntent/verifyCallback`。新增通道 = 新适配器 + 配置，不改账本与贷款领域。

## 4. 唯一过账服务与财务事务（修复 DR-1）
### 4.1 `postRepayment()` —— 唯一写路径
```
postRepayment({ tenantId, loanId, amountCents, channel, attemptId, sourceType, sourceRef, idempotencyKey, actor })
```
**P6-A（人工确认）与 P6-B（回调）都只调用它。** 它在 CR-007 §3.4 的**财务事务**内：读 `financial_version` → 用 `calculateFinancialPosition` 校验 → 按**绑定政策的 `allocationOrder`** 分摊 → D1 批（CAS + 账本行 + 审计 + 通知 outbox，条件链）→ 必要时在同批设 `phase=SETTLED`（结清唯一权威，CR-007 §3.5）。CR-004 **不单独**修改 `loan.status`。
### 4.2 投影策略（据真实存储选择；不声称不存在的原子性）
- 财务提交与工作区 JSON **不在同一事务**（见 CR-007 §3.2：共享单行文档的行级 CAS 会串行化全主体贷款、并使财务提交因无关编辑失败）。
- 账本提交（含 `financial_version`）是权威；`paid/status/entries` 由**投影器**在提交后更新，带 `projectedFinancialVersion`；失败重试；`rebuildProjection(loanId)` 可从账本重建。
- **读时叠加**：任何读取路径对已放款贷款用 SQL 权威覆盖 `paid/status/remaining*`。不一致时**账本为准**，绝不"先读到谁算谁"。
### 4.3 禁止的遗留写路径
生产模式下 `applyAction('repay')`、`admin_repay` 的直接记账分支、以及任何直接写 `paid`/`closed`/`entries` 的代码**失败关闭**；`admin_repay` 在生产仅作为 `postRepayment()` 的受控入口（见 §9）。**契约测试 + 静态扫描**证明生产财务变更只有这一条写路径。
### 4.4 分摊
过账调用绑定政策的 `allocationOrder`（CR-007 §6.4）；多分量应付而顺序缺失/无效 ⇒ **失败关闭**：`ALLOCATION_POLICY_MISSING`（CR-012）；单分量应付无需政策。**不猜测顺序。**
### 4.5 `remaining` 的来源
取代 `amount + fee − paid` 作为未来权威：**唯一来源**为 `calculateFinancialPosition`（CR-007 §3.3）；CR-004 的 `amountDueNowCents`、`remainingCents`、可分摊分量均来自该函数。

## 5. P6-A — 线下转账 + 人工确认
```
客户查看应还 + 转账指引（含系统生成的唯一付款参考码）→ 线下转账 → （可选）提交参考号/凭证
→ 员工审核 → 确认/驳回 → postRepayment() → 更新 → 凭证
```
1. 创建 Repayment(`MANUAL_TRANSFER`)：服务端绑定 `loanId、customerId、amountCents（≤ amountDueNow）、currency`，生成 `paymentReference`。
2. claim：`bankReference?`、`proofFileId?`（凭证走现有上传管线：魔数→扫描 fail-closed→AES-GCM）。**凭证是否强制**=OD-4.2（默认：可选；无凭证则员工在银行流水中核对）。
3. 员工确认：录入**实际到账金额**与**银行流水号**；校验与 Repayment 绑定一致（§7）；**不得直接改写任何余额**，只能触发 `postRepayment()`。
4. 驳回 → `failed`（客户安全 `failureCode`）；过期 → `expired`。

## 6. P6-B — KHQR/Bakong 自动
```
创建支付意图 → 通道支付 → 回调 → 验真 → 对账 → postRepayment() → 凭证
```
金额/币种/贷款/客户服务端绑定；客户端轮询状态，**不以客户端动作推断成功**；通道状态与会计状态分离（§8）。实现受 OD-4.4（通道与规范）阻塞；通用适配契约可先行。

## 7. 幂等 + 财务版本 + 金额绑定
### 7.1 外部货币事实的身份与幂等（P1-R1，冻结）

> **一个外部来源引用（银行流水号 / 通道参考 / 机构资金事件参考）标识的是"一次外部资金事件"，而不是"某笔贷款的一次过账"。** 因此外部来源的唯一性**不得包含 `loanId`**。

**规范身份**
```
externalSourceKey = tenantId + channel + sourceRefNormalized
  MANUAL_TRANSFER : tenantId + MANUAL_TRANSFER + normalizedBankReference
  KHQR            : tenantId + KHQR            + providerReference
  BAKONG          : tenantId + BAKONG          + providerReference
机构回调事件去重（事件层，另一维度）：institutionId + eventId ；institutionId + idempotencyKey
```
**账本幂等键（外部来源过账）**：`external:{tenantId}:{channel}:{sourceRefNormalized}`（`UNIQUE`）。**不是** `tenantId:loanId:channel:sourceRef`。系统内部生成的更正/冲正使用其自己的显式 `requestId` 幂等键（`man:{requestId}`）。

**绑定（binding）**：首次**经校验**的使用，将 `externalSourceKey` 绑定到 `{loanId, amountCents, currency, customerId}`，并写入 `ExternalSourceBinding`（与账本过账**同一财务批**）。之后：
| 再次使用同一 `externalSourceKey` | 结果 |
|---|---|
| 同一绑定（同贷款/金额/币种/客户） | **幂等**：返回既有过账，不二次入账 |
| 不同 `loanId` / 不同金额 / 不同币种 / 不同客户 | **不过账**；记 `ReconciliationRecord(outcome=EXTERNAL_REFERENCE_CONFLICT)` 异常；同步接口返回稳定 **409 `EXTERNAL_REFERENCE_CONFLICT`**（CR-012）；回调则 409 并进异常队列 |
- **绑定时机**：`MANUAL_TRANSFER` 的绑定发生在**员工确认时**（银行流水号经校验），**不**发生在客户 claim 时——客户提交的 `bankReference` 属于未经校验的声明，可重复出现于多个 claim，但**至多一个**能在确认时完成绑定（防止客户抢占他人参考号造成拒绝服务）。通道支付的绑定发生在回调验真且与 PaymentIntent 一致时。
- **并发**：两个对同一 `externalSourceKey` 的并发请求（即使分属**不同贷款**、各自持有不同的 `financial_version`）——跨贷款的序列化由 `ExternalSourceBinding` 的 `UNIQUE` 承担：**恰好一个**批提交；另一个 `UNIQUE` 冲突 ⇒ 整批回滚 ⇒ 重读：同一绑定则返回既有结果，否则 `EXTERNAL_REFERENCE_CONFLICT`。**一笔外部转账因此永远不可能为两笔贷款付款。**
- 不弱于现状：F4 的 `PRIMARY KEY(tenant_id, reference)` 保护由本规则取代并扩展到所有渠道；上线迁移必须回填（见 §2）。

### 7.1.1 其它键与冲突语义（"同键异载荷"适用于每一层）
| 键 | 作用域 | 同键同载荷 | 同键异载荷 |
|---|---|---|---|
| 客户幂等键 `requestId`（UUID） | `tenantId + customerId + 操作类型` | 返回既有对象 | 409 `IDEMPOTENCY_PAYLOAD_MISMATCH` |
| `providerReference`（PaymentIntent） | `UNIQUE(tenantId, provider, providerReference)` | 同一 intent | 409 |
| 回调 `eventId` / `idempotencyKey` | `(institution_id, event_id)` / `(institution_id, idempotency_key)` | 200 `duplicate:true` | 409 `EVENT_PAYLOAD_MISMATCH` / `IDEMPOTENCY_PAYLOAD_MISMATCH` |
| 外部来源账本键 | `external:{tenantId}:{channel}:{sourceRefNormalized}` | 返回既有过账 | 409 `EXTERNAL_REFERENCE_CONFLICT` |

### 7.2 幂等 ≠ 并发控制（两者都需要）
幂等键防止"同一意图重复入账"；**`financial_version`（CR-007 §3.4）防止两个不同的合法操作同时改写同一贷款财务状态**。批内幂等键 `UNIQUE` 冲突 ⇒ 整批回滚 ⇒ 重读并返回既有结果。
### 7.3 金额绑定
创建 Attempt 时固化 `loanId · 还款对象 · amountCents · currency · customerId · provider/channel`；回调/确认任一不一致 → **不过账**，记 `ReconciliationRecord(…MISMATCH)` 与异常队列（`blocksSettlement` 视类型）。
- **超额**：`amountCents > remaining` ⇒ **不入账**、不静默吞并 ⇒ `OVERPAYMENT` 异常（OD-4.1 为外部政策，安全默认保持）。
- 部分还款允许（`0 < amount ≤ remaining`）。
- 外部来源再次出现且**绑定不一致**（贷款/金额/币种/客户）→ `EXTERNAL_REFERENCE_CONFLICT`（§7.1），不过账。
- **客户端不得自报** `paymentVerified`；`admin_repay` 请求体中的该字段在生产**废止**（由账本来源事实取代）。

## 8. 状态机
**支付状态（Repayment/Attempt）**：`created → pending → confirmed | failed | expired | cancelled`；`pending→confirmed` 仅当"验真通过且对账 MATCHED（或员工确认）**且已过账**"。
**对账状态（独立）**：`pending → reconciled | exception`。通道已"成功"但对账 `exception` ⇒ 支付状态保持 `pending`，不过账，进异常队列。不得把通道状态与会计状态混用。
**入账约束（来自 CR-005）**：贷款 `phase ≠ ACTIVE`（未放款/`FUNDING_EXCEPTION`/`SETTLED`）⇒ 拒绝创建与过账，`REPAYMENT_NOT_PAYABLE`（`details.reason`）。

## 9. 人工确认（权限与审计）
- `finance` 可确认；超阈值或冲正需 `finance_checker` 二次批准（**基线检查者必须冻结，阈值数值 OD-4.3**）；**确认人 ≠ 提交人**；MFA 步进；禁止匿名/共享账号。
- 审计（`team_audit` + 账本）：`actor, role, tenant, repaymentId, attemptId, amountCents, bankReference, receivedAt, decision, reason, 前后位置摘要, idempotencyKey, traceId`。
- 生产 `admin_repay` = `postRepayment()` 的受控入口（同规则、同账本），测试模式隔离。
- **冲正（REVERSAL）**：通过同一过账服务；批准需双人 + MFA + 原因 + 原账本条目引用 + 幂等键；对**已结清**贷款的影响见 **CR-007 §3.5.1（受控重开）**；对 `VOIDED` 贷款拒绝（`REVERSAL_NOT_ALLOWED`）。

## 10. Receipt
由账本过账派生：`receiptNo, loanId, amountCents, currency, channel, postedAt, referenceMasked, remainingAfterCents`；客户只读。

## 11. 回调安全
1. **签名**：HMAC-SHA256 over `[institutionId, timestamp, nonce, rawBody]`，按机构/通道独立密钥；常量时间比较；通道若有自有方案由 `verifyCallback` 实现。
2. **时间窗/重放**：±300 秒；nonce 唯一。**修复 F9（必须）**：事件行与尝试行的写入**以 nonce 写入成功为条件**（批内条件链）；重放 nonce 不得产生任何事件。
3. 事件去重见 §7.1。
4. `providerReference` 必须对应现存 PaymentIntent；金额/币种/贷款/客户绑定见 §7.3。
5. **消费者**（新增 worker + 队列）：`received → processing → applied|rejected|dead_letter`，沿用 `maxAttempts=5` 与退避；`applied` 即调用 `postRepayment()`。
6. 载荷/签名/密钥不入日志。

## 12. APIs（提案；不复用 `POST /api/h5/state` 业务动作；错误码见 CR-012）
**客户（Cookie 会话 + Origin + JSON；服务端按 `REPAYMENT_ENABLED[channel]` 开关）**
`GET /api/h5/repayment/options?loan=ID` · `POST /api/h5/repayments`（`{requestId, loanId, channel, amountCents}`）· `POST /api/h5/repayments/{id}/claim` · `POST /api/h5/repayments/{id}/cancel` · `GET /api/h5/repayments?loan=ID` · `GET /api/h5/repayments/{id}` · `POST /api/h5/repayments/proof`。
**员工**：`GET /api/team/repayments?status=` · `POST /api/team/repayments/{id}/confirm|reject` · 对账异常队列 · 冲正（双人）。
**通道/机构**：`POST /api/institution/callback`（补消费者）。

## 13. Android Read Model（服务端权威）
```
repaymentBill:   见 CR-007 §10（amountDueNowCents, remainingCents, delinquencyState …）
channels:        [{ channel, enabled, minAmountCents?, instructions? }]
repayments[]:    { id, channel, amountCents, status, reconciliationState?, createdAt, expiresAt?, failureCode?, receipt? }
receipt:         { receiptNo, amountCents, currency, channel, postedAt, referenceMasked, remainingAfterCents }
```
失败只返回客户安全 `failureCode`（CR-012 §7），不含员工文案/通道原文。

## 14. 向后兼容
- 客户 `repay`（`POST /api/h5/state`）**保持 403 `CUSTOMER_SETTLEMENT_FORBIDDEN`**，在本 CR **实施并通过验收之前**与**之后**都保持（新能力走专用资源，不复活旧动作）。
- 新端点默认关闭（服务端开关）；老客户端不受影响。

## 15. 安全前置（据当前 HEAD 重新分类；不照搬旧审计）
| 项 | 分类 |
|---|---|
| `paymentVerified` 自报 | **CONFIRMED OPEN**（`admin-funds.ts` 仍读取；本 CR 废止） |
| 回调重放仍插入事件 | **CONFIRMED OPEN**（F9；本 CR 修复并重测） |
| 回调无消费者 | **CONFIRMED OPEN**（F8；本 CR 新增） |
| Admin 资金双人控制 | **REQUIRES RE-VERIFICATION** |
| 应急授权 | **PARTIALLY CLOSED — REQUIRES HARDENING**（一次性 ✓、MFA 批准 ✓、仅申请人 ✓；**未绑定贷款/动作/金额**，仅在消费时记录；`admin` 不在 `highRiskRoles`）。**不得把本文当作关闭证据** |
| MFA 重绑 | **APPEARS CLOSED — TEST REQUIRED** |
| 迁移器 | **触发器 `BEGIN/END` 切分：CONFIRMED CLOSED**；**`0030/0031` 与只追加审计表冲突：CONFIRMED CLOSED**；**全新卷迁移启动：CONFIRMED OPEN**（`0015_admin_password.sql` 的注释含分号，`splitSql` 不识别注释，把 `see 0030….sql.` 当作语句 ⇒ 空卷启动失败；后端实施/发布门禁，本契约不修代码）。本 CR 新增触发器迁移前必须关闭 |
**真实还款/放款激活被阻断**，直到以上门禁经独立复验且本 CR 通过验收。

## 16. 测试（契约）
**外部引用**：同引用+同绑定→幂等同结果 · 同引用+不同贷款→拒绝且不过账 · 同引用+不同金额→拒绝且不过账 · 同引用并发两请求（含不同贷款）→恰好一次绑定/过账 · 旧 `team_repayment_receipts` 回填后保护不弱于现状 · 重复回调不二次过账 · **重放 nonce 不产生事件（F9）** · 各层"同键异载荷"409 · 账本幂等键作用域（跨贷款复用参考号被拒）· 金额/贷款/客户不一致 → 异常且不过账 · 超额 → `OVERPAYMENT` · 部分还款与结清（仅经共享结清）· **并发交错（回调/人工/计提/豁免/冲正）无双过账、无错误结清** · 分摊：多分量缺顺序 → 失败关闭，单分量可过账 · 人工确认需角色+MFA+非提交人 · 账本不可更新/删除 · 投影滞后时读时叠加正确 + `rebuildProjection` · 生产遗留直写被拒绝（静态扫描）· `phase≠ACTIVE` 拒绝 · Android 契约（fixtures 与 §13 一致）· D1 批回滚。

**冲正**（见 CR-007 §12）：已结清+冲正后余额>0→受控重开；VOIDED 冲正被拒；重复冲正不重复入账。

## 17. Open Decisions（分类）
| ID | 决策 | 分类 |
|---|---|---|
| OD-4.1 | 超额政策（退款/客户贷方/抵扣） | CAN REMAIN OPEN（安全默认：不入账+异常）；BLOCKS 超额处理上线 |
| OD-4.2 | P6-A 凭证是否强制及保留期 | CAN REMAIN OPEN（默认可选）；BLOCKS 凭证保留策略上线 |
| OD-4.3 | 人工确认二次批准阈值与冲正审批 | **BLOCKS manual-confirmation 实施**（基线检查者须冻结）；阈值数值外部 |
| OD-4.4 | KHQR/Bakong 提供方与规范 | **BLOCKS P6-B 实施与生产**（通用适配契约可先行） |
| OD-4.5 | 凭证编号规则与支付过期时长 | P6-A 用文档化默认可实施；**BLOCKS 确定性 P6-B** |
| OD-7.3（跨 CR） | 分摊顺序 | **BLOCKS PRODUCTION FINANCIAL POSTING**（多分量时） |

## 18. Gate
```
CR-004 v2: PROPOSED — READY FOR CODEX RE-REVIEW；Implementation: NOT AUTHORIZED；Trae = HOLD
```
