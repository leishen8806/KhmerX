# Gate B — Financial Foundation · Implementation Plan

```
Document:  71-Gate-B-financial-foundation-plan.md
Date:      2026-10-09
Owner:     Claude（规划）
Status:    PROPOSED — READY FOR CODEX PLAN RE-REVIEW（v2，据 72 修复 P0/P1；未自批）
Contracts: 57 CR-004 v3 · 58 CR-005 v3 · 60 CR-007 v3 · 61 CR-012 v3.1（需求权威）
Master:    69-backend-implementation-master-plan.md
Prerequisite: 73-B0-fresh-volume-migration-recovery-plan.md（B0 独立执行包；Gate B 不得在 B0 PASS 前提交 0042+）
Repair:    74-Gate-A-B-implementation-plan-repair-summary.md（v1 备份：71-Gate-B-financial-foundation-plan.md.pre73.bak）
Gate:      CODE NOT MODIFIED · DATABASE NOT MODIFIED · IMPLEMENTATION NOT AUTHORIZED · Trae = HOLD
```

## 1. Objective
建立 CR-004 / CR-005 / CR-007 共享的财务权威基础设施，使后续 Gate 只需"接业务"，不再各自决定余额、结清或激活。
**Gate B 结束时只交付基础设施**：不开放客户还款、不开放真实放款、不计提罚息。

## 2. Scope
**Included**
`financial_version` · 不可变 `loan_financial_terms` · `external_source_bindings` · `repayment_ledger`（含分摊） · `loan_charge_ledger` · `loan_financial_events` · `loan_financial_state` · 规范财务位置 `calculateFinancialPosition` · 共享 loan 级财务事务服务 · 共享结清权威 · 受控重开权威 · 资金激活权威（无调用方开放） · 财务幂等存储 · 政策版本存储与绑定 · 可重建投影 + 读时叠加 · 遗留直写 fail-closed · 安全基线中分配给 B 的项（§8）。
**Explicitly excluded**
客户还款端点（C1/C2）· 收款账户确认/放款指令/真实资金确认的对外入口（D）· 罚息计提作业（E）· 推送（F）· 任何生产资金开关 · Android。

## 3. 冻结的权威层级
```
不可变合同/报价事实（storedContract：principal, fee, currency, termDays, billing, termsHash）+ 绑定政策版本
  + 资金事实（funding confirmed / returned）
  + repayment_ledger（CREDIT / REVERSAL + allocations）
  + loan_charge_ledger（DEBIT / CREDIT：罚息、豁免、调整）
        ↓
calculateFinancialPosition(loanId, asOf)   ← 唯一计算（纯函数，输入为上述事实）
        ↓
loan_financial_state（phase, financial_version, settled_at, current_terms_seq）
        ↓
生命周期投影（demo_workspaces.payload 中的 status/paid 等 = 兼容投影）
        ↓
API 读模型（读时叠加：SQL 权威覆盖 JSON 投影）
```
**`demo_workspaces` JSON 只是兼容投影，永远不是财务权威。**

## 4. Database changes（全部新增；迁移 0042 起，B0 关闭后才可提交）

> 列名为规划级；字段语义以 57/58/60 为准。金额一律整数分（cents），币种显式。

| # | 表 | 关键列 / 约束 |
|---|---|---|
| 1 | `loan_financial_state` | `loan_id PK, tenant_id, financial_version INTEGER NOT NULL, phase CHECK IN ('ACTIVE','FUNDING_EXCEPTION','SETTLED','VOIDED')`（**严格为 CR-007 的四个阶段，不新增**）`, current_terms_seq, settled_at NULL, last_txn_id NOT NULL, updated_at`。**行在首次权威资金确认批次中 `INSERT` 创建**（主键冲突 ⇒ 并发确认只有一个成功）；资金确认前不存在该行（贷款尚无财务位置） |
| 1a | `financial_legacy_loans` | `loan_id PK, tenant_id, marked_at, reason`——Gate B 切换时刻已存在的**全部**贷款的显式遗留标记（见 §7.1）。**默认拒绝**：除该标记外，财务可变更资格还要求**正向条件**——`loan_policy_bindings` 行存在（只有 Gate B 之后的新代码在合同阶段创建）。回填漏标的贷款因缺少绑定行同样被拒 |
| 2 | `loan_financial_terms` | `PK(loan_id, terms_seq)`, `tenant_id, principal_cents, contract_fee_cents, currency, term_days, delinquency_policy_version, allocation_order_ref, funded_at NULL, due_at NULL, due_local_date NULL, contract_snapshot_id, terms_hash, financial_txn_id NOT NULL, created_at`；**append-only 触发器**（禁止 UPDATE/DELETE） |
| 3 | `repayment_ledger` | `id PK, tenant_id, loan_id, direction CHECK IN ('CREDIT','REVERSAL'), amount_cents CHECK > 0, currency, channel, source_type, source_ref, idempotency_key UNIQUE, reverses_entry_id NULL REFERENCES repayment_ledger(id), financial_version_after, financial_txn_id NOT NULL, posted_by, posted_at`；append-only 触发器 |
| 4 | `repayment_allocations` | `PK(entry_id, component)`, `cents CHECK > 0`, `financial_txn_id NOT NULL`；append-only |
| 5 | `loan_charge_ledger` | `id PK, tenant_id, loan_id, component, direction CHECK IN ('DEBIT','CREDIT'), amount_cents CHECK > 0, kind CHECK IN ('ACCRUAL','WAIVER','ADJUSTMENT','REVERSAL'), idempotency_key UNIQUE, policy_version, accrual_date NULL, reverses_entry_id NULL, reason, approved_by NULL, financial_version_after, financial_txn_id NOT NULL, created_at`；append-only |
| 6 | `loan_financial_events` | `PK(loan_id, seq)`, `type, financial_version, financial_txn_id NOT NULL, ref, actor, at`；append-only |
| 7 | `external_source_bindings` | **`PRIMARY KEY(tenant_id, channel, normalized_reference)`**（不含 loan_id；`channel` 为渠道/提供方上下文）, `raw_reference, normalization_version, normalization_context, loan_id, amount_cents, currency, customer_id, ledger_entry_id, financial_txn_id, first_bound_at`；规范化规则见 §5.1 |
| 8 | `financial_idempotency` | `PK(scope, idempotency_key)`, `payload_hash, result_ref, financial_txn_id NOT NULL, created_at`（客户/员工 `requestId` 幂等；同键异载荷 → `IDEMPOTENCY_PAYLOAD_MISMATCH`） |
| 9 | `funding_facts` | `id PK, loan_id, kind CHECK IN ('CONFIRMED','RETURNED'), instruction_ref, amount_cents, currency, external_reference, financial_txn_id NOT NULL, occurred_at, recorded_at`；append-only |
| 10 | `delinquency_policies` | `PK(tenant_id, version)`, `grace_days, penalty_model ('NONE' 默认), allocation_order JSON, accrual_basis, created_at`；append-only（新政策 = 新版本） |
| 12 | `financial_txn_assertions` | `txn_id PK, ok INTEGER NOT NULL`——**提交断言表**（§6.3）：仅用于让批在事实数量不符时通过 `NOT NULL` 违例整体回滚；正常提交后行可保留（审计）或由维护任务清理 |
| 11 | `loan_policy_bindings` | `loan_id PK, policy_version, bound_at, contract_snapshot_id`；写一次（触发器禁止 UPDATE） |

**回填（同批迁移或独立回填脚本，须可重复执行）**
- `team_repayment_receipts` 全部行 → `external_source_bindings(channel='MANUAL_TRANSFER', raw_reference=reference, normalized_reference=reference, normalization_version=1)`，保持"同流水号不可二次入账"（57 §2，**不弱于现状**）。
- 既有贷款：迁移以 `json_each(demo_workspaces.payload,'$.loans')` 把切换时刻**所有**贷款写入 `financial_legacy_loans`（幂等，可在部署时重复执行以覆盖迁移与新代码上线之间创建的贷款）；**不**从 JSON 推导账本（测试资金历史不进入 SQL 权威）。遗留贷款**只读**：任何财务变更（新服务与旧路径）均 fail-closed（§7.1）。是否转换遗留贷款属于**独立的 Migration / Backfill / Reconciliation Gate**，不在 Gate B 范围内。
- 新贷款：在合同生成/签署之前绑定政策（`loan_policy_bindings`，60 §5）；`loan_financial_state`（`phase='ACTIVE'`, `financial_version=1`）与 `loan_financial_terms` 首版（`terms_seq=1`，由不可变合同快照生成）**在同一资金确认批次中创建**（58 §6.2）。资金确认前贷款处于生命周期 `signed`，无财务位置。

## 5. 服务与模块（新增 `lib/finance/*`）

| 模块 | 职责 |
|---|---|
| `terms.ts` | 从 `storedContract`（`lib/kyc/server.ts`，经 `contractHashValid` 校验）生成条款；**从不读取 `demo_workspaces.payload`**；`terms_hash` 校验 |
| `policy.ts` | 政策版本读取；签约前绑定（`loan_policy_bindings`）；无绑定 → `FINANCIAL_POLICY_UNBOUND`；>1 应付分量且无 `allocation_order` → `ALLOCATION_POLICY_MISSING` |
| `position.ts` | `calculateFinancialPosition(facts, asOf)`：**纯函数**，输入为条款 + 资金事实 + 两类账本；输出各分量 `outstanding`、`remainingCents`、`settlementEligible`；任一分量为负 → 抛内部不变量错误 |
| `txn.ts` | loan 级财务事务（§6） |
| `settlement.ts` | **唯一**结清/重开决策：`decideTransition(prevPhase, position, txnKind)`；只有它能产出 `ACTIVE→SETTLED` 与（仅 `txnKind=REVERSAL`）`SETTLED→ACTIVE` |
| `funding.ts` | **资金激活权威**：`applyFundingConfirmed`（首次：`INSERT loan_financial_state(phase=ACTIVE)` + 条款 `terms_seq=1`，生命周期投影 `signed→active`；REISSUE：`FUNDING_EXCEPTION→ACTIVE` + `terms_seq+1`）、`applyFundingReturned`（→`FUNDING_EXCEPTION`）、`applyVoid`（→`VOIDED`）。B 中**无对外路由调用**，仅测试与 D 使用 |
| `external-source.ts` | 按 §5.1 冻结规则规范化（`MANUAL_TRANSFER` v1：trim + ASCII 大写 + 字符集校验；提供方引用由提供方适配器规范化，通用层不改写）；生成绑定语句；冲突重读判定（同绑定 → 幂等；异绑定 → `EXTERNAL_REFERENCE_CONFLICT`） |
| `ledger.ts` | `postRepayment()` 与 `postReversal()`、`postCharge()` 的**语句构造器**（不对外开放路由）；分摊按绑定政策；冲正校验 61 §4.6.1 |
| `projection.ts` | `overlay(state, financialRows)`：读时以 SQL 覆盖 JSON；`rebuildProjection(loanId)`：从 SQL 重写 JSON 投影字段（`status/paid/...`），幂等 |
| `events.ts` | `loan_financial_events` 追加；后续 F 的 outbox 从这里派生（B 不写 outbox） |

### 5.1 外部来源引用规范化（OD-B2 = CLOSED，冻结）
**存储**：`raw_reference`（原文，审计用，不参与唯一性）· `normalized_reference`（唯一性键组成部分）· `normalization_version`（整数，初始 1）· `normalization_context`（`MANUAL_TRANSFER` 或提供方标识）。
**全局最低规则（所有渠道）**：去除首尾空白 · 拒绝空值 · 拒绝控制字符（含 `\u0000-\u001F`、`\u007F`）· 规范化确定性、有版本、可审计（规则变更 = `normalization_version+1`，旧版本绑定行保持其版本，不重写）。
**`MANUAL_TRANSFER` v1**：trim → ASCII 字母转大写 → 按项目批准的参考号字符集/长度校验（沿用现行 `^[A-Z0-9_-]{6,80}$`，见 `lib/team/admin-funds.ts`）。**不**删除有意义的标点，**不**剥离分隔符，**不**去除前导零。
**提供方引用（KHQR / BAKONG / 未来提供方）**：由**提供方适配器**拥有规范化。若提供方引用为不透明/区分大小写：**仅 trim**。通用财务层**不得**对其转大写/转小写/去标点/改写。
**唯一性**：`tenantId + channel/provider-context + normalizedReference`；**永不含 `loanId`**。同一 `normalized_reference` 在不同 `normalization_context` 下互不冲突（上下文即 `channel`）。
**回填**：`team_repayment_receipts.reference` 已按现行规则存为大写，以 `normalization_version=1`、`context=MANUAL_TRANSFER` 回填。
**测试**：大小写/空白/控制字符/空值；MANUAL_TRANSFER 标点不被剥离；不透明提供方引用大小写保持；规则版本记录；同引用跨贷款冲突；回填后保护不弱于现状。

## 6. 财务并发模型（基于当前 D1 能力）

D1 事实：`db.batch([...])` 为单个 SQL 事务（本地 miniflare 已验证 `#txn → transactionSync`；**远程 D1 为测试门禁**）；不支持交互式事务（不能在事务中读后决定）。因此采用"**应用层读 → 计算 → 单批 CAS 提交**"。

### 6.1 冻结不变量（P0 修复）
```
FAILED FINANCIAL OWNERSHIP CLAIM
→ ZERO AUTHORITATIVE FINANCIAL SIDE EFFECTS
```
1. 每次财务变更生成唯一 `financialTxnId`（`crypto.randomUUID()`），读取到 `financial_version = V`，并以此计算变更。
2. 批的**第一条**语句是**所有权声明（CAS）**：把 `loan_financial_state` 从 `V` 推进到 `V+1` 并写入 `last_txn_id = :txn`（首次资金确认时为 `INSERT` 状态行，主键冲突即序列化点）。
3. 批内**每一条**后续权威写（INSERT/UPDATE）**必须**以同一个守卫为条件：
   `EXISTS (SELECT 1 FROM loan_financial_state WHERE loan_id=:loan AND financial_version=:V+1 AND last_txn_id=:txn)`
   不允许任何"CAS 之后无条件插入"的语句。
4. CAS 影响 0 行 ⇒ 其后每条权威语句同样影响 0 行（守卫为假）⇒ **零权威副作用**。
5. 调用方**必须**核对语句效果（§6.4）；批"成功返回"本身**不是** CAS 成功的证据。
6. CAS 未命中 ⇒ 该次尝试被判定为陈旧/冲突：丢弃，从权威状态重读，有界重试（N=3），耗尽 ⇒ `REVISION_CONFLICT`（61 §4.6.1）。

### 6.2 权威事实清单（全部受所有权守卫；无遗漏）
| 权威事实 | 写入方式 | 守卫 |
|---|---|---|
| `loan_financial_state`（版本/阶段/`settled_at`/`current_terms_seq`——即**结清投影与重开投影**） | 批内第 1 条：`UPDATE … WHERE financial_version=V AND NOT EXISTS legacy AND EXISTS policy_binding`；首次激活为 `INSERT … WHERE NOT EXISTS legacy AND EXISTS policy_binding` | **本身即所有权声明** |
| `repayment_ledger` | `INSERT … SELECT … WHERE <§6.1-3 守卫>` | 守卫 |
| `repayment_allocations` | `INSERT … SELECT … WHERE <守卫>`（并以 `entry_id` 属于本 `txn` 的账本行为条件） | 守卫 |
| `loan_charge_ledger`（计提/豁免/调整/冲正） | 同上 | 守卫 |
| `loan_financial_events` | 同上（`seq = 当前最大 seq + 1` 在 SELECT 内计算，主键防重） | 守卫 |
| `external_source_bindings`（财务过账事务内） | 同上；**守卫为假则不插入，因此陈旧写者不会占用绑定**；守卫为真而主键冲突 ⇒ 抛错 ⇒ 整批回滚（跨贷款序列化） | 守卫 + 主键 |
| `financial_idempotency` | 同上 | 守卫 |
| `funding_facts`（确认/退回） | 同上 | 守卫 |
| `loan_financial_terms`（`terms_seq=1` 初始化、REISSUE `terms_seq+1`） | 同上 | 守卫 |
| 生命周期的财务投影（`active↔closed`、`signed→active`） | **= `loan_financial_state` 的阶段**（SQL 权威）；`demo_workspaces` JSON 是兼容投影，见 §6.5 | 状态行即守卫 |
| `financial_txn_assertions` | 批内**最后**一条：见 §6.3 | 守卫 |

**有意采用不同串行化语义的对象（逐项说明）**
| 对象 | 语义 | 为何不需要 loan 所有权守卫 |
|---|---|---|
| `loan_policy_bindings` | 写一次：`PK(loan_id)` + 禁止 UPDATE 触发器；在合同阶段（资金确认**之前**）创建 | 此时尚无财务状态行与财务位置，不移动资金、不改变余额；由主键保证至多一次，并作为"财务资格"的正向前提被 §6.1 的守卫读取 |
| `delinquency_policies` | tenant 级追加（`PK(tenant_id, version)`），新政策 = 新版本 | 非 loan 级；对既有贷款无影响（贷款只绑定特定版本，终身不变） |
| `financial_legacy_loans` | 仅迁移/部署回填写入 | 非运行期财务事务 |
| `demo_workspaces` JSON 投影 | 财务批**之后**的最佳努力重建，见 §6.5 | 非权威；见 §6.5 |

### 6.3 可审查的伪代码（实现中立）
```
withLoanFinancialTxn(loanId, kind, build):
  for attempt in 1..N (N=3):
    S   = SELECT * FROM loan_financial_state WHERE loan_id=:loan            -- 得到 V（首次激活：S 为空，V=0）
    F   = 读取条款、资金事实、两类账本                                          -- 全部按 loan_id
    P   = calculateFinancialPosition(F, asOf)
    plan = build(S, P)      -- 纯计算：待追加的账本/分摊/事件/绑定/幂等/条款/状态转换（含 settlement.decideTransition）
    txn = randomUUID();  GUARD = EXISTS(SELECT 1 FROM loan_financial_state
                                         WHERE loan_id=:loan AND financial_version=:V+1 AND last_txn_id=:txn)

    batch = [
      -- A. 所有权声明（CAS）
      UPDATE loan_financial_state SET financial_version=:V+1, last_txn_id=:txn, phase=…, settled_at=…, …
        WHERE loan_id=:loan AND financial_version=:V
          AND NOT EXISTS(SELECT 1 FROM financial_legacy_loans WHERE loan_id=:loan)
          AND EXISTS(SELECT 1 FROM loan_policy_bindings WHERE loan_id=:loan),          -- r[0]
      -- B. 每条权威事实（仅当 GUARD）
      INSERT INTO repayment_ledger(…, financial_txn_id) SELECT …, :txn WHERE GUARD,     -- r[1]
      INSERT INTO repayment_allocations(…)              SELECT … WHERE GUARD,
      INSERT INTO loan_charge_ledger(…)                 SELECT … WHERE GUARD,           -- 视 kind
      INSERT INTO external_source_bindings(…)           SELECT … WHERE GUARD,           -- 主键冲突 ⇒ 抛错 ⇒ 整批回滚
      INSERT INTO financial_idempotency(…)              SELECT … WHERE GUARD,
      INSERT INTO funding_facts(…) / loan_financial_terms(…) SELECT … WHERE GUARD,      -- 视 kind
      INSERT INTO loan_financial_events(…)              SELECT … WHERE GUARD,
      -- C. 提交断言（让"事实数量不符"变成整批回滚）
      INSERT INTO financial_txn_assertions(txn_id, ok)
        SELECT :txn, CASE WHEN <本 txn 在各事实表中的行数 == plan 声明的期望行数> THEN 1 ELSE NULL END
        WHERE GUARD                                           -- ok NOT NULL ⇒ 数量不符时抛错，整批回滚
    ]
    r = await db.batch(batch)                                                          -- 抛错（UNIQUE/NOT NULL/触发器）⇒ 整批已回滚
    -- D. 结果核对（不得仅凭"批成功返回"）
    if r[0].meta.changes == 1 AND r[i].meta.changes == plan.expected[i] for all i: return COMMITTED
    if r[0].meta.changes == 0: -- CAS 未命中 ⇒ 守卫全为假 ⇒ 其余语句必须全为 0；若发现非 0 ⇒ 视为实现缺陷，抛内部不变量错误（P0 告警）
         continue (重读重算)
  throw ApiError('REVISION_CONFLICT')
  catch UNIQUE 冲突（整批已回滚）：重读 binding / idempotency：
       同绑定/同载荷 ⇒ 返回既有结果；否则 EXTERNAL_REFERENCE_CONFLICT / IDEMPOTENCY_PAYLOAD_MISMATCH
```
- 不使用 `changes()=1` 链：`changes()` 只反映紧邻上一语句，长链易错；`txn` 守卫对每条语句独立成立，并可被测试逐条验证。
- **陈旧写者**：A 影响 0 行 ⇒ B、C 全部影响 0 行 ⇒ 无账本、无事件、无绑定、无幂等行、无条款/资金事实、无状态变更。
- **跨贷款序列化**：两笔不同贷款的批各自 A 命中，但同一 `normalized_reference` 只有一批能插入绑定；另一批抛错整体回滚（其账本与状态推进同时回滚）。

### 6.4 CAS 结果核对（强制）
调用方必须断言：①`r[0].meta.changes == 1`（CAS 命中）；②各事实语句的 `changes` 等于计划的期望数（例如还款 = 1 条账本 + k 条分摊 + 1 条事件 + 1 条幂等 + [0|1] 条绑定）；③不一致时：若 ① 未命中 ⇒ 陈旧/冲突，重试；若 ① 命中而 ② 不符 ⇒ 因提交断言（C）此情形应已整批回滚，若仍出现 ⇒ 内部不变量错误（P0 告警、不返回成功）。**批返回成功不是 CAS 成功的证明。**

### 6.5 投影与适用范围
- **所有**以下变更必须经 `withLoanFinancialTxn`：还款、冲正、计提、豁免、调整、资金确认、资金退回、结清、重开、作废。静态扫描禁止其它代码写这些表。
- `demo_workspaces` JSON 投影**不在**财务批内（避免把同主体所有贷款串行化，见 57 DR-1），并且**只有 CAS 命中（COMMITTED）的调用才会在批后触发 `rebuildProjection`**；`rebuildProjection` **只从已提交的 SQL 权威读取**，写入时带 `financial_version` 单调保护（旧版本不覆盖新版本）。因此陈旧写者**不会**产生任何财务投影变更；读时叠加以 SQL 为准，JSON 滞后不影响正确性。

## 7. 结清 / 重开 / 激活权威
| 转换 | 唯一执行者 | 条件 |
|---|---|---|
| （无行）→ `ACTIVE`（投影 `signed→active`） | `funding.applyFundingConfirmed` | 权威资金确认事实（D 提供来源；B 仅测试调用）；`INSERT` 主键冲突 ⇒ 并发确认恰一个成功 |
| `ACTIVE → SETTLED`（投影 `active→closed`） | `settlement.decideTransition` | `remainingCents==0` 且无阻塞异常 |
| `SETTLED → ACTIVE`（投影 `closed→active`） | `settlement.decideTransition`，仅 `kind=REVERSAL` | 已批准冲正 + 重算 `remaining>0`；`settled_at=NULL`；事件 `REVERSAL_APPLIED`+`REOPENED`；拖欠按原到期日+绑定政策+当前 Asia/Phnom_Penh 日期重算（60 §3.5.1） |
| `ACTIVE → FUNDING_EXCEPTION` | `funding.applyFundingReturned` | 退回事实 |
| `FUNDING_EXCEPTION → ACTIVE` | `funding.applyFundingConfirmed`（REISSUE） | 已批准 REISSUE + 新指令确认 |
| `FUNDING_EXCEPTION → VOIDED` | `funding.applyVoid` | 已批准 VOID |
| VOIDED 冲正 | 拒绝 | `REVERSAL_NOT_ALLOWED(reason=VOIDED)` |

### 7.1 遗留贷款：只读 + 旧路径封堵（B1 = CLOSED，冻结）
**冻结决定**：Gate B 之前存在的贷款**不**自动迁移到新财务权威。它们是 **LEGACY / READ-ONLY**；任何**新的**财务变更一律 fail-closed。把遗留贷款转换到 SQL 权威需要**单独的 Migration / Backfill / Reconciliation Gate**。

**资格判定（默认拒绝）**：贷款仅当 ①不在 `financial_legacy_loans` **且** ②存在 `loan_policy_bindings` 行 时才可经新财务服务变更；两个条件写入 §6.3 的 CAS（A）语句。

**旧路径清单与封堵**（按真实代码盘点；"封堵"= 生产路径对**任何**贷款不再直接改写这些字段——SQL 权威贷款走 `lib/finance`，遗留贷款一律只读）：
| # | 旧路径 | 能改写的字段 | Gate B 封堵方式 |
|---|---|---|---|
| 1 | `lib/domain.ts: applyAction` — `disburse` | `status→active`、`wallet`、`dueAt`、`entries` | 生产调用点（#2–#6）不得再以 `disburse/repay/withdraw/overdue` 调用；纯函数仅保留给**单元测试夹具**，静态扫描断言生产模块不含这些调用 |
| 2 | `lib/domain.ts: applyAction` — `repay` | `paid`、`status→closed`、`entries` | 同上 |
| 3 | `lib/domain.ts: applyAction` — `withdraw`、`overdue` | `wallet`、`demoDays`/到期推移 | 同上 |
| 4 | `lib/store.ts: mutate` + `customerAction`（`allowInternalSettlement` 选项） | 经 `customerAction` 的 `repay/withdraw` | 删除 `allowInternalSettlement` 在生产的可达性；保持 `CUSTOMER_SETTLEMENT_FORBIDDEN` |
| 5 | `lib/team/workflow.ts: staffAction` — `disburse_request`、`disburse`、`overdue` | `status→active`、`wallet`、`entries`、`fundingActor` | 遗留贷款：拒绝；SQL 权威贷款：生产默认拒绝（放款入口由 Gate D 启用）；测试模式也不得绕过 |
| 6 | `lib/team/admin-funds.ts: adminFunds` — `admin_disburse`、`admin_repay`、`team_repayment_receipts` 插入 | 同上 + 回执表 | 遗留贷款：拒绝；SQL 权威贷款：仅经 `withLoanFinancialTxn` 受控入口（§8），生产默认关；`team_repayment_receipts` 停止新增写入（回填后只读） |
| 7 | `lib/institution-event-plans.ts` / 回调动作计划（`funding.confirmed`、`repayment.confirmed`） | 计划对 `loan` 的预期状态转换 | 消费框架默认 fail-closed（§8）；遗留贷款永远拒绝 |
| 8 | `lib/postloan/server.ts` 的 `UPDATE demo_workspaces` | 任务状态（不改贷款财务字段） | 仅核对：不得写 `paid/status/wallet/entries`；Gate E 把 `outstanding()` 改读规范位置 |
| 9 | `lib/loan-signing.ts` 的 `UPDATE demo_workspaces` | 合同字段 | 不改财务字段；新增：此处创建 `loan_policy_bindings`（Gate B 资格的正向前提） |
| 10 | `lib/customer-cleanup.ts` | 删除早期状态贷款 | 仅允许早期状态（现状）；遗留/SQL 权威的已放款贷款不可删除（保持现有守卫并加测试） |
| 11 | 任何新增的 `UPDATE demo_workspaces` 写 `paid/status∈{active,closed}/wallet/entries` | — | 静态扫描：禁止（除 `rebuildProjection`） |

**错误语义**（沿用 CR-012 既有码，**不修改 57–68**）：遗留贷款上的还款/提现类变更 → `REPAYMENT_NOT_ENABLED`（403）；放款类变更 → `DISBURSEMENT_NOT_AVAILABLE`（409，不带 `reason`，因白名单为契约冻结）。是否为遗留冻结增设专用码，作为后续 CR-012 增量（P2，不阻塞）。

**测试（强制）**
| # | 场景 | 断言 |
|---|---|---|
| L1 | 遗留贷款 + 新财务服务（还款/冲正/计提/豁免/调整/资金确认） | 全部 fail-closed，零写入 |
| L2 | 遗留贷款 + 旧 `repay` 路径（`customerAction`/`staffAction`/`admin_repay`） | 被拒 |
| L3 | 遗留贷款 + 旧 `disburse`/`admin_disburse` | 被拒 |
| L4 | 遗留贷款 + 计提/豁免/调整 | 被拒 |
| L5 | 遗留贷款 + 结清/重开 | 被拒 |
| L6 | 缺少 `loan_policy_bindings` 且不在遗留表（回填漏标） | 被拒（默认拒绝） |
| L7 | 静态扫描：生产模块无直接 `paid/status/wallet/entries` 财务写入、无 `applyAction('disburse'\|'repay'\|'withdraw'\|'overdue')` 调用 | 通过 |
| L8 | 部署回填幂等：重复执行覆盖迁移后到上线前创建的贷款 | 一致 |

## 8. 分配给 Gate B 的安全基线项
> 另：`paymentVerified` 自报 → **C1 关闭**（B 不得引入任何信任自报核验的路径）；全新卷迁移 → **B0 PASS 为 Gate B 的前置**。
| 项 | B 中的交付 |
|---|---|
| callback replay insertion（CONFIRMED OPEN） | **通用安全摄取原语（B 关闭）**：nonce 插入先行；事件/尝试插入以 nonce 行守卫的条件语句执行；重放 → 不产生事件行；测试 |
| callback consumer absence（CONFIRMED OPEN） | B **只交付**通用消费框架/fail-closed 分发外壳（读取待处理事件 → 动作计划 → **默认记录"未启用"，不改业务**）；**B 不启用**还款提供方消费者（→ C2）、**不启用**资金提供方消费者（→ D）。B 退出时本项仍为 OPEN，由 C2/D 分别关闭 |
| MFA rebinding（TEST REQUIRED） | Gate B **测试前提/安全验证**：自动化测试证明 MFA 已启用时 `mfa_enroll_start` 需步进；待确认密钥在确认前不替换现密钥 |
| Admin financial dual control（RE-VERIFY） | Gate B **架构验证**（结论落库：`admin_disburse`/`admin_repay` 生产默认关闭；仅测试模式或硬化应急授权下作为 `withLoanFinancialTxn` 受控入口；`admin` 不得同时为 maker 与 checker）；**C1/D 负责落实执行** |
| Emergency authorization（HARDENING） | Gate B **硬化基础**（先于 C1/D）：申请时预绑定 `loanId + action + cents + currency`（`team_emergency_*` 新增列）；消费时逐项相等，否则拒绝且**不消费**；测试 |

## 9. 测试（自动化 · 强制）

### 9.1 D1 测试门禁（全部必须通过；本地 miniflare + 远程 Workers D1 两端）
| # | 测试 | 断言 |
|---|---|---|
| D1-1 | 远程 Workers D1 批回滚对等性 | 批中第 k 条语句失败 → 前 k−1 条全部回滚（与 miniflare 结果一致） |
| D1-2 | CAS 陈旧写者 | 两个持有同一 V 的写者：恰一个 `changes=1`；另一个所有守卫语句 no-op，无部分写入 |
| D1-3 | UNIQUE 冲突回滚 | `external_source_bindings` / `idempotency_key` 冲突 → 同批 `financial_version` 递增也回滚 |
| D1-4 | 并行财务过账 | N 个并发 `postRepayment` 同一贷款：账本合计 = 成功提交之和；无双过账；版本严格递增 |
| D1-5 | 并行还款 + 罚息计提 | 结果与某一串行顺序一致；`accrualBasis` 确定化 |
| D1-6 | 并行冲正 + 还款 | 单一确定结果；冲正不超原条目未冲正额 |
| D1-7 | 并行资金确认 + 结清 | 结清不会早于激活；无"未激活即结清"；并发首次资金确认恰一个创建财务状态行 |
| D1-8 | 批语句数/参数上限 | 实测单批最大语句数与单语句绑定参数上限（以开工时 Cloudflare 文档为准，并实测）；`withLoanFinancialTxn` 的最大批规模留 ≥50% 余量；超限 → 构造期拒绝 |
| D1-9 | 追加表触发器 | 对 `repayment_ledger`、`repayment_allocations`、`loan_charge_ledger`、`loan_financial_events`、`loan_financial_terms`、`funding_facts`、`delinquency_policies`、`loan_policy_bindings` 的 UPDATE/DELETE 均 `RAISE(ABORT)` |
| D1-10 | 跨贷款同一外部引用并发 | 两个不同贷款的批：恰一个绑定+过账 |
| D1-11 | **陈旧所有权声明 + 还款** | CAS 未命中 ⇒ `repayment_ledger`/`repayment_allocations` 新增 **0** 行 |
| D1-12 | **陈旧 + 计提** | `loan_charge_ledger` 新增 0 行 |
| D1-13 | **陈旧 + 冲正** | 冲正行 0 行；生命周期（阶段/`settled_at`）不变 |
| D1-14 | **陈旧 + 结清** | 阶段不变；无 `SETTLED` 事件 |
| D1-15 | **陈旧 + 资金确认** | 无 `funding_facts`、无 `loan_financial_terms`、无状态行创建 |
| D1-16 | **陈旧 + 任意事实组合**（逐表断言） | 事件、`external_source_bindings`、`financial_idempotency`、投影 均 0 变化（"FAILED OWNERSHIP CLAIM → ZERO SIDE EFFECTS"） |
| D1-17 | 守卫缺失探测（变异测试） | 人为移除任一语句的守卫，D1-11…16 至少一个失败（证明测试能抓到未守卫写入） |
| D1-18 | 提交断言 | 制造"CAS 命中但某事实语句影响行数 ≠ 期望"⇒ `financial_txn_assertions` NOT NULL 违例 ⇒ 整批回滚 |
| D1-19 | 陈旧写者不占用外部来源绑定 | 陈旧批不插入绑定；随后合法批可绑定同一引用 |

> 远程 D1 测试只在**专用非生产 D1 数据库**执行，需业主书面许可与凭据；不得使用生产库。

### 9.2 领域测试
- 位置计算：表驱动（本金/合同费/罚息/豁免/调整/还款/冲正）；任一分量不得为负。
- 结清/重开：remaining=0 → SETTLED；冲正后 remaining>0 → ACTIVE 且拖欠四分支；remaining 仍为 0 → 保持 SETTLED；`settled_at` NULL 而事件保留。
- 冲正阶段矩阵（61 §4.6.1）：ACTIVE / SETTLED / FUNDING_EXCEPTION（阶段不变）/ VOIDED（拒绝）；超额 → `ALREADY_REVERSED`；原条目缺失 → `NOT_FOUND`。
- 外部来源：同绑定幂等；异贷款/异金额/异币种/异客户 → `EXTERNAL_REFERENCE_CONFLICT` 且无过账；回填后保护不弱于 `team_repayment_receipts`。
- 条款：取自不可变合同快照；篡改工作区 JSON 不影响位置；`terms_hash` 不符 → 拒绝。
- 政策：未绑定 → `FINANCIAL_POLICY_UNBOUND`；>1 分量缺分摊顺序 → `ALLOCATION_POLICY_MISSING`；单分量可过账。
- 投影：滞后时读时叠加正确；`rebuildProjection` 幂等且与 SQL 一致。
- 遗留直写：SQL 权威贷款上 `repay/disburse/withdraw` 被拒绝；静态扫描无其它写财务表的代码。
- 安全：§8 各项测试。

### 9.2.1 冲正目标（B4 = CLOSED，冻结）
**普通冲正的目标 = 原始还款 CREDIT 条目，且仅限该类型。** 以下均**不是**合法的普通冲正目标：`REVERSAL` 条目 · 费用/罚息条目 · 豁免条目 · 调整条目 · 资金事实 · 任何无关账本事实。
**校验（`postReversal` 在 `build` 阶段与 SQL 守卫双重执行）**：①目标条目存在（否则 `NOT_FOUND`）；②目标位于 `repayment_ledger` 且 `direction='CREDIT'`；③目标未冲正余额 > 0；④请求冲正额 ≤ 未冲正余额（否则 `REVERSAL_NOT_ALLOWED`，`reason=ALREADY_REVERSED`）。目标为 `REVERSAL`/非还款类型 → 拒绝（沿用 `REVERSAL_NOT_ALLOWED`；`reason` 仅限契约白名单，故不带 `reason`，或 `NOT_FOUND`——实现取"不暴露账本内部类型"的 `NOT_FOUND`；**后续如需区分 → CR-012 增量，P2**）。
**冲正的冲正**：普通冲正路径**不支持**；纠正错误的 REVERSAL 需要**单独的受控会计更正契约/Gate**。
**数据库约束（纵深防御）**：`repayment_ledger` 触发器断言 `direction='REVERSAL'` 的行其 `reverses_entry_id` 指向 `direction='CREDIT'` 的行，且同贷款、同币种；`SUM(同目标 REVERSAL) ≤ 目标金额`。
**测试**：REVERSAL 作目标被拒；费用/豁免/调整/资金事实作目标被拒；跨贷款/跨币种目标被拒；超额被拒；部分冲正累计不超额；触发器直接 SQL 违规插入被拒。

### 9.3 迁移测试
- 空卷全量回放 0001→最新（standalone 迁移器与托管路径）。
- 既有卷（含 0041）升级至最新，回填可重复执行且结果一致。
- 触发器 `BEGIN…END` 切分回归；0030/0031 后审计表触发器仍生效。

## 10. 迁移前置（B0 · 独立执行包）
全新卷迁移 = **CONFIRMED OPEN**。B0 **不是** Gate B 本身，而是 Gate B 的前置执行包，完整计划（范围、执行者 Trae（须授权）、独立验收 Codex、入口/出口、回滚/恢复、托管迁移路径发现、测试）见 **`73-B0-fresh-volume-migration-recovery-plan.md`**。
**Gate B 在 B0 PASS（Codex 独立验收）之前不得提交任何 0042+ 迁移。**

## 11. Gate B Exit
- [ ] 财务账本与事件表存在且追加保护生效（D1-9）
- [ ] `financial_version` 存在；所有财务变更仅经 `withLoanFinancialTxn`（静态扫描）
- [ ] **【P0 出口】CAS 所有权守卫**：事务中每一条权威财务语句在因果与技术上均受"成功的财务所有权声明"守卫；陈旧写者产生 **ZERO 账本事实、ZERO 财务事件、ZERO 生命周期变更、ZERO 外部来源绑定、ZERO 财务投影变更**（D1-11…D1-19 全绿，含变异测试）
- [ ] 遗留贷款只读且旧路径封堵（L1–L8 全绿）；B2 规范化与 B4 冲正目标测试全绿
- [ ] 规范财务位置工作（领域测试全绿）
- [ ] 串行化工作（D1-1…D1-10 本地全绿；远程 D1 在许可后全绿）
- [ ] 可重建投影工作（叠加 + rebuild）
- [ ] 迁移测试全绿（空卷 + 升级 + 回填）
- [ ] **无客户还款端点启用；无真实放款启用；无罚息计提启用**（路由清单与特性开关断言测试）
- [ ] §8 安全项交付；回调重放 CLOSED；应急授权硬化 CLOSED；MFA 重绑测试 PASS；Admin 资金双人控制结论已落实
- [ ] Codex Gate B 验收 PASS

## 12. Rollback
- 迁移只增不删；回滚代码不需回滚表。
- 特性开关 `FIN_SQL_AUTHORITY_WRITES`（默认关；B 内仅测试开启）。关闭 → 所有财务写入 fail-closed（只读），读时叠加照常。
- **不支持**把已产生 SQL 财务事实的贷款回退为 JSON 权威；回滚手段是"冻结写入 + 修复前进"。
- 回填脚本幂等，可重复执行；若回填错误，以新增纠正行修复，不删除。

## 13. Entry criteria
Gate A PASS · **B0 PASS（73，Codex 独立验收）** · Codex 通过本计划 · 业主书面授权。（远程 D1 测试库是 **Gate B Exit** 的实施环境依赖，不是计划批准或开工的前提。）

## 14. P0 / P1 acceptance
| 级别 | 条件 |
|---|---|
| P0 | **任何权威财务写入未受所有权守卫、陈旧写者产生任何权威副作用**；任何路径双过账；一笔外部转账偿付两笔贷款；绕过 `settlement.ts` 改变 `closed/active`；JSON 投影被当作财务输入；客户还款/真实放款/罚息被启用；追加表可被改删 |
| P1 | D1 测试门禁任一失败或未在远程执行；CAS 失败出现部分写入；投影不可重建；条款读自工作区 JSON；遗留贷款可被新财务服务或旧路径写入；外部来源规范化缺失或含 loanId；普通冲正可指向 REVERSAL/非还款条目；B0 未关闭即提交新迁移；新增 CR-007 之外的财务阶段 |

## 15. Open items
| ID | 内容 | 分类 |
|---|---|---|
| ~~OD-B1~~ | 既有贷款处置 | **CLOSED（冻结）**：遗留只读、不自动迁移；转换需独立 Migration/Backfill/Reconciliation Gate（§7.1） |
| ~~OD-B2~~ | 外部来源规范化 | **CLOSED（冻结）**：§5.1 |
| OD-B3 | 专用非生产远程 D1 与凭据 | **IMPLEMENTATION ENVIRONMENT DEPENDENCY**（非业主/产品决策）；**Gate B Exit 前**必需，计划批准前不需要；**计划中不含任何凭据** |
| ~~OD-B4~~ | 冲正目标 | **CLOSED（冻结）**：普通冲正目标 = 原始还款 CREDIT 条目；冲正的冲正不支持（§9.2.1） |
| P2-1 | 遗留冻结/冲正目标类型错误是否需专用 `reason`/码 | CR-012 增量，不阻塞 |

## 16. Gate
```
Gate B plan: PROPOSED — READY FOR CODEX REVIEW
Precondition: B0 fresh-volume migration fix（CONFIRMED OPEN）
Implementation: NOT AUTHORIZED · Trae: HOLD
```
