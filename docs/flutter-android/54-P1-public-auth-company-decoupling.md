# P1 Public Customer Auth / Company Decoupling Delta

```
Document:  54-P1-public-auth-company-decoupling.md
Date:      2026-10-09
Owner:     Claude（Product / Requirements / Architecture / API Contract）
Status:    PROPOSED — READY FOR CODEX QUICK REVIEW（不自批；Trae = HOLD）
Supersedes: 52-P1-customer-entry-delta.md（静默公司解析 / defaultCompanyId 方案——前提已被业主推翻）
Amends:    45-P1-entry-home-readonly-loan-contract.md（见 §10；本文先记录 Delta，再改 45）
Evidence:  真实后端/网关代码（lib/h5-auth.ts、lib/h5-auth-core.ts、lib/team/server.ts、deploy/standalone/server.mjs、db/schema.ts）。未运行代码。
Not done:  不写 Flutter 代码；不改后端；不删除 CF-0/CF-6 或租户隔离。
```

## 0. Project Identity
```
PROJECT IDENTITY CHECK: PASS
PROJECT: KhmerX · ROOT: E:\KhmerX\KhmerX · REMOTE: git@github.com:leishen8806/KhmerX.git
HEAD: d916b4515a93057d7dd2a0673ebbca39a7bfd242 · worktree: 仅 docs/ 与 mobile/ 未跟踪
```

## 1. 业主规则（冻结）

KhmerX 客户端是**面向公众的借款 App**：任何普通用户都可以注册和登录。客户注册/登录**不要求**选择公司、隶属机构、邀请链接、CompanyId、`defaultCompanyId`、机构二维码。

> 因此 `52` 的前提（生产需要 `defaultCompanyId`、静默公司解析、Recovery 页）**作废**。

目标启动：
```
Launch → 恢复公开客户会话 → 认证预检 → 已认证 ? Home : Login
```
无公司解析屏；无默认机构要求；不因"没有 CompanyId"出现 Recovery 页。

## 2. 真实代码取证：CompanyId 今天在哪里是"技术必需"

| # | 事实 | 证据 |
|---|---|---|
| F1 | 所有客户认证端点都以 **`owner()`** 作为数据分区键：`owner() = customerCompany()?.id ?? user.userId`。`customerCompany()` 读 `payease_company` Cookie；**缺失时返回 null（不抛错）**，此时 owner 退化为"访客身份 `visitor:<uuid>`" | `lib/h5-auth.ts` `owner()`；`lib/team/server.ts` `companyByCookie`（`!v ⇒ null`） |
| F2 | **客户账号按 `(owner, phone_key)` 定位**：`h5_accounts` 主键含 `customer_id + owner`；查询均为 `WHERE owner=? AND (phone_key=? OR customer_id=?)`。会话（`h5_sessions.owner`）、验证码挑战（`h5_challenges.owner`）、限流键、`kyc_cases.owner`、贷款工作区（`demo_workspaces.owner`）、Telegram 渠道（`telegram_bot_credentials.owner`）同样按 owner 分区 | `lib/h5-auth-core.ts`（多处 SQL）；`db/schema.ts`；`lib/store.ts:9-12` |
| F3 | 因此 **owner ≠ 路由元数据，而是租户分区键**：同一手机号在两个 owner 下是**两个独立账号**；同一手机号在无公司（访客 owner）下，换设备/重装（新访客 id）又是**新账号** | F1+F2 |
| F4 | **生产网关兜底**：`deploy/standalone/server.mjs:68` 若请求无 `payease_company`，则追加 **`cfg.companies[0].id`**（配置数组第一项）。所以生产里"客户端不发公司"≠ 访客 owner，而是**悄悄落入第一家公司** | `server.mjs:63-68` |
| F5 | 直连 Worker（绕过网关）且无公司 Cookie：owner = 访客 id（每个安装各自一个私有工作区）→ 账号不可跨设备，**不是公共身份** | F1 |
| F6 | 公司还决定：定价（`pricingFor`；非 `t_` owner 用默认定价）、可选语言（公司的 `client_*_enabled`）、业务渠道（bot）、员工分配/审批范围、资金限额（公司日/月）、KYC 评审归属 | `lib/pricing.ts`；`lib/team/server.ts`；`lib/funding-limits.ts` |
| F7 | **限流按 owner 汇总**：同公司 30 次/小时发码、同公司 60 次/15 分钟密码登录等（BR-7）。若所有公众用户落在**同一个**公共工作区，这些"公司级"上限会成为**全体用户共享的总额度** | `lib/h5-auth-core.ts:43-45,134`；`02` BR-7 |
| F8 | 贷款/KYC 必须有人审批、放款、对账，所以**每笔贷款最终需要一个运营主体（机构）** | F2、F6 |

## 3. 分离：A 客户身份 vs B 内部多租户路由

| | A. 客户身份/认证 | B. 内部多租户/机构路由 |
|---|---|---|
| 客户视角 | 公开：任意手机号注册/登录 | 不可见 |
| 今天的实现 | 账号以 `(owner, phone)` 定位 | `owner = 公司 id` |
| 是否需要客户"选择"公司 | **否**（业主规则） | 否 |
| 是否需要服务端有公司概念 | **是（作为数据分区与运营主体）** | 是：贷款归属、机构专属方案、后台隔离、未来路由 |

**结论**：公司在**服务端**仍是必需的分区键（F2/F6/F8），但**不应由客户或 Android 提供**。正确的解耦是：**服务端提供一个"公开客户工作区（Public Customer Workspace）"，作为无公司上下文时的确定性、受配置控制的默认**；Android 以"公开上下文"运行，不选择、不持有、不展示公司。

## 4. 回答具体问题

| 问题 | 答案 |
|---|---|
| 各端点当前是否**要求** `payease_company`？ | **代码层不要求**（缺失不抛错，owner 退化）；**生产层事实上总有**（网关兜底 `companies[0]`，F4） |
| 公司是否用于定位客户账号？ | **是**（F2：`(owner, phone_key)`） |
| 公司只是路由元数据吗？ | **不是**，是租户分区键（F3） |
| 缺失公司是否触发代理"第一家公司"兜底？ | **是**（`server.mjs:68`） |
| 公开认证能否在无公司情况下"安全地"工作？ | **今天能工作（靠网关兜底到第一家公司），但不是受契约保证的**：依赖数组顺序（改配置顺序会让既有用户"消失"）、且公司级限流会变成全体共享（F7）。直连 Worker 则会得到访客私有 owner（F5，不可用） |
| 若不能，需要什么后端改动？ | 见 §7（CR-003：显式配置的公开工作区 + 公开工作区限流策略），**服务端小改，Android 不需要公司** |

## 5. Auth Endpoint Matrix

| Endpoint | 与公司的耦合 | 分类 | 说明 |
|---|---|---|---|
| `GET /api/h5/auth` | 用 `customerCompany()` 取公司名/语言开关/策略；浏览器令牌表 `h5_browser_tokens` **全局**（不分 owner） | **PUBLIC-CAPABLE NOW**（经网关兜底）· 需 **BACKEND CHANGE** 以显式化 | 无公司时 `company:null`（直连）；生产落到 `companies[0]`；语言开关来自该公司行 |
| `POST /api/h5/auth/send` | `owner()`；挑战、限流（含 **同公司 30/小时**）按 owner | **COMPANY-COUPLED** · **REQUIRES BACKEND CHANGE**（限流策略，F7） | 公开规模下总额度太小 |
| `POST /api/h5/auth/verify` | `owner()`；首次验证**在该 owner 下建号** | **COMPANY-COUPLED**（由公开工作区满足） | 账号归属公开工作区 |
| `POST /api/h5/auth/account`（`password_login`/`set_password`） | `owner()`；账号查找、同公司 60/15 分钟 | **COMPANY-COUPLED** · 限流同上 | |
| `POST /api/h5/auth/recovery` | `owner()`；挑战/账号按 owner | **COMPANY-COUPLED** | |
| `POST /api/h5/auth/logout` | `owner()` + 会话 | **COMPANY-COUPLED**（平凡） | |
| `POST /api/h5/auth/telegram` | `owner()` | Mini App 专属，Android 不用 | |
| `GET /api/h5/state` 等业务读写 | 全部按 owner（贷款/KYC） | **COMPANY-COUPLED**（由公开工作区满足） | |

综合：**COMPANY REQUIRED FOR CUSTOMER AUTH = PARTIAL**——服务端需要一个工作区/租户作为分区；**客户/Android 不需要选择或提供公司**。

## 6. 目标后端（建议：**CR-003 Public Customer Workspace**，服务端变更）

| # | 变更 | 目的 |
|---|---|---|
| B1 | 新增**显式服务端配置** `PUBLIC_CUSTOMER_COMPANY_ID`（指向承担公众客户的运营主体公司行）。网关在缺少 `payease_company` 时注入**该配置值**，**取代**"`cfg.companies[0]`（数组第一项）"；API 层 `customerCompany()` 缺失时同样回退到该配置（而不是访客 owner） | 把偶然兜底变为受契约约束的行为；消除顺序依赖；直连与经网关一致 |
| B2 | **公开工作区限流策略**：公司级 30/小时发码、60/15 分钟密码登录等**不得**变成全体共享总额；改为按手机号 + 浏览器令牌 + IP 的维度（保留每手机号 5/小时、每浏览器 10/小时） | 避免公开规模下被总额度限死，也减轻"耗尽整公司额度"的 DoS（审计 M-7/N-08） |
| B3 | `GET /api/h5/auth` 的 `company` 字段保持（展示名）；`02` 增加"公开工作区"小节 | 契约化 |
| B4 | 业主/运营输入 **OWN-P1**：哪个公司行是公开客户工作区（服务端配置，不进 App） | 贷款需要运营主体（F8） |

- **不要求**的变更：账号模型重做（全局客户身份、贷款后再分配机构）——属**更大**的后端重构，列为未来选项，**不在本 Delta**。
- **互操作**：在 CR-003 落地前，生产网关的 `companies[0]` 兜底已让"客户端不发公司"可用；Android 开发/联调可立即按公开模式进行，**生产上线前必须完成 B1+B2**。

## 7. Flutter 目标（契约 Delta）

```
Launch → 恢复公开客户会话 → GET /api/h5/auth → authenticated ? Home : Login
```

### 7.1 公开上下文（Public Context）
- 引入 `ApiContext = Public | Tenant(companyId)`。**P1 只使用 `Public`**。
- **Public 模式**：客户端**不发送** `payease_company`；公司由网关/服务端的公开工作区决定（§6 B1）。
- CF-0 Guard 调整（不删除）：
  - `Tenant(companyId)`：沿用——最终出站恰好一个且等于该 id；
  - `Public`：最终出站**零个** `payease_company`（若 jar/请求中出现任何 `payease_company` → fail-closed）。
- Cookie jar 按上下文分区：公开会话使用固定命名空间（如 `public`），与未来 Tenant jar 隔离；CF-6（只清 `payease_h5_session`、保留其它）沿用。
- 无需 `ActiveCompany` 持久化、最近公司、`defaultCompanyId`。

### 7.2 启动
`/startup`：读取公开会话 Cookie → 预检 → `authenticated:true` 且注册完成 → `GET /api/h5/state` → `/home`；`false` → `/auth/login`（`pending` → 验证码页）；离线 → 启动失败页（仅「重试」）。**不存在公司解析步骤。**

### 7.3 预检里的 `company`
仅用于**显示机构名称（可选）**，不是路由；403「公司不可用 / 工作区无效」在公开模式下表示**服务端配置问题**，映射为通用「服务暂不可用」，**不是 Recovery**。

## 8. 客户 UX：移除与保留

### 8.1 从 P1 普通客户产品中**移除**
| 项 | 处置 |
|---|---|
| `/company/select`（含 Recovery） | **移除** |
| `/company/scan` | **移除** |
| `/company/paste-link` | **移除** |
| `/company/candidate-confirm` | **移除** |
| Me → 服务机构 / 公司切换（`/me/company`） | **移除** |
| 登录页「更换服务机构」 | **移除**（`52` 的 OQ-E2 作废） |
| 公司 App Link 处理（`https://khmerx.org/app?c=`）及 Android intent-filter | **P1 不启用**（休眠；待后端定义"公众客户与机构"的关系后再引入） |
| 静默公司解析 / `defaultCompanyId` / Recovery 提示文案 | **作废** |

理由：没有真实的普通客户用例（业主规则：任何人直接注册）；公司切换在"账号按 owner 分区"的模型下等于切换到**另一个账号**，对普通客户没有意义且易混淆。

### 8.2 作为**内部基础设施保留**（不删除、不展示）
`CompanyId` 类型与校验 · `CompanyCookieStore` 的按上下文分区 jar · `CompanyCookieInterceptor` / `CompanyContextGuardInterceptor`（Tenant 模式路径与测试 CF0-T1…T11 **全部保留**）· 候选公司预检/切换的领域代码与测试（休眠，不接入 P1 UI）· `CompanyLinkParser`、扫码资产（休眠；`mobile_scanner` 去留在 P2 随相机权限一并评估）· 租户隔离的内存快照标签（`companyId` 或 `public` 标签）。
> 这些保证未来"机构专属链接/方案/后台分离"可恢复，而**不阻塞**公开认证。

## 9. 不变的内容
Cookie 认证、Origin、`GET /api/h5/auth` 预检、Telegram Gateway OTP、密码登录/设置、找回、会话恢复、登出（成功才清）、401 Return Intent、`GET /api/h5/state` 驱动的真实 Home/Loans/Detail、H1–H22 矩阵、Future CTA 策略、3 标签、内存-only、P1/P4 边界——**全部不变**。

## 10. 对 `45` 的修改（Delta 54，本文先记录，随后同步）
| 位置 | 修改 |
|---|---|
| Status / Delta 行 | 52 → 54；标明 52 作废 |
| §2 User Outcome | "静默解析公司上下文" → "恢复公开客户会话（无需选择机构）" |
| §3 Scope（Entry） | 改为"公开客户会话；公司基础设施内部休眠" |
| §6.1 资产矩阵 | Company Context / Deep Link / Scanner → **DORMANT（P1 不接入 UI）**；Cookie isolation 保持 KEEP（含 Public 模式扩展） |
| §12.2 路由 | 删除 `/company/select`、`/company/scan`、`/company/paste-link`、`/company/candidate-confirm`、`/me/company`；`/startup` 改为公开会话恢复 |
| §12.3 深链行 | P1 无深链 |
| §13 Entry / Company | 重写为"公开上下文" |
| §15.1 冷启动 | 按 §7.2 |
| §23.2/23.3、§25 | 语言偏好改为**单一（设备级）作用域**；公司切换条目 N/A（保留"登出/401 清除内存"） |
| §35.1 E1/E4、§35.2 | E1（候选/切换/深链）与 E4（扫码）**N/A**（休眠）；取消 `P1-ENTRY-01/02/03/04`；新增 `P1-ENTRY-05` 公开上下文 |
| §36 / §37 | 验收旅程与退出标准更新 |
| §39 | 移除 OQ-E2/E3；新增 CR-003 依赖说明 |
`52` 标记为 **SUPERSEDED BY 54**（保留历史，不删除）。

## 11. 测试（新增/调整）
| ID | 断言 |
|---|---|
| `P1-N-PUB-01` | Public 模式下，假服务收到的任一请求 **不含** `payease_company` |
| `P1-N-PUB-02` | Public 模式 Guard：出站出现任何 `payease_company` → fail-closed；Tenant 模式沿用 CF0-T1…T11（全部保持通过） |
| `P1-S-PUB-03` | 启动：持久公开会话有效 → 终点 `/home`，沿途无 `/company/*`；无会话 → `/auth/login` |
| `P1-S-PUB-04` | 全新安装零公司配置 → 直接 `/auth/login`，**无任何公司界面/Recovery** |
| `P1-W-PUB-05` | 全部 P1 页面文本扫描：不含 Company ID / Tenant / 公司链接 / "Select company" / 「服务机构」选择入口 |
| `P1-W-PUB-06` | 路由清单：不存在 `/company/*`、`/me/company`；登录页无更换机构入口 |
| `P1-N-PUB-07` | 预检 `company:null` 或返回公司名：均不影响登录流程；预检 403「公司不可用」→ 通用服务不可用，不进入 Recovery |
| `P1-S-PUB-08` | 登出/401：清除公开会话与内存快照；jar 隔离保持 |
| `P1-R-PUB-09` | 假服务的认证夹具不要求公司 Cookie（以真实网关兜底后的响应形状） |

## 12. 任务变更
- **Trae（Flutter）**：取消 `P1-ENTRY-01/02/03/04`；新增 **`P1-ENTRY-05` 公开上下文**（`ApiContext.Public`、Guard 双模式、jar 命名空间、`/startup` 公开恢复、移除 §8.1 路由与 UI 与相关测试、清理 Manifest intent-filter 在 P1 的启用）；`P1-NAV-01` 路由清单按 §10；`P1-L10N-01` 语言作用域单一；`P1-AUTH-*`、`P1-STATE-*`、`P1-HOME-*`、`P1-LOANS-*`、`P1-ME-*` 不变（Me 无公司项）。
- **后端（非 Trae 范围，需单独 CR）**：**CR-003 Public Customer Workspace**（B1–B4）；联调期可用现状（网关兜底）；**生产上线前必须完成 B1+B2**。
- **文档**：`02` 在 Product 终审通过后补"公开工作区"小节（本轮不改 02）。

## 13. 风险与分级
| 级别 | 项 |
|---|---|
| **P0** | 无（本 Delta 不引入资金/身份/跨租户新风险；租户隔离代码保留） |
| **P1** | ① 生产依赖网关 `companies[0]` 的偶然兜底（顺序依赖，改配置会让既有公众用户"丢号"）→ 需 CR-003 B1；② 公共工作区的"同公司"限流成为全体共享总额（发码 30/小时）→ 需 CR-003 B2。二者**不阻塞 Android 开发与联调**，**阻塞公众上线** |
| P2 | 未来"机构专属入口/方案"的产品形态未定义（休眠基础设施保留）；账号模型是否改为全局身份（更大重构，未来选项）；`mobile_scanner` 去留 |

## 14. Gate
```
PUBLIC CUSTOMER AUTH DELTA: COMPLETE（PROPOSED）
Next:  Codex 快速评审（重点：§5 端点矩阵、§6 CR-003 是否足够小、§7 Public 模式 Guard、§8 移除清单）
Trae:  HOLD 直至 Codex 快速评审通过；Flutter 开发不依赖 CR-003 即可进行，生产上线依赖 CR-003 B1+B2
```
