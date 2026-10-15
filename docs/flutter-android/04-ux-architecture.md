# KhmerX Android 客户端 · UX Architecture

版本：v2 · 2026-10-07  
范围：Android Flutter 客户端 UX Contract。本文不写 Flutter 代码，不修改 `05`、`07`、后端、Web、H5、Mini App、`app/`、`lib/` 与 `deploy/`。

Aligned with：

- `01-requirements.md`
- `02-api-contract.md`
- `03-ui-design-brief.md`
- `05-flutter-technical-architecture.md` v2
- `06-contract-review.md`
- `07-CR-001-quote-contract.md`（Status: PROPOSED；CR-001 仍是后端依赖，G3 保持 BLOCKED）

Revision Log：RC-1 FIXED · RC-2 FIXED · RC-3 FIXED · RC-4 FIXED · RC-5 FIXED · RC-6 FIXED · RC-7 FIXED · Terminology Alignment FIXED

品牌依据：`public/brand/khmerx-logo.png`、`public/brand/khmerx-icon-v2.png`、现有 H5 `app/globals.css` 与 `components/mini-shell.tsx`。Flutter 资源应复制为客户端资源，不直接依赖 Web 运行时路径。

## 1. UX Principles

1. **可信与克制**：金额、费用、审核和等待状态清楚展示，不使用夸张动效或倒计时制造压力。
2. **状态驱动**：每个页面回答“我现在在哪一步、谁在处理、下一步做什么”。
3. **可恢复**：草稿、Return Intent、离线缓存和 409 合并都以不丢用户输入为目标。
4. **服务端为准**：金额、费用、状态、条款版本、revision 和权限不由客户端推断。
5. **本地化优先**：高棉文先于英文调整布局；中文条款保持服务端原文。
6. **一手操作**：主要操作位于底部安全区内，触控目标至少 48dp。
7. **隐私可见**：敏感页面、权限和数据用途用短句说明；后台预览遮挡敏感内容。

## 2. Information Architecture

```text
App Shell
├── Company Context
│   ├── 选择公司
│   ├── 扫码
│   ├── 粘贴公司链接
│   └── 最近使用公司
├── Auth Context（当前公司隔离）
│   ├── 登录入口
│   ├── Telegram 验证码
│   ├── 密码登录
│   ├── 设置密码
│   └── 找回密码
├── Main Shell（登录后）
│   ├── 首页
│   ├── 借款
│   ├── 消息（贷款事件与系统提示，无推送）
│   └── 我的
├── KYC Flow
│   ├── 总览
│   ├── 个人与身份
│   ├── 紧急联系人
│   ├── 工作与资产
│   ├── 收款账户
│   ├── 授权确认
│   ├── 材料上传
│   └── 提交结果
└── Loan Flow
    ├── 额度与期限
    ├── Loan Quote 借款报价
    ├── Quote Confirmation 报价确认
    ├── 创建申请
    ├── 条款
    ├── 手写签名
    ├── 提交结果
    ├── 贷款详情
    └── 合同
```

公司是一级上下文。所有会话、缓存、语言开关、草稿、待定操作和 Return Intent 均以 `companyId + customer` 隔离。切换公司只切换 Active Company 并加载目标公司的 Session + Cache，不删除原公司数据；Logout 只清除当前公司的会话。只有用户明确执行 Remove Company / Clear All Data 才删除公司数据。界面只显示公司名称，不显示 tenant、cookie、scope 等技术术语。

## 3. Navigation Architecture

采用 4 项底部导航：**首页 / 借款 / 消息 / 我的**。

- 首页：唯一状态驱动 Primary CTA。
- 借款：全部贷款列表与详情。
- 消息：只展示 `state.events` 中客户可见贷款事件和系统提示；不声明推送能力。
- 我的：账号、语言、公司切换、修改密码、退出、关于。

底部导航只在登录后的 Main Shell 显示。KYC、账单、条款、签名等任务页隐藏底部导航，使用顶部返回和流程进度。返回行为优先回到流程上下文，而不是简单回到首页。

导航规则：

- 401：保存当前路由和表单草稿 → 登录 → 恢复原路由。
- 公司切换：保留当前公司会话、快照和语言偏好，激活目标公司独立上下文；目标公司未登录则进入该公司的登录页。文案必须表达“切换服务机构”，不得表达为退出或清除原账户。
- 409：原地提示“资料已更新”，拉取最新数据并保留本地未提交输入。
- 离线：允许查看已缓存展示数据，禁用写操作并保留输入。

## 4. Complete Route Map

```text
/startup
/company/select
/company/scan
/company/paste-link
/auth/login
/auth/telegram-consent
/auth/telegram-code
/auth/password
/auth/set-password
/auth/recover
/auth/recover/code
/home
/loans
/loans/:loanId
/messages
/kyc
/kyc/identity
/kyc/contacts
/kyc/employment-assets
/kyc/bank
/kyc/consent
/kyc/files
/kyc/submitted
/kyc/needs-info
/kyc/update-required
/loan/apply
/loan/quote
/loan/quote/confirm
/loan/bill/:loanId
/loan/terms/:loanId
/loan/sign/:loanId
/loan/result/:loanId
/loan/status/:loanId
/loan/contract/:loanId
/me
/me/language
/me/company
/me/password                    # G2：G1 不注册修改密码页
/me/about
/feature/repay/:loanId        # FEATURE FLAG，默认关闭
/feature/withdraw/:loanId     # FEATURE FLAG，默认关闭
```

## 5. User Flow

### New User

`startup → company/select → auth/login → telegram-consent → telegram-code → auth/set-password（如 required）→ home → kyc`

首次建号只能使用 Telegram Verification Codes。无短信回退；无 Telegram 时说明安装 Telegram 或检查该号码是否已注册。

### Existing User

`startup → company（最近使用）→ GET /api/h5/auth → home`

密码用户从 `auth/password` 登录；验证码仍是恢复路径。

### Session Restore

安全存储读取当前公司 Cookie，调用 `GET /api/h5/auth`。成功显示缓存首页并后台刷新；失败进入登录并保存 Return Intent。

### Company Switch

`me/company → 选择目标公司 → GET /api/h5/auth → 目标公司 home 或目标公司 auth/login`

A 与 B 的 Cookie、快照、语言开关和草稿绝不互用。

### KYC

`kyc → identity → contacts → employment-assets → bank → consent → files → submit → submitted / needs-info / approved / rejected`

每步显示 `Unsaved / Saving / Saved / Save Failed`。继续、切换分组、离开、切后台和 Save & Exit 触发尽力保存，但只提交通过客户端格式校验的字段；未完成输入留在内存，不把“输入未完成”误报为保存失败。`submitted` 与 `approved/rejected` 锁定编辑；`needs_info` 显示 `review.reason` 并定位到需要补件的分组。`ruleVersion` 不一致进入 `/kyc/update-required` 只读态，禁止编辑和提交。

### Loan Application

`home(approved) → loan/apply → POST /api/loan/quote → loan/quote → Quote Confirmation → POST create(quoteId, billConfirmed:true, requestId) → terms → sign → apply → result/status`

申请前统一称 **Loan Quote / 借款报价**，不是 Bill。报价金额全部来自服务端；客户端不计算 fee、net、total 或 due amount。只有贷款进入 `active` 后，实际债务生命周期数据才称 **Repayment Bill / 还款账单**。

确认报价后必须等待服务端 Create 成功才进入条款；不显示本地假成功。CR-001 推荐 Option B：Create 原子记录 `billConfirmedAt`，不再调用 `confirm_bill`；若最终回退 Option A，Create 成功后才调用兼容 action `confirm_bill`。报价过期、定价变化、参数不一致或已有进行中申请时，刷新服务端状态并要求重新确认，不静默替换数字。

### Password Recovery

`auth/recover → POST /api/h5/auth/recovery {action:send} → recover/code → POST /api/h5/auth/recovery {action:reset, challengeId, code, password, confirmPassword} → auth/password`

找回密码不经过 `verify` 或 `account`。成功后旧会话全部失效，清除当前公司的会话 Cookie，必须用新密码重新登录。

### Session Expired

`任意业务页 → 401 → 保存 Return Intent + 草稿 → auth/login → 成功后回原页`

### Offline Recovery

`缓存内容可读 → 离线横幅 → 写操作禁用 → 网络恢复 → 用户主动重试`

写操作不排队、不展示假成功。Create、Sign、Apply、Repay、Withdraw 等请求超时或断连时进入 **Unknown Outcome / 操作状态待确认**，保留同一 `requestId`，刷新服务端状态后再决定成功、失败或允许用户重试。AF-6 修复前若同一 `requestId` 重试返回 `ACTIVE_APPLICATION_EXISTS` 或 `QUOTE_ALREADY_USED`，必须检查是否存在相同 `loan.billing.quoteId` 并判定 AlreadyDone；仅确认无对应 Loan 后才显示冲突。资金操作不得自动重复提交。

## 6. Home State Matrix

| 条件 | 状态标题/说明 | Primary CTA | Secondary | 编辑 | 摘要/截止日/原因 |
|---|---|---|---|---|---|
| KYC none | 开始完成身份资料 | 继续完善资料 | 查看流程 | 是 | 否 / 否 / 缺项 |
| KYC draft | 资料完成度与缺项 | 继续完善资料 | 查看已保存内容 / Save & Exit | 是 | 否 / 否 / 缺项 |
| KYC submitted | 资料审核中 | 查看审核进度 | 查看资料 | 否 | 否 / 否 / 否 |
| KYC needs_info | 需要补充资料 | 去补充资料 | 查看审核意见 | 仅缺项 | 否 / 否 / `review.reason` |
| KYC rejected | 资料未通过 | 查看结果 | 联系客服 | 否 | 否 / 否 / 结果 |
| KYC ruleVersion mismatch | 当前 App 规则已过期，只读查看 | 升级 App | 返回首页 / 查看资料 | 否 | 否 / 否 / 规则版本 |
| approved，无进行中贷款 | 可以申请借款 | 申请借款 | 查看 KYC | 否 | 否 / 否 / 否 |
| 已选金额与期限，尚无报价 | 正在获取借款报价 | 获取报价 | 返回 | 否 | 否 / 否 / 加载状态 |
| Loan Quote loaded | 借款报价待确认 | 确认借款报价 | 修改金额与期限 | 否 | 是 / `expiresAt`（若 CR-001 支持） / 否 |
| Loan Quote expired / pricing changed | 报价已更新，请重新确认 | 重新获取报价 | 修改金额与期限 | 否 | 是 / 新报价有效期 / 原因 |
| Quote confirmed，Create processing | 正在创建申请 | 正在处理 | 取消不可用 | 否 | 是 / 否 / 处理中 |
| Quote confirmed，Create unknown | 正在确认申请结果 | 刷新状态 | 返回贷款 | 否 | 以服务端为准 / 否 / 操作待确认 |
| kyc_approved，已创建未确认报价 | 借款报价待确认 | 查看借款报价 | 查看贷款 | 否 | 是 / 有则显示 / 否 |
| kyc_approved，已确认报价，无合同 | 可以签署协议 | 手写签名 | 查看借款报价 | 否 | 是 / 有则显示 / 否 |
| kyc_approved，已有合同 | 协议已签署 | 提交申请 | 查看合同 | 否 | 是 / 有则显示 / 否 |
| decision_pending | 等待机构审批 | 查看进度 | 查看合同 | 否 | 是 / 以服务端为准 / 否 |
| signed | 申请已提交 | 查看进度 | 查看合同 | 否 | 是 / 以服务端为准 / 否 |
| active | 贷款进行中 | 查看还款账单 | 还款/提现（开关） | 否 | 是 / dueAt / 逾期提示 |
| closed | 贷款已结清 | 查看记录 | 再次申请（符合条件时） | 否 | 是 / 否 / 否 |
| 贷款 rejected | 申请未通过 | 查看原因 | 查看记录 | 否 | 是 / 否 / 结果 |

所有首页状态都有 Cached、Loading、Offline、Error 变体：缓存显示最后更新时间；刷新期间保留旧内容；离线禁用写操作；错误提供“重试”和上下文说明。报价状态另有 Expired、Pricing Changed、Parameter Mismatch、Already Used、Active Application Exists、KYC Changed 变体。

## 7. KYC State Matrix

| 状态 | 页面行为 | 主操作 | 次操作 |
|---|---|---|---|
| draft | 分组可编辑，显示完成度和缺项 | 保存并继续 | Save & Exit / 稍后处理 |
| submitted | 全部只读，显示审核中 | 查看资料 | 返回首页 |
| needs_info | 突出审核意见，定位分组 | 补充资料并保存 | 查看原资料 |
| approved | 全部只读，显示通过时间 | 申请借款 | 查看资料 |
| rejected | 只读结果，显示客服入口 | 查看结果 | 联系客服 |
| ruleVersion mismatch | 全部只读，显示规则已过期和升级要求 | 升级 App | 查看已填写内容 / 返回 |

表单状态：初始、读取、编辑、未保存、保存中、已保存、保存失败、上传中、上传失败可重试、409 合并、提交确认、提交成功、离线。客户端格式校验未通过时显示“当前输入未完成”，不发已知会返回 400 的自动保存请求；服务端保存失败才显示“保存失败”。服务端是可恢复草稿的唯一持久化来源，当前页未保存数据只在内存中，文件预览不落盘。离开未保存页面先给出保存并退出、放弃编辑、取消三项选择。

## 8. Loan State Matrix

| 状态 | 详情内容 | 主操作 | 可用次操作 |
|---|---|---|---|
| kyc_approved，无活动申请 | 可申请借款 | 选择金额与期限 | 查看 KYC |
| quote loading | 服务端正在生成 Loan Quote | 等待报价 | 返回 |
| quote loaded | 借款金额、期限、费用、实际到账、应还总额、币种、有效期 | 确认借款报价 | 修改金额与期限 |
| quote expired / pricing changed | 报价失效或价格变化 | 重新获取并重新确认 | 返回 |
| quote parameter mismatch / already used | 当前报价不能用于本次操作 | 重新获取报价 | 返回 |
| active application exists | 已有未结束申请 | 查看现有申请 | 返回 |
| KYC changed / not approved | KYC 前置条件变化 | 查看 KYC | 返回 |
| quote confirmed, create processing | 等待服务端创建 | 正在处理 | 不可重复点击 |
| quote confirmed, unknown outcome | 请求已发出，结果待确认 | 刷新状态 | 返回 |
| kyc_approved，报价已确认 | 已创建申请，等待条款与签名 | 阅读条款 | 查看 Loan Quote |
| bill confirmed | 已确认的 Loan Quote 摘要（API 兼容字段仍可能叫 `billing`） | 阅读条款并签名 | 查看借款报价 |
| signed | 合同与提交时间 | 提交申请 | 查看合同 |
| decision_pending | 时间线与等待说明 | 查看进度 | 查看合同 |
| active | Repayment Bill：应还总额、已还、剩余、到期日、还款记录 | 查看还款账单 | 还款/提现（开关） |
| closed | 结清摘要 | 查看记录 | 再次申请（若允许） |
| rejected | 结果和本地化原因 | 查看原因 | 返回记录 |

额度只展示 30/50/100/500 USD，期限只展示 14/28 days；Loan Quote、Create、Repayment Bill 和所有金额来自服务端响应。客户端不计算任何费用。

## 9. Error UX Matrix

| 类型 | 用户表现 | 操作 |
|---|---|---|
| 400 | 输入或流程不完整 | 就地标字段，保留输入 |
| 401 | 会话已过期 | 保存 Return Intent，重新登录后返回 |
| 403 | 当前公司或权限不可用 | 说明原因，返回公司选择/首页 |
| 404 | 内容不存在或已失效 | 返回上一层，提供刷新 |
| 409 | 数据已更新 | 自动刷新，保留未提交输入，请确认后继续 |
| QUOTE_EXPIRED | 借款报价已过期 | 重新获取报价并重新确认 |
| QUOTE_PRICING_CHANGED | 定价已变化 | 展示新报价，禁止静默替换并要求重新确认 |
| QUOTE_PARAMETER_MISMATCH | 金额或期限与报价不一致 | 返回选择页并重新获取报价 |
| QUOTE_ALREADY_USED | 报价已被使用 | 获取新报价 |
| QUOTE_NOT_FOUND | 报价不存在或不属于当前公司/客户 | 获取新报价，不泄露报价存在性 |
| QUOTE_INVALID_AMOUNT / QUOTE_INVALID_TERM | 金额或期限不在服务端允许集合 | 返回选择页并就地提示 |
| QUOTE_CONFIRMATION_REQUIRED | Create 缺少 `billConfirmed:true` | 回到报价确认页 |
| ACTIVE_APPLICATION_EXISTS | 已有进行中申请 | 查看现有申请，不创建重复申请 |
| KYC_NOT_APPROVED | KYC 尚未通过或版本已变化 | 返回 KYC 或刷新状态 |
| RULE_VERSION_MISMATCH | 当前 App 规则已过期 | 进入只读页，升级 App |
| UNKNOWN_OUTCOME | 请求已发送但结果未知 | 显示“正在确认操作结果”，刷新服务端状态；资金操作不自动重试 |
| 413/415 | 文件过大或类型不支持 | 说明限制，重新选择/压缩 |
| 429 | 操作过于频繁 | 显示 `retryAfter` 倒计时 |
| 503 | 服务暂不可用 | 缓存可读，提供稍后重试 |
| offline | 无网络 | 顶部横幅，写操作禁用 |
| timeout | 请求超时 | 读操作可单次重试；重要写操作进入待确认状态 |
| unknown | 通用错误 | 本地化文案 + 本地 trace id，不展示请求体、手机号、Cookie 或原始中文 |

## 10. Component Architecture

```text
AppShell
├── SecureAppBar（Logo、Company、Language、状态）
├── OfflineBanner
├── MainBottomNavigation
├── StateHeroCard
├── LoanSummaryCard
├── StatusPill
├── Timeline
├── KycSectionProgress
├── FormField / LocalizedSelectSheet
├── FileUploadCard / FilePreviewMemoryOnly
├── LoanQuoteCard（申请前借款报价）
├── LoanQuoteBreakdown
├── LoanQuoteExpiry
├── LoanQuoteConfirmation
├── LoanQuoteChangedNotice
├── RepaymentBillCard（仅 active 后实际还款账单）
├── TermsReader / ReadProgress
├── SignatureCanvas
├── ConfirmLoanQuoteDialog（标题：确认借款报价 / Confirm Loan Quote）
├── UnknownOutcomeBanner
├── ConflictBanner
├── EmptyState / ErrorState / SkeletonState
└── Snackbar / RetryCountdown
```

组件状态统一包含：default、focused、filled、error、disabled、loading、offline；按钮最小高度 48dp，主要按钮使用品牌蓝，危险动作使用明确文本而不是只用红色。

## 11. Design Tokens

### Brand and logo

| Token | Light | Dark | 用途 |
|---|---|---|---|
| `brand.primary` | `#1677FF` | `#69A8FF` | 主按钮、当前状态、链接 |
| `brand.interactive` | `#0057E6` | `#69A8FF` | pressed、focus、底部选中 |
| `brand.deep` | `#003BB7` | `#102E68` | 头部、主视觉深色 |
| `brand.cyan` | `#008FD6` | `#22A7E8` | Hero 渐变终点 |
| `brand.hero` | `#003BB7 → #005BEA → #008FD6` | 同左，降低亮度 | 首页主卡片 |
| `logo.icon` | `khmerx-icon-v2.png` | 同左 | App bar、启动图 |
| `logo.wordmark` | `khmerx-logo.png` | 同左 | 公司选择、登录 |

### Surface and semantic colors

| Token | Light | Dark |
|---|---|---|
| `background` | `#F5F7FB` | `#101722` |
| `surface` | `#FFFFFF` | `#192332` |
| `surfaceMuted` | `#F0F3F8` | `#233042` |
| `textPrimary` | `#172033` | `#E7ECF5` |
| `textSecondary` | `#667085` | `#A9B5C8` |
| `border` | `#E2E7EF` | `#334155` |
| `success` | `#08784F` / `#E8F7F1` | `#80DFB3` / `#173D35` |
| `warning` | `#985300` / `#FFF4E5` | `#FFD38D` / `#443323` |
| `error` | `#B42318` / `#FFF0EF` | `#FFB8B2` / `#48292C` |
| `info` | `#175BC0` / `#EAF2FF` | `#B1D2FF` / `#213957` |

### Shape, spacing and type

- Spacing scale: 4, 8, 12, 16, 20, 24, 32dp.
- Input/button height: 48dp; primary action minimum 52dp on mobile.
- Card radius: 16dp; hero radius: 24dp; pill radius: 999dp.
- Elevation: cards use 0–2dp; dialogs 8dp; avoid heavy shadows.
- English/Chinese: Display 28/34, Title 22/30, Heading 17/26, Body 15/24, Label 13/20, Caption 11/16, Money 38/46.
- Khmer: Display 26/38, Title 21/32, Heading 17/28, Body 16/28, Label 14/24, Caption 12/20, Money 36/46. Never force single-line truncation for Khmer.

## 12. Content Hierarchy

每页最多一个 Primary CTA。层级顺序：

1. 当前状态与公司上下文；
2. 用户需要知道的金额、期限、审核结果或下一步；
3. Primary CTA；
4. Secondary action；
5. 帮助、隐私、更新时间和技术状态。

金额统一 USD、两位小数；日期按统一本地格式；状态文案由客户端 key 本地化，不直接显示服务端中文 `note`。

## 13. Accessibility Rules

- 验证宽度 320dp、360dp、412dp；系统字体 130% 和 200%。
- 所有按钮、输入、底部导航项至少 48dp；图标单独按钮有语义标签。
- 错误同时使用图标、标题和文字，不只用颜色。
- OTP 支持粘贴、自动聚焦、逐位读出；密码有显示/隐藏状态。
- 所有输入有可访问 label；选择器读出当前值和可用选项。
- 长高棉文允许多行，不能用固定高度截断；条款阅读器支持字号调整。
- `FLAG_SECURE` 页面切后台显示品牌蓝遮罩，不展示身份资料、银行资料或签名。
- 遵循 `prefers-reduced-motion` 等价设置：加载使用静态骨架，不使用连续旋转作为唯一状态提示。

## 14. Localization Rules

- 文案 key 与接口 value 分离：`value` 原样提交，`label` 由 `en/km/zh` 本地化。
- 语言可用性取 `GET /api/h5/auth` 响应的 `languages`；管理端关闭后下次预检移除选项并切到可用语言。
- 高棉语优先测试字体、行高和换行；不把英文长度作为布局基准。
- 服务端中文错误使用 HTTP 状态 + 已知消息映射；未知消息使用通用本地化文案。
- 条款原文目前是中文，页面明确显示“当前签约条款为中文正式版本”；不得自行翻译法律文本。
- 选项固定值（如 `男`、`女`、`已婚`、`摩托车`）提交原值，界面只翻译显示标签。

## 15. Backend Dependency List

以下能力当前不由 App 自行假设，均标记为 **BACKEND DEPENDENCY**：

- **BACKEND DEPENDENCY**：Telegram Gateway 验证码发送、验证和无短信回退。
- **BACKEND DEPENDENCY**：公司有效性、停用状态、公司名与语言开关。
- **BACKEND DEPENDENCY: CR-001 · G3 BLOCKING**：Pre-Application Loan Quote 无副作用报价接口。CR-001 未冻结/未上线前，不开放 G3 申请入口；UX 可按目标方案设计，但不得假设接口已存在。Quote 的字段、有效期和错误映射以冻结契约为准。
- **API compatibility**：现有 API 字段 `billing` 在 Domain 映射为 `Loan Quote`，UI 文案为“借款报价”；现有 action `confirm_bill` 在 Domain 映射为 `ConfirmLoanQuote`，UI 文案为“确认报价”。不要求为术语统一修改旧 API。
- **BACKEND DEPENDENCY**：贷款费用、到账金额、应还总额、到期日和状态均由服务端提供，客户端只展示。
- **BACKEND DEPENDENCY**：KYC `revision`、`ruleVersion`、`missing`、`review.reason`。
- **BACKEND DEPENDENCY**：CR-002 `assetlinks.json`。核心开发非阻断，但阻塞最终 App Links 验收。
- **BACKEND DEPENDENCY**：条款 `blocks` 与 `termsVersion`，当前只有中文。
- **BACKEND DEPENDENCY**：客户可见事件、合同内容、409 冲突版本。
- **BACKEND DEPENDENCY**：提现/还款后续 KESS 接入；功能开关默认关闭。
- **BACKEND DEPENDENCY**：稳定 error code、条款译文、推送通知、Telegram 深链登录、延迟深链、客服入口。

## 16. Open Questions

1. 法务是否提供 Khmer/English 正式条款？在确认前继续使用中文原文并显示提示。
2. 客服入口最终使用电话、Telegram 还是网页？
3. 提现/还款功能开关是否最终由构建参数控制，还是后续增加远程配置？
4. 证书固定、root 检测、反调试和 Android 最低版本是否由合规/技术负责人确认？
5. App Links 的公司链接承载和 Play Install Referrer 是否纳入上架版本？
6. `07-CR-001-quote-contract.md` 当前工作区缺失；在正式契约文件到位前，Quote API 的最终字段、expiresAt 支持和 errorCode 仍是开放依赖。

## 17. Prototype Contract

| Route | Entry Condition | Required API/Data | UI States | Primary / Secondary | Target | Acceptance |
|---|---|---|---|---|---|---|
| `/startup` | App 启动 | secure cookie、company cache | restoring/offline/error | 继续 / 选择公司 | home 或 company | 24h 会话恢复且公司隔离 |
| `/company/select` | 无当前公司 | auth、recent companies | empty/invalid/disabled | 选择 / 扫码粘贴 | auth/login | 无效 ID 不发登录请求 |
| `/company/scan` | 用户点扫码 | QR parser | camera/denied/invalid | 使用链接 / 返回 | company/select | 解析 `c=t_<uuid>` |
| `/company/paste-link` | 用户粘贴链接 | 无 | invalid/valid | 继续 / 返回 | auth/login | 格式错误就地提示 |
| `/auth/login` | 公司有效、无会话 | `GET /api/h5/auth` | loading/password/error/offline | 登录 / 验证码 | home/set-password | 不泄露账号存在性 |
| `/auth/telegram-code` | 同意并发送成功 | send/verify | countdown/expired/429/offline | 验证 / 重发 | set-password/home | 支持粘贴，5 次失败可重发；同意框默认未勾选 |
| `/auth/password` | 已有密码 | account password_login | idle/loading/error | 登录 / 验证码 | home | 失败统一文案 |
| `/auth/set-password` | policy required | account set_password | weak/mismatch/saving | 保存 / 退出 | home | 未完成不可进业务页 |
| `/auth/recover` | 用户找回密码 | `POST /api/h5/auth/recovery` action=send | phone/loading/401/429/offline | 发送验证码 / 返回 | `/auth/recover/code` | 不经过 verify/account |
| `/auth/recover/code` | recovery send 成功 | recovery action=reset | code/expired/invalid/loading/error | 重置密码 / 返回 | `/auth/password` | 成功后旧会话失效 |
| `/home` | authenticated | auth/state/kyc | cached/loading/offline/error + 13 states | 状态 CTA / 次操作 | 对应流程 | 唯一 Primary CTA 正确 |
| `/loans` | authenticated | state.loans | loading/empty/cached/error | 查看贷款 / 首页 | loan detail | 倒序且无内部字段 |
| `/loans/:loanId` | loan belongs to user | state/contract | loading/404/offline | 查看合同 / 返回 | contract | 金额均来自服务端 |
| `/messages` | authenticated | state.events | empty/loading/error | 查看事件 / 返回 | loan detail | 只显示客户可见事件 |
| `/kyc` | no KYC or editable | `GET /api/kyc` | draft/submitted/needs_info/approved/rejected | 继续 / 返回 | KYC step | 状态与编辑权限一致 |
| `/kyc/:step` | KYC editable 且 ruleVersion 匹配 | `POST /api/kyc save` | edit/unsaved/saving/saved/save-failed/409/offline | 保存继续 / Save & Exit | next step 或 `/home` | 只提交本地格式校验通过字段；未保存字段仅在内存 |
| `/kyc/files` | file slot visible | files POST/GET | picker/progress/retry/preview/413/415 | 上传 / 替换 | KYC step | 不落盘敏感图片 |
| `/kyc/submitted` | submit success | kyc response | submitted/error | 查看进度 / 首页 | home | 表单只读 |
| `/loan/apply` | KYC approved、无进行中贷款 | `POST /api/loan/quote`（CR-001） | select/loading/active-application/KYC-changed/offline/error | 获取借款报价 / 返回 | `/loan/quote` | 不创建申请、不占用名额 |
| `/loan/quote` | 已选金额与期限 | CR-001 Quote | loading/success/expired/pricing-changed/parameter-mismatch/already-used/409/offline | 确认借款报价 / 修改金额期限 | `/loan/quote/confirm` | 全部字段 SERVER DRIVEN，客户端不计算 |
| `/loan/quote/confirm` | Loan Quote loaded | `POST /api/h5/state action=create` with `quoteId` + `billConfirmed:true` + `requestId`（CR-001 Option B；Option A 才调用 `confirm_bill`） | review/processing/success/failure/unknown/offline | 确认并继续 / 返回报价 | `/loan/terms/:id` | 只有 Create 服务端成功才进入下一步；不显示假成功 |
| `/loan/bill/:id` | Create 成功或旧 API 返回 billing | state `confirm_bill` compatibility action | read-only/loading/changed/409/unknown/offline | 查看报价摘要 / 返回 | `/loan/terms/:id` | UI 称 Loan Quote；不称 Bill Confirmation |
| `/loan/terms/:id` | bill confirmed | sign GET | reading/ready/error/409 | 同意继续 / 返回 | sign | 未读完不可同意 |
| `/loan/sign/:id` | terms consent | sign POST | empty/drawing/upload/409 | 提交签名 / 重签 | result | 每次签名新图 |
| `/loan/result/:id` | apply success | state | pending/error | 查看进度 / 首页 | status | 只认服务端成功 |
| `/loan/status/:id` | signed/active/etc | state | cached/loading/offline | 查看账单 / 返回 | detail | 状态映射正确 |
| `/loan/contract/:id` | contract exists | contract GET | loading/404/offline | 返回 / 分享禁用 | detail | 条款来自服务端 |
| `/me` | authenticated | auth/company list | loading/error | 公司/语言/密码 / 退出 | target | 当前公司清晰可见 |
| `/me/language` | authenticated | 当前公司 preflight `languages` + 本地存储 | available/saving/error | 选择 / 返回 | me | G1 只做本地选择；关闭语言不再展示，服务端 locale 同步留后续阶段 |
| `/me/company` | authenticated | recent companies/auth | switching/error | 切换 / 返回 | target company | A/B 会话隔离 |
| `/me/password` | password exists | account set_password | validation/saving/401 | 保存 / 返回 | me | 当前密码必填 |
| `/feature/repay/:id` | feature flag on，loan active | state POST repay | confirm/processing/success/failure/unknown/offline | 确认 / 取消 | status | 默认隐藏；未知结果先刷新，不自动重复 |
| `/feature/withdraw/:id` | feature flag on，loan active/closed | state POST withdraw | confirm/processing/success/failure/unknown/offline | 确认 / 取消 | status | 默认隐藏；未知结果先刷新，不自动重复 |

### Write and Quote Route Contract

| Route | Entry Condition | Required API | Required Data | UI States | Primary Action | Secondary Action | Navigation Target | Error State | Loading State | Unknown Outcome State | Offline State | Acceptance Criteria | Backend Dependency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/auth/recover` | 用户选择找回密码 | `POST /api/h5/auth/recovery` `action=send` | phone、consent | idle/sending/sent/401/429 | 发送验证码 | 返回登录 | `/auth/recover/code` | 登录页失效时刷新 Cookie 后仅恢复一次 | 按钮不可重复提交 | 不适用：副作用前置失败才允许一次恢复 | 无网时保留手机号 | 不调用 `verify` 或 `account` | 现有 API |
| `/auth/recover/code` | send 成功 | `POST /api/h5/auth/recovery` `action=reset` | challengeId、code、password、confirmPassword | editing/resetting/success/failure | 重置密码 | 返回登录 | `/auth/password` | 过期/验证码错误/密码不一致就地提示 | 处理中禁用提交 | 结果未知时刷新认证状态，不自动重复 | 离线保留输入 | 成功后旧会话失效并要求重新登录 | 现有 API |
| `/loan/apply` | KYC approved 且无 active application | `POST /api/loan/quote`（CR-001） | amount、termDays | selecting/validating/active-application/KYC-changed/offline | 获取借款报价 | 返回 | `/loan/quote` | `ACTIVE_APPLICATION_EXISTS`、`KYC_NOT_APPROVED` | 获取报价期间显示骨架 | Quote 结果未知时刷新 Loan 状态，不创建申请 | 禁用获取报价 | 创建前不得展示已创建申请 | **CR-001 · G3 BLOCKING** |
| `/loan/quote` | amount、termDays 已通过服务端允许值校验 | `POST /api/loan/quote`（CR-001） | quoteId、principal、deduction、interest、service、upfront、net、total、currency、termDays、pricingVersion、expiresAt? | loading/success/expired/pricing-changed/parameter-mismatch/already-used/active-application/offline | 确认借款报价 | 修改金额与期限 | `/loan/quote/confirm` | 使用 Internal UX State，不依赖稳定 errorCode | 服务端返回前不显示费用估算 | Quote 请求结果未知时刷新状态；不生成本地报价 | 保留选择，禁用确认 | 所有金额和有效期 SERVER DRIVEN | **CR-001 · G3 BLOCKING** |
| `/loan/quote/confirm` | Quote loaded 且未过期 | `POST /api/h5/state action=create` with `quoteId` + `billConfirmed:true` + `requestId`（CR-001 Option B；Option A 才在 Create 成功后调用 `confirm_bill`） | quoteId、金额、期限、费用摘要、consent | review/processing/success/failure/unknown/offline | 确认并继续 | 返回报价 | `/loan/terms/:id` 仅在 Create 成功后 | `QUOTE_EXPIRED`、`QUOTE_PRICING_CHANGED`、`QUOTE_PARAMETER_MISMATCH`、`QUOTE_CONFIRMATION_REQUIRED`、409 | Processing 中禁用重复点击 | 显示“正在确认操作结果”，复用同一 requestId 后刷新服务端；AF-6 兼容 AlreadyDone 判定 | 禁止提交，保留报价 | 不显示本地“申请已创建” | **CR-001 · G3 BLOCKING** |
| `/loan/bill/:id` | 已有服务端 `billing` | `GET /api/h5/state`、compatibility `confirm_bill` | API `billing` 映射 Domain `Loan Quote` | readonly/loading/changed/409/unknown/offline | 查看报价摘要 | 返回 | `/loan/terms/:id` | 报价变化要求重新确认 | 读取服务端摘要 | confirm 结果未知先刷新 Loan 状态 | 禁止确认 | UI 不称 Repayment Bill | 现有 API；CR-001 可能调整 |
| `/kyc/:step` | KYC editable 且 ruleVersion 匹配 | `POST /api/kyc {action:save}` | revision、通过本地格式校验的 profile/files/consent | unsaved/saving/saved/save-failed/invalid/offline | 保存并继续 | Save & Exit / 放弃编辑 | 下一分组或 `/home` | 400 只提示未完成字段；409 合并一次 | Saving 状态明确可见 | save 结果未知时读取服务端草稿，不重复发送新 request | 只保留内存输入 | 服务端是唯一可恢复来源；不承诺强杀恢复未保存输入 | 现有 API |
| `/kyc/update-required` | `ruleVersion` 与内置副本不一致 | `GET /api/kyc` | 已填写 profile、当前 ruleVersion | read-only/banner/full-screen | 升级 App | 查看资料 / 返回 | 更新后重新进入 KYC | 禁止继续编辑和提交 | 不允许旧规则继续提交 | 不适用 | 可查看已缓存只读资料 | 不猜测旧 option 值 | App 发布新规则 |
| `/feature/repay/:id` | feature flag on，loan active | `POST /api/h5/state action=repay` | loanId、cents、requestId | confirm/processing/success/failure/unknown/offline | 确认还款 | 取消 | `/loan/status/:id` | KYC/状态/金额冲突 | Processing 禁止重复 | 刷新 Remaining Due 与 Repayment History，资金操作不自动重试 | 禁止提交 | 以服务端 Paid/Remaining Due 为准 | 后续 KESS 契约 |
| `/feature/withdraw/:id` | feature flag on，loan active/closed | `POST /api/h5/state action=withdraw` | loanId、requestId | confirm/processing/success/failure/unknown/offline | 确认提现 | 取消 | `/loan/status/:id` | 状态/余额冲突 | Processing 禁止重复 | 刷新 wallet 状态，不自动重复 | 禁止提交 | 无假成功 | 后续资金契约 |
| `/loan/sign/:id` | 条款已读且 Quote 已确认 | `POST /api/loan/sign` | loanId、quoteId、billConfirmed:true、签名图、requestId | empty/drawing/upload/processing/success/failure/unknown/offline | 提交签名 | 重签 / 返回条款 | `/loan/status/:id` 或 `/loan/result/:id` | 409 时刷新 Loan 与合同状态 | 上传/提交期间禁用重复 | 刷新合同与 Loan 状态；不得直接让用户重复签名 | 保留签名于内存，禁用提交 | 仅服务端确认合同后进入下一步 |
| `/loan/result/:id` | Sign 成功或 Apply 请求完成 | `POST /api/h5/state action=apply` | loanId、quoteId、billConfirmed:true、requestId | processing/success/failure/unknown/offline | 查看申请状态 | 返回贷款 | `/loan/status/:id` | 状态冲突时刷新；无对应 Loan 时显示失败 | 处理中只显示状态确认 | 先刷新服务端；同 requestId 重试，AF-6 规则下判定 AlreadyDone | 禁止再次 Apply | 只有服务端返回 `decision_pending` 才显示已提交 |

### Prototype completion gate

- 每个 Route 都有进入条件、返回目标、加载、空、错误和离线状态。
- 所有按钮有明确目标；所有首页业务状态有唯一 Primary CTA。

## 18. G1 Company/Auth UX Closure

本节只约束 G1 的 Company、Auth、Recovery、Session 和最小 Home 外壳；不开放 KYC、贷款、报价、签名、还款或提现入口。

### R-3 CLOSED — Company Switch

`/me/company` 明确显示当前公司与目标公司。确认文案为“切换到目标公司？当前公司的登录状态会保留”，确认后先以目标公司作为候选上下文执行预检，再激活目标公司；取消保持原公司。切换不清理原公司 Cookie、快照、草稿或语言偏好；只有明确的“移除公司”或“退出当前公司”操作才清除对应会话。

### R-5 CLOSED — Recovery Routing

恢复密码只使用两页：`/auth/recover`（手机号与同意）→ `/auth/recover/code`（验证码、新密码、确认密码）。不存在 `/auth/recover/reset`。成功后清除当前公司会话并返回 `/auth/password`，要求使用新密码重新登录。

### R-12 CLOSED — OTP Consent

Telegram 同意框默认未勾选；未勾选时“发送验证码”禁用且不发请求。只有用户明确勾选后才发送 `{consent:true}`。页面说明验证码发送至 Telegram Verification Codes，会区分无 Telegram/号码不可达，并明确没有短信回退。

### U-4 CLOSED — G1 Minimal Home and Me

G1 `/home` 是认证后的占位首页，只显示当前公司名称、当前认证状态和“我的”入口，不请求业务状态接口。`/me` 提供当前公司、切换公司、语言选择和退出登录；退出始终只清当前公司并返回认证流程。所有页面支持 loading、offline、服务不可用和重试状态，主按钮在 320dp 宽度仍可操作。

### U-5 CLOSED — Deep Link to Another Company

收到指向另一公司的 App Link 时只保存候选公司，不改变认证状态。已登录于公司 A 时显示“切换到公司 B？”及确认/取消；确认后以 B 作为候选上下文预检，再切换，A 的会话保持；取消关闭提示并保持 A。深链永不登录或授权任何公司。

### U-6 CLOSED — Exceptional Auth States

G1 页面必须为以下状态提供本地化说明、明确 CTA 和重试规则：离线启动（重试/选择公司）、公司无效或停用（返回公司选择）、OTP 错误、过期、五次失败锁定、429 倒计时、Telegram 不可达（安装 Telegram/检查号码）、Recovery pending（恢复验证码页）、会话过期（重新登录后回到安全 Return Intent）、认证服务不可用（稍后重试）。错误页不展示服务端技术细节，不自动重发 OTP，不自动重放敏感 POST。

### G1 layout and locale acceptance

Company/Auth 核心页面在 320dp、360dp、412dp 宽度及 130%/200% 字体缩放下，Send Code、Confirm Company、Login、Reset Password 等主要 CTA 必须可见、可滚动、可操作。所有新增 key 必须同时存在于 en/km/zh；实际可选语言为预检 `languages` 与已打包语言的交集。

### G1 Revision Log

| Item | Status | Change |
|---|---|---|
| R-3 | CLOSED | 明确切换保留原公司会话与数据，修正旧“清理快照”歧义。 |
| R-5 | CLOSED | 移除独立 `/auth/recover/reset`，统一两页 Recovery 路由。 |
| R-12 | CLOSED | 同意框默认未勾选，未同意不得发送。 |
| U-4 | CLOSED | 定义 G1 最小 Home、`/me`、切换与退出入口。 |
| U-5 | CLOSED | 定义跨公司深链确认、候选预检与取消行为。 |
| U-6 | CLOSED | 定义离线、公司不可用、OTP、429、Recovery pending、会话过期和服务不可用状态。 |
- 401/403/409/429/503 不使用裸服务器文案。
- 公司、会话、缓存、草稿按公司隔离。
- 不新增 `/api/mobile/*`、Bearer Token、短信 OTP、Telegram 深链登录或贷款规则。
- Withdraw/Repay 默认隐藏；未接入 KESS 前不作为首页主流程。
- 该文档只作为 Flutter Technical Architecture 和后续 Prototype/Trae 实现输入，不直接开始 Flutter 业务代码。

## 19. G1 Prototype Contract v2

本节是 G1 Company/Auth/Session/Recovery/Minimal Home 的唯一页面验收清单。以下为当前实际 G1 路由与一个应用级状态 `candidateConfirm`，不新增业务路由，也不开放 Loan/KYC/Quote/State API。每张卡均显式给出同一组字段；`N/A` 表示契约明确不适用，不是遗漏。

### 19.1 Shared acceptance bindings

| ID | Binding |
|---|---|
| **ERR-400** | 已知文案映射本地化 key；字段/手机号/密码错误留在当前页、保留可安全保留的输入；不泄露账号存在性。 |
| **ERR-401** | 登录端点：当前页提示失败并保留在登录；受保护端点：保存安全 Return Intent 后进入登录；不自动重放 POST。 |
| **ERR-403** | `companyUnavailable` → 说明公司不可用并回公司选择；`registrationIncomplete` → 进入设密码/验证；`crossOrigin` 或部署问题 → 通用服务配置错误并人工重试；`genericForbidden` → 通用无权限并返回安全上层。 |
| **ERR-404** | `N/A — G1 Company/Auth API 不以 404 暴露可渲染路由状态；未知链接在本地解析阶段拒绝。` |
| **ERR-409** | 状态已变化/挑战冲突：保留非敏感输入，刷新当前认证状态或重新取得挑战；不自动重复副作用请求。 |
| **ERR-429** | `RateLimitFailure.retryAfter`：缺失/非法/≤0=60s，1..3600=服务端值，>3600=3600；CTA 倒计时禁用，结束只重新启用，绝不自动请求。 |
| **ERR-503** | 本地化“服务暂不可用”，保留可安全保留的输入，提供人工“重试”；不导向注册或自动重发。 |
| **ERR-OFFLINE** | 无网：不排队、不假成功；写操作禁用；输入按路由卡保留；恢复网络后由用户主动重试。 |
| **ERR-TIMEOUT** | 读/预检：显示超时并允许一次人工重试；写操作：进入结果待确认，不自动重放。 |
| **ERR-UNKNOWN** | 本地化通用错误 + trace id；不展示服务端原文、Cookie、OTP、密码、完整手机号或 challengeId。 |
| **RET-GET** | GET/导航意图可保存和恢复；成功认证后回原安全路径。 |
| **RET-POST** | POST/命令意图只保存来源说明，不自动重放；认证后回安全上层，由用户重新发起。 |
| **A11Y-G1** | 320dp/360dp/412dp；130%/200% 字体；控件至少 48dp；长 Khmer 文本可换行滚动；主要 CTA 可达、可操作；所有状态文案有 en/km/zh key。 |

### 19.2 Route inventory and cards

每张卡字段顺序固定为：Route ID / Path / Purpose / Entry Condition / Active Company Context / Candidate Company Context / Required API / Required Data / UI States / Loading State / Empty State / Offline State / 400 / 401 / 403 / 404 / 409 / 429 / 503 / Timeout / Unknown Error / Primary CTA / Primary CTA Enabled / Primary CTA Loading / Secondary CTA / Navigation Success / Navigation Failure / Back / Return Intent / Security / Localization / Accessibility / Acceptance / Manual Acceptance / Automation Coverage。

#### G1-01 · Startup / resolving

- **Path/Purpose**: `/startup`；恢复公司与认证状态，不渲染业务内容。
- **Entry/Context**: App 启动；Active Company = 已存活动公司或 none；Candidate = none。
- **API/Data**: 读取 Secure Storage/company cache；有公司时 `GET /api/h5/auth`；`AuthSnapshot`、pending、languages。
- **States/Loading/Empty**: resolving、offline-start、service-error、company-invalid；加载骨架；无公司 = empty → `/company/select`。
- **Offline/400/401/403/404/409/429/503/Timeout/Unknown**: offline 显示“重试/选择公司”不假设已登录；400 N/A；401 按 `ERR-401`；403 回 `/company/select`；404 N/A；409 刷新预检；429 `ERR-429`；503/timeout/unknown 分别 `ERR-503`/`ERR-TIMEOUT`/`ERR-UNKNOWN`。
- **CTA/Navigation**: Primary=继续/重试（有可恢复公司且预检成功才启用）；loading 禁用；Secondary=选择公司；成功→`/home`、`/auth/telegram-code`、`/auth/set-password` 或 `/company/select`；失败保持 startup 或选择公司；Back=退出启动页无动作。
- **Return/Security/Locale/A11y**: 只消费安全 `RET-GET`；不显示完整手机号、不读 demoCode；状态 key 三语；`A11Y-G1`。
- **Acceptance/Manual/Automation**: 冷启动已登录/未登录/pending/设密/403/离线各一条；手测杀进程恢复 pending；`AUTH-01/08`、startup/router tests。

#### G1-02 · Company select

- **Path/Purpose**: `/company/select`；选择最近公司或进入扫码/粘贴。
- **Entry/Context**: 无 Active Company 或公司不可用；Active = none/原 A（保持）；Candidate = none。
- **API/Data**: 最近公司、公司链接解析器；候选验证使用 `GET /api/h5/auth`；不发登录请求。
- **States/Loading/Empty**: idle、validating、invalid、disabled、offline；验证中按钮禁用；无最近公司 empty。
- **Offline/400/401/403/404/409/429/503/Timeout/Unknown**: offline 不激活候选；400 本地格式错误留页；401 `ERR-401`；403 显示公司不可用并选其他；404 N/A；409 刷新候选；429 `ERR-429`；503/timeout/unknown 按共享矩阵。
- **CTA/Navigation**: Primary=选择/继续（仅合法候选且预检成功后启用）；loading 禁用；Secondary=扫码、粘贴；成功→`candidateConfirm`；失败留页；Back=返回 startup。
- **Return/Security/Locale/A11y**: 不保存敏感 Return Intent；不写 ActiveCompany 直到确认；三语 key；`A11Y-G1`。
- **Acceptance/Manual/Automation**: 非法链接不发请求；403 不切换；离线不激活；`COMPANY-02` tests。

#### G1-03 · Company scan

- **Path/Purpose**: `/company/scan`；扫描公司链接。
- **Entry/Context**: 用户点击扫码；Active = 原 A 或 none；Candidate = none。
- **API/Data**: QR parser；解析 `c=t_<uuid>` 后交给统一候选流程。
- **States/Loading/Empty**: camera、permission-denied、invalid、parsed；无扫描结果 empty；无远程 loading。
- **Offline/400/401/403/404/409/429/503/Timeout/Unknown**: offline 在预检阶段按 `ERR-OFFLINE`；400/404 本地无效链接留页；401/403/409/429/503/timeout/unknown 按共享矩阵。
- **CTA/Navigation**: Primary=使用链接（解析成功启用）；loading=预检时禁用；Secondary=粘贴/返回；成功→`candidateConfirm`；失败→`/company/select` 并保留原因；Back→select。
- **Return/Security/Locale/A11y**: 不含认证凭据；不因扫码产生 authenticated；三语 key；`A11Y-G1`。
- **Acceptance/Manual/Automation**: 权限拒绝可回退粘贴；非法 QR 不请求；`COMPANY-02`。

#### G1-04 · Company paste link

- **Path/Purpose**: `/company/paste-link`；粘贴公司 App Link。
- **Entry/Context**: 用户点击粘贴；Active = 原 A 或 none；Candidate = none。
- **API/Data**: 本地 `CompanyLinkParser`；合法后候选 `GET /api/h5/auth`。
- **States/Loading/Empty**: empty、invalid、validating；validating 显示进度。
- **Offline/400/401/403/404/409/429/503/Timeout/Unknown**: invalid/400 留页说明无效公司链接；offline 不激活；其余按共享矩阵。
- **CTA/Navigation**: Primary=继续（合法且预检成功启用）；loading 禁用；Secondary=返回；成功→`candidateConfirm`；失败留页或回 select；Back→select。
- **Return/Security/Locale/A11y**: 只接受公司 id，不接受凭据；三语 key；`A11Y-G1`。
- **Acceptance/Manual/Automation**: 格式错误零请求；合法链接进入候选确认；`COMPANY-02`。

#### G1-05 · Candidate confirmation (application state)

- **Path/Purpose**: `candidateConfirm`；确认目标 B 后才激活。
- **Entry/Context**: 最近列表/扫码/粘贴/App Link/`/me/company` 预检 200；Active=A；Candidate=B。
- **API/Data**: 候选上下文 `GET /api/h5/auth` 已成功；显示 B 名称、语言、认证摘要。
- **States/Loading/Empty**: confirm、confirming、unavailable、network-error、cancelled；确认中锁定按钮；empty=N/A。
- **Offline/400/401/403/404/409/429/503/Timeout/Unknown**: offline/timeout 不激活 B；400 N/A；401/403 显示 B 不可用并选其他；404 N/A；409 重新预检；429 倒计时；503/unknown 手动重试。
- **CTA/Navigation**: Primary=确认切换（预检成功启用）；loading 禁用；Secondary=取消；确认成功→B 的 `/home` 或 auth route；失败保持 A 并显示原因；取消立即回 A。
- **Return/Security/Locale/A11y**: A 的 session/jar/Return Intent 保留；深链永不认证；三语 key；`A11Y-G1`。
- **Acceptance/Manual/Automation**: A→B→A；取消 A 仍 Active；B 不可用不切换；`COMPANY-03/04`、CF0-T3/T4/T6。

#### G1-06 · Auth preflight / login resolving

- **Path/Purpose**: `/auth/login`；展示 `GET /api/h5/auth` 结果并选择密码/OTP。
- **Entry/Context**: 公司已确认且无有效会话；Active=当前公司；Candidate=none。
- **API/Data**: `GET /api/h5/auth`；authenticated、session、pending、policy、company、languages。
- **States/Loading/Empty**: resolving、unauthenticated、pending、authenticatedIncomplete、service-error；loading=骨架；empty=N/A。
- **Offline/400/401/403/404/409/429/503/Timeout/Unknown**: offline 不推断登出；400 N/A；401 refresh 一次；403 公司不可用/注册未完成分流；404 N/A；409 重刷；429 倒计时；503 手动重试；timeout/unknown 共享矩阵。
- **CTA/Navigation**: Primary=继续/选择认证方式（结果明确才启用）；loading 禁用；Secondary=切换公司/恢复密码；authenticated→`/home` 或 `/auth/set-password`；pending→`/auth/telegram-code`；失败留页或 select；Back→company。
- **Return/Security/Locale/A11y**: 仅安全 `RET-GET`；不泄露账号存在性；languages ∩ bundled；`A11Y-G1`。
- **Acceptance/Manual/Automation**: 五类 preflight 结果逐项导航；`AUTH-01`、router tests。

#### G1-07 · Telegram consent/send

- **Path/Purpose**: `/auth/telegram-consent`；取得明确同意后发送 OTP。
- **Entry/Context**: preflight 允许 OTP；Active=当前公司；Candidate=none。
- **API/Data**: `POST /api/h5/auth` send `{phone, consent:true}`；手机号、同意状态、challenge 摘要。
- **States/Loading/Empty**: idle、sending、sent、undeliverable、rate-limited；loading 禁止重复提交；empty=N/A。
- **Offline/400/401/403/404/409/429/503/Timeout/Unknown**: consent=false 是本地 400 等价状态且不请求；401 refresh 一次；403 按 `ERR-403`；404/409 N/A/刷新；429 `ERR-429`；503/timeout/unknown 手动重试。
- **CTA/Navigation**: Primary=发送验证码（默认未勾选时 disabled；consent=true 且手机号合法才 enabled）；sending 禁用；Secondary=密码登录/返回；成功→`/auth/telegram-code`；失败留页；Back→login。
- **Return/Security/Locale/A11y**: 无 SMS fallback；日志不含手机号/OTP；文案三语；`A11Y-G1`。
- **Acceptance/Manual/Automation**: 未同意零请求；发送后 60s；Telegram 不可达说明；`AUTH-03`、R-12 tests。

#### G1-08 · OTP verify / pending restore

- **Path/Purpose**: `/auth/telegram-code`；验证 6 位 OTP，恢复 pending challenge。
- **Entry/Context**: send 成功或 preflight `pending`；Active=当前公司；Candidate=none。
- **API/Data**: `POST /api/h5/auth` verify；challengeId、6 位 code、expiresAt、pending。
- **States/Loading/Empty**: editing、verifying、wrong、expired、attemptsExhausted、rate-limited、pending-restored、telegram-unavailable；loading 禁止提交；empty=N/A。
- **Offline/400/401/403/404/409/429/503/Timeout/Unknown**: wrong/expired/5 次锁定留页并给重发；401 refresh 一次；403 `ERR-403`；404 N/A；409 账号冲突→重新登录/联系支持；429 倒计时；503/timeout/unknown 手动重试。
- **CTA/Navigation**: Primary=验证（6 位完整才启用）；loading 禁用；Secondary=重新发送/返回；成功→`/auth/set-password` 或 `/home`；失败按状态留页；Back→consent；App killed→preflight pending→恢复本页，绝不自动 send。
- **Return/Security/Locale/A11y**: OTP 不日志/不持久化明文；三语 key；粘贴、自动聚焦、逐位读出；`A11Y-G1`。
- **Acceptance/Manual/Automation**: wrong/expired/exhausted/conflict/429/503/offline/timeout 全覆盖；`AUTH-04`、pending recovery test。

#### G1-09 · Password login

- **Path/Purpose**: `/auth/password`；已有密码的登录。
- **Entry/Context**: preflight 允许 password；Active=当前公司；Candidate=none。
- **API/Data**: `POST /api/h5/auth/account` `password_login`；phone、password。
- **States/Loading/Empty**: idle、submitting、invalid-credentials、rate-limited、service-error；loading 禁止重复；empty=N/A。
- **Offline/400/401/403/404/409/429/503/Timeout/Unknown**: 400 known-message 留页；401 统一“手机号或密码不正确”留页并清密码；403 分流 company/registration/origin/generic；404/409 N/A/刷新；429 倒计时；503/timeout/unknown 手动重试。
- **CTA/Navigation**: Primary=登录（手机号+密码完整启用）；loading 禁用；Secondary=改用验证码/找回密码；成功→`/home` 或 `/auth/set-password`；失败留页；Back→login choice。
- **Return/Security/Locale/A11y**: 不泄露账号存在性；密码不日志、不保存；三语 key；`A11Y-G1`。
- **Acceptance/Manual/Automation**: 401 不触发 session expiry；429 clamp；`AUTH-02`。

#### G1-10 · Mandatory password setup

- **Path/Purpose**: `/auth/set-password`；完成注册门槛。
- **Entry/Context**: authenticatedIncomplete / policy.passwordSetup；Active=当前公司；Candidate=none。
- **API/Data**: `POST /api/h5/auth/account` `set_password`；password、confirmPassword、policy。
- **States/Loading/Empty**: editing、weak、mismatch、saving、session-expired、registration-incomplete；loading 禁止重复；empty=N/A。
- **Offline/400/401/403/404/409/429/503/Timeout/Unknown**: 400 显示规则/不一致；401 `RET-GET`→login；403 registrationIncomplete 保持本页；404 N/A；409 刷新 preflight；429 如服务端返回则倒计时；503/timeout/unknown 手动重试。
- **CTA/Navigation**: Primary=保存（12–128 且一致才启用）；saving 禁用；Secondary=退出登录；成功→预检后`/home`；失败留页；Back=禁止绕过，退出走 logout。
- **Return/Security/Locale/A11y**: 未完成不得进业务页；密码不日志/不持久化；三语 key；`A11Y-G1`。
- **Acceptance/Manual/Automation**: 11/12/128/129、403、409、401、logout；`AUTH-05`。

#### G1-11 · Password recovery send

- **Path/Purpose**: `/auth/recover`；发起找回挑战。
- **Entry/Context**: 用户选择找回；Active=当前公司；Candidate=none。
- **API/Data**: `POST /api/h5/auth/recovery` `action=send`；phone、consent=true。
- **States/Loading/Empty**: idle、sending、sent、rate-limited、undeliverable；loading 禁止重复；empty=N/A。
- **Offline/400/401/403/404/409/429/503/Timeout/Unknown**: 400 known-message 留页；401 refresh 一次；403 generic forbidden；404 N/A；409 recovery conflict 留页；429 倒计时；503/timeout/unknown 手动重试。
- **CTA/Navigation**: Primary=发送验证码（手机号合法且同意才启用）；sending 禁用；Secondary=返回密码登录；成功→`/auth/recover/code`；失败留页；Back→password。
- **Return/Security/Locale/A11y**: 不经过 verify/account；不泄露账号存在性；三语 key；`A11Y-G1`。
- **Acceptance/Manual/Automation**: recovery send 不进入 login pending；`AUTH-06` send tests。

#### G1-12 · Password recovery reset

- **Path/Purpose**: `/auth/recover/code`；同一 recovery 流程输入 code 与新密码。
- **Entry/Context**: recovery send 成功；Active=当前公司；Candidate=none。
- **API/Data**: `POST /api/h5/auth/recovery` `action=reset`；challengeId、code、password、confirmPassword。
- **States/Loading/Empty**: editing、resetting、wrong、expired、attemptsExhausted、weak、mismatch、success；loading 禁止重复；empty=N/A。
- **Offline/400/401/403/404/409/429/503/Timeout/Unknown**: 400 错码/密码规则留页；401 refresh 一次；403 generic forbidden；404 N/A；409 recoveryConflict→重新获取；429 倒计时；503/timeout/unknown 手动重试。
- **CTA/Navigation**: Primary=重置（code 6 位且密码 12–128 一致才启用）；resetting 禁用；Secondary=返回；成功→`/auth/password`，旧会话失效；失败留页。
- **Return/Security/Locale/A11y**: 不创建 pending OTP；密码/OTP 不日志；三语 key；`A11Y-G1`。
- **Acceptance/Manual/Automation**: wrong/expired/exhausted/mismatch/429/503/offline；成功不进 Home；`AUTH-06` reset tests。

#### G1-13 · Minimal authenticated home

- **Path/Purpose**: `/home`；认证落地页，仅 Company/Auth 范围。
- **Entry/Context**: authenticated 且注册完成；Active=当前公司；Candidate=none。
- **API/Data**: 不发起网络请求；只用 `AuthSnapshot`/`CompanySummary`。
- **States/Loading/Empty**: resolving、authenticated、offlineKnownSession、sessionExpired、companyUnavailable、error；loading 只在恢复阶段；empty=N/A。
- **Offline/400/401/403/404/409/429/503/Timeout/Unknown**: offlineKnownSession 保留内存内容并禁用切换；400/404/409/429 N/A；401→`/auth/login`；403 company unavailable→select；503/timeout/unknown 手动重试。
- **CTA/Navigation**: Primary=进入我的；始终显示当前公司/切换/退出；loading 禁用；Secondary=语言/版本；成功→`/me` 或 `candidateConfirm`；失败保持 Home/错误态。
- **Return/Security/Locale/A11y**: `/home` 不恢复 POST；不调用 state/kyc/loan/locale；三语 key；`A11Y-G1`。
- **Acceptance/Manual/Automation**: 网络调用计数为零；退出只清 A；`U-4`、HM-1…HM-4。

#### G1-14 · Me shell and logout

- **Path/Purpose**: `/me`；展示当前公司、语言、退出。
- **Entry/Context**: authenticated Home；Active=当前公司；Candidate=none。
- **API/Data**: 内存 `AuthSnapshot`/CompanySummary；logout 使用 `POST /api/h5/auth/logout`。
- **States/Loading/Empty**: idle、loggingOut、logoutFailed、offline；loading 禁止重复；empty=N/A。
- **Offline/400/401/403/404/409/429/503/Timeout/Unknown**: logout 400/404/409 N/A；401/403/503/timeout/unknown 显示失败并保留“重试/取消”；offline 尽力请求 + 本地清 A，不假成功展示；429 倒计时。
- **CTA/Navigation**: Primary=退出（确认后启用）；loggingOut 禁用；Secondary=重试/取消；成功→该公司 auth/company flow；失败留 Me；Back→Home。
- **Return/Security/Locale/A11y**: A session 清除，B 保留；清除 A Return Intent/敏感内存；三语 key；`A11Y-G1`。
- **Acceptance/Manual/Automation**: A logout 不清 B，重启后仍清 A；`AUTH-07`、CF0-T11。

#### G1-15 · Company switch from Me

- **Path/Purpose**: `/me/company`；选择并确认切换公司。
- **Entry/Context**: authenticated；Active=A；Candidate=用户选中的 B。
- **API/Data**: 候选 `GET /api/h5/auth`，确认后写 ActiveCompany。
- **States/Loading/Empty**: idle、candidateConfirm、confirming、unavailable、network-error、cancelled；确认中禁用；无公司 empty。
- **Offline/400/401/403/404/409/429/503/Timeout/Unknown**: offline/timeout 不切换；403 B unavailable→选择其他；400/404 N/A；409 重刷；429 倒计时；503/unknown 手动重试。
- **CTA/Navigation**: Primary=确认切换（B 预检成功才启用）；loading 禁用；Secondary=取消；成功→B Home/auth；失败回 A；取消回 A。
- **Return/Security/Locale/A11y**: A 全部 session/data 保留；不得写成 logout；三语 key；`A11Y-G1`。
- **Acceptance/Manual/Automation**: A→B→A、取消、B disabled、断网；`COMPANY-04`、CF0-T3/T4/T6。

#### G1-16 · Language selection

- **Path/Purpose**: `/me/language`；当前公司本地语言选择。
- **Entry/Context**: authenticated；Active=当前公司；Candidate=none。
- **API/Data**: 使用当前 `auth.languages ∩ bundled locales` 与本地存储；G1 不调用 locale POST。
- **States/Loading/Empty**: available、disabled-language-removed、saved、error；保存为本地同步；无可用语言 empty→English fallback。
- **Offline/400/401/403/404/409/429/503/Timeout/Unknown**: 全部远程错误 N/A；本地写失败显示重试；unknown 按 `ERR-UNKNOWN`。
- **CTA/Navigation**: Primary=选择语言（可用集合内启用）；loading 不适用；Secondary=返回；成功→Me；失败保留旧语言。
- **Return/Security/Locale/A11y**: 公司隔离偏好；不得选择 server disabled 的 zh；三语 key；`A11Y-G1`。
- **Acceptance/Manual/Automation**: A/B 偏好隔离、languages 交集、中文关闭不可选；`I18N-01`。

### 19.3 Shared matrix acceptance

- **403 matrix**：公司不可用→公司选择；注册未完成→OTP/设密；Origin/deployment→通用服务配置错误；generic forbidden→通用无权限；均不展示 Origin 或服务端原文。
- **429 matrix**：所有适用 G1 写/认证端点都使用 `RateLimitFailure.retryAfter` 的 60/1/3600 clamp；倒计时结束只启用 CTA，用户点击才请求。
- **503 matrix**：所有适用 G1 路由保留输入并显示人工重试；不注册、不自动发 OTP、不假成功。
- **Offline matrix**：所有写操作不排队、不假成功；手机号/非敏感表单按卡片保留；OTP/password/challenge 明文不持久化。
- **401 Return Intent matrix**：`/home`、`/me`、`/me/company` 的 GET/导航可恢复到安全路径；logout/password/OTP/recovery 等 POST 不自动重放；登录成功后由用户重新发起命令。

### 19.4 Contract completion gate

- Route inventory = **16 routes + 1 application state**，无未列 G1 Company/Auth/Recovery/Home 路由。
- 每张卡已明确 Entry、Company Context、Candidate Context、API/Data、States、Loading、Empty、Offline、400/401/403/404/409/429/503/Timeout/Unknown、CTA、Navigation、Back、Return Intent、Security、Localization、Accessibility、Acceptance、Manual、Automation。
- 未适用状态均标记 `N/A`，不得由 Trae 自行决定。
