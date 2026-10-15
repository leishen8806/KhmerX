# Backend CR Bundle Re-review

```
Document:  64-backend-cr-bundle-rereview.md
Date:      2026-10-09
Reviewed:  57 · 58 · 59 · 60 · 61（v2）· 63（repair summary）· 55 · 56 · 62
Basis:     真实代码与存储（HEAD d916b4515a93057d7dd2a0673ebbca39a7bfd242）+ 实际运行的验证脚本
Scope:     契约验收复审。未修改 57–63；未写后端/Flutter 代码；未改 02/45/55；未授权 Trae
```

> **独立性声明**：本次复审的被审对象是同一执行者（Claude）起草的修复，**独立性有限**。为弥补这一点，复审以**真实代码/存储的实际运行结果**为准（而非对照文字），并主动寻找修复自身引入的缺陷。**仍建议 Codex 另做一次真正独立的复核**，尤其是 §5 的新发现。

## 0. Project Identity
```
PROJECT IDENTITY CHECK: PASS
PROJECT: KhmerX · ROOT: E:\KhmerX\KhmerX · REMOTE: git@github.com:leishen8806/KhmerX.git
HEAD: d916b4515a93057d7dd2a0673ebbca39a7bfd242 · worktree: 仅 docs/ 与 mobile/ 未跟踪
57–63、55、56 均存在；64 此前不存在
```

## 1. 结论

**BACKEND CR BUNDLE RE-REVIEW: FAIL**（窄幅失败）

- `62` 的 15 项 P1 中，**14 项已关闭，1 项部分关闭**（CR-005 生命周期，见 §5 P1-R3）。
- 复审**新发现 3 项结构性 P1**（均为 v2 修复自身引入或遗留的资金完整性/路径确定性缺口），故不能给 PASS/CONDITIONAL PASS：**结构性歧义不得用 CONDITIONAL 放行**。
- P0 = 0。
- 修复量小且局部（见 §11），不需要重开任何已冻结决策。

## 2. 真实代码/存储验证（本轮实际执行）

| # | 验证 | 方法 | 结果 |
|---|---|---|---|
| V1 | 全部权威状态在同一 D1；工作区为"每主体一行 + 行级 CAS" | 读 `lib/store.ts`、`workflow.ts`、`admin-funds.ts` | **CONFIRMED**：`SELECT revision,payload FROM demo_workspaces WHERE owner=?`；`UPDATE … WHERE owner=? AND revision=?` |
| V2 | D1 `batch()` = 事务 | 读本地 miniflare 源码 `database.worker.js` | **CONFIRMED（本地）**：`#txn` → `this.state.storage.transactionSync(() => queries.map(...))`，异常即回滚。远程 D1 为平台文档语义 → 实施测试门禁 |
| V3 | 条件链 `INSERT … WHERE changes()=1` 与 CAS / UNIQUE 回滚 | 在 `node:sqlite` 上实跑 | **CONFIRMED**：CAS 命中→提交；CAS 过期→条件插入不写入；UNIQUE 冲突→整批回滚；现有代码已在 `admin-funds.ts`/`workflow.ts` 使用该链 |
| V4 | 客户路径 `mutate` 未使用批 | 读 `lib/store.ts` | **CONFIRMED**：0 处 `.batch(`，以单语句 `.run()` 提交 → CR-006 必须"先改批再声称原子"的规则成立 |
| V5 | 迁移器 `splitSql` 对触发器 `BEGIN…END` | 提取真实函数，对 42 个迁移在全新内存库回放 | **触发器已修**：41/42 应用；`team_audit` 的 `DELETE`/`UPDATE` 被触发器阻止 |
| V6 | **全新卷迁移回放** | 同上 | **失败**：`0015_admin_password.sql: near "see": syntax error`——该文件的**注释**含分号（"Credentials removed; see 0030…"），`splitSql` 不识别注释，把 `see 0030….sql.` 当作语句；运行器无 try/catch ⇒ **空卷启动失败** |
| V7 | 回调入库 | 读 `app/api/institution/callback/route.ts` | **CONFIRMED OPEN**：`db.batch([INSERT OR IGNORE nonce, INSERT event, INSERT attempt])`，事件与尝试**无条件**写入；`results[0].meta.changes` 在批**提交之后**才检查，409 前事件已落库 |
| V8 | 回调消费者 | grep | **CONFIRMED OPEN**：`institution_callback_events` 仅被两条路由引用 |
| V9 | `paymentVerified` | grep | **CONFIRMED OPEN**：`admin-funds.ts` 仍读取请求体该字段 |
| V10 | 应急授权 | 读 `lib/team/emergency.ts` | **部分关闭**：一次性消费 ✓、批准要求 MFA 步进 ✓、仅申请人可用 ✓、范围含 `funding` ✓；**但授权并未绑定具体贷款/动作/金额**——`loanId/action/cents` 只在消费时**被记录**，未被**校验**。`highRiskRoles` 仍不含 `admin` |
| V11 | MFA 重绑 | 读 `lib/team/server.ts` | **表面关闭**：`mfa_enroll_start` 在启用 MFA 时 `requireMfaStepUp`，且写入 `pending_mfa_secret` 而非直接覆盖 → 仍需独立测试 |

## 3. 62 的 P1 关闭矩阵

| # | 62 项 | 结论 | 说明 |
|---|---|---|---|
| 1 | CR-004 DR-1 原子性/投影 | **CLOSED** | 事实核实（V1/V2）：权威=D1 SQL 账本；工作区 JSON 降为版本化、可重建投影 + 读时叠加；理由（单行共享 CAS 的串行化与耦合失败）成立 |
| 2 | CR-004↔007 分摊 | **CLOSED** | 分摊顺序属绑定的不可变政策；>1 分量缺失 → `ALLOCATION_POLICY_MISSING` 失败关闭；OD-7.3 为生产财务过账阻断 |
| 3 | CR-005 生命周期 | **PARTIALLY CLOSED** | `signed→active`、`fundedAt/dueAt`、返还事实/`FUNDING_EXCEPTION` 已确定；但 **REISSUE 的账户重确认前置条件与阶段自相矛盾**（P1-R3） |
| 4 | CR-005 账户确认 | **CLOSED** | 绑定 `loanId/accountRefId/accountVersion/accountSnapshotHash/kycRevision/requestId/confirmedAt/expiresAt`；过期/修订失效；指令引用确切快照 |
| 5 | CR-006 登出范围 | **CLOSED** | 普通登出仅停用该安装；账号级事件集合明确；会话到期不销毁无关设备；换账号改绑 |
| 6 | CR-006 事件原子性 | **CLOSED** | 同一 D1：批内条件链写 outbox；非批路径须先改批（V4）；reconciler 兜底；通知失败不回滚业务 |
| 7 | CR-007 宽限边界 | **CLOSED** | 公式与 G=0/G=3 示例；首个逾期日 `daysOverdue=1` |
| 8 | CR-007 恢复语义 | **CLOSED** | 到期后部分还款不回 `CURRENT`；`remaining==0` → 结清 → `SETTLED` |
| 9 | CR-007 费用账本方向/幂等 | **CLOSED** | `DEBIT|CREDIT` + 正整数；自动键含 `loan+policyVersion+component+accrualDate`，手工键 `man:{requestId}` |
| 10 | CR-007 政策绑定 | **CLOSED** | 合同生成/签约前绑定、终身不可变、依赖 P3/CR-001；区分未配置与绑定 `NONE` |
| 11 | CR-007 资金竞态 | **CLOSED（机制）** | loan 级 `financial_version` CAS + D1 批（V2/V3 支持）；**但见 P1-R2：冲正对已结清贷款的重开语义缺失** |
| 12 | CR-012 重试 | **CLOSED** | 重试分类 + 全局规则；`INTERNAL_ERROR=CONDITIONAL` |
| 13 | CR-012 `UNCLASSIFIED_ERROR` | **CLOSED** | 仅内部；公共响应永不出现，有契约测试 |
| 14 | CR-012 追踪归属 | **CLOSED** | 网关生成并替换入站值；`traceId` 与幂等 `requestId` 分离；OD-12.2 CLOSED |
| 15 | CR-006 错误覆盖 | **CLOSED** | 4 个新码 + `RATE_LIMITED` 复用；无提供方特定码 |

## 4. 逐项复审结果

### CR-012 — **PASS（含 P2）**
- RETRY MODEL：七类；全局规则 GET/HEAD 可重试，变更类不自动重试，除非端点保证幂等 + 同键同载荷。**INTERNAL_ERROR RETRY: CLOSED。INTERNAL_ERROR: PASS**（读重试与变更重放明确分离）。
- UNCLASSIFIED：**CLOSED**。TRACE：**CLOSED**（OD-12.2 CLOSED）。
- HTTP STATUS MODEL：**PASS**——一码一状态；`AUTH_DEMO_FORBIDDEN`/`WORKSPACE_UNAVAILABLE`→503，`INVALID_REQUEST`→400，`UNSUPPORTED_MEDIA_TYPE`→415，`FILE_INVALID`→422；唯一迁移例外是 `/api/kyc/files` 现状 400，已登记。
- CR-006 ERROR COVERAGE：**PASS**。
- **P2**：注册表**未列出生产今天仍在发出的旧通用码**（`INVALID_VERIFICATION_CODE`、`INVALID_FILE`、`INVALID_KYC`、`INVALID_ARGUMENT`、`CONFLICT` 等，见 `docs/api-error-codes.md`）与新码之间的**迁移别名表**；Android 在迁移期会同时见到新旧码。未知码已有按状态类的通用回退，故非结构性，但需补一张"旧码→新码"表。

### CR-007 — **CHANGE REQUIRED（因 P1-R2）**
- DELINQUENCY ARCHITECTURE：**PASS**。GRACE BOUNDARY：**CLOSED**。POST-DUE PARTIAL REPAYMENT：**CLOSED**（对象始终存在，结清后 `SETTLED`）。
- TERMINAL STATE ALIGNMENT：**PASS（含 P2）**——`closed/settled/funding exception/voided` 无矛盾：`FUNDING_EXCEPTION→SUSPENDED`，`VOIDED/SETTLED→SETTLED`。**P2**：`VOIDED` 以 `SETTLED` 表示并带 `closedReason`，语义容易误导（作废≠结清）；建议显式增加 `VOIDED` 展示态或在读模型保证 `closedReason` 必出。
- CHARGE LEDGER DIRECTION：**CLOSED**。CHARGE IDEMPOTENCY：**PASS**。POLICY VERSION BINDING：**CLOSED**。MISSING POLICY：**PASS**。ALLOCATION ARCHITECTURE：**PASS**。FINANCIAL POSITION AUTHORITY：**PASS**。
- FINANCIAL SERIALIZATION：**PASS**——在当前存储上可强制（V1–V3）；批回滚/并发列为实施测试门禁。
- LOAN CLOSURE AUTHORITY：**PASS（有 P1-R2 例外）**——结清只有共享逻辑；**但反向（已结清→重新开启）没有定义**。

### CR-004 — **CHANGE REQUIRED（因 P1-R1）**
- D1 ATOMICITY FACT：**CONFIRMED**（V1/V2）。LEDGER AUTHORITY：**PASS**。JSON PROJECTION：**PASS**（版本化、可重建、读时账本为准）。WORKSPACE CAS DESIGN：**PASS**（单行共享 CAS 的论证成立）。
- FINANCIAL WRITE PATH：**SINGLE**（`postRepayment()`，遗留直写失败关闭 + 静态扫描）。IDEMPOTENCY + CONCURRENCY：**PASS**。CR-004/007 ALLOCATION：**PASS**。
- **P1-R1**：人工/外部参考号唯一性自相矛盾且弱于现状（§5）。
- **P2**：§1 F6 与 §15 把应急授权写成"一次性**绑定**"——与 V10 不符（只记录、不校验）。

### CR-005 — **CHANGE REQUIRED（因 P1-R3）**
- CONFIRMATION：**PASS**。ACCOUNT LOCK：**PASS**。ACTIVATION（`signed→active` 仅权威资金确认）：**PASS**。FUNDED_AT：**PASS**（服务端权威确认时间，非员工点击/客户端）。DUE_AT：**PASS**——默认 `fundedAt+term` 结构可接受，**OD-5.4 = BLOCKS IMPLEMENTATION**。
- RETURNED FUNDING：**PASS**（不可变退回/冲正事实；`FUNDING_EXCEPTION` 暂停还款/计提/结清）。
- FUNDING EXCEPTION RESOLUTION：**FAIL（局部，P1-R3）**。
- **P2**：`loan_financial_terms` 的本金/合同费来源未指明——应明确取自**不可变合同快照**（`kyc_contracts`/Quote），不取可变工作区 JSON。

### CR-006 — **PASS**
- PER-DEVICE LOGOUT：**PASS**。ACCOUNT-WIDE REVOCATION：**PASS**（密码重置并撤销全部、账户删除、显式撤销全部、安全锁定）。SESSION EXPIRY DEVICE EFFECT：**PASS**。INSTALLATION REBIND：**PASS**。OUTBOX TRANSACTION MODEL：**PASS**。NOTIFICATION RECOVERY：**PASS**。

## 5. 新发现（结构性 P1 — 必须修复）

### P1-R1　CR-004：外部参考号唯一性自相矛盾，且弱于现状 → 同一笔银行转账可被记到多笔贷款
- **事实**：现状 `team_repayment_receipts` 主键是 `(tenant_id, reference)`（**不含贷款**），因此同一银行流水号**无法**入账两次（现状 F4）。
- **v2 缺陷**：CR-004 §7.1 写 `UNIQUE(tenantId, loanId, reference_normalized)` 却声称"跨贷款复用同参考号被拒绝"；账本幂等键 `tenantId + loanId + channel + sourceRef` 同样含 `loanId`。→ 同一 `bankReference` 可对**两笔不同贷款**各过账一次 = **一笔真实资金被重复计入**。
- **修复要求**：对**来自外部的参考**（银行流水号、通道 `providerReference`、机构 `eventId`），唯一性必须**不含 `loanId`**：`UNIQUE(tenantId, channel, sourceRef_normalized)`；同一 `sourceRef` 绑定不同 `loanId`/金额 → 409 并进对账异常。幂等键对外部来源取 `tenantId+channel+sourceRef`；`loanId` 作为绑定校验而非键的一部分。

### P1-R2　CR-004/007：冲正使已结清贷款余额>0 时的状态转换未定义
- **事实**：CR-004 允许 `REVERSAL` 过账（含双人审批），CR-007 把结清定义为 `phase=SETTLED` 的**终态**，且"唯一结清权威"。两处都**没有**说明：对 `SETTLED` 贷款冲正使 `remaining>0` 时，阶段、生命周期投影（`closed→active`）、拖欠状态（`SETTLED→?`）如何变化，或是否禁止。
- **风险**：实现者各自发明"重新打开"路径 ⇒ 违反"只有共享财务逻辑决定 closed/active"的权威链；或产生 `remaining>0` 的 `closed` 贷款。
- **修复要求**：二选一并冻结：（a）**允许重开**：`REVERSAL` 使 `remaining>0` 时，在同一财务批内 `SETTLED→ACTIVE`（需双人审批 + MFA + 审计），拖欠状态按日期重算，投影 `closed→active` **仅**经此路径；（b）**禁止**对已结清贷款冲正（须走受控的"重开"财务工单）。无论哪种，`VOIDED` 禁止冲正。

### P1-R3　CR-005：REISSUE 的账户确认前置条件与阶段矛盾，解决路径不可达
- **事实**：§4 要求确认时"贷款属于当前客户且 `signed`"；而资金退回后贷款处于 `phase=FUNDING_EXCEPTION`，兼容投影为 `status:'active'`（§6.4）。REISSUE（§6.4）又要求"新确认记录 → 新指令"。→ 客户在 `active` 投影下**无法**通过 `signed` 前置完成重新确认；解决路径不可达。
- **修复要求**：确认命令的前置条件改为 `status==signed` **或** `phase==FUNDING_EXCEPTION` 且存在**待执行的 REISSUE 解决单**；指令创建的前置同理；补充对应错误码（可复用 `RECEIVING_ACCOUNT_REQUIRED`/`DISBURSEMENT_NOT_AVAILABLE`，无需新码）。

## 6. P2（非结构性；须在下一版修订中处理）
1. CR-012：补"旧通用码→新码"迁移别名表（§4）。
2. CR-007：`VOIDED` 的展示表示（见 §4）。
3. CR-005：`loan_financial_terms` 的合同事实来源须指明为不可变合同快照。
4. **CR-004 §1 F6 / §15 与 63 的表述需更正**：应急授权现为"一次性 + MFA 批准 + 仅申请人使用"，**并未绑定贷款/动作/金额**（仅审计记录）；且 `admin` 不在 `highRiskRoles`。
5. **63 与 CR-004/005/007 中"迁移器…APPEARS CLOSED IN CODE"的分类应更正**（见 §9）。
6. 命名/状态词汇统一（62 的 P2，继续）。

## 7. 跨合同权威模型
| 项 | 结论 |
|---|---|
| FINANCIAL AUTHORITY CHAIN | **PASS** |
| ACTIVATION AUTHORITY | **PASS**（仅权威资金确认） |
| CLOSURE AUTHORITY | **PASS（正向）/ 反向见 P1-R2** |
| DELINQUENCY AUTHORITY | **PASS** |
| ERROR AUTHORITY | **PASS**（CR-012 为唯一公共错误语义；遗留码迁移见 P2） |

## 8. Error Coverage Matrix
自动交叉核对：CR-004/005/006/007 中出现的所有错误码均存在于 CR-012（唯一未命中的是环境变量名与 Android 权限名，不是错误码）。
**ERROR COVERAGE: COMPLETE。** 缺失/冲突项：无（遗留旧码别名见 CR-012 P2）。

## 9. 安全门禁（以当前 HEAD 实测重新分类）
| 门禁 | 分类 | 证据 |
|---|---|---|
| `paymentVerified` 自报 | **CONFIRMED OPEN** | V9 |
| 回调 nonce 重放仍插入事件 | **CONFIRMED OPEN** | V7（批无条件写入，409 在提交后） |
| 回调无消费者 | **CONFIRMED OPEN** | V8 |
| MFA 重绑 | **APPEARS CLOSED — TEST REQUIRED** | V11（独立判断：63 的改判有依据，但须测试） |
| Admin 资金双人控制 | **REQUIRES RE-VERIFICATION** | `admin` 仍不在 `highRiskRoles`；`admin_disburse/admin_repay` 单 Admin 可发起（受应急授权约束） |
| 应急授权 | **PARTIALLY CLOSED — REQUIRES HARDENING** | V10：一次性 ✓、MFA 批准 ✓、**未绑定贷款/动作/金额**（63/CR-004 的"绑定"表述不准确） |
| 迁移器：触发器切分 | **CONFIRMED CLOSED（触发器）** | V5：41/42 应用，append-only 触发器生效 |
| **迁移器：全新卷启动** | **CONFIRMED OPEN（新定性）** | V6：`0015` 注释含分号 → `splitSql` 误切 → 空卷启动失败。**63 将"迁移缺陷"归为 APPEARS CLOSED 的判断不成立**，须更正；修复属后端（不在本轮），并须在本 CR 新增触发器迁移之前关闭 |
| `0030/0031` 与只追加审计表冲突 | **CONFIRMED CLOSED（冲突本身）** | 文件不再 `DELETE FROM team_audit`，回放通过 |
**真实还款/放款激活保持 BLOCKED。**

## 9.1 对 63 判断的独立结论
- MFA 改判：**有依据**（但需测试）。
- 迁移改判：**不成立**（触发器部分对，空卷启动仍失败）。

## 10. 开放决策（独立分类）
| ID | 分类 |
|---|---|
| OD-4.1 超额 | CAN REMAIN OPEN（默认不入账+异常）；BLOCKS 超额处理上线 |
| OD-4.2 凭证 | CAN REMAIN OPEN（默认可选）；BLOCKS 保留策略上线 |
| OD-4.3 检查者阈值 | **BLOCKS IMPLEMENTATION**（人工确认；基线检查者须冻结） |
| OD-4.4 提供方 | **BLOCKS IMPLEMENTATION（P6-B）与 PRODUCTION** |
| OD-4.5 编号/过期时长 | P6-A 默认可实施；**BLOCKS 确定性 P6-B** |
| OD-5.1 银行校验 | BLOCKS IMPLEMENTATION（账户校验） |
| OD-5.2 确认时长 | 行为 ARCHITECTURE CLOSED；时长必配外部值，缺失失败关闭 → **BLOCKS IMPLEMENTATION（配置缺失时）** |
| OD-5.3 退回处置 | **BLOCKS IMPLEMENTATION（returned 转换）与 PRODUCTION**（会计完整性 ARCHITECTURE CLOSED） |
| OD-5.4 fundedAt/dueAt | **BLOCKS IMPLEMENTATION**（默认已冻结，待业主/法务确认） |
| OD-5.5 参考号展示 | CAN REMAIN OPEN（默认脱敏/隐藏） |
| OD-6.1 提供方 | BLOCKS PRODUCTION（抽象实现可先行） |
| OD-6.2 设备上限 | BLOCKS PRODUCTION（可指定保守临时上限） |
| OD-6.3 静默时段 | CAN REMAIN OPEN |
| OD-7.1 罚息 | CAN REMAIN OPEN（`NONE`）；BLOCKS PRODUCTION 真实罚息 |
| OD-7.2 宽限/桶 | BLOCKS PRODUCTION（边界算法 ARCHITECTURE CLOSED） |
| OD-7.3 分摊 | **BLOCKS PRODUCTION FINANCIAL POSTING**（>1 分量；失败关闭规则 ARCHITECTURE CLOSED） |
| OD-7.4 日历/舍入 | BLOCKS IMPLEMENTATION（罚息计提；状态模式可先行） |
| OD-7.5 豁免/核销 | BLOCKS IMPLEMENTATION（豁免/核销路径） |
| OD-7.6 同日基数 | BLOCKS IMPLEMENTATION（罚息计提；机制 ARCHITECTURE CLOSED） |
| OD-12.1 别名下线 | CAN REMAIN OPEN（PRODUCTION / DEPRECATION） |
| OD-12.2 追踪归属 | **ARCHITECTURE CLOSED** |

## 11. D1 语义
**D1 CONTRACT ASSUMPTIONS: VALID**——
- 批=事务、异常整批回滚：本地 miniflare 已在源码核实（V2），SQLite 级行为已实跑（V3）。
- 条件链/CAS/UNIQUE 回滚：已实跑验证；现有代码已依赖该链。
- 触发器 `RAISE(ABORT)`：已实跑验证。
**D1 IMPLEMENTATION TEST GATES**（契约语义确定，属实施验证，非契约 P1）：
1. 远程 Workers D1 上重复 V2/V3 的批回滚、条件链、UNIQUE 回滚测试（与本地 miniflare 对等性）；
2. 并发交错测试（回调/人工确认/计提/豁免/冲正/资金确认/结清）证明无双过账、无错误结清；
3. 触发器迁移在 **全新卷与既有卷** 回放（含修复 `0015` 之后）；
4. 批大小/绑定参数上限（D1 限制）下的最大批；
5. 批内 outbox 同提交/同回滚测试，及非批路径改批后的回归。

## 12. 需要的修复（交 Claude）
1. **P1-R1**：CR-004 §7.1 外部参考唯一性与账本幂等键去掉 `loanId`，改 `tenantId+channel+sourceRef`，加跨贷款复用 409 与对账异常。
2. **P1-R2**：CR-007 §3.5 / CR-004 §2 冻结冲正对已结清贷款的行为（重开或禁止）。
3. **P1-R3**：CR-005 §4/§6.4 放宽账户确认与指令创建前置到 `FUNDING_EXCEPTION + REISSUE`。
4. P2：旧码别名表；`VOIDED` 展示；terms 来源；更正应急授权与迁移门禁表述（含 63）。
5. **后端缺陷（非契约）**：修 `0015` 注释分号/让 `splitSql` 识别注释；回调批改为条件写入（P1-R1 之外的 CR-004 §11 已要求）。

## 13. Final
```
BACKEND CR BUNDLE RE-REVIEW: FAIL
P0: 0
P1: 3（P1-R1 外部参考唯一性；P1-R2 冲正/重开；P1-R3 REISSUE 确认前置）
IMPLEMENTATION: NOT AUTHORIZED
TRAE: HOLD
NEXT: CLAUDE CONTRACT FIXES
```
