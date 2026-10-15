# KhmerX Android · Architecture Reconciliation（2026-10-07）

> **编号说明**：本文原编号 08，已改为 09，以便 `08-G0-implementation-report.md` 保留给 Trae 的 G0 实施报告。**Gate 状态以 `10-G0-implementation-contract.md` 为准**（G0 = FAIL / RECOVERY；G1、G2 = HOLD；G3 = BLOCKED），本文第 7 节与末尾的 Gate 表为 2026-10-07 早些时候的快照，已被取代。

- 负责人：Claude（System / Product / Requirements / Architecture Owner）
- 范围：`01`、`02`、`03`、`04`、`05`、`06`、`07` 与仓库现状的一次性对账
- 原则：文件内容 > 聊天历史；任何需求先变成 Contract，Contract 先经过 Review，通过后再交 Trae 实现
- 本次**没有**修改：`04`（Codex 负责）、`03`（已被 `04` 取代）、任何 Trae/Flutter 代码、任何后端或 Web 代码

## 1. 输入核对（以磁盘为准）

| 输入 | 状态 | 说明 |
|---|---|---|
| `01`–`03`、`05`–`07` | 存在 | Claude 维护 |
| `04-ux-architecture.md` | **v2**（10:42 更新） | Codex 负责；页首自述“`07` 当前工作区未提供”——**该陈述在 `07` 落地（10:41）前写成，现已过时** |
| **Trae G0 报告** | **不存在** | `E:\KhmerX\KhmerX\mobile\` 目录不存在，**没有任何 Flutter 代码**。对账第 3 项无法执行，**不编造** |
| **Codex 审查报告** | **不存在** | 仅有 `04` v2 的 Revision Log（RC-1 至 RC-7 声明已修） |
| 后端实现状态 | **无 CR-001 实现** | 四份副本（`KhmerX`、`deploy-stage`、`deploy-stage-4bceda1`、`deploy-stage-f95932b`）均无 `/api/loan/quote` 路由、无 `loan_quotes` 表、`create` 路径无 `quoteId`、仍含 100 笔硬编码；**审计 F-01（`roles.repay='mini'`）也仍在** |

## 2. 对账结果（10 项检查）

| # | 检查项 | 结论 | 证据与处理 |
|---|---|---|---|
| 1 | Requirements 与 UX Contract 一致 | **PASS（有 1 处待 Codex 改）** | `01` v2 的 FR-6.x、首页状态、Unknown Outcome、KYC 保存策略与 `04` v2 一致。差异仅 R-1（`confirm_bill`） |
| 2 | UX 是否违反 API | **1 处违反 + 若干措辞** | **R-1**：`04` §17 `/loan/quote/confirm` 的 API 写“`confirm_bill` + `create`”，与 `07` Option B（`create` 携带 `quoteId` + `billConfirmed:true`，不再调用 `confirm_bill`）冲突。其余见第 3 节 |
| 3 | Flutter Architecture 与 Trae G0 实现一致 | **N/A（G0 未产出）** | 无代码可对照。已在 `05` §25.3 规定 G0 报告必须回答的 7 项，作为日后对账清单 |
| 4 | Cookie / Session 一致 | **PASS** | `05` §7（`cookie_jar` + 公司分区加密存储 + 4-Cookie 白名单 + 每公司独立 Dio）与 `04` §2、§5（公司隔离、Logout 只清当前公司、Remove Company 才删数据）一致。已在 `05` SETTINGS-01 补上“移除公司/清除全部数据”任务 |
| 5 | Retry 一致 | **PASS** | `05` §6.2/§10.1/§19.3：Default OFF，仅 `GET /api/h5/auth`、`/api/h5/state`、`/api/kyc` HTTP 层有界重试；写操作显式处理。`04` §9 “timeout：读可单次重试，重要写进入待确认” 一致。**修正**：`05` 原 `quote` 行允许 `BoundedSafePost`，已改为 `None`（报价是 POST，不属于“明确安全的 GET”） |
| 6 | KYC 保存策略一致 | **PASS** | `01` FR-5.2、`04` §5/§7/§17、`05` §12.2、ADR-013 一致：服务端是唯一可恢复来源；内存保存未保存输入；仅提交通过格式校验字段（D11）。**措辞待 Codex 微调**（R-4） |
| 7 | 术语统一 | **PASS（04 已遵守；01/02/05/07 已改）** | 借款报价 / 报价确认 / 还款账单已写入 `01` §1.3a；`02`、`05`、`07` 的叙述性“账单”已替换，兼容名 `billing`/`confirm_bill`/`billConfirmed(At)` 保留；`05` 领域模型 `Billing` → `LoanQuote`，新增 `RepaymentBill`。`03`、`06` 为历史文档，不再维护 |
| 8 | CR-001 是否需同步到其他文档 | **已同步** | `01`（FR-6.2/6.2a/6.2b/6.2c/6.7/6.8、§7.1 Gate）、`02`（术语框、`create` 非幂等事实、流程双轨、限制 9–12）、`05`（§0 D13–D16、§5.4、§9.1、§13 全章、§18.2、§19.2、§25.2/25.3、§29、ADR-012）、`06`（状态说明）。`04` 的同步项见 R-1 至 R-14 |
| 9 | AF-6 是否被所有技术方案正确考虑 | **此前不正确，已更正** | **`05` §19 原写“服务端对已处理的 requestId 直接返回现状，安全”对 `create` 不成立**（`store.ts:20` 先于 `domain.ts:18`）。已更正：恢复判定改为“同 `requestId` 重发 → 200，或 409 后按 `loan.billing.quoteId` 判定已成功”；`OperationRunner` 的“被拒即删除 pending”加了 `create` 例外；`02` §3.5 标明此事实；`07` §11/§17/§22 定义修复、原子边界与 A-xx、U-xx 测试 |
| 10 | Gate 状态是否需要变化 | **不变** | G0 = GO；G1 = CONDITIONAL；G2 = CONDITIONAL；G3 = BLOCKED。条件已细化，见第 7 节 |

## 3. 本次对账新发现

| 编号 | 类型 | 发现 | 处理 |
|---|---|---|---|
| N-1 | FACT | 仅 `create` 受 AF-6 影响；`confirm_bill`、`apply`、`withdraw`、`repay` 的前置检查不会先于去重拦截成功重试（`apply` 在 KYC 之后被改动的极端情况除外） | `07` §11.3 限定修复范围，不重构其余动作 |
| N-2 | REQUIRED CHANGE | “返回原始成功结果”需要可定位的幂等结果：现有 `requests` 只存 id，不存 Loan | `07` §11.1 定义：同一次 CAS 内追加 `requests` 并在 Loan 写 `createRequestId`（内部字段，客户投影排除）；重放返回 200 + 当前完整 state，**不重新校验** |
| N-3 | FACT | **Legacy 与 Option B 并存**：同一客户可能经 Web/Mini App 创建 `kyc_approved` 且未确认的贷款 | App 必须保留 `confirm_bill` 兼容动作接续（`01` FR-6.2c、`05` §13.2）；`04` 首页状态“已创建未确认报价”只可能来自 Legacy（R-7） |
| N-4 | FACT | 服务端**没有“剩余应还”字段**；`repay` 内部用 `amount + fee − paid`；`postloan` 现无罚息 | 还款账单的“剩余”允许作为**派生显示值**，且必须标注 `DERIVED_DISPLAY`、仅用于展示（`05` §13.6）。建议后端日后直接返回，列为非阻断项 |
| N-5 | FACT | **审计 F-01（客户可单方还款）在仓库四份副本中均未修复** | 不影响 G3 的“测试资金”联调，但**真实资金上线前必须修复**；Android 的 repay/withdraw 继续受构建开关控制 |
| N-6 | FACT | 开发期“每工作区 100 笔”仍硬编码在四份副本 | OD-5 已决策：改为显式配置，生产默认不启用（`07` §26.1），后端任务 BE-07 |

## 4. Codex Review Items（对 `04` v2，Codex 修订）

| 编号 | 位置 | 问题 | 要求 | 影响 Gate |
|---|---|---|---|---|
| **R-1** | §17 `/loan/quote/confirm`（原表与 “Write and Quote Route Contract” 表）、`/loan/bill/:id` | API 写“`confirm_bill` compatibility + `create(quoteId)`”。**Option B（`07` OD-3 已冻结）：`create` 携带 `quoteId` + `billConfirmed:true`，不再调用 `confirm_bill`** | `/loan/quote/confirm` 的 Required API 只写 `create`；`/loan/bill/:id` 在新流程中是**只读借款报价摘要**，仅 Legacy 创建、未确认的贷款才有“确认借款报价”动作（兼容 `confirm_bill`） | **G3** |
| **R-2** | §6 行“Loan Quote loaded”、§15、§16 第 6 项、页首 Aligned with、`/loan/quote` 行 | 仍写“`07` 当前工作区缺失”“`expiresAt` 若 CR-001 支持”“不依赖稳定 errorCode” | 改为引用 `07` v2：**TTL 15 分钟，`expiresAt` 必有，`errorCode`（`QUOTE_*`）在 Quote 与 `create+quoteId` 上提供**；UX 状态由 `errorCode` 驱动，未知码按 HTTP 状态回退。页首对齐版本改为 `05` v3、`07` v2、`01` v2、`02` v2 | G3 |
| **R-3** | §3 导航规则第 2 条 | “公司切换：**清理当前公司展示快照**”，与 §2（“切换公司不删除原公司数据”）自相矛盾；RC-7 声明已修但此处未改 | 改为“切换只切换 Active Company 并加载目标公司的 Session + Cache，**不清理原公司数据**；仅 Remove Company / Clear All Data 才删除” | **G1** |
| **R-4** | §3 第 1 条、§5 “Session Expired” | “保存 Return Intent + 表单草稿”易被理解为草稿落盘 | 明确：草稿为**内存**，仅同一进程内保留；进程被杀后只恢复**已成功保存到服务端**的 KYC 分组（Q-A2） | G2 |
| **R-5** | §4 路由表与 §17 | 路由表有 `/auth/recover/reset`，原型契约只有 `/auth/recover` 与 `/auth/recover/code`（重置动作在 `code` 页） | 二选一：删除 `/auth/recover/reset`，或补充其契约行 | **G1** |
| **R-6** | §17 `/loan/status/:id` | Primary 为“查看账单” | 按状态区分：放款前称“借款报价摘要”，`active` 后称“还款账单”；全文不再单独使用“账单” | G3/G4 |
| **R-7** | §6 行“kyc_approved，已创建未确认报价”、§9 `ACTIVE_APPLICATION_EXISTS` | ① Android 创建的贷款在 Option B 下创建即已报价确认，此状态只可能来自 **Legacy 创建**；② **AF-6**：`create` 结果不确定后重试，修复前可能得到 `ACTIVE_APPLICATION_EXISTS`，若此时已存在 `billing.quoteId` 等于刚确认的 `quoteId` 的贷款，**应作为成功继续到条款，而不是展示“已有进行中申请”的错误** | 补充这两点；“Create unknown”状态的解析结果分三种：成功（含兜底判定）/真实冲突/仍未知 | **G3** |
| R-8 | §17 `/home` 行 | “13 states”，实际矩阵已 21 行 | 改为“见 §6 状态矩阵” | — |
| R-9 | §5 “Loan Application”、§17 `/loan/apply`、`/loan/quote` | 缺少报价有效期（15 分钟）的倒计时与“即将过期”状态；未规定切换金额/期限时的请求节流 | 报价页显示有效期；**不得每次切换选择就自动请求**（`07` OD-6 限流；`05` 按 `(amount, termDays)` 缓存未过期报价）。需有显式“获取借款报价”操作 | G3 |
| R-10 | §8 “active” 行 | “应还总额、已还、剩余”未说明“剩余”为派生值 | 注明“剩余”为**派生显示值**（`05` §13.6），不得作为任何提交或校验输入；还款金额上限以服务端校验为准 | G4 |
| R-11 | §15 后端依赖 | 缺 **AF-6（`create` 幂等修复，P0，G3 BLOCKING）**与 OD-5（容量上限改显式配置） | 补入，并标注 G3 Blocking | G3 |
| R-12 | §17 `/auth/telegram-consent` | 未规定同意框默认状态 | **不得预勾选**（接口要求显式 `consent:true`） | G1 |
| R-13 | §5 “Offline Recovery” | 已有 Unknown Outcome，但未区分**资金类需用户确认**与**非资金类自动同 `requestId` 恢复** | 补充：非资金类（create/apply）自动恢复；资金类（repay/withdraw，开关开启时）**先询问用户** | G3 |
| R-14 | 页首 Revision Log | 标注“RC-3/RC-7 FIXED”，但 R-3、R-5 说明并非全部落实 | 修订后更新 Revision Log，列出本次 R-x 的处理 | — |

> **UX Constraint（给 Codex，非 Review Item）**：任何界面不得展示由客户端计算出的借款报价数字；还款账单的“剩余”必须标注为派生显示；条款为中文原文时显示“当前签约条款为中文正式版本”。

## 5. 文档变更清单（本次已做）

| 文件 | 变更 |
|---|---|
| `01-requirements.md` | v2；新增 §1.3a 统一术语；FR-4.2/6.x 改写（Option B、FR-6.2c Legacy、FR-6.7 AF-6、FR-6.8 Unknown Outcome）；首页状态用语；§7.1 Gate 与 G3 八项条件；风险表加入 F-01 现状与 OD-5 |
| `02-api-contract.md` | v2；§3 术语框；`billing`/`billConfirmedAt` 语义；**`create` 非真正幂等（AF-6）事实**与客户端兜底；§6 流程分 Legacy/Android 目标两轨；§7 限制 9–13（报价缺失现状、AF-6、100 笔上限、“剩余”无字段） |
| `05-flutter-technical-architecture.md` | v3；决策冻结表；§0 D13–D16；§5.4 `LoanQuote`/`RepaymentBill`；§9.1 采纳 `04` v2 路由；**§13 重写**（Option B、Legacy 兼容、§13.6 还款账单）；§18.2/§19.2 更正 AF-6 恢复判定；§19.3 `quote` = None；**§25.2 Gate 状态、§25.3 G0 报告要求、G3 八项条件**；§26 LOAN-02/QUOTE-01/SETTINGS-01；§29 CR-001 改为引用 `07`；ADR-012 重写 |
| `06-contract-review.md` | 加状态说明：Gate 以本文为准 |
| `07-CR-001-quote-contract.md` | v2；已冻结决策表（OD-1/2/3/4/5/11）；统一术语；AF-6 升 P0；**§11 重写为 Command Idempotency**；§17 原子边界含幂等结果；§22 增 A-01–A-05、U-01–U-08；§23 实现顺序（AF-6 先行）；§26 仅列未决项；§27 八项解除条件；OD-5 改显式配置；`billing_json` → `quote_snapshot_json` |
| `09-architecture-reconciliation.md` | 本文（新增） |

## 6. 后端实现任务（等待 `07` 签署后；指派人待定）

> 这些是对**现有后端代码**的改动，不属于 Flutter。若由 Trae 执行，需项目方明确指派；否则由后端负责人执行。**`07` §28 未签署前不得开始。**

| 编号 | 任务 | 优先级 | 依赖 | 验收 |
|---|---|---|---|---|
| BE-01 | **AF-6 修复**：`create` 路径的 `requestId` 查找移到 `store.ts:20/22/23` 之前；Loan 记录 `createRequestId`（内部字段，客户投影排除）；重放返回 200 + 当前 state，不重新校验 | **P0** | 无（对 Legacy 向后兼容，可独立先上线） | `07` §22：I-01、U-01–U-03、U-06、U-07、C-01 |
| BE-02 | 迁移：`loan_quotes`（每条语句 `--> statement-breakpoint`；编号取实现时下一个可用号） | P1 | 签署 | 迁移在 standalone 流程中演练通过 |
| BE-03 | `POST /api/loan/quote`：校验、资格预检、`calculateBill` + `pricingFor`、持久化快照、复用策略、TTL 15 分钟、限流 | P1 | BE-02 | `07` §22：Q-01–Q-07、S-01–S-03、X-*、E-01 |
| BE-04 | `create` 集成：Quote 校验与消费（固定判定顺序）、`pricing_fingerprint` 比对、`billConfirmed` → `billConfirmedAt`、单次 CAS 原子写入、镜像写与对账 | P1 | BE-01、BE-03 | A-01–A-05、P-01–P-03、T-*、I-02–I-04、C-02–C-04 |
| BE-05 | `errorCode`：Quote 与 `create+quoteId`；透传型错误，不被 `state` 路由折叠 | P1 | BE-03 | 错误码表 §14.2 全覆盖 |
| BE-06 | 限流：导出/复用 `h5_limits` 机制 | P2 | BE-03 | X-06 |
| BE-07 | 容量上限改显式配置（生产默认不启用） | P2 | OD-13 | 生产默认无上限；Sandbox 可配置 |
| BE-08 | 契约测试套件与未知结果重试测试 | P1 | BE-01–BE-05 | `07` §27 第 4–7 项 |

## 7. Gate 状态与解除条件

| Gate | 状态 | 解除/放行条件 |
|---|---|---|
| **G0** | **GO** | 立即开工。**当前无任何产出**。Exit：`05` §25 的 G0 Exit + **§25.3 的 7 项报告** |
| **G1** | **CONDITIONAL** | ① G0 Exit 且 G0 报告通过对账；② 三方 Gate Review（Architecture + UX + API）；③ Codex 完成 R-3、R-5、R-12 |
| **G2** | **CONDITIONAL** | G1 Exit；Codex 完成 R-4；`options.json` 副本版本确认；`cookie_jar` spike 结论落档 |
| **G3** | **BLOCKED** | **8 项全部满足**：`CR-001 APPROVED` + `Quote API IMPLEMENTED` + `AF-6 IDEMPOTENCY FIX IMPLEMENTED` + `QUOTE/CREATE ATOMICITY PASS` + `CONTRACT TEST PASS` + `CONCURRENCY TEST PASS` + `UNKNOWN-OUTCOME RETRY TEST PASS` + `ANDROID INTEGRATION TEST PASS`。另需 Codex 完成 R-1、R-2、R-7、R-9、R-11、R-13 |
| G4 / G5 | 未变化 | G4 需 G3 Exit；G5 另需 CR-002（`assetlinks.json`）上线与合规确认 |

---

## Claude Decisions

1. **术语冻结落地**：借款报价 / 报价确认 / 还款账单。Domain：`LoanQuote`（同一类型覆盖 Create 前的 Quote 与创建后的 `loan.billing`）、`RepaymentBill`；废止 `Billing`。API 兼容名保留。`03`、`06` 为历史文档不再维护。
2. **AF-6 定义**：幂等结果 = 同一 CAS 内 `requests` 追加 + Loan 的 `createRequestId`；**重放返回 200 + 当前完整 state，不重新校验**；可选幂等键复用检测（OD-12，非阻断）。
3. **Quote 的 POST 不做 HTTP 重试**（`05` §19.3）：不属于“明确安全的 GET”，由用户主动重试，客户端按 `(amount, termDays)` 缓存未过期报价。
4. **还款账单的“剩余”**允许作为**派生显示值**，必须标注并预留替换为服务端字段；禁止参与任何提交或校验。
5. **Legacy 兼容**：新流程不调用 `confirm_bill`，但 App 必须保留该兼容动作接续 Web/Mini App 创建的未确认贷款。
6. **`create` 未知结果判定**：同 `requestId` 重发；409 后按 `loan.billing.quoteId` 兜底判定已成功。`OperationRunner` 的“被拒即删除 pending”对 `create` 加例外。
7. **存储命名**：`loan_quotes.billing_json` 改为 `quote_snapshot_json`；最终 Loan 的 `billing` 字段名因 API 兼容保持。
8. **OD-5 落地**：开发期上限仅作为显式配置；先做部署级配置，未设置 = 不限（OD-13 允许后端细化到公司级）。
9. **G1/G2 条件**与 **G0 报告模板**已写入 `05` §25.2/§25.3。
10. **未改动 `04`**；所有对 `04` 的问题以 Review Item 形式交 Codex。

## Codex Review Tasks

对 `04-ux-architecture.md` v2 修订，**优先级**：

1. **G1 前**：**R-3**（公司切换缓存措辞）、**R-5**（`/auth/recover/reset` 路由）、**R-12**（同意框不预勾选）。
2. **G2 前**：**R-4**（草稿=内存）。
3. **G3 前**：**R-1**（Option B，去掉 `confirm_bill`）、**R-2**（引用 `07` v2，TTL/`expiresAt`/`errorCode`）、**R-7**（Legacy 与 AF-6 的 Create-unknown 解析）、**R-9**（有效期倒计时与请求节流）、**R-11**（后端依赖补 AF-6 与 OD-5）、**R-13**（资金类恢复需用户确认）。
4. **文档整洁**：R-6、R-8、R-10、R-14。
5. 修订后在 Revision Log 中逐条标注处理结果，并将页首“Aligned with”更新为 `01` v2、`02` v2、`05` v3、`07` v2、`09`。
6. 对 `07` 的 UX 侧审查：第 21 节 Flutter Contract 的报价页字段是否满足展示需求（本金、利息/服务费分项、到账、应还、期限、有效期、`interestTiming`/`serviceTiming` 说明文案）。

## Trae Implementation Tasks

**现在可以开工（G0，Flutter 基础设施，不含任何业务页面）**，建议顺序：

1. **FND-01**：`flutter create --platforms=android`；目录；`test/architecture/dependency_rules_test.dart`。
2. **CORE-CONFIG-01**、**CORE-STORAGE-01**。
3. **`cookie_jar` spike（先于 CORE-SESSION-01 实现）**：核实 4.0.9 的 `Storage` 真实签名、`PersistCookieJar` 的 `persistSession`、仅删除会话 Cookie 的方式、`dio_cookie_manager 3.5.0` 在预置 `payease_company` 时的 `Cookie` 头行为；结论写入 G0 报告，**不得让 `05` 的伪代码约束真实依赖库**。
4. **CORE-SESSION-01**（`cookie_jar` + `SecureKvCookieStorage` + `WhitelistCookieJar` + 公司分区）、**CORE-NET-01**（每公司 Dio、7 个拦截器、`Endpoints.retry` 仅三个 GET）、**CORE-ERR-01**、**CORE-LOG-01**、**CORE-APPLINK-01**（只做 Manifest 与链接解析器）。
5. **CORE-L10N-01**（ARB 骨架、高棉字体）、**CORE-SEC-01**（`FLAG_SECURE`、`allowBackup=false`、`TempFileSweeper`）、**CORE-MONEY-01 / CORE-FLAGS-01**、测试基础与模拟服务骨架（`TEST-INT-01` 仅骨架）。
6. **生产冒烟**：仅 `GET /api/h5/auth` 与无副作用 `POST /api/h5/auth/logout`；**不得发送验证码、创建账号、KYC 或贷款数据**。
7. **G0 报告**：按 `05` §25.3 的 7 项提交，并列出与 `05` 的任何偏差。

**禁止**：KYC/Loan 页面、完整 Router、Home UI、Design System、业务 Widget、`CORE-IDEM-01`（G3 前再做）。

**G3 之前不要开始**：`QUOTE-01`、`LOAN-02` 的 `create` 部分。

**后端实现任务**（BE-01 至 BE-08，见第 6 节）：**指派人待项目方确认**；`07` 签署前不得开始。

## Blocking Dependencies

| 依赖 | 阻塞对象 | 状态 |
|---|---|---|
| **`07` Approval Record 签署** | 全部后端实现、G3 | 未签署（`PROPOSED`） |
| **BE-01 AF-6 修复（P0）** | G3 | 未实现 |
| **Quote API + `loan_quotes`（BE-02/03/04）** | G3 | 未实现 |
| **`07` §22 的原子性、并发、未知结果测试通过** | G3 | 未执行 |
| Codex 修订 `04`：R-3、R-5、R-12 | G1 | 待办 |
| Trae G0 Exit 与 G0 报告 | G1、对账第 3 项 | **G0 尚未开始** |
| 三方 Gate Review（Architecture + UX + API） | G1、G2 | 待 `04` 修订与 G0 完成后 |
| `cookie_jar` spike 结论 | CORE-SESSION-01 冻结、G2 | 待 Trae |
| 后端负责人/执行人指派 | BE-01 至 BE-08 | **待项目方决定** |
| CR-002（`assetlinks.json`） | G5 的 App Links 验收 | 非阻断，未上线 |
| **审计 F-01 等安全阻断项修复** | 真实资金上线（非 G3 联调） | **仓库四份副本中未见修复** |
| 法务：条款译文与签约语言 | 展示策略（不阻塞开发） | 待定 |

## Gate Status

```
G0 = GO              （可立即开工；当前无任何产出）
G1 = CONDITIONAL     （G0 Exit + G0 报告 + 三方 Gate Review + Codex R-3/R-5/R-12）
G2 = CONDITIONAL     （G1 Exit + Codex R-4 + options.json 副本确认 + cookie_jar spike）
G3 = BLOCKED         （8 项全部满足才解除；当前 0/8 已满足）
```
