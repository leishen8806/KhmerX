# CR-012 Final Alignment

```
Document:  67-CR-012-final-alignment.md
Date:      2026-10-09
Owner:     Claude（契约对齐；不自批）
Status:    PROPOSED — READY FOR CODEX FINAL DELTA REVIEW
Identity:  PROJECT IDENTITY CHECK: PASS · KhmerX · E:\KhmerX\KhmerX · git@github.com:leishen8806/KhmerX.git · HEAD d916b4515a93057d7dd2a0673ebbca39a7bfd242
Backups:   61-CR-012-state-error-registry.md.pre67.bak · 65-backend-cr-bundle-final-repair.md.pre67.bak
Scope:     仅 61（→ v3.1）与 65（追加一条对齐说明）。57/58/59/60、02/45/55 未修改。无新错误码。未写代码。
```

## Source Review
`66-backend-cr-bundle-final-rereview.md` — FAIL，P0 = 0，P1 = 1（P1-CROSS-1）。P1-R1/R2/R3 已被 66 判定 CLOSED。

## Remaining P1
CR-012 与 CR-007 的冲正语义冲突：61 v3 `REVERSAL_NOT_ALLOWED.details.reason` 含 `FUNDING_EXCEPTION`，而 CR-007 §3.5.1 明确"`FUNDING_EXCEPTION`：允许冲正，不改变阶段，亦无重开"。

## Before（61 v3）
- `REVERSAL_NOT_ALLOWED` reason ∈ `{VOIDED, ALREADY_REVERSED, NOT_A_CREDIT, FUNDING_EXCEPTION}` —— `FUNDING_EXCEPTION` 被错误归为冲正禁止原因。
- `NOT_A_CREDIT` 在 CR-004/CR-007 中**无出处**（自行发明的禁止条件）。
- §9 覆盖矩阵把"员工确认/驳回/冲正"合并为一行，并列 `FUNDING_EXCEPTION_ACTIVE` ⇒ 暗示冲正在资金异常期被阻断（与 CR-007 冲突的第二处）。
- `details.reason` 白名单为全局扁平列表，取值可跨码借用。

## After（61 v3.1）
- `REVERSAL_NOT_ALLOWED` reason ∈ **`{VOIDED, ALREADY_REVERSED}`**，两者均直接出自 CR-007 §3.5.1（`VOIDED`；对同一原条目超额冲正）。
- 新 §4.6.1 冲正错误语义：阶段矩阵 + 前置失败→既有码映射；`FUNDING_EXCEPTION` 走普通受控冲正规则，**不得**因阶段返回 `REVERSAL_NOT_ALLOWED` 或 `FUNDING_EXCEPTION_ACTIVE`。
- `FUNDING_EXCEPTION_ACTIVE` 定义加注"不适用于受控冲正"。
- §9 矩阵拆分为"员工确认/驳回"（保留 `FUNDING_EXCEPTION_ACTIVE`——CR-004 还款过账要求 `phase=ACTIVE`）与"冲正"（无阶段错误）。
- §5 `details.reason` 改为**按错误码限定取值**，禁止跨码借用：`REPAYMENT_NOT_PAYABLE` → FUNDING_EXCEPTION/SETTLED/NOT_FUNDED/VOIDED；`DISBURSEMENT_NOT_AVAILABLE` → FUNDING_EXCEPTION_NO_REISSUE/VOIDED/NOT_SIGNED/INSTRUCTION_ACTIVE；`REVERSAL_NOT_ALLOWED` → VOIDED/ALREADY_REVERSED。
- §11 测试补充冲正阶段矩阵夹具。

## Error Matrix
| 阶段 | 冲正 | 生命周期效果 | 仅因阶段的错误 |
|---|---|---|---|
| ACTIVE | 按财务规则（受控冲正前置） | 无阶段变化 | 无 |
| SETTLED | 已批准冲正可触发受控重开 | remaining>0 → `closed→active`，拖欠按原到期日+绑定政策+当前 Asia/Phnom_Penh 日期重算；否则保持 closed | 无 |
| FUNDING_EXCEPTION | 财务前置通过即允许 | 不变阶段、不重开 | **无** |
| VOIDED | 禁止 | — | `REVERSAL_NOT_ALLOWED(reason=VOIDED)` |

受控冲正前置失败（复用既有码，无新增）：
| 失败 | code |
|---|---|
| 原账本条目不存在 | `NOT_FOUND` 404 |
| 超过原条目未冲正金额 | `REVERSAL_NOT_ALLOWED(reason=ALREADY_REVERSED)` 409 |
| 未获批准 / maker-checker 未满足 | `STAFF_DUAL_CONTROL_REQUIRED` 403 |
| MFA 步进 | `MFA_STEP_UP_REQUIRED` 403 |
| 幂等键异载荷（同载荷 → 返回既有结果） | `IDEMPOTENCY_PAYLOAD_MISMATCH` 409 |
| `financial_version` CAS 有界重试耗尽 | `REVISION_CONFLICT` 409（CR-007 §3.4 第 4 步） |

## Cross-Contract Check
| 规则 | CR-004（57） | CR-007（60，权威） | CR-012（61 v3.1） | 结论 |
|---|---|---|---|---|
| 冲正前置：双人+MFA+原因+原条目+幂等 | §2、§9 | §3.5.1 前置 | §4.6.1 映射到既有码 | 一致 |
| SETTLED 冲正 = 受控重开 | §2、§9 指向 CR-007 | §3.5.1 原子顺序 | 矩阵：无阶段错误 | 一致 |
| FUNDING_EXCEPTION 冲正允许、不变阶段 | 未禁止（仅还款过账要求 ACTIVE） | §3.5.1 明文允许 | 矩阵：无阶段错误；`FUNDING_EXCEPTION_ACTIVE` 不适用 | **一致（已修正）** |
| VOIDED 冲正禁止 | §2、§9 `REVERSAL_NOT_ALLOWED` | §3.5.1 `reason=VOIDED` | 同 | 一致 |
| 超额冲正 | — | `reason=ALREADY_REVERSED` | 同 | 一致 |
| 原条目不存在 | — | `NOT_FOUND` | 同 | 一致 |
| CR-005 资金异常期还款 | — | — | `REPAYMENT_NOT_PAYABLE(reason=FUNDING_EXCEPTION)`——还款阻断，与冲正无关 | 一致 |

SEMANTIC CONFLICTS = 0。

## Error Coverage
方法：从 57/58/59/60 提取全部错误形态标识，与 61 §4 注册表（89 个 code）比对，并核对每处 `details.reason` 的用法是否落在该码允许的取值内。
- 未注册的命中仅为非 HTTP 枚举：`AMOUNT_MISMATCH`/`LOAN_MISMATCH`（`ReconciliationRecord.outcome`；`AMOUNT_MISMATCH` 亦为 §7 还款 `failureCode`）、`ACCOUNT_INVALID`（§7 放款 `failureCode`）、`NOT_SIGNED`/`INSTRUCTION_ACTIVE`（`DISBURSEMENT_NOT_AVAILABLE` 的 reason）——均按设计不属于 HTTP 错误码。
- reason 用法：58 `REPAYMENT_NOT_PAYABLE(FUNDING_EXCEPTION)` ✓；58 §4.0 `DISBURSEMENT_NOT_AVAILABLE(FUNDING_EXCEPTION_NO_REISSUE|VOIDED|NOT_SIGNED|INSTRUCTION_ACTIVE)` ✓；60 `REVERSAL_NOT_ALLOWED(VOIDED|ALREADY_REVERSED)` ✓。
- 59（CR-006）：全部注册，无变化。

**ERROR COVERAGE = COMPLETE。**

## Remaining P0
无。

## Remaining P1
无（自评；以 Codex delta review 为准）。

## Remaining P2
- 被冲正条目本身为 `REVERSAL` 行（"冲正的冲正"）是否可行，CR-004/007 未明确规定；`NOT_A_CREDIT` 因无出处已移除。建议在后续 CR-004/007 修订中明确：原条目必须为 CREDIT 还款行；若届时需新 reason，须先改 CR-007 再登记到 61。当前不阻塞，不在本次范围（不得改 57/60）。
- 66 已列的其它 P2（D1 远程/miniflare 回滚测试、MFA 重绑测试、新码 ARB 文案、命名统一）不变。

## Final Re-review Readiness
```
CR-012 v3.1: PROPOSED — READY FOR CODEX FINAL DELTA REVIEW
Bundle: not self-approved
Implementation: NOT AUTHORIZED
Trae: HOLD
Next: CODEX FINAL DELTA REVIEW
```
