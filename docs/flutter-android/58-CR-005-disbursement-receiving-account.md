# CR-005 · Disbursement & Receiving Account（放款与收款账户）

```
Status:     PROPOSED — READY FOR CODEX FINAL RE-REVIEW（v3，据 64 窄幅修复 P1-R3 + P2；未自批；不授权实施）
Version:    v3 · 2026-10-09（v2 备份：58-CR-005-disbursement-receiving-account.md.pre65.bak）
Owner:      Claude（契约起草）
Phase:      P7
Decisions:  DEC-3 = APPROVED（无客户钱包/提现，直接放款到收款账户）· ARC-2（放款指令创建后收款账户不可变）· DEC-1 = A
Depends:    CR-007 §3（共享财务权威：资金确认→ACTIVE 的移交、财务事务、position）· CR-004（回调框架/账本/幂等）· CR-012
Evidence:   HEAD d916b45，2026-10-09
```

**核心原则**：客户产品无钱包与提现；放款是"对一个已确认并锁定的收款账户的一次放款指令"；Android 只读，**不从本地动作推断成功**；整数美分；服务端权威；幂等；可审计；**只有权威资金确认才能使贷款 `active`**。

---

## 1. Problem（现状事实）
| # | FACT | 证据 |
|---|---|---|
| F1 | 贷款变 `active` 仅经 `disburse`：`needs(['signed'])` → `status='active'`、`wallet = billing.net ?? amount`、`dueAt = now + termDays×86400000`；记 '测试放款'/'放款预扣费用'/'到期费用' | `lib/domain.ts` |
| F2 | `withdraw`：`wallet>0` → '测试提现'（'无真实转账'）并清零；客户路径 403 | `lib/domain.ts`；`state/route.ts` |
| F3 | 员工放款链：`approve`→`approval_check`(→`signed`)→`disburse_request`(finance)→`disburse`(finance_checker，须异人，`assertFundingCapacity`)；另有 `admin_disburse`（Admin 单人，非测试需应急授权） | `lib/team/workflow.ts`；`admin-funds.ts` |
| F4 | 放款限额常量：日 1,000,000 / 月 3,000,000 美分（按 Asia/Phnom_Penh） | `lib/funding-limits.ts` |
| F5 | KYC 银行字段 `bankName/bankAccount/bankHolder`；`bankAccount` 自由文本无校验；payload AES-GCM；批准后客户不可改；员工 `amend` 强制 `needs_info` 并使 `revision` 递增（使放款守卫 409） | `lib/kyc/core.ts`；`server.ts` |
| F6 | **放款时没有收款账户概念**；放款记录无目的账户与外部参考号 | 检索 |
| F7 | 机构回调 `funding.confirmed`/`payment.failed` **只存储、无消费者**；回调入库重放缺陷见 CR-004 F9 | `lib/institution-event-plans.ts` |
| F8 | 存储事实：权威状态在同一 D1 数据库，`batch()` 为 SQL 事务；`demo_workspaces` 为每主体一行共享 JSON | 见 CR-007 F6/F7 |

## 2. 钱包与提现：冻结
`wallet` 仅内部/测试遗留；`withdraw` 永不进入客户 Android；放款成功不再表达为"进钱包"，而是"放款指令已确认到收款账户"。

## 3. Receiving Account
`ReceivingAccountRef { id, source('KYC'), bankCode, accountMasked, holderMasked, version, kycCaseId, kycRevision }`。完整账号仅在服务端（AES-GCM），**任何客户响应、日志、审计、回调回显、外部参考号路径**都不得出现完整账号。来源 KYC `bank` 分组；服务端**新增格式校验**（规则 OD-5.1）。KYC 修订变化 ⇒ 引用 `version` 失效。

## 4. 账户确认（冻结绑定字段）
**命令**：`POST /api/h5/loans/{id}/receiving-account/confirm`
```
{ requestId(幂等键), loanId, accountRefId, accountVersion, accountSnapshotHash, kycRevision }
```
### 4.0 账户确认资格（P1-R3，冻结：只有这两种路径可创建新的收款账户确认）
```
Case A  正常首次放款：  loan.status == signed
                        且 不存在任何活动（pending/processing）的放款指令

Case B  资金退回后重发： loan.phase == FUNDING_EXCEPTION
                        且 存在一个【已批准】的 REISSUE 解决单（FundingExceptionResolution，§6.5）
                        且 不存在任何其它活动的放款指令
```
- 其它任何阶段/状态（包括 `FUNDING_EXCEPTION` 而无已批准 REISSUE、`VOIDED`、`active` 正常期、`closed`）→ 拒绝创建确认：`DISBURSEMENT_NOT_AVAILABLE`（409，`details.reason` 为受控枚举，如 `FUNDING_EXCEPTION_NO_REISSUE`、`VOIDED`、`NOT_SIGNED`、`INSTRUCTION_ACTIVE`）。
- Case B 中，旧确认记录与旧账户快照**仅作历史**，**不得复用**：复用旧确认 → `RECEIVING_ACCOUNT_STALE`；客户必须对**当前有效的** `ReceivingAccountRef` 重新确认，且所有版本/有效期/KYC 修订校验照常适用。

**服务端必须校验以下全部相等，才创建确认记录**：`loanId`（属于当前客户，且满足 §4.0 的资格）、`accountRefId`、`accountVersion`（== 当前）、`accountSnapshotHash`（== 当前加密快照哈希）、`kycRevision`（== 贷款绑定的 KYC 修订）、幂等键（同键异载荷 → 409 `IDEMPOTENCY_PAYLOAD_MISMATCH`）。
**确认记录** `ReceivingAccountConfirmation`：`{ id, loanId, accountRefId, accountVersion, accountSnapshotHash, kycCaseId, kycRevision, requestId, confirmedAt, expiresAt, status ∈ {ACTIVE, EXPIRED, SUPERSEDED, CONSUMED} }`。
**放款指令必须引用这条确认记录**（即确切的已确认快照）。
### 4.1 有效期行为（冻结；时长数值为外部配置 OD-5.2）
- `expiresAt = confirmedAt + confirmationTtl`；`confirmationTtl` 为必配项，**缺失 ⇒ 创建放款指令失败关闭**。
- 过期（`EXPIRED`）⇒ **不能创建指令**，客户须对**当前**账户版本重新确认（返回 `RECEIVING_ACCOUNT_CONFIRMATION_EXPIRED`）。
- **任何** KYC/账户修订（`accountVersion`/`kycRevision` 变化）⇒ 确认**立即** `SUPERSEDED`，需重新确认（`RECEIVING_ACCOUNT_STALE`）。
- **无静默刷新**：确认记录不会自动续期或自动改绑。

## 5. 账户锁定（ARC-2，冻结）
> **一旦创建 DisbursementInstruction，该次放款的 `receivingAccountId`、`accountSnapshotHash`、`confirmationId` 不可变。**
- 创建之前：账号仅可在 KYC/校验策略下变更（回 `needs_info` 并使批准与确认失效）。
- 创建之后：**普通客户不可编辑**；更改必须走"取消 → 重新确认 → 重新下发"：
  1. 取消仅在指令 `pending`（未提交机构/银行）时允许，记录原因与审批；
  2. `processing` 及之后不可取消，只能等待 `confirmed/failed/returned`；
  3. 重新下发 = 新确认记录 + 新指令 id。
- **禁止静默替换**；全部变更写 append-only 审计。

## 6. 指令、状态机与贷款生命周期

### 6.1 DisbursementInstruction
`{ id, loanId, tenantId, amountCents(=net), currency, receivingAccountId, accountSnapshotHash, confirmationId, status, institutionId, externalReference?, providerOccurredAt?, requestedBy, checkedBy, failureCode?, createdAt, updatedAt }`
状态：`pending → processing → confirmed | failed | returned | cancelled`
| 自 | 到 | 触发 |
|---|---|---|
| — | pending | 员工 maker-checker 通过后创建（沿用 `disburse_request`/`disburse`；创建时校验 `assertFundingCapacity` 与 `ACTIVE` 确认记录） |
| pending | processing | 提交机构/银行（记录 `externalReference`） |
| processing | **confirmed** | 验真且绑定一致的 `funding.confirmed`，或受控人工确认（双人 + 银行参考号）→ 执行 §6.2 **资金确认批** |
| processing | failed | `payment.failed` / 人工标记（资金未离开） |
| confirmed | returned | `funding.returned`（资金退回）→ §6.4 |
| pending | cancelled | 取消（§5） |

### 6.2 `signed → active`（冻结的生命周期变更）
- 指令 `pending/processing` 期间 **`loan.status` 保持 `signed`**。
- **只有权威资金确认**才触发 `signed → active`；**任何员工点击本身都不能使贷款 active**。
- **REISSUE 情形**（§6.5）：贷款 `status` 已为 `active`、`phase=FUNDING_EXCEPTION`；新指令期间保持该状态；新指令的权威确认在同一财务批内清除 `FUNDING_EXCEPTION`（`phase → ACTIVE`）并追加 `terms_seq+1`，不重复 `signed → active`。
- 资金确认在**一个财务批**内完成（CR-007 §3.4）：`UPDATE instruction → confirmed` · 创建 `loan_financial_terms`（本金/合同费/期限/绑定政策**取自不可变的已接受合同/报价快照**，不取工作区 JSON；`funded_at`、`due_at`、`delinquency_policy_version`、本金/合同费、`terms_seq=1`）· 创建 `loan_financial_state(phase=ACTIVE, financial_version=1)` · 审计 · 通知 outbox（`disbursement.updated`）· 之后由投影器写 `status=active`、`dueAt`（读时叠加，CR-007 §3.2）。这也是**财务权威的移交点**（CR-007 §3.6）。
- 缺少已绑定政策版本 ⇒ 失败关闭（`FINANCIAL_POLICY_UNBOUND`）。

### 6.3 `fundedAt` / `dueAt`（OD-5.4 的默认冻结；**IMPLEMENTATION BLOCKER 直至业主/法务确认**）
```
fundedAt = 权威资金确认时间（系统接受已验真的确认的服务端时间；provider 的 occurredAt 另存为 providerOccurredAt 供审计）
dueAt    = fundedAt + 合同期限（termDays × 24h）
D        = localDate(dueAt)（Asia/Phnom_Penh，CR-007 §4）
```
理由：借款人不应在资金确认送达之前开始计时。若法务/产品条款明确规定其它规则，**必须在 P7 实施前冻结**；否则不得实施 P7 的资金流。**拖欠时钟在 `fundedAt/dueAt` 存在之前不启动**（CR-007）。

### 6.4 资金退回（`confirmed → returned`）——确定性语义
- **不新增 `Loan.status`**；使用**财务阶段**：`loan_financial_state.phase = FUNDING_EXCEPTION`（阻断型资金异常）。
- 同一财务批内追加**不可变事实**：`funding_return`（金额、原因、`externalReference`、`occurredAt`）；**不删除、不覆盖**既有"资金已确认"事实；放款会计通过**冲正行**表达，保留历史。
- **效果**（确定性）：① 还款资格**暂停**（`REPAYMENT_NOT_PAYABLE`，`details.reason=FUNDING_EXCEPTION`）；② 拖欠时钟/计提**暂停**（`delinquencyState=SUSPENDED`）；③ 兼容投影保持 `status:'active'` 但附带 `fundingException:true`，Android 以该标志覆盖展示（"放款退回，处理中"）；④ 结清被阻断；⑤ 若退回时账本已有客户还款（`repayment_ledger` 有贷方）⇒ 记 `blocksSettlement` 的对账异常，须人工财务处理。
- **解决路径**由一等对象 `FundingExceptionResolution` 驱动（见 §6.5），业务处置值 OD-5.3。
- **在 `FUNDING_EXCEPTION` 期间，不得让 `active` 贷款正常计息/计提。**

### 6.5 FundingExceptionResolution 与 REISSUE / VOID（P1-R3，冻结）
```
FundingExceptionResolution {
  id, loanId, type ∈ { REISSUE, VOID }, status ∈ { REQUESTED, APPROVED, EXECUTED, REJECTED, CANCELLED },
  requestedBy, approvedBy, reason, createdAt, approvedAt
}
```
具体持久化形态属实施层，**语义必须存在**。创建/批准需**双人控制 + MFA + 原因 + 审计**（FUNDING_DUAL_CONTROL_REQUIRED / STAFF_DUAL_CONTROL_REQUIRED / MFA_STEP_UP_REQUIRED）。

**REISSUE 流程（冻结，不复用旧确认/旧指令）**
```
funding.confirmed（loan active）
→ 之后 funding.returned
→ 追加不可变 funding_return 事实 + 冲正行（§6.4）
→ phase = FUNDING_EXCEPTION：还款禁用 · 拖欠计提禁用 · 结清禁用
→ 已批准的 REISSUE 解决单
→ （如有必要）客户经允许的 KYC 路径更新收款账户
→ 新的收款账户确认（新 confirmationId / accountVersion / accountSnapshotHash；§4.0 Case B）
→ 新的 DisbursementInstruction（引用新确认，不复用旧指令）
→ processing → confirmed（权威资金确认）
→ FUNDING_EXCEPTION 清除，phase 回到 ACTIVE；loan_financial_terms 追加 terms_seq+1（历史保留）；常规生命周期恢复
```
**新指令的创建资格**：仅当 ①`signed` 且为正常首次放款，或 ②`FUNDING_EXCEPTION` + 已批准 REISSUE + **新鲜有效**的账户确认。无其它例外。

**VOID 流程（冻结）**
```
已批准的 VOID 解决单
→ 不重发
→ phase = VOIDED（显式终态）
→ 无还款 · 无拖欠计提 · 无后续放款
```
对客户语义：**`VOIDED` 不是结清**——读模型使用独立展示态 `VOIDED`（`delinquencyState='VOIDED'` + `closedReason='FUNDING_VOID'`；兼容旧客户端的 `status` 投影为 `closed` 时必须同时携带 `closedReason`），不得表示为 `SETTLED`。`VOIDED` 贷款拒绝任何还款冲正（CR-007 §3.5.1）。

## 7. 资金回调（funding.confirmed / payment.failed / funding.returned）
- 认证/去重/重放：沿用 CR-004 §11（按机构密钥；±300 秒；**nonce 条件写入**；`eventId`/`idempotencyKey` 唯一；同键异载荷 409）；`funding.returned` 为新增事件类型。
- **绑定校验**：`loanId`、`instructionId`、`amount == net`、`currency`、账户绑定（回显 `accountSnapshotHash` 或账户尾号校验）；任一不符 → 不推进状态，进入异常队列。
- 消费者与 CR-004 共用框架；动作计划沿用 `expectedStatus`（`funding`→`signed`，REISSUE 时为 `active`+`FUNDING_EXCEPTION`+已批准 REISSUE；`returned`→`active`+`confirmed` 指令；`payment.failed`→`signed|active`）。
- 每次迁移经 CR-007 §3.4 财务事务，写审计。

## 8. Receipt / Reference
对客户（按需）：`status, amountCents, currency, receivingAccountMasked, externalReference（脱敏或隐藏，OD-5.5 默认：脱敏/隐藏）, confirmedAt, failureCode?`。

## 9. APIs（提案；错误码见 CR-012）
**客户**：`GET /api/h5/loans/{id}/disbursement` · `POST /api/h5/loans/{id}/receiving-account/confirm`。
**员工**：`POST /api/team/disbursements`（创建指令，承接 maker-checker）· `…/{id}/processing|confirm|fail|cancel` · 资金异常解决（`reissue|void`，双人）· `GET /api/team/disbursements?status=` · 异常队列。
**机构**：`POST /api/institution/callback`。**不新增**任何钱包/提现客户端点。

## 10. Android Read Model（P7）
```
disbursement: { status, amountCents, currency, receivingAccountMasked, externalReference?, confirmedAt?,
                failureCode?, canConfirmAccount, accountConfirmedAt?, confirmationExpiresAt?, fundingException? }
```
`outcome?`（`VOIDED` 时为 `'VOIDED'`，与 `fundingException` 互斥）；`failureCode ∈ {ACCOUNT_INVALID, BANK_REJECTED, TEMPORARY_FAILURE, RETURNED}`（CR-012 §7）；**无钱包余额**。

## 11. 向后兼容与迁移
- `wallet` 与 `withdraw` 仅保留于工作区 JSON（内部/测试）；客户路径继续 403。
- 新增表：`receiving_accounts`、`receiving_account_confirmations`、`disbursement_instructions`、`funding_return_facts`（后三者 append-only/状态迁移审计触发器）；`loan_financial_*` 见 CR-007。
- 测试模式下旧 `disburse` 可保留；生产模式走指令状态机；迁移含触发器，须通过迁移器回放测试。

## 12. 安全前置（据当前 HEAD 重新分类）
| 项 | 分类 |
|---|---|
| `admin_disburse` 单 Admin 资金权限 | **REQUIRES RE-VERIFICATION**（`admin` 仍不在 `highRiskRoles`） |
| 应急授权 | **PARTIALLY CLOSED — REQUIRES HARDENING**（一次性 ✓、MFA 批准 ✓、仅申请人 ✓；**未绑定贷款/动作/金额**，仅在消费时记录） |
| 回调重放仍插入事件；回调无消费者 | **CONFIRMED OPEN**（CR-004 F8/F9） |
| MFA 重绑 | **APPEARS CLOSED — TEST REQUIRED** |
| 迁移器：触发器 `BEGIN/END` 切分；`0030/0031` 与审计表冲突 | **CONFIRMED CLOSED** |
| 迁移器：**全新卷启动** | **CONFIRMED OPEN**（`0015` 注释含分号 → `splitSql` 误切 → 空卷启动失败；后端实施/发布门禁） |
| `bankAccount` 无格式校验 | **CONFIRMED OPEN**（OD-5.1） |
**真实放款不得在以上未复验前启用。**

## 13. 测试（契约）
确认记录绑定全部字段，任一不符被拒 · 过期不能建指令、需重新确认 · KYC/账户修订使确认立即失效 · 指令创建后账号不可变；取消/重发流程与审计 · `active` 仅在资金确认批内产生（员工点击无效）· `dueAt = fundedAt + term`；拖欠时钟在此之前不启动 · 回调绑定不符 → 异常 · 重复/重放回调不二次推进 · **`confirmed → returned` 后：还款被拒、计提暂停、`fundingException` 标志、结清被阻断、历史事实不被删除/覆盖** · REISSUE/VOID 双人审批 · 完整账号永不出现在客户响应/日志/审计 · D1 批回滚与并发交错。

**REISSUE / 账户确认资格**：`signed` 正常首次放款 → 确认允许 · `FUNDING_EXCEPTION` 无 REISSUE → 确认被拒（`DISBURSEMENT_NOT_AVAILABLE`/`FUNDING_EXCEPTION_NO_REISSUE`）· `FUNDING_EXCEPTION` + 已批准 REISSUE → 确认允许 · 复用旧确认 → `RECEIVING_ACCOUNT_STALE` · 新确认 → 新指令（不复用旧指令）· REISSUE 的 `confirmed` → `FUNDING_EXCEPTION` 清除、恢复 `active` 生命周期、`terms_seq+1` · 已存在其它活动指令时确认被拒 · VOID → 终态 `VOIDED`，无重发/还款/拖欠，读模型为 `VOIDED` 而非 `SETTLED` · REISSUE/VOID 需双人 + MFA · `loan_financial_terms` 取自不可变合同快照。

## 14. Open Decisions（分类）
| ID | 决策 | 分类 |
|---|---|---|
| OD-5.1 | 收款账户格式校验规则 | BLOCKS 账户校验实施；可在 P7 前由外部提供 |
| OD-5.2 | 账户确认有效期**时长** | 行为已冻结；时长为必配外部值，**缺失则失败关闭** → BLOCKS P7 实施直至配置 |
| OD-5.3 | 退回资金的业务处置（REISSUE/VOID 规则、与已收还款的处理） | **BLOCKS returned 转换实现与生产放款**；会计完整性（事实不可覆盖、阻断型异常）已冻结 |
| OD-5.4 | `fundedAt`/`dueAt`（计息起点） | **IMPLEMENTATION BLOCKER**（默认已冻结，待业主/法务确认） |
| OD-5.5 | 外部参考号是否对客户展示 | CAN REMAIN OPEN（安全默认：脱敏/隐藏） |

## 15. Gate
```
CR-005 v2: PROPOSED — READY FOR CODEX RE-REVIEW；Implementation: NOT AUTHORIZED；Trae = HOLD
```
