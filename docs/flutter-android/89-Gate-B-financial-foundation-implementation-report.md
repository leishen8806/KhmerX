# Gate B Financial Foundation Implementation Report

```
Document:  89-Gate-B-financial-foundation-implementation-report.md
Date:      2026-10-10
Owner:     TRAE（实施）
Status:    IMPLEMENTATION COMPLETE (LOCAL) — BLOCKED AT EXIT (remote non-production D1 evidence unavailable)
Executor:  TRAE
Next Owner: CODEX — GATE B ACCEPTANCE REVIEW
Authority: EXECUTOR...txt (Gate B — Financial Foundation) · GPT IMPLEMENTATION AUTHORIZATION = GRANTED
```

## Project Identity

```
Project: KhmerX
Root:    E:\KhmerX\KhmerX
Remote:  git@github.com:leishen8806/KhmerX.git
Docs:    E:\KhmerX\KhmerX\docs\flutter-android

PROJECT IDENTITY CHECK: PASS
```

## Authority Documents

```
57-CR-004-repayment-payment-reconciliation.md
58-CR-005-disbursement-receiving-account.md
60-CR-007-overdue-penalty-fee-model.md
61-CR-012-state-error-registry.md
68-backend-cr-bundle-final-delta-review.md
69-backend-implementation-master-plan.md
71-Gate-B-financial-foundation-plan.md
75-Gate-A-B-implementation-plan-rereview.md
82-Gate-A-final-acceptance-review.md
88-B0-final-acceptance-review.md
```

Corrections/frozen: 72 · 74 · 75. Prerequisite: 73 / 77 / 83-88 (B0 CLOSED).

## Starting HEAD / Worktree

```
START HEAD: d916b4515a93057d7dd2a0673ebbca39a7bfd242
            ("bind postloan idempotency to payload")
FINAL HEAD: d916b4515a93057d7dd2a0673ebbca39a7bfd242   (unchanged — no commit, no separate worktree, per authorization)
Worktree:   main (single worktree; no cross-PR contamination since Gate B is one authorized package)
```

No commit was made. All Gate B work is uncommitted working files under `lib/finance/`, `lib/callback/`, `drizzle/0042_*`, `scripts/b0/backfill-gate-b.mjs`, `tests/finance-*` and the report.

## Starting Migration Number

```
STARTING HIGHEST MIGRATION: 0041  (B0 closed)
NEW MIGRATIONS:             0042  (single forward migration)
```

## New Migrations

| # | 迁移 | 用途 |
|---|---|---|
| 0042 | `drizzle/0042_gate_b_financial_foundation.sql` | 13 张财务表 + append-only/write-once 触发器 + reversal defense-in-depth 触发器 + `team_emergency_access` 硬化列（`currency`/`consumed_currency`）。单迁移，无历史文件修改 |

总语句数 47；经 split-sql（词法感知）与 migrate-hosted 解析验证。

## Schema

新增表（`drizzle/0042_...sql`，详见计划 71 §4）：

| 表 | 关键约束 |
|---|---|
| `loan_financial_state` | `loan_id PK`（首次资金确认时 INSERT 创建；序列化点）、`financial_version INTEGER NOT NULL`、阶段 `CHECK IN ('ACTIVE','FUNDING_EXCEPTION','SETTLED','VOIDED')`、`settled_at NULL`、`last_txn_id NOT NULL`、`updated_at` |
| `financial_legacy_loans` | `loan_id PK, tenant_id, marked_at, reason`（显式遗留标记，默认拒绝） |
| `loan_financial_terms` | `PK(loan_id, terms_seq)`、`terms_hash`；append-only（UPDATE/DELETE 触发器） |
| `repayment_ledger` | `direction CHECK IN ('CREDIT','REVERSAL')`、`amount_cents CHECK > 0`、`idempotency_key UNIQUE`、`reverses_entry_id REFERENCES repayment_ledger(id)`、`financial_version_after`、`financial_txn_id NOT NULL`；append-only + `repayment_ledger_reversal_guard` 触发器（REVERSAL 必须指向同币种 CREDIT 且累计不超） |
| `repayment_allocations` | `PK(entry_id, component)`、`cents CHECK > 0`；append-only |
| `loan_charge_ledger` | `direction CHECK IN ('DEBIT','CREDIT')`、`kind CHECK IN ('ACCRUAL','WAIVER','ADJUSTMENT','REVERSAL')`；append-only |
| `loan_financial_events` | `PK(loan_id, seq)`、`type`、`financial_txn_id NOT NULL`；append-only |
| `external_source_bindings` | **`PRIMARY KEY(tenant_id, channel, normalized_reference)`**（不含 loan_id） |
| `financial_idempotency` | `PK(scope, idempotency_key)`、`payload_hash`、`result_ref` |
| `funding_facts` | `kind CHECK IN ('CONFIRMED','RETURNED')`；append-only |
| `delinquency_policies` | `PK(tenant_id, version)`、`penalty_model 'NONE'` 默认、`allocation_order JSON`；append-only |
| `financial_txn_assertions` | `txn_id PK, ok INTEGER NOT NULL`（提交断言表） |
| `loan_policy_bindings` | `loan_id PK`、`policy_version`；write-once（禁止 UPDATE 触发器） |

## Legacy Loan Isolation

- 资格默认拒绝：贷款仅当 **①不在 `financial_legacy_loans` 且 ②存在 `loan_policy_bindings`** 才可经新财务服务变更（冻结为正前条件）。
- CAS 前缀 `QUALIFY_GUARD` 同时引用 `financial_legacy_loans`（NOT EXISTS）与 `loan_policy_bindings`（EXISTS）。
- 旧路径封堵（L 系列静态 + 运行时证据）：
  - `lib/store.ts`：移除 `allowInternalSettlement` 生产可达性，保留 `CUSTOMER_SETTLEMENT_FORBIDDEN`。
  - `lib/team/workflow.ts`：legacy/SQL 权威贷款拒绝 `disburse_request`/`disburse`/`overdue`（`DISBURSEMENT_NOT_AVAILABLE`）。
  - `lib/team/admin-funds.ts`：停止新增 `team_repayment_receipts` 写入；legacy 拒绝；SQL 权威经受控入口 + feature flag。
  - `lib/loan-signing.ts`：合同阶段在 `db().batch()` 原子创建 `loan_policy_bindings`（write-once）。
  - `lib/institution-event-plans.ts`：consumption 框架默认 fail-closed（`financialConsumptionEnabled`）。
- 回填：`scripts/b0/backfill-gate-b.mjs` 幂等：`team_repayment_receipts` → `external_source_bindings`（channel=MANUAL_TRANSFER, version=1, context=MANUAL_TRANSFER）+ `json_each(demo_workspaces.payload,'$.loans')` → `financial_legacy_loans`（reason='gate-b-backfill'）。带 `--env`/`--dry-run` 守卫。

## Immutable Financial Terms

- `lib/finance/terms.ts`：`buildTerms` / `hashTerms` / `normalizeCurrency` — 来源为接受的不可变合同/报价快照（存入 `loan_financial_terms` 的 `contract_snapshot_id` + `terms_hash`），**从不读取 `demo_workspaces.payload`**；terms_hash 校验。
- append-only 触发器禁止 UPDATE/DELETE；任何修正需显式会计/契约流程，非静默 UPDATE。

## Financial State / Version

- `loan_financial_state.financial_version` 单调递增（每次都 `V → V+1`）。
- 每条财务变更生成唯一 `financialTxnId = crypto.randomUUID()`，写入 `last_txn_id`。

## Transaction Ownership / CAS

`lib/finance/txn.ts` — 冻结 P0 不变式：

```
FAILED FINANCIAL OWNERSHIP CLAIM
→ ZERO AUTHORITATIVE FINANCIAL SIDE EFFECTS
```

- 批第一条 = 所有权声明（CAS）：`FIRST_ACTIVATION`（INSERT，PK loan_id 为序列化点）或 `REVISE`（`UPDATE ... WHERE loan_id=?1 AND financial_version=?2`）。
- 批内每一条权威写以 `ownershipGuardSql(selectBindings) => EXISTS(SELECT 1 FROM loan_financial_state WHERE last_txn_id = ?(selectBindings+1))` 为守卫 —— D1 位置绑定修复：守卫引用最后一个绑定参数，规避无编号 `?` 从 1 编号导致 `?1` 别名到首个 SELECT 值的缺陷。
- 批最后一条 = `financial_txn_assertions` 提交断言（`ok NOT NULL`；事实数量不符 → NOT NULL 违例 → 整批回滚）。
- 调用方核对 `r[0].meta.changes == 1`（CAS 命中）；CAS 0 行 → 有界重试（N=3）→ 耗尽抛 `ApiError('REVISION_CONFLICT')`。
- D1 原子性：`db.batch([...])` 单事务，commit/rollback 一体。

## First-Funding Initialization Branch

- `lib/finance/funding.ts: applyFundingConfirmed`：`FIRST_ACTIVATION` 用 `INSERT INTO loan_financial_state ... SELECT ?1..?8 WHERE ${QUALIFY_GUARD}`；并发首次确认主键冲突 → 整批回滚，败者零副作用。
- `applyFundingReturned`（→FUNDING_EXCEPTION）、`applyVoid`（→VOIDED）、REISSUE（FUNDING_EXCEPTION→ACTIVE + terms_seq+1）。

## ExternalSourceBinding

- 唯一性 = `tenantId + channel + normalized_reference`，**永不含 loanId**（同一 `normalized_reference` 不同 context 互不冲突）。
- 跨贷款同引用并发测试 D1-10：恰一个绑定+过账，败者零写。

## Source Normalization

`lib/finance/external-source.ts`：
- 全局最低规则：trim · 拒绝空值 · 拒绝控制字符（`\u0000-\u001F`、`\u007F`）· 确定性 · 版本化（`normalization_version`）。
- `MANUAL_TRANSFER` v1：trim → ASCII 大写 → `^[A-Z0-9_-]{6,80}$` 校验（不剥离分隔符、不去前导零）。
- opaque 提供方渠道：仅 trim，通用层不改写。
- 变更规范化版本需显式迁移/对账（避免重复绑定）。

## Repayment Ledger Foundation

- `lib/finance/ledger.ts`：`postRepaymentInsert`（CREDIT + allocations + event）、`postReversalInsert`（REVERSAL + event）、`externalBindingInsert`、`assertReversalTarget`。
- `lib/finance/operations.ts`：`postRepayment` 高层服务（规范化 → 幂等 → CAS → 账本/分摊/事件/绑定/幂等 → `decideTransition`）。
- append-only 触发器 + 幂等存储（`financial_idempotency`）；同键异载荷 → `IDEMPOTENCY_PAYLOAD_MISMATCH`。

## Charge Ledger Foundation

- `lib/finance/ledger.ts` 构造器 + `loan_charge_ledger` append-only；`calculateFinancialPosition` 计入 charge（DEBIT/CREDIT）。**Gate B 不激活罚息计提**（feature flag 关闭）。

## Financial Events

- `lib/finance/events.ts`：`eventInsert` 带 `ownershipGuardSql`；事件仅由成功 CAS 事务追加；陈旧写者不追加事件。

## Canonical Financial Position

- `lib/finance/position.ts`：`calculateFinancialPosition` 纯函数（terms + funding facts + repayment_ledger + repayment_allocations + loan_charge_ledger）；任一分量为负 → 抛内部不变量错误；`settlementEligible = remainingCents === 0`。
- 冲正按比例分摊由 `operations.ts: effectiveAllocations` 处理（部分/全额冲正）。

## Settlement Authority

- `lib/finance/settlement.ts`：`decideTransition(prevPhase, position, kind, nowMs, priorSettledAt)` — **唯一** `ACTIVE→SETTLED`（remaining==0）与（仅 `REVERSAL`）`SETTLED→ACTIVE` 出口；`operations.ts: settleLoan` 封装。

## Controlled Reopen

- 仅 `decideTransition` + `kind=REVERSAL` 可 `SETTLED→ACTIVE`（settled_at=NULL）；保持 `SETTLED`/`REVERSAL`/`REOPENED` 事件历史。
- VOIDED 拒绝冲正（`REVERSAL_NOT_ALLOWED`，reason=VOIDED）。

## Funding Activation Primitive

- `lib/finance/funding.ts` — 无对外路由；仅测试与后续 Gate D 调用；Gate B **不开放生产资金入口**。

## Callback Intake Foundation

- `lib/callback/replay.ts`：`claimCallbackNonce` / `callbackNonceGuardSql` / `claimSucceeded` / `ingestCallbackEvent` — nonce 先行（INSERT OR IGNORE），事件/尝试行以 nonce 行的 `changes()=1` 守卫；重放 → 不产生事件行。
- `lib/institution-callback.ts`：**保持纯 HMAC 原生状态**（无 `@/` 别名、无 Cloudflare 类型 import），以便原生 Node ESM 测试直接加载。
- 不启用还款/资金提供方消费者（→ C2 / D）。

## MFA Rebinding Evidence

- §34 要求独立自动化证据：MFA 启用时 `mfa_enroll_start` 需步进、待确认密钥在确认前不替换现密钥。相关断言纳入 `tests/team-integration.test.mjs`（regression）。**约束**：该测试属于既有安全门禁回归集，非停工重放；已在全量回归中保持 PASS。

## Emergency Authorization Hardening

- `lib/team/emergency.ts`：`emergencyRequest` 需非空 `currency`；`assertEmergencyAccess` 预绑定 `loanId + action + cents + currency`（`team_emergency_access` 新列 `currency`/`consumed_currency`）；消费时逐项相等（含 `AND COALESCE(currency,'')=?` 守卫），不匹配则不消费。
- 修复：SELECT 补 `expires_at`（避免 `new Date(Number(row.expires_at))` RangeError）。

## Admin Dual Control Verification

- `admin_disburse`/`admin_repay` 生产默认关闭；仅测试模式或硬化应急授权下作为 `withLoanFinancialTxn` 受控入口；`admin` 不得同时为 maker 与 checker（架构结论落库）。实际业务执行由 C1/D 落实。

## Workspace Projection Boundary

- `lib/finance/projection.ts`：`overlay(db, loanId, tenantId)` 读时以 SQL 覆盖 JSON；`rebuildProjection` 带 `financialVersion` 单调保护重写 JSON 投影，只从已提交 SQL 权威读取。
- `demo_workspaces` JSON = **兼容投影，非财务权威**。投影失败不影响财务真相。

## Concurrency Test Matrix

计划 71 §9.1 映射（本地 miniflare 全绿，`FIN_SQL_AUTHORITY_WRITES=ON`）：

| # | 场景 | 结果 |
|---|---|---|
| D1-2 | CAS 陈旧写者（恰一 win，其余 no-op 零部分写入） | PASS |
| D1-3 | UNIQUE 冲突回滚（绑定/idempotency 冲突 → version 递增也回滚） | PASS |
| D1-4 | 并行过账（N postRepayment，无双过账，版本严格递增） | PASS |
| D1-9 | 追加表 UPDATE/DELETE 全拒（8 表） | PASS |
| D1-10 | 跨贷款同引用 → 恰一绑定+过账 | PASS |
| D1-11 | 陈旧 + 还款 → 0 账本/分摊行 | PASS |
| D1-12 | 陈旧 + 计提 → 0 charge 行 | PASS |
| D1-13 | 陈旧 + 冲正 → 0 行，阶段/settled_at 不变 | PASS |
| D1-14 | 陈旧 + 结清 → 无 SETTLED 事件，阶段不变 | PASS |
| D1-15/16 | 陈旧 + 资金确认/事实组合 → 0 facts/terms/state/idempotency | PASS |
| D1-18 | 提交断言：事实数量不符 → NOT NULL → 整批回滚 | PASS |
| D1-19 | 陈旧写者不占用绑定；随后合法写者可绑同引用 | PASS |

授权指令 §42 矩阵（B01-B16）同上述语义覆盖（陈旧 CAS 各事实 0 副作用、双首激活恰一胜、串行化、跨贷款绑定、UNIQUE 失败零写、append-only 禁 UPDATE/DELETE）。

覆盖缺口（本地未实现项）：D1-5/6/7（并行还款+计提 / 冲正+还款 / 资金确认+结清的串行顺序确定性）、D1-8（批语句数/参数上限实测）、D1-17（变异测试：移除任一守卫应至少一个 D1-11..16 失败）。D1-1（远程批回滚对等）与 D1-8 的远程实测、远程陈旧 CAS/绑定竞争/append-only/参数上限 —— **依赖远程非生产 D1 环境，未执行**。详见「Remote Non-Production D1 Results」。

Legacy 隔离矩阵（计划 §7.1 测试 + §46）：
| # | 场景 | 结果 |
|---|---|---|
| L1 | 遗留 + 新财务服务（资金激活 fail-closed，零写入） | PASS |
| L4/L5 | 遗留 + 冲正/计提/结清 authority fail-closed，零账本/事件/状态/断言行 | PASS |
| L6 | 遗留 + postRepayment fail-closed | PASS |
| L7 | 非遗留缺失 policy binding → 默认拒绝 | PASS |
| L8 | 静态扫描：store/workflow/admin/loan-signing/plans 均含 legacy/authority 守卫；QUALIFY_GUARD 引用双条件 | PASS |
| 回填 | FM4-FM6 幂等 + dry-run | PASS |

## Local D1 Results

```
tests/finance-positions.test.mjs      PASS
tests/feature-flag.test.mjs           PASS
tests/finance-d1-cas.test.mjs         PASS
tests/finance-legacy-block.test.mjs   PASS
tests/finance-migration.test.mjs      PASS
finance subset total:                 42 PASS / 0 FAIL
```

## Remote Non-Production D1 Results

```
REMOTE NON-PRODUCTION D1 ENVIRONMENT: NOT PROVIDED
→ D1-1 batch rollback parity, stale CAS, conditional-write chain,
  UNIQUE conflict rollback, ExternalSourceBinding race, financial
  interleavings, append-only trigger behavior, batch/binding parameter
  limits, outbox same-commit/rollback: NOT RUN
```

所有远程对等证据缺失。**不伪造 Miniflare=远程 PASS。** → `GATE B: BLOCKED AT EXIT`。

## Migration Replay

```
FRESH VOLUME REPLAY (0000→0042):       PASS (15/15)
HOSTED MIGRATE PATH (migrate-hosted):  PASS (21/21)
TRIGGER SPLIT REGRESSION (BEGIN..END): PASS
AUDIT TRIGGER SURVIVAL (0030/0031+):   PASS
```

## Full Backend Regression

```
tests/*.test.mjs (full suite):
  tests 276
  pass  276
  fail  0
  cancelled 0
```
（含 Gate A 错误基础架构、B0 迁移、收入回调、team-integration、finance 全套。node --experimental-vm-modules --test。）

## Static Checks

```
TSC --noEmit:       仅 1 处预存在错误 lib/errors/envelope.ts:85（Gate A 文件，非 Gate B 引入，未修改）
ESLint (lib/**):    0 errors；135 warnings 全部为库内既有基线（no-explicit-any / no-unused-vars，
                    与 Gate A/B0 之前一致）。Gate B 新增 lib/finance/* 与 lib/callback/replay.ts 已清理为 0 warning。
NEW STATIC ERRORS:  0
NEW STATIC WARNINGS:0（相对于既有基线 — Gate B 新文件无新增）
```

## Product Activation Check

所有资金移动仍关闭（feature flag `FIN_SQL_AUTHORITY_WRITES` 默认 OFF → 写入 fail-closed；无生产路由）：

```
CUSTOMER REPAYMENT ENABLED: NO
REAL FUNDING ENABLED:        NO
PENALTY CHARGING ENABLED:    NO
CALLBACK PROVIDER CONSUMER:  0 (generic fail-closed shell only)
PRODUCT ACTIVATION:          ZERO
```

## Database Changes

- 仅 1 个新迁移 `0042_gate_b_financial_foundation.sql`（47 语句，13 表 + 触发器 + 硬化列）。
- 未修改任何历史迁移文件（B0 不可变性维持）。
- 金额全部 `int cents`（`_int()` 宽松解析，无浮点）。

## Security Gates

- Callback replay：CLOSED（B 交付通用 intake；provider consumer → C2/D 关闭）。
- Emergency authorization：HARDENING CLOSED（预绑定 loanId+action+cents+currency；消费逐项相等）。
- Admin financial dual control：架构验证已落库；业务执行 → C1/D。
- MFA rebinding：自动化证据在回归集中 PASS。
- `paymentVerified`：**无新增信任路径**（保持 C1 关闭项）。

## Contract Gaps

```
CONTRACT GAP: 0
```
未发现需停止项或需发明的语义。全部实现遵循 CR-012 既有错误码（`REVISION_CONFLICT`、`REPAYMENT_NOT_ENABLED`、`DISBURSEMENT_NOT_AVAILABLE`、`EXTERNAL_REFERENCE_CONFLICT` 等），未新增对外码。

## P0

```
P0 = 0
（陈旧写者权威副作用 = 0；无未守卫权威写；无双过账；无单笔外部转账偿付两笔贷款；
 无绕过 settlement.ts 的状态变更；追加表不可改删；JSON 投影非财务输入；无客户还款/真放款/罚息启用）
```

## P1

```
P1 = 0  （本地实施范围）
```
**注意**：计划 §14 将"远程非生产 D1 未执行"列为 P1。此处本地测试全绿，但远程证据缺失构成 **BLOCKED AT EXIT**（见 Exit/Readiness），不计为可绕过项。

## P2

```
P2-1 遗留冻结/冲正目标类型错误是否需要专用 reason/码 → CR-012 增量，不阻塞本 Gate；未实施
```

## Final HEAD / Worktree

```
FINAL HEAD: d916b4515a93057d7dd2a0673ebbca39a7bfd242
Worktree:   main（未提交；无独立 worktree）
```

## Readiness for Codex Acceptance

本地全量实现 READY，但受 §41/§56 limit 约束：

```
GATE B:
BLOCKED AT EXIT

REASON:
专用非生产远程 Workers D1 环境未提供 → 远程对等证据（D1-1、远程陈旧 CAS、
绑定竞争、UNIQUE 回滚对等、追加表触发、批/参数上限、outbox 同提交）缺失。
未用 miniflare 冒充远程 PASS。

本地状态：
全部本地基础设施（B1–B10）已实现并通过本地 miniflare 测试（finance subset 42/42；
全量回归 276/276；迁移 15/15 + hosted 21/21；tsc 仅预存在 envelope.ts:85；eslint 0 error）。

解除 BLOCKED 需要：
1) 提供专用非生产远程 D1 数据库与凭据（业主书面许可，不得用生产库）
2) 在 Codex 监督下执行 §41 清单远程对等测试
3) Codex 执行 Gate B 最终验收
```

---

```
NEXT: CODEX GATE B ACCEPTANCE REVIEW
```