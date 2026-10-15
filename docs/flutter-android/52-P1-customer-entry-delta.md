# P1 Customer Entry Delta

```
Document:  52-P1-customer-entry-delta.md
Date:      2026-10-09
Owner:     Claude（Product / Requirements / Architecture / API Contract）
Status:    SUPERSEDED BY 54-P1-public-auth-company-decoupling.md（业主规则：客户注册/登录公开，无需公司；defaultCompanyId 与静默公司解析作废；本文保留为历史）
Amends:    45-P1-entry-home-readonly-loan-contract.md（仅 §2、§3、§12.2、§13、§15、§35.2、§36、§37、§39 中的 Entry 部分；见 §13）
Trigger:   Android Runtime 暴露了错误的普通用户首屏：Select company → Company link or ID → Paste link → Scan QR
Not done:  不重开 Product Remap；不改租户架构；不改 02；不写代码；不授权 Trae。
```

## 0. Project Identity

```
PROJECT IDENTITY CHECK: PASS
PROJECT: KhmerX
ROOT: E:\KhmerX\KhmerX
REMOTE: git@github.com:leishen8806/KhmerX.git
HEAD: d916b4515a93057d7dd2a0673ebbca39a7bfd242
worktree: 仅 docs/ 与 mobile/ 未跟踪
```

## 1. 问题与冻结的产品要求

KhmerX Android 是**普通借款用户客户端**。Company Context 是**基础设施**，不是用户主任务。普通用户首次打开 App **不应**被要求理解 Company ID、Company Link、Tenant、粘贴公司链接、扫描公司二维码。

## 2. OLD → NEW（必须明确）

```
OLD:
  startup → company/select          （无活动公司时一律进入"Select company / Company link or ID / Paste / Scan"）

NEW:
  startup
  → silent company resolution       （对用户透明；按 §3 优先级）
  → auth preflight                  （GET /api/h5/auth，使用已解析公司的上下文）
  → authenticated=true  → Real Home （GET /api/h5/state）
    authenticated=false → Customer Login
  只有无法解析公司时 → Company Recovery / Institution Connection
```

## 3. Company Context Resolution（优先级，冻结）

| 优先级 | 来源 | 规则 |
|---|---|---|
| **R1** | 有效的传入 **App Link** 公司上下文（冷启动初始链接或运行中到达） | `CompanyLinkParser` 解析 → 候选 → **候选预检**（候选上下文 `GET /api/h5/auth`）。无现有 ActiveCompany：预检成功即作为 Entry 上下文激活，**不再让用户手输或确认公司**；已有 ActiveCompany 且不同：按既有切换规则出**候选确认**（U-5，`45` §13）；同一公司：忽略。**链接无效/公司不可用 → 进入 Recovery 并给出明确提示，不静默改用其它公司**（用户意图明确） |
| **R2** | 之前有效的 **ActiveCompany**（持久的 `activeCompanyId`） | 静默预检。成功 → 使用。**不可用（403 invalid/disabled）→ 视为未解析，进入 Recovery 并说明"原服务机构当前不可用"；不静默替换成默认或其它最近公司**（租户安全：用户的账号属于原机构）。离线/超时/503 → 启动失败页（重试），不进入 Recovery |
| **R3** | KhmerX **App 默认公司配置**（构建配置 `defaultCompanyId`，见 §8） | **仅当不存在持久的 ActiveCompany（全新安装/数据被重置）且无有效 R1 链接**时使用。静默预检，成功 → 激活并进入登录；预检 403 → Recovery（"服务暂不可用"类提示）；离线 → 启动失败页（重试） |
| **R4** | 以上均无法解析 | 才显示 **Company Recovery / Institution Connection** 页 |

补充：
- **最近公司列表不参与静默选择**（它只在 Recovery 与 Me 中供用户**主动**选择）。理由：账号与会话按机构隔离，静默换机构会让用户落到另一家机构的登录页。
- 解析结果以 `CompanyResolution = Resolved(companyId, source ∈ {link, active, default}) | Unresolved(reason)` 表达；`source` 仅用于内存诊断，不含 PII。
- 每次解析中涉及的请求都是**已选定公司上下文**下的 `GET /api/h5/auth`（候选客户端，Cookie Contract 不变）；**没有候选 id 时零网络请求**（例如全新安装、无链接、无默认配置 → 直接 Recovery）。
- **绝不**依赖代理的"缺省第一家公司"（Rule B）；默认公司由客户端**显式**通过 `payease_company` 发送。

## 4. 场景矩阵（验收依据）

| # | 前置 | 请求 | 结果（用户所见） |
|---|---|---|---|
| S1 | 持久 ActiveCompany，会话有效 | preflight → `GET /api/h5/state` | 直接 `/home`；**不出现任何机构界面** |
| S2 | 持久 ActiveCompany，无会话 | preflight | `/auth/login`（或 `pending` → 验证码页） |
| S3 | 全新安装 + 默认公司可用 | 默认公司 preflight | `/auth/login`；**无机构选择界面** |
| S4 | 全新安装 + 有效 App Link | 候选 preflight | 激活该公司 → `/auth/login`；**不要求再次输入/确认公司** |
| S5 | 已有 ActiveCompany A + 指向 B 的链接 | 候选 B preflight | **候选确认**（"切换服务机构？当前机构登录状态会保留"）；确认才切换（既有规则） |
| S6 | 已有 ActiveCompany A + 指向 A 的链接 | — | 忽略 |
| S7 | App Link 无效 / 公司不存在或停用 | 候选 preflight 403/404 或解析失败 | Recovery + 「链接无效或服务机构不可用」 |
| S8 | 持久 ActiveCompany 不可用（403） | preflight | Recovery + 「原服务机构当前不可用」；**不改用默认** |
| S9 | 全新安装 + 默认公司不可用（403） | preflight | Recovery + 「服务暂不可用」 |
| S10 | 全新安装 + 无默认配置 + 无链接 | **零请求** | Recovery（「无法识别服务机构」） |
| S11 | 冷启动离线，已有 ActiveCompany 或默认公司 | preflight 失败 | 启动失败页（重试）；**不显示 Recovery，不假设已登录** |
| S12 | 解析成功，preflight 返回 `authenticated:true` 但需设密码 | — | `/auth/set-password`（既有规则） |
| S13 | 用户在 Me → 服务机构 → 更换 | 候选 preflight | 候选确认（既有规则） |
| S14 | 登录页上用户点「更换服务机构」（见 §6） | — | 进入 Recovery / Institution Connection（主动模式） |

## 5. 屏幕要求

### 5.1 Startup（`/startup`）
静默解析与预检期间只显示品牌加载态；**不展示公司选择内容**。出口：`/home`（已认证）· `/auth/login` · `/auth/telegram-code`（pending）· `/auth/set-password` · Recovery（`/company/select`，仅 Unresolved）· 启动失败页（离线/超时/503，重试）。

### 5.2 Customer Login（首屏，`/auth/login`）
- 面向普通借款用户：品牌区 + 登录方式（验证码 / 密码）+ 找回密码。
- **可以**显示服务机构的**显示名称**（来自预检 `company`，用于信任感），**不得**显示：Company ID、Tenant ID、公司链接输入框、任何技术性"company/tenant"措辞。
- **不得**在登录页放置默认可见的"Switch company / Select company"按钮。仅提供一个低显著度的次级文字入口「更换服务机构」（S14），用于登出状态下机构不对的用户（无 Me 页可用）；点击进入 Recovery 的主动模式。

### 5.3 Company Recovery / Institution Connection（路由 `/company/select`，保持路径不变以减少改动；**界面不再叫 "Select company"**）
- 标题（zh 意图）：「无法识别服务机构」（Unresolved 时）；用户主动进入时：「更换服务机构」。
- 内容：按原因的一行说明（无法识别 / 原机构不可用 / 链接无效 / 服务暂不可用）；操作：**扫描机构二维码**、**粘贴邀请链接**；若有最近机构，显示「最近使用的服务机构」列表供**主动**选择（经候选确认/预检）。
- 仅用于：App 无法解析公司、用户主动更换机构、扫邀请二维码、粘贴邀请链接。**不得**作为普通启动的默认路由。
- 入口守卫：只有 (a) Resolution = Unresolved，或 (b) 用户从 Me / 登录页主动进入时可达；其它情况访问 → 回 `/startup`。

### 5.4 Me → 服务机构（`/me/company`）
高级设置：显示当前服务机构名称（非 ID）；「更换服务机构」→ 候选确认流程（既有规则）；最近机构列表。不是默认入口。

### 5.5 面向用户的措辞
| 概念 | 用户可见（zh 基线） | 禁止出现 |
|---|---|---|
| Company | 服务机构 | Company ID、Tenant ID、租户、公司链接输入框 |
| 切换 | 更换服务机构 | Select company、Company link or ID |
| 链接/二维码 | 邀请链接 / 机构二维码（仅 Recovery 内） | — |
en/km 文案由 Codex/文案确认；ARB 键沿用 `45` §14（E15）。

## 6. App Link 规则（补充 `45` §13）
- 解析 → 候选 → **候选预检** 不变；确认规则按有无现有 ActiveCompany 区分：
  - **无 ActiveCompany**（冷启动初始链接，或 Recovery/全新安装状态下收到链接）：预检成功 → **直接作为 Entry 上下文激活**，进入登录；不展示"确认公司"屏。
  - **已有不同的 ActiveCompany**：必须候选确认。
- 深链**永不**产生认证态、**永不**静默切换已有公司。
- 链接解析失败/预检 403 → Recovery 提示（S7）。

## 7. Router 守卫变更（取代 `21` §5.13 与 `45` §12 中相应行）
| 旧 | 新 |
|---|---|
| 无活动公司 → `/company/select` | 无活动公司 → **`/startup`**（运行 Resolution）；仅 `Unresolved` 才到 `/company/select` |
| 公司不可用（403）→ `/company/select` | → Recovery（带原因），仅在 R2/R3/R1 的"不可用"结果 |
| `/startup` 离线 → 「重试 / 选择公司」 | → 「重试」；**不**默认提供"选择公司"（Recovery 仅在 Unresolved） |
| 登录页默认带 "Switch company" | 去除；改为次级「更换服务机构」文字入口 |
路由响应性要求（`45` §12.3）不变：公司/认证/设密码/会话失效变化即时确定性响应。

## 8. 默认公司配置（R3）
- 构建配置项：`defaultCompanyId`（可空），来源 `--dart-define=DEFAULT_COMPANY_ID=t_…` / 环境配置；加载时用既有 `CompanyId` 校验（`^t_[a-f0-9-]{36}$`），非法 → 视为未配置并记脱敏日志。
- **不是机密**（公司 id 本就出现在邀请链接中），可放构建配置；**不得**用来绕过预检——默认公司同样必须预检成功才使用。
- 生产构建应配置为面向公众的默认服务机构；debug/runtime 构建指向假服务的公司 id（使 R2 运行验收无需手动输入公司）。
- 若某构建未配置：行为即 S10（无链接时 Recovery），不是缺陷。
- **业主输入（OWN-1）**：生产默认服务机构的公司 id 由业务方提供；未提供前，生产构建走 S10。**不阻塞实现**（配置驱动）。

## 9. 租户架构：**不变**（逐项）
| 项 | 状态 |
|---|---|
| ActiveCompany 为业务真源；`payease_company` 仅传输 | **不变** |
| `CompanyCookieInterceptor` / `CompanyContextGuardInterceptor`（CF-0：每请求恰好一个正确的 `payease_company`，fail-closed） | **不变** |
| 按公司的 Cookie jar、会话隔离、`clearSessionFor`（CF-6） | **不变** |
| 候选公司预检用候选上下文；取消不影响 A；非已知公司残留清理 | **不变** |
| 无活动公司不发 KYC/业务请求；绝不依赖代理缺省公司（Rule B） | **不变**（默认公司由客户端显式发送） |
| 公司切换：丢弃 A 内存快照、先加载态再 B；登出清除 | **不变** |
| 内存快照携带 `companyId` 标签，不匹配不渲染 | **不变** |
**变化的只有"用户是否看见公司概念"**：隐藏 UI，不取消隔离。

## 10. 对 `45` 的修改清单（本版同步已改）
| 位置 | 修改 |
|---|---|
| 头部 Status | 注明 Delta 52 待 Codex 快速 UX 核对 |
| §2 User Outcome / §3 Scope（Entry） | "选择/恢复公司上下文" → "静默解析公司上下文（对用户透明）" |
| §12.2 `/startup`、`/company/select`、`/me`、`/me/company` | 按本文 §5、§7 |
| §13 Entry/Company | 增加 13.0 静默解析与例外：无 ActiveCompany 的链接无需确认屏；其余候选入口仍须确认 |
| §15.1 冷启动 | 按 §3/§4 |
| §35.2 任务卡 | 新增 `P1-ENTRY-03`、`P1-ENTRY-04`，调整 `P1-ENTRY-01`、`P1-NAV-01` |
| §36 / §37 | 验收旅程与退出标准加入 Entry Delta |
| §39 | 新增 NONBLOCKING 问题 OQ-E2/OQ-E3 |

## 11. 测试（新增；对应 §4 场景）
| ID | 断言 |
|---|---|
| `P1-S-RES-01` | S1：持久公司+有效会话 → 终点 `/home`，沿途**未**出现 `/company/*` 路由 |
| `P1-S-RES-02` | S2/S3：终点 `/auth/login`，未出现 `/company/*` |
| `P1-S-RES-03` | S4：无 ActiveCompany + 有效链接 → 候选预检成功后直接激活 → `/auth/login`；**无候选确认屏** |
| `P1-S-RES-04` | S5：已有 A + 指向 B 的链接 → 候选确认；取消保持 A |
| `P1-S-RES-05` | S6：同公司链接被忽略 |
| `P1-S-RES-06` | S7：无效/停用链接 → Recovery + 对应提示；ActiveCompany 不变 |
| `P1-S-RES-07` | S8：持久公司 403 → Recovery（"原机构不可用"）；**未**改用默认公司（断言无默认公司请求） |
| `P1-S-RES-08` | S9：默认公司 403 → Recovery |
| `P1-S-RES-09` | S10：无候选 → **零请求** → Recovery |
| `P1-S-RES-10` | S11：离线 → 启动失败页；不进入 Recovery；不假设已登录 |
| `P1-W-ENTRY-10` | 普通启动路径（S1–S4）所有页面的文本扫描：**不含** Company ID / Tenant / "company link" / "Select company" 等被禁文案 |
| `P1-W-ENTRY-11` | 登录页：无默认可见的 Switch company 按钮；存在次级「更换服务机构」入口，进入 Recovery 主动模式 |
| `P1-W-ENTRY-12` | Recovery：标题为「无法识别服务机构」/「更换服务机构」，不是 "Select company"；含扫描与粘贴入口 |
| `P1-N-RES-13` | 默认公司路径的 wire：每个请求恰好一个 `payease_company` = 默认公司 id（显式发送，非代理缺省） |
| `P1-N-RES-14` | 回归：CF0-T1…T11 全部保持通过 |
| `P1-U-RES-15` | `CompanyResolver` 纯逻辑表驱动：R1/R2/R3/R4 优先级、`Unresolved` 原因、最近公司不参与静默选择 |

## 12. 任务卡变更
- **P1-ENTRY-01（改）**：候选确认规则按 §6 区分有/无 ActiveCompany；其余 E1 内容不变。
- **P1-ENTRY-03（新）静默公司解析**：Goal 实现 `CompanyResolver`（§3，纯逻辑 + 依赖注入的预检/存储/AppConfig）与 `/startup` 编排（§4）；Layer features/company/domain、app/router；Files `company_resolver.dart`、`app_config.dart`（`defaultCompanyId`）、`startup_page.dart`；Dep L10N-01、NET-01、ENTRY-01；Acceptance S1–S14；Tests `P1-S-RES-*`、`P1-U-RES-15`、`P1-N-RES-13/14`。
- **P1-ENTRY-04（新）Recovery 与登录页调整**：Goal 将 `/company/select` 重做为 Company Recovery（§5.3）、登录页去除 Switch company 并加次级入口、Me 服务机构措辞（§5.4/§5.5）；Dep ENTRY-03、L10N-01；Tests `P1-W-ENTRY-10/11/12`。
- **P1-NAV-01（改）**：守卫按 §7（无活动公司 → `/startup`）。
- 依赖顺序：`… L10N-01 → ENTRY-01 → ENTRY-03 → ENTRY-04 → …`（ENTRY-02 扫码验证不变）。

## 13. 开放问题（均 NONBLOCKING，各有默认）
| ID | 问题 | 默认 |
|---|---|---|
| OQ-E2 | 登录页是否提供次级「更换服务机构」入口（登出用户机构不对时的唯一出口） | 提供（低显著度文字链接）；Codex 快速 UX 核对确认 |
| OQ-E3 | R2 持久公司不可用时，是否改用默认公司 | **不改用**，进入 Recovery 并说明原因（租户安全） |
| OWN-1 | 生产默认服务机构的公司 id（业主提供） | 未提供前走 S10；不阻塞实现 |

## 14. Gate
```
P1 CUSTOMER ENTRY DELTA: PROPOSED（本文 + 45 同步修改）
Next:  Codex 快速 UX 核对（重点：§3 优先级与 R2 不可用不静默改默认、§5.2 登录页措辞、§5.3 Recovery 文案、OQ-E2/E3）
Trae:  HOLD 直至 Codex 快速 UX 核对通过
```
