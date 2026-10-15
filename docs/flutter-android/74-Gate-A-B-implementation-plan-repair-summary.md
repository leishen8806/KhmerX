# Gate A/B Implementation Plan Repair

```
Document:  74-Gate-A-B-implementation-plan-repair-summary.md
Date:      2026-10-09
Owner:     Claude（规划修复；不自批）
Status:    PROPOSED — READY FOR CODEX GATE A/B PLAN RE-REVIEW
Identity:  PROJECT IDENTITY CHECK: PASS · KhmerX · E:\KhmerX\KhmerX · git@github.com:leishen8806/KhmerX.git · HEAD d916b4515a93057d7dd2a0673ebbca39a7bfd242
Backups:   69/70/71 各有 *.pre73.bak
Not done:  未改 57–68；未写任何后端/Flutter 代码；未改数据库；未授权实施
```

## Source
`72-Gate-A-B-implementation-plan-review.md` — FAIL：P0 = 1，P1 = 5。

## P0 Repair — CAS Guarding（71 §6，Gate B Exit 新增 P0 出口项）
**冻结不变量**
```
FAILED FINANCIAL OWNERSHIP CLAIM → ZERO AUTHORITATIVE FINANCIAL SIDE EFFECTS
```
- 每次财务变更持有唯一 `financialTxnId`；批的第 1 条语句是所有权声明（CAS：`financial_version V→V+1`，写 `last_txn_id=:txn`；首次激活为 `INSERT` 状态行）。
- 其后**每一条**权威写都以 `EXISTS(SELECT 1 FROM loan_financial_state WHERE loan_id=? AND financial_version=V+1 AND last_txn_id=:txn)` 为条件——账本、分摊、费用账本、事件、外部来源绑定、幂等行、资金事实、条款（初始化/REISSUE）、提交断言；结清/重开投影即状态行本身。
- 71 §6.2 逐项列出权威事实及其守卫；仅有的例外（`loan_policy_bindings`、`delinquency_policies`、`financial_legacy_loans`、JSON 投影）逐项说明了不同串行化语义及理由。
- 结果核对（§6.4）：CAS `changes==1` 且各事实语句行数等于期望；**批成功返回不是 CAS 成功的证明**。新增 `financial_txn_assertions` 提交断言（`ok NOT NULL`）：事实行数不符 ⇒ 整批回滚。
- 伪代码（§6.3）不再含任何无守卫的权威 INSERT。
- 新增测试 D1-11…D1-19：陈旧 CAS + 还款/计提/冲正/结清/资金确认 → 各自 **0** 行；事件/绑定/幂等/投影 0 变化；变异测试（移除任一守卫必须被测试抓到）；提交断言；陈旧写者不占用外部来源绑定。
- 投影：`rebuildProjection` 只在 CAS 命中的调用之后触发，且只读 SQL 权威、带版本单调保护 ⇒ 陈旧写者不产生财务投影变更。

## P1 Repairs
| 项 | 修复 | 位置 |
|---|---|---|
| **B1 遗留贷款** | 冻结：Gate B 之前的全部贷款为 LEGACY / READ-ONLY，任何新财务变更 fail-closed；资格 = 不在 `financial_legacy_loans` **且** 存在 `loan_policy_bindings`（默认拒绝，回填漏标亦被拒）；**11 条旧路径盘点与封堵**（`applyAction` 的 disburse/repay/withdraw/overdue、`customerAction`/`allowInternalSettlement`、`staffAction` 的 disburse*/overdue、`adminFunds`、回调动作计划、`postloan`/`loan-signing`/`customer-cleanup` 写入核对、静态扫描禁令）；测试 L1–L8；转换需独立 Migration/Backfill/Reconciliation Gate | 71 §4、§7.1 |
| **B2 规范化 = CLOSED** | 存储 `raw_reference` / `normalized_reference` / `normalization_version` / `normalization_context`；全局：trim、拒绝空值与控制字符、确定性且有版本；`MANUAL_TRANSFER` v1：trim + ASCII 大写 + 现行字符集/长度校验，不剥离标点；提供方引用由适配器规范化，不透明引用仅 trim，通用层不得改写大小写/标点；唯一性 `tenantId + channel/provider-context + normalizedReference`，永不含 `loanId` | 71 §4(7)、§5.1 |
| **B4 冲正目标 = CLOSED** | 普通冲正目标 = 原始还款 CREDIT 条目，仅此一种；REVERSAL/费用/豁免/调整/资金事实/无关事实均非法目标；校验：存在、类型 CREDIT、未冲正余额>0、请求额≤余额；冲正的冲正不支持（需单独受控更正契约/Gate）；触发器纵深防御；测试 | 71 §9.2.1 |
| **Gate A trace = CLOSED** | 删除 OD-A1 开放表述；单一规则：受信最外层入口生成服务端 `traceId`，外部 `X-Request-Id` 不受信，永不成为 traceId / `requestId` / 幂等键 / 安全身份；OD-A2 重分类为 **ENGINEERING INVENTORY TASK** | 70 §4.2、§11 |
| **B0 独立执行包** | 新建 73：范围、变更边界与方案选择（推荐修解析器、不改已发布迁移文件）、入口/出口、M1–M14 测试、回滚/恢复、托管 Cloudflare 迁移路径发现（必交付项）；执行者 TRAE（需授权），验收 CODEX | 73 |

## P2
- **F1 排序**：F1 仅在 **Gate A Exit 之后**启动（设计准备可重叠、执行不可）；69 DAG、并行表、Gate F 条目、实施顺序均已改正。
- 遗留冻结/冲正目标类型错误的专用 `reason`/码：CR-012 增量（P2，不阻塞；本任务不得改 57–68，故沿用 `REPAYMENT_NOT_ENABLED` / `DISBURSEMENT_NOT_AVAILABLE` / `NOT_FOUND`）。

## Updated Dependency DAG
```
Gate A ───────────────→ Gate B ──→ C1 ──→ C2
  │                       ↑     ├──→ D
  ↓                       │     └──→ E
 F1  (仅 A Exit 之后)      │
B0 ───────────────────────┘      稳定业务事件 ──→ F2
Gate B 需要：Gate A PASS ＋ B0 PASS
授权包：Package A（Gate A）与 Package B0（73）可在 Codex 批准 + GPT 授权后并行执行
C1/D/E 并行（B 退出后）：单一迁移编号协调人串行分配，禁止自行分配
```

## Security Gate Ownership
| 门禁 | 负责 |
|---|---|
| Fresh-volume migration | **B0（73）**，PASS 之前 Gate B 不得写 0042+ |
| MFA rebinding 自动化验证 | Gate B 测试前提 / 安全验证 |
| Emergency authorization 目标绑定 | Gate B 硬化基础（先于 C1/D） |
| Admin financial dual control | Gate B 架构验证 + C1/D 执行 |
| paymentVerified 自报 | C1 关闭 |
| Callback replay insertion | Gate B 通用摄取原语 |
| Callback 业务消费者缺失 | B：框架（不启用业务消费者）→ C2：还款消费者 → D：资金消费者 |
| 触发器切分 / 0030-0031 | CLOSED，B0 回归 |

## 范围保持
- Gate A 范围**未扩大**（typed ApiError、注册表、trace、信封、legacy 别名、details 白名单、REQUEST_FAILED 下线、UNCLASSIFIED 仅内部）；DB 变更：无。
- Gate B 产品范围仍为零：不启用客户还款、真实放款、罚息、KHQR/Bakong、推送；回调只做通用摄取原语 + fail-closed 消费框架，**不启用**还款/资金提供方业务消费者（分别属 C2 / D）。
- OD-B3（远程 D1）= IMPLEMENTATION ENVIRONMENT DEPENDENCY：Gate B **Exit 前**必需，非计划批准前提；文档不含任何凭据。

## Validation（过期表述检查，均为 0）
OD-A1 开放 · OD-B2 开放 · OD-B4 开放 · "F1 与 Gate A 并行执行" · 遗留贷款继续旧财务变更 · 外部来源唯一性含 `loanId` · 普通冲正可指向 REVERSAL 条目 · CAS 之后无守卫的权威 INSERT —— 对 69/70/71/73 grep 无命中（含 71 中的"无条件插入"仅出现在禁止性表述中）。

## Remaining P0
无（规划者自评）。
## Remaining P1
无（规划者自评）。最终判定权在 Codex。
## Remaining P2
见上；另：D1 远程对等性、MFA 重绑自动化、ARB 文案、命名统一均属实施证据工作。

## Review Readiness
```
69 v2 · 70 v2 · 71 v2 · 73 · 74: PROPOSED — READY FOR CODEX GATE A/B PLAN RE-REVIEW
Implementation: NOT AUTHORIZED · Trae: HOLD
Next: CODEX GATE A/B PLAN RE-REVIEW
```
