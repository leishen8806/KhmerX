# KhmerX Android · Contract Review（04 UX × 05 技术架构 × 02 接口契约）

> **状态更新（2026-10-07，Architecture Reconciliation）**：本文是对 `04` v1 的审查。`04` 已更新为 v2，RC-1 至 RC-7 已由 Codex 声明修复；**当前 Gate 状态与剩余 Review Item 以 `09-architecture-reconciliation.md` 为准**。本文中涉及 `/loan/bill`、`confirm_bill` 的流程描述已被 `07` v2 的 Option B 取代。

- 日期：2026-10-07
- 审查对象：`04-ux-architecture.md` v1（Codex）、`05-flutter-technical-architecture.md` v2、`02-api-contract.md`
- 事实优先级：现有代码 → `02` → `01` → `04` → `03`。UX 与 API 契约冲突时，API 契约优先。
- 原则：**不改动 04 本身**；需要 Codex 修订的内容列为 **RC（Required Change）**，技术侧调整列为 **TA（Technical Adoption）**。

## 1. 结论

| 范围 | 结论 |
|---|---|
| 路由与信息架构 | **接受 04 的路由命名**，05 §9 改用 04 的路由 |
| 首页 13 状态、KYC/Loan 状态矩阵 | **接受**，与 `LoanStageMapper`、需求 §5 一致 |
| 设计令牌、组件、无障碍、本地化规则 | **接受**，无技术冲突 |
| **G1（Company + Auth）Entry** | **有条件通过**：需先修正 RC-5（找回密码的接口映射）。其余 RC 不阻塞 G1 |
| G2（KYC） | 需先完成 RC-2、RC-3 |
| **G3（Loan Application）** | **BLOCKED BY CR-001**，且需先完成 RC-1、RC-4 |

## 2. Required Changes（需要 Codex 修订 04）

### RC-1　**申请流程与已冻结决策冲突（阻塞 G3）**
- **04 现状**：§5 与 §17：`home(approved) → loan/apply → POST create → loan/bill → terms → sign → result`。即**先 create，后展示账单**。
- **冲突**：2026-10-07 已冻结 Q-A1：必须**先获取服务端 Quote，用户确认费用后才创建申请**（CR-001）。
- **要求**：流程改为
  `loan/apply（选额度与期限）→ loan/quote（服务端报价展示 + 确认）→ create（携带 quoteId）→ terms → sign → result`。
  - 新增路由（建议）`/loan/quote`，进入条件：已选金额与期限；所需数据：CR-001 报价；状态：加载 / 已过期（“报价已更新，请重新确认”）/ 错误 / 离线；主操作“确认并创建申请”；文案须明确**创建后不可撤销、会占用当前申请名额**。
  - `/loan/bill/:id`：CR-001 若支持 `create` 同时记录账单确认，则该页退化为只读摘要；**最终以 CR-001 冻结契约为准**，04 先按“可能不存在”预留。
  - 04 已有的 `ServerQuoteCard` 组件可直接复用于报价页。
- **范围**：仅影响 G3 及其页面，G0–G2 不受影响。

### RC-2　KYC 草稿语义与“已保存/未保存”状态（G2 前）
- **04 现状**：§3、§5 写“保存 Return Intent 与表单草稿”，§1 写“草稿…不丢用户输入”，容易被读成“草稿落盘”。
- **冻结规则（Q-A2）**：服务端是草稿唯一持久化来源；内存保存当前页未保存编辑；**磁盘不存 KYC PII**；“继续”同步保存；切换分组、离开、切后台、Save & Exit 尽力保存；**强杀进程可能丢失当前分组未保存输入**。
- **要求**：
  1. 文案澄清：草稿 = 服务端已保存 + 当前内存；**不得承诺本地持久化**。
  2. KYC 表单增加**“已保存 / 未保存 / 保存中 / 保存失败”**状态与提示。
  3. 增加 **Save & Exit** 操作与离开未保存时的确认。
  4. “继续”保存失败时留在当前页并定位原因（服务端会因任一字段格式不合法而整体拒绝，客户端只提交合法字段，不合法的留在内存）。

### RC-3　`ruleVersion` 不一致页（G2 前）
- **04 现状**：路由表没有该状态。
- **要求**：新增 KYC 只读降级与**强制升级提示页**（建议 `/kyc/update-required`）：说明“需要升级应用才能继续填写”，显示去应用商店的操作，允许查看已有状态与审核意见；**不允许编辑与提交**。KYC 已 `approved` 的客户贷款流程不受影响。

### RC-4　“结果不确定”的写操作状态（G3 前）
- **04 现状**：只有“离线 / 超时 / 409”，没有“请求已发出但结果未知”。
- **背景**：写操作超时或断连时，服务端可能已成功（`PendingOperation = unknown`，05 §19）。
- **要求**：设计
  1. **“正在确认结果…”**状态：禁止重复点击，自动用同一 `requestId` 恢复；
  2. 非资金类恢复成功后的**轻提示**；
  3. **资金类（提现/还款，开关打开时）恢复需用户确认**的对话（“上次操作结果未确认，是否继续？”）；
  4. 恢复超时后的“已刷新状态，请核对”提示。

### RC-5　找回密码的接口映射有误（**G1 前，必须改**）
- **04 现状**：§17 `/auth/recover` 的所需数据写为“send/verify/account”。
- **事实**：找回密码使用 `POST /api/h5/auth/recovery`（`action: send` 与 `action: reset`），**不经过** `verify` 与 `account`。重置需要 `challengeId`、验证码、新密码与确认密码，成功后**旧会话全部失效**，需用新密码重新登录。
- **要求**：更正为 `recovery send / recovery reset`；成功后落到 `/auth/password`（已与 04 一致），并说明“旧会话已失效”。

### RC-6　后端依赖清单补充（文档）
- **04 §15** 缺少：**CR-001 无副作用报价（G3 前置）**、**CR-002 `assetlinks.json`（非阻断，阻塞 App Links 最终验收）**。
- **要求**：补入，并标注 CR-001 为 **G3 Blocking Dependency**。

### RC-7　公司切换时的缓存说明（文档，不阻塞）
- **04 §3** 写“公司切换：清理当前公司展示快照”。
- **技术方案**：切换公司**不清除**旧公司数据（会话、缓存、待定操作均按 `companyId` 隔离，登出才清除当前公司）。
- **要求**：改为“按公司隔离，不互相可见”；**不要向用户承诺“切换会清空数据”**。

## 3. Technical Adoption（05 采纳 04 的内容）

| 编号 | 调整 |
|---|---|
| TA-1 | 05 §9 路由表**改用 04 的路由命名**（`/startup`、`/company/*`、`/auth/*`、`/home`、`/loans`、`/kyc/*`、`/loan/*`、`/me/*`、`/feature/*`），原“临时名”作废 |
| TA-2 | `RouterGate` 的重定向目标映射：未选公司 → `/company/select`；未登录 → `/auth/login`；注册未完成 → `/auth/set-password`；KYC 约束 → `/kyc`；启动 → `/startup` |
| TA-3 | 04 的 `/feature/repay/:id`、`/feature/withdraw/:id` 由 `FeatureFlags` 控制，**路由层也要在开关关闭时拒绝进入**（不只是隐藏入口） |
| TA-4 | “消息”只展示 `LoanEvent` 的**本地化动作标签与时间**，**不展示服务端 `note`**（可能含员工信息，审计 B-01）；未知动作显示通用文案 |
| TA-5 | `/auth/telegram-consent` 对应 `consent:true` 的显式同意步骤，**同意状态不得预勾选** |
| TA-6 | 04 §9 “unknown：本地化文案 + request context”：**context 只允许使用本地 trace id**，不得包含请求体、手机号、Cookie 等 |
| TA-7 | 04 §9 “400 就地标字段”适用于 KYC 与表单校验；`POST /api/h5/state` 的统一 400 **无法定位字段**，按 05 §18.2 重新拉取状态后诊断，UI 展示“操作未完成，请核对当前状态” |
| TA-8 | 04 中 Logo 等资源复制为客户端资产（只读引用 `public/brand/`，不改动现有目录） |

## 4. 对接核对表（04 §17 Prototype Contract × 接口契约）

| 04 路由 | 契约核对 | 结果 |
|---|---|---|
| `/startup`、`/company/*` | `GET /api/h5/auth`、公司链接 `c=t_<uuid>` | ✅ |
| `/auth/login`、`/auth/telegram-code` | `send`/`verify`，验证码 5 分钟、5 次、重发 60 秒 | ✅ |
| `/auth/password` | `account password_login`，失败统一文案 | ✅ |
| `/auth/set-password` | `account set_password`，12–128 位 | ✅ |
| `/auth/recover` | **应为 `recovery send/reset`** | ❌ → RC-5 |
| `/home`、`/loans`、`/loans/:id` | `state`、`kyc.status` | ✅ |
| `/messages` | `state.events` | ✅（仅标签，TA-4） |
| `/kyc`、`/kyc/:step`、`/kyc/files` | `GET/POST /api/kyc`、`/api/kyc/files`（原始字节，槽位限制） | ✅ |
| `/loan/apply` | **缺报价步骤** | ❌ → RC-1 |
| `/loan/bill/:id` | `confirm_bill` + `quoteId` | ✅（CR-001 后可能调整） |
| `/loan/terms/:id`、`/loan/sign/:id` | `GET/POST /api/loan/sign`，头 `x-loan-*`，每次新图 | ✅ |
| `/loan/contract/:id` | `GET /api/kyc/contract` | ✅ |
| `/me/password` | `set_password` 需 `currentPassword` | ✅ |
| `/me/language` | `languages` + `POST /api/h5/locale` | ✅ |
| `/feature/*` | 开关默认关闭 | ✅（TA-3） |

## 5. 下一步

1. **Codex**：修订 04（RC-1 至 RC-7）。优先顺序：**RC-5 → RC-2/RC-3 → RC-4/RC-1 → RC-6/RC-7**。
2. **Claude**：05 采纳 TA-1 至 TA-8（已同步 §9 与状态）；起草 **CR-001 报价契约**供后端评审。
3. **Trae**：**G0 可立即开工**（不依赖 04 的任何修订）。G1 在 RC-5 修正后开始。
4. **G3 保持 `BLOCKED BY CR-001`**。
