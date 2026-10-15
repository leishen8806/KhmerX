# CR-007 · Overdue / Penalty / Fee Model + Shared Financial Authority（逾期、罚息、费用与共享财务权威）

```
Status:     PROPOSED — READY FOR CODEX FINAL RE-REVIEW（v3，据 64 窄幅修复 P1-R2 + P2；未自批；不授权实施）
Version:    v3 · 2026-10-09（v2 备份：60-CR-007-overdue-penalty-fee-model.md.pre65.bak）
Owner:      Claude（契约起草）
Phase:      P8（逾期）；本文 §3 的"共享财务权威"同时是 CR-004 / CR-005 的唯一引用来源
Decisions:  拖欠（delinquency）与贷款生命周期**正交**——已被评审接受，**不重开**
Consumers:  Backend · Android(Flutter) · 贷后/催收 · 财务 · QA · Compliance/Legal
Evidence:   HEAD d916b45，2026-10-09
```

**目标**：逾期完全由服务端权威；Android 不计算、不发明任何逾期/罚息政策。**纪律**：不硬编码任何费率/宽限期/监管上限/分摊顺序——它们是**不可变政策版本**中的外部输入；缺省行为安全（`NONE`/禁用）。

---

## 1. Problem（现状事实）
| # | FACT | 证据 |
|---|---|---|
| F1 | `dueAt = 放款时间 + termDays×86400000`；`active` 期间无逾期状态 | `lib/domain.ts` disburse |
| F2 | 日历 UTC+7（Asia/Phnom_Penh）：`localDay()`/`dayGap()`；**到期当天不算逾期** | `lib/postloan/core.ts` |
| F3 | 贷后任务：日差 0 → `stage='due'`；<0 → `'overdue'`；仅用于催收任务，不改金额 | 同上 |
| F4 | `overdue` 动作（ops）仅测试：`demoDays ∈ {0,3,4,16}`，只改备注与 `demoDays` | `lib/domain.ts` |
| F5 | **无罚息/滞纳金字段或计算**；`outstanding = amount + fee − paid` | `lib/pricing.ts`；`lib/postloan/core.ts` |
| F6 | **存储事实**：全部权威状态在同一个 D1 数据库（Workers `env.DB`；本地 miniflare `getD1Database('DB')`）；D1 `batch()` 为 SQL 事务（平台语义，**须由自动化测试证明回滚**）；现有资金路径已用批内条件链 `INSERT … WHERE changes()=1`（`admin-funds.ts`、`workflow.ts`） | `deploy/standalone/server.mjs`；`lib/team/admin-funds.ts` |
| F7 | `demo_workspaces` 是**每个运营主体仅一行**的 JSON 文档（含该主体**全部客户**的贷款），行级 `revision` CAS，最多重试 4 次 | `lib/store.ts`；`workflow.ts` |

## 2. 决策（不重开）：拖欠为独立维度，`Loan.status` 不新增 `overdue`
贷款生命周期（`kyc_approved…signed→active→closed`，CR-005 之后 `active` 仅由权威放款确认产生）与 `LoanDelinquency` 是两个正交维度；`active` 期间叠加拖欠状态。测试用 `overdue` 动作在生产停用。

## 3. 共享财务权威（Financial Authority）—— CR-004/005/007 的唯一来源

### 3.1 权威链（冻结）
```
合同/定价事实 + 绑定的政策版本（loan_financial_terms，不可变）
+ loan_charge_ledger（罚息/费用/豁免/调整）
+ repayment_ledger（CR-004，含分摊明细）
+ 资金事实（disbursement_instructions，CR-005）
        ↓
calculateFinancialPosition(loanId, asOf)   ← 唯一财务计算
        ↓
loan_financial_state（阶段/版本/结清）──→ 生命周期投影（active/closed）
        ↓
API 读模型（读时叠加）  →  Android
```
**绝不**以 Android、工作区 JSON、通知数据作为财务权威。

### 3.2 存储模型（据 F6/F7 选择）
- **权威 = D1 SQL 表**；`demo_workspaces.payload` 中的 `paid/status/dueAt/entries` 降为**兼容投影**（可重建）。
- **不把财务提交与工作区 JSON 放进同一事务**：工作区是"每主体一行、共享 CAS"的文档，把每笔财务提交绑到它的 `revision` 上会令同一主体内所有贷款串行化，并让财务提交因无关编辑而失败。因此：
  1. **财务提交**（账本行 + `loan_financial_state` CAS + 审计 + 通知 outbox）= **一个 D1 批事务**；
  2. **投影**在提交后更新 `payload`（幂等、带 `projectedFinancialVersion`，失败可重试），并有 `rebuildProjection(loanId)` 从事实重建；
  3. **读时叠加（overlay）**：`GET /api/h5/state` 等读取路径对每笔已放款贷款，用 SQL 权威覆盖 `paid/status/dueAt/remaining*`，所以投影滞后**永不**被当作财务真相；JSON 与账本不一致时**账本为准**。
- **表**：
  - `loan_financial_terms`（不可变）：`(loan_id, terms_seq) PK, tenant_id, principal_cents, contract_fee_cents, term_days, currency, delinquency_policy_version, allocation_order_ref, funded_at, due_at, due_local_date, contract_snapshot_id, terms_hash, created_at`——在**资金确认批**中创建（CR-005）。**其本金、合同费、期限、绑定政策版本只能取自不可变的已接受合同/报价快照**（`kyc_contracts.termsSnapshot` / Quote 快照，`contract_snapshot_id` 引用之，`terms_hash` 校验），**绝不**取自可变的工作区 JSON（`demo_workspaces.payload`）。`terms_seq` 递增（首次放款为 1；REISSUE 追加新版，历史保留，仅最新版生效）。
  - `loan_financial_state`（控制行）：`loan_id PK, financial_version, current_terms_seq, phase ∈ {ACTIVE, FUNDING_EXCEPTION, SETTLED, VOIDED}, settled_at?（**当前**结清标记，重开后为 NULL）, blocking_exceptions, updated_at`。
  - `loan_financial_events`（append-only，触发器保护）：`(loan_id, seq) PK, type ∈ {FUNDED, SETTLED, REVERSAL_APPLIED, REOPENED, FUNDING_RETURNED, FUNDING_REISSUED, VOIDED, …}, financial_version, ref（账本/指令/批准单引用）, actor, at`——**永久保留**"曾经结清"等历史，当前投影字段可被取代，历史不可删改。
  - `loan_charge_ledger`（§7）；`repayment_ledger`（CR-004）。账本表 append-only（触发器 `RAISE(ABORT)`）。

### 3.3 `calculateFinancialPosition(loanId, asOf)`
一个服务端函数，输入 `loan_financial_terms` + 两本账本 + 阶段，输出：
```
components: { PRINCIPAL, CONTRACT_FEE, PENALTY, LATE_FEE } 各自 {billed, credited, outstanding}
principalOutstanding · contractFeeOutstanding · chargeBalance
amountDueNowCents · remainingCents
settlementEligible: boolean   // remaining==0 且 phase!=FUNDING_EXCEPTION 且 blocking_exceptions==0
```
- `outstanding(c) = base(c) + ΣDEBIT(c) − ΣCREDIT(c) − Σrepayment 分摊(c) + Σ冲正分摊(c)`，且 **任一分量不得为负**。
- 当前产品为**单期一次性到期**，故 `amountDueNowCents = remainingCents`；未来分期需另立契约扩展。
- Android 与其它 CR **不得**自行计算；CR-004 的 `remainingCents`、`amountDueNowCents`、可分摊分量均来自本函数。

### 3.4 财务串行化规则（单一边界）
对一笔贷款的下列变更**必须**经同一 **loan 级财务事务**：还款过账 · 罚息计提 · 豁免 · 调整 · 冲正 · 资金确认/退回 · 结清。
```
1. 读取 loan_financial_state.financial_version = V，并据此计算 position
2. 在应用层确定要追加的事实（含分摊）
3. D1 批：
   UPDATE loan_financial_state SET financial_version=V+1, phase=?, settled_at=? WHERE loan_id=? AND financial_version=V;
   INSERT <ledger/fact rows> … WHERE changes()=1;          -- 条件链
   INSERT team_audit … WHERE changes()=1;
   INSERT notification_events/outbox … WHERE changes()=1;  -- CR-006
4. changes()==0（CAS 失败）→ 从权威账本重读并重算，最多 N 次；仍失败 → 409 REVISION_CONFLICT
5. 幂等键 UNIQUE 冲突 → 整批回滚 → 重读并返回既有结果（幂等成功），不二次入账
```
- **幂等 ≠ 并发控制，二者都需要**：幂等键防"同一意图重复入账"；`financial_version` 防"两个不同的合法操作同时改写同一贷款的财务状态"。
- 任何两个操作不得各自独立地决定 `closed`（§3.5）。
- 验收证据：并发测试（回调/人工确认/计提/豁免/冲正/结清交错）证明无双过账、无错误结清；D1 批回滚测试（在 Workers D1 与本地 miniflare 均须通过）。

### 3.5 结清（唯一权威）
**只有共享的财务结清逻辑可以把已放款贷款转入 `closed`。** 条件：`settlementEligible`——重算后的 `remaining == 0`（含本金、合同费用、罚息/费用、豁免/调整、还款与冲正），且无未解决的资金/对账异常阻塞。CR-004 与 CR-007 **均不得**单独修改 `loan.status=closed`；结清在**同一财务批**内设置 `phase=SETTLED`，生命周期投影随后写 `closed`。

### 3.5.1 对已结清贷款的冲正 = 受控重开（P1-R2，冻结）

> 不可变会计必须允许更正已确认的还款。**对 `SETTLED` 贷款的冲正 = 受控重开（CONTROLLED REOPEN）**，而不是被静默禁止。

**重开权威**：**只有共享财务结清引擎**可以执行 `closed → active`（作为已批准冲正的逆向后果）；任何 API/控制器/领域层捷径**不得**直接重开贷款。

**前置**（缺一不可）：已批准的 `REVERSAL`（双人控制/maker-checker）· MFA 步进 · 必填原因 · 引用原账本条目 · 幂等键 `man:{requestId}` · 审计。不规定数值阈值（OD-4.3）。冲正金额 ≤ 原条目**尚未被冲正**的金额。

**同一财务事务内的原子顺序**（loan 级 CAS，§3.4）：
```
校验已批准的冲正
→ 追加 REVERSAL 账本条目（含按原分摊反向的 allocations）
→ calculateFinancialPosition 重算
→ 若 remainingCents > 0：
      phase  SETTLED → ACTIVE
      settled_at := NULL（当前标记清除；历史保存在 loan_financial_events）
      追加事件 REVERSAL_APPLIED + REOPENED（SETTLED 事件原样保留，其时间戳不丢）
      拖欠状态按【原合同到期日 + 不可变绑定政策 + 当前 Asia/Phnom_Penh 本地日期】重算
      生命周期投影 closed → active（仅经此路径）
  否则（remaining 仍为 0）：保持 closed，仅追加 REVERSAL_APPLIED
→ financial_version + 1
→ 提交
```
**重开后的拖欠状态（绝不无条件 `SETTLED → CURRENT`）**：重开于到期日前 → `CURRENT`；到期日当天 → `DUE_TODAY`；宽限期内 → `IN_GRACE`；宽限期后 → `OVERDUE`（§4 公式）。
**计提不追溯**：计提只覆盖 `phase=ACTIVE` 的日期；贷款处于 `SETTLED`/`SUSPENDED` 的区间**不补算**罚息（区间由 `loan_financial_events` 推导）；重开后自下一计提日起恢复。
**`VOIDED`**：`VOIDED` 贷款**不可**经还款冲正重开；任何修正须走正常冲正路径之外的行政/会计专门流程 → 冲正命令返回 `REVERSAL_NOT_ALLOWED`（`details.reason=VOIDED`）。
**`FUNDING_EXCEPTION`**：允许冲正（用于处理退回时已有还款的情形），但**不改变阶段**，亦无重开。
**并发**：冲正与还款均 CAS 于 `financial_version`；先提交者胜，后者基于新账本重算，结果唯一确定。
**重复冲正**：同键同载荷 → 幂等既有结果；对同一原条目超额冲正 → `REVERSAL_NOT_ALLOWED`（`reason=ALREADY_REVERSED`）；原条目不存在 → `NOT_FOUND`。

### 3.6 权威移交
| 阶段 | 权威 |
|---|---|
| 申请→审批→待放款（`kyc_approved…signed`） | 工作区 JSON + KYC（现状，员工 CAS） |
| **资金确认之后**（`active`/`closed`/资金异常） | **SQL 财务权威**（`loan_financial_*` + 账本）；JSON 仅投影 |
移交发生在 CR-005 的"资金确认批"内（创建 `terms` + `state(phase=ACTIVE)`）。

### 3.7 遗留路径
生产模式下，`applyAction` 对**已放款贷款**的 `repay`/`disburse`/`overdue`/`withdraw`、以及任何直接写 `paid`、`closed`、`entries` 的路径**失败关闭**；契约测试 + 静态扫描证明"生产财务变更只有一条写路径"。测试模式隔离保留。

## 4. 日期算术（冻结）
```
D = 合同到期本地日期（Asia/Phnom_Penh，固定 UTC+7，无夏令时）= localDate(dueAt)
G = graceDays（整数 ≥ 0，来自绑定的政策版本）
T = 当前本地日期

T <  D              → CURRENT
T == D              → DUE_TODAY
D <  T <= D + G     → IN_GRACE
T >  D + G          → OVERDUE

daysPastDue = max(0, T − D)             // 自到期日起（信息性）
daysOverdue = max(0, T − (D + G))       // 自宽限期结束起；首个 OVERDUE 日 = 1
```
| G | T=D−1 | T=D | T=D+1 | T=D+2 | T=D+3 | T=D+4 |
|---|---|---|---|---|---|---|
| 0 | CURRENT | DUE_TODAY | OVERDUE(1) | OVERDUE(2) | OVERDUE(3) | OVERDUE(4) |
| 3 | CURRENT | DUE_TODAY | IN_GRACE | IN_GRACE | IN_GRACE | **OVERDUE(1)** |
- G=0：`D` 为 `DUE_TODAY`，`D+1` 为首个逾期日；G=3：`D+1…D+3` 为 `IN_GRACE`，`D+4` 为首个逾期日。
- 测试须表驱动覆盖上表及跨 UTC+7 午夜的边界。

## 5. 拖欠状态与还款后的行为
`LoanDelinquency.state ∈ { CURRENT, DUE_TODAY, IN_GRACE, OVERDUE, SETTLED, SUSPENDED, VOIDED }`（**冻结表示方式：对象始终存在**；`SETTLED` = 财务结清；**`VOIDED` = 资金退回后经批准作废的终态，是独立展示态，不是结清**，客户语义上**不得**表示为"成功结清"）。
- 状态由 **日期 + 宽限政策 + `remainingCents`** 推导；`remainingCents > 0` 时：
  - **到期后的部分还款不会让贷款回到 `CURRENT`**——状态仍由 §4 的日期规则决定（`IN_GRACE`/`OVERDUE`）；
  - 到期前的部分还款状态保持 `CURRENT`。
- `remainingCents == 0` → 结清逻辑（§3.5）执行；状态 `SETTLED`（**已关闭的贷款永远不会显示 `CURRENT`**）。已结清贷款经**受控重开**（§3.5.1）后按日期重算，不会无条件变为 `CURRENT`。
- `phase = VOIDED` → 状态 `VOIDED`：无还款、无计提、无后续放款（CR-005 §6.4）。
- `phase = FUNDING_EXCEPTION`（CR-005 资金退回）→ `SUSPENDED`：暂停计提与催收时钟，直至资金异常解决。
- 不自动核销/坏账（Write-off 不在本 CR）。

## 6. 政策与版本绑定
### 6.1 政策版本（不可变）
`delinquency_policy_version`：`{ id, tenantId, version, effectiveFrom, graceDays, penaltyModel ∈ {NONE, FLAT_ONE_TIME, DAILY_FLAT, DAILY_RATE_BPS}, penaltyBasis, rateBps?, flatCents?, maxPenaltyCents?, maxPenaltyBps?, allocationOrder: ComponentList, rounding, accrualCalendar, accrualBasis ∈ {OPENING_BALANCE, CLOSING_BALANCE} }`。已发布版本**只读**；新规则 = 新版本，仅适用于其后创建的贷款。
### 6.2 绑定时点（冻结）
> **政策版本在合同生成/签约之前被绑定进客户合同**（宽限/罚息条款属客户合同条款）。绑定后 `loan.delinquencyPolicyVersion` **终身不可变**；任何账期/计提只使用该版本，**不使用"每个计提日当前生效的政策"**；不得追溯重新定价（除非另有经授权的法务迁移）。
- 依赖登记：**P3 / CR-001**——Quote 须携带 `delinquencyPolicyVersion` 与 `allocationOrder` 引用；`create` 绑定；`POST /api/loan/sign` 的合同快照与 `kyc_contracts.termsSnapshot` 含政策条款；放款确认时复制进 `loan_financial_terms`。在 P3 未能绑定之前，生产不得创建携带罚息的贷款（测试模式除外）。
### 6.3 缺省
- **区分**：①"未配置任何政策" ②"贷款已绑定的政策其 `penaltyModel = NONE`"。生产贷款必须具备**确定的已绑定版本**（可为 `NONE`）；**无绑定版本 → 失败关闭**：还款/计提/资金确认返回 `FINANCIAL_POLICY_UNBOUND`（CR-012）。
- `NONE` 仍产生拖欠**状态**与天数，不产生罚息。
### 6.4 分摊顺序
- `allocationOrder` = **组件有序列表**（组件 ⊆ `{PENALTY, LATE_FEE, CONTRACT_FEE, PRINCIPAL}`），属于**绑定的不可变政策版本**；**本 CR 不选择具体顺序**（需业主/法务）。
- 过账时按绑定顺序逐一冲抵（记录到账本 `allocations[]`）。
- **失败关闭**：当某笔贷款有 **>1 个**未清应付分量而 `allocationOrder` 缺失/无效 ⇒ 还款过账返回 `ALLOCATION_POLICY_MISSING`；仅有 **1 个**应付分量时分摊是确定的，无需政策。
- 分类：**OD-7.3 = BLOCKS PRODUCTION FINANCIAL POSTING**（结构已冻结，数值不发明）。

## 7. 费用账本 `loan_charge_ledger`（append-only）
`{ id, loanId, direction ∈ {DEBIT, CREDIT}, amountCents（正整数）, chargeType ∈ {PENALTY, LATE_FEE, WAIVER, ADJUSTMENT}, component ∈ {PENALTY, LATE_FEE, CONTRACT_FEE, PRINCIPAL}, accrualDate?, policyVersion, reversesEntryId?, reason?, actor('system'|staff), idempotencyKey UNIQUE, createdAt }`
- **方向显式**：`PENALTY/LATE_FEE` 通常 `DEBIT`；`WAIVER` 通常 `CREDIT`；`ADJUSTMENT` 必须显式声明方向与目标分量；**不以负数符号表达会计方向**。
- **幂等键（互相独立）**：
  - 自动计提：`acc:{loanId}:{policyVersion}:{component}:{accrualDate}`；
  - 手工豁免/调整/冲正：`man:{requestId}`（显式幂等键，支持同日多次合法调整）。
- 冲正 = 反方向新行 + `reversesEntryId`，**不修改历史**。

## 8. 计提与同日确定性
- 计提为财务事务（§3.4）；定时任务（沿用 `POSTLOAN_JOB_SECRET`）幂等可补算。
- **同日竞态**：`accrualBasis` 为政策属性（取值需外部输入，OD-7.6）：
  - `OPENING_BALANCE`：计提日 `T` 的基数取 `T` 本地零点之前已过账的账本事实（与同日还款先后无关）；
  - `CLOSING_BALANCE`：仅在 `T` 结束后（`T+1` 本地时间）执行计提。
  两种方式均为确定性的；顺序以 `financial_version` 提交顺序为准。
- 结清当日是否计提、封顶：政策属性；`NONE` 下无计提。

## 9. 豁免 / 调整
仅员工；理由必填；**双人审批 + MFA**；写入账本（§7）；经财务事务；不得改写历史；审计记录 `actor/role/理由/前后位置摘要`。

## 10. API / Android 读模型（读时叠加）
`GET /api/h5/state` 每笔已放款贷款新增可选对象（旧客户端忽略）：
```
repaymentBill: {
  currency, principalCents, contractFeeCents, penaltyCents, paidCents,
  amountDueNowCents, remainingCents,
  dueAt, graceDays, daysPastDue, daysOverdue,
  delinquencyState ('CURRENT'|'DUE_TODAY'|'IN_GRACE'|'OVERDUE'|'SETTLED'|'SUSPENDED'|'VOIDED'),
  closedReason?   // 如 'FUNDING_VOID'，VOIDED 时必出
  policyVersion, financialVersion
}
```
- Android **只展示**；`remainingCents` 取代客户端派生 `max(0, amount+fee−paid)`（旧派生仅作兼容回退）。
- 逾期文案由 `delinquencyState` + 天数本地化组合；不展示员工文本；`Loan.status` 不新增值。

## 11. 贷后任务统一
`runPostloan` 改读 `LoanDelinquency`/`calculateFinancialPosition`，使用同一日历与边界，消除重复计算；催收阶段/桶由同源推导；`SUSPENDED`/`SETTLED` 自动关闭或暂停任务。

## 12. 测试（契约）
§4 表驱动 · 到期后部分还款仍 `IN_GRACE/OVERDUE` · 到期前部分还款 `CURRENT` · 结清为 `SETTLED` 且永不显示 `CURRENT` · `SUSPENDED` 暂停计提 · 计提幂等（自动键）与手工多次调整不冲突 · 方向/符号语义 · 政策版本终身不变（全局政策变更不影响既有贷款）· 未绑定 → `FINANCIAL_POLICY_UNBOUND` · 分摊缺失（>1 分量）→ `ALLOCATION_POLICY_MISSING`，单分量可过账 · **并发交错（还款/计提/豁免/冲正/结清）无双过账、无错误结清** · D1 批回滚 · 投影滞后时读时叠加仍正确，`rebuildProjection` 一致 · 生产遗留直写被拒绝 · `OPENING/CLOSING_BALANCE` 同日确定性。

**冲正/重开**：已结清+冲正后 remaining=0 → 仍 closed · 已结清+冲正使 remaining>0 → `active` 且拖欠重算（到期前 CURRENT / 当天 DUE_TODAY / 宽限内 IN_GRACE / 宽限后 OVERDUE）· 重开不追溯计提已结清区间 · 重复冲正不重复入账 · `VOIDED` 冲正被拒（`REVERSAL_NOT_ALLOWED`）· 冲正与还款并发 → 单一确定结果 · `settled_at` 重开后为 NULL 而 `loan_financial_events` 保留原结清事件 · `terms` 取自不可变合同快照（工作区 JSON 被篡改不影响财务位置）。

## 13. 向后兼容与迁移
新增 `loan_financial_terms`、`loan_financial_state`、`loan_charge_ledger`、`delinquency_policy_version`（+ CR-004 的 `repayment_ledger`）；`Loan.status` 不变；`demoDays`/`overdue` 动作仅测试；既有 `active` 贷款（测试期）在迁移时一次性生成 `terms/state`（或保持测试模式隔离）。迁移含触发器，须通过迁移器回放测试。

## 14. 安全前置（据当前 HEAD 重新分类；不照搬旧审计）
| 项 | 分类 |
|---|---|
| 员工资金/调整权限控制 | **REQUIRES RE-VERIFICATION**（`admin` 仍不在 `highRiskRoles`；`admin_disburse/admin_repay` 单 Admin 可发起，受应急授权约束） |
| 应急授权 | **PARTIALLY CLOSED — REQUIRES HARDENING**（一次性 ✓、MFA 批准 ✓、仅申请人 ✓；**未绑定贷款/动作/金额**，`loanId/action/cents` 仅在消费时记录） |
| MFA 重绑 | **APPEARS CLOSED — TEST REQUIRED**（`mfa_enroll_start` 现已在启用 MFA 时要求步进，且使用待确认密钥） |
| 迁移器：触发器 `BEGIN/END` 切分 | **CONFIRMED CLOSED** |
| `0030/0031` 与只追加审计表冲突 | **CONFIRMED CLOSED** |
| 迁移器：**全新卷启动** | **CONFIRMED OPEN**（`0015_admin_password.sql` 注释含分号，`splitSql` 不识别注释 ⇒ `see 0030….sql.` 被当作语句 ⇒ 空卷启动失败；后端实施/发布门禁；本契约新增触发器迁移前必须关闭） |
真实罚息不得在以上未重新核验、且 OD-7.1/7.2 未提供之前启用。

## 15. Open Decisions（分类）
| ID | 决策 | 分类 |
|---|---|---|
| OD-7.1 | 是否收取罚息/滞纳金；模型与费率；监管上限 | CAN REMAIN OPEN（`NONE` 安全）；**BLOCKS PRODUCTION** 真实罚息 |
| OD-7.2 | 宽限天数；催收桶边界 | **BLOCKS PRODUCTION** 拖欠策略（边界算法已冻结，数值外部） |
| OD-7.3 | 分摊顺序 | **BLOCKS PRODUCTION FINANCIAL POSTING**（>1 应付分量时）；架构已冻结 |
| OD-7.4 | 计提日历（节假日）与舍入 | BLOCKS 罚息计提实现（仅状态模式可先行） |
| OD-7.5 | 豁免/减免审批规则；核销 | BLOCKS 豁免/核销路径（`NONE` 基础模式可先行） |
| OD-7.6 | 同日计提基数（`accrualBasis`）及结清日是否计提 | BLOCKS 罚息计提实现（机制已冻结，选择为外部输入） |

## 16. Gate
```
CR-007 v2: PROPOSED — READY FOR CODEX RE-REVIEW；Implementation: NOT AUTHORIZED；Trae = HOLD
```
