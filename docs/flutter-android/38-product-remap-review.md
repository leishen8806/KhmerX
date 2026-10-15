# Product Remap Review

日期：2026-10-08
审核人：Codex 独立 Product / UX Review
范围：只审核 H5 / Telegram Mini App → Flutter Android 产品重映射；未编写 Flutter 代码，未修改后端和产品 Contract。

## Result

```text
PRODUCT REMAP REVIEW: FAIL
TRAE PLANNING: HOLD
```

`37-h5-miniapp-to-flutter-product-remap.md` 的总体方向正确，但仍有数个已确认的事实错误和未关闭的产品边界问题。必须先修正文档与下一阶段 Contract 输入，不能直接授权 Trae 进入实现。

## H5 / Mini App Baseline Validation

结论：**Claude 的核心判断成立。** `/h5/layout.tsx` 挂载 `H5Login`，登录成功后统一渲染 `MiniClient`；`/mini` 重定向到 `/h5`。两者是同一套客户 UI/API，Mini App 增加 `Telegram.WebApp.initData` 静默登录和 Telegram 提醒订阅能力。

因此产品基线统一为：

```text
H5 / Mini App Customer Client
```

真实差异：

- Mini App：`POST /api/h5/auth/telegram`，依赖签名 `initData`。
- Mini App：`/api/telegram` 提醒订阅，依赖 Telegram 会话。
- 普通 H5：没有静默登录，使用预检、Telegram Gateway 验证码或密码登录。
- 共同的首页、KYC、申请、账单、签约、借款记录和我的页面共用 `MiniClient`。

## Missing User Features

真实 H5 已有、Flutter 尚未实现：

- `GET /api/h5/state` 仓储、DTO、刷新、真实首页状态卡片。
- 借款记录、借款详情、事件时间线、合同和只读账单。
- KYC 总览及个人资料、证件、自拍、联系人、工作/资产、银行账户、授权、文件、保存、提交、补件状态。
- 首页按 KYC/Loan 状态驱动的 Primary CTA。
- 账户安全中的修改密码页。
- 401 后 Return Intent 的真实恢复。

H5 自身没有的能力，不应伪装为移植功能：

- 客服、帮助、关于：NEW PRODUCT FEATURE。
- 原生多公司扫码/最近公司：Android 增量能力。
- Telegram 静默登录和 Telegram 提醒订阅：`MINI APP ONLY`，不纳入 Android MVP。

## Incorrectly Ported / Planned Features

- H5/Mini 的铃铛链接 `/h5/me?panel=messages` 在 `MiniClient` 中没有对应消息面板，属于 **DEAD UI / DO NOT PORT**。
- H5 仍渲染“提现/测试还款”按钮，但 `app/api/h5/state/route.ts` 明确对 `repay` / `withdraw` 返回 403 `CUSTOMER_SETTLEMENT_FORBIDDEN`。两者是 **MOCK / BLOCKED BY BACKEND**，Android 不应列为可用客户功能。
- 37 将“create 后立即进入 `kyc_approved`”写成当前事实；当前 `lib/domain.ts` 的 `create` 实际生成 `registered`，并要求后续 KYC。该条必须修正为以当前代码状态机为准。
- 37 将 Android P1 的首页价值写对了，但不能只做首页摘要；已有贷款用户必须能进入只读 Loan List/Detail，否则用户闭环仍不完整。

## Backend Reality Review

### Confirmed REAL

- `GET /api/h5/auth`
- `POST /api/h5/auth/send`
- `POST /api/h5/auth/verify`
- `POST /api/h5/auth/account`
- `POST /api/h5/auth/recovery`
- `POST /api/h5/auth/logout`
- `POST /api/h5/locale`
- `POST /api/h5/auth/telegram`（Mini App only）
- `GET/POST /api/h5/state`
- `GET/POST /api/kyc`、KYC files、geocode
- `GET/POST /api/loan/sign`
- `GET /api/kyc/contract`

### Confirmed NOT IMPLEMENTED / BLOCKED

- `/api/loan/quote`：当前仓库无报价路由，CR-001 才定义目标接口。
- 客户 `repay` / `withdraw`：服务端硬拒绝，不能作为 Android 当前功能。

### API CONTRACT UPDATE REQUIRED

`02-api-contract.md` 至少需要 Claude 后续更新：

1. 当前响应使用 `code` 与错误文案并存，错误结构不能只按旧文档理解。
2. `/api/h5/state` 客户 `repay`/`withdraw` 的实际 403 拒绝语义。
3. 当前 `create` 的实际状态为 `registered`，不能写成直接 `kyc_approved`。
4. 客户状态动作失败在路由层存在折叠为通用 400 的路径，客户端不可假设完整细分错误码。
5. `/api/team {customer_enter}` 若作为入口能力保留，应补入 API 文档；Android 当前公司链接/扫码路径可不调用它。

## Flutter Coverage Review

| 能力 | 当前判断 |
|---|---|
| G0 网络、Cookie、Secure Storage、Origin、Redaction、Locale 基础 | KEEP / REUSE |
| Company/Auth/Router | REUSE + REFACTOR；35 的实现缺陷不能被产品规划忽略 |
| Scanner/App Links | REUSE + REFACTOR；仍缺候选 preflight、权限拒绝、粘贴回退 |
| Minimal Home | REFACTOR；不能继续作为正式首页 |
| `/api/h5/state`、KYC、Loan DTO/Repository/UI | NOT IMPLEMENTED |
| Repay/Withdraw 桩 | REMOVE from customer product flow；保留后端阻断说明 |

## User Journey Review

正确的 Android 用户主链应为：

```text
启动
→ 选择/确认公司
→ GET /api/h5/auth
→ 验证码或密码登录
→ 必要时设置密码
→ GET /api/h5/state
→ 真实首页
→ KYC 或只读借款记录/详情
```

已有会话必须支持：

```text
restore company cookie
→ preflight
→ home or re-auth
→ safe Return Intent restore
```

## Home Review

正式 Home 不应只显示公司 ID、认证状态、语言、退出。

必须由以下服务端状态驱动：

- KYC：`null/draft/submitted/needs_info/approved/rejected`
- Loan：无贷款、`registered/kyc_pending/needs_info/kyc_approved/decision_pending/approved/signed/active/closed/rejected`
- Primary CTA：完成 KYC、继续申请、查看账单/签约、查看审批、查看还款账单或申请新贷款。

每个状态卡片至少绑定：标题、摘要、主 CTA、次 CTA、目标路由、所需 API。金额、费用、到期日均来自服务端；客户端不得重算费用。

## KYC Review

现有 KYC 服务端支持草稿、服务端保存、文件、提交、`needs_info`、`approved`、`rejected`。代码没有 rejected 后重提路径，因此：

```text
rejected = terminal until backend/product decision
```

Android P2 应覆盖 8 个实际分组及保存/提交/补件状态；不要自行设计 rejected → resubmit。

## Loan Application Review

当前 H5 链路是：

```text
amount/term
→ create
→ billing
→ confirm_bill
→ terms/sign
→ apply
```

目标 Android/CR-001 链路是：

```text
quote
→ confirmation
→ create(quoteId, billConfirmed:true)
→ terms/sign
→ apply
```

两者不能混写。CR-001 只阻塞目标 Quote/Create Gate，不阻塞 P1 首页、只读借款或 P2 KYC。

金额 `$30/$50/$100/$500`、期限 `14/28` 当前由代码固定，不是 server-driven：

```text
STATIC CONTRACT DATA
```

应记录版本漂移风险。协议正文当前为中文，属于：

```text
PRODUCT / LEGAL DECISION REQUIRED
```

不要由 Android 客户端自行翻译成正式法律文本。

## Loan Lifecycle Review

状态机以当前代码为准：

```text
registered / kyc_pending / needs_info / kyc_approved
→ decision_pending
→ approved / signed
→ active
→ closed
```

另有 `rejected`。`overdue` 不是 Loan status；只是测试 `demoDays` / 通知情景。Android 不应把 overdue 提前设计为独立一级状态。

只读生命周期应包括：Loan List、Detail、事件、合同、状态、账单派生展示。客户 repay/withdraw 保持 `DEFERRED / BLOCKED BY BACKEND`。

## Navigation Review

H5 的真实一级导航是三项：

```text
首页 / 借款记录 / 我的
```

Android 应采用三项底部导航。旧 `04` 的四项“首页 / 借款 / 消息 / 我的”与真实 H5 不一致，应标记：

```text
STALE DOCUMENT
```

消息铃铛是 dead link，不应复制。

## Feature Reuse Matrix

| 现有 Flutter资产 | 决定 | 说明 |
|---|---|---|
| G0 Foundation | KEEP | 通过的 Cookie/网络/日志/存储基础继续复用 |
| Company | REFACTOR | 先修 candidate 不提前激活、candidate preflight、最近公司 |
| Auth | REFACTOR | 保留 DTO/登出修复；补 challenge、pending、recovery send、Return Intent |
| Router | REFACTOR | 保留基础 Router，扩展真实业务路由和状态门禁 |
| Cookie | KEEP | CF-0/CF-6 作为强约束 |
| Locale | REUSE | 接入 preflight languages 与公司隔离 |
| Minimal Home | REMOVE/REFACTOR | 替换为真实状态首页 |
| Scanner | REFACTOR | 增加权限拒绝、错误、粘贴回退 |
| Deep Link | REFACTOR | 增加 candidate preflight 和确认状态 |

## Product Gaps

- 真正状态驱动 Home 缺失。
- 只读借款记录/详情缺失。
- KYC Android 产品流缺失。
- Loan application、账单、签约、生命周期页面缺失。
- 账户安全修改密码缺失。
- About/Help/Support 若要加入，属于新增产品能力。

## Engineering Gaps

- Flutter 仍缺 state/KYC/loan 仓储、DTO、控制器和页面。
- 当前 Company/Auth 仍需重新验收，不能因为 APK 能构建就视为产品闭环完成。
- Android runtime、真机/模拟器路由证据和可访问性证据需要单独闭环。
- `/api/h5/state`、KYC、签名接口需要真实 contract tests，不能只保留 endpoint 常量。

## Backend Gaps

- CR-001 Quote API 尚未实现。
- 客户 repay/withdraw 被硬拒绝，且无支付通道。
- rejected KYC 没有重提后端路径。
- 状态动作错误在部分路径折叠为通用 400。
- 条款只有中文；Android 不可自行生成正式译文。

## Product Decisions

### BLOCKS P1

- Home 是否以 `GET /api/h5/state` 为唯一事实源：建议确认并冻结。
- P1 只读 Loan List/Detail 的字段与状态映射：必须在 Contract 中冻结。
- 当前 `create → registered` 状态与 H5 实际流程：必须修正文档后再写 Contract。

### BLOCKS P2

- KYC `rejected` 是否终态：当前代码显示是终态；若要重提必须先改后端。
- 8 步 KYC 在 Android 的分组与文件/定位权限策略。
- 离线是否只读缓存，写操作是否全部禁用。

### BLOCKS P3

- CR-001 Option A/B 最终选择。
- 静态金额/期限是否继续硬编码，还是增加 server-driven pricing/ruleVersion。
- 中文条款的法律翻译策略。
- 申请后合同、签名、状态页面的具体路由命名。

### NONBLOCKING

- About/Help/Support 是否新增。
- Android 品牌视觉与动画。
- Telegram 提醒订阅不进入 Android MVP。

## Corrected Phase Plan

### P0 — Foundation

**用户结果：** App 可安全启动、选择公司、恢复/退出当前公司会话；Cookie/Origin/日志/本地化基础可审计。

### P1 — Entry + Real Home + Read-only Loan

**用户结果：** 用户可以登录或恢复会话，看到真实 KYC/Loan 首页，进入借款记录、详情、事件与只读账单；可切换语言、公司和退出。

Required APIs: `GET /api/h5/auth`, auth endpoints, `GET /api/h5/state`, `POST /api/h5/locale`。

P1 不包含 KYC 编辑、Loan create、Quote、签名、repay、withdraw。

### P2 — KYC

**用户结果：** 用户可查看/编辑 8 个 KYC 分组，服务端保存草稿、上传材料、提交审核、处理 needs_info；approved/rejected 进入明确只读状态。

Required APIs: `/api/kyc`, `/api/kyc/files`, optional `/api/kyc/geocode`。

### P3 — Loan Application

**用户结果：** KYC approved 用户可以选择额度/期限并完成服务端报价确认、申请创建、条款阅读、手写签名、提交审批。

Current H5 create/billing path 与 CR-001 target path 必须拆成两个 Contract 分支；Quote/Create Gate 在 CR-001 前保持 HOLD。

### P4 — Loan Lifecycle

**用户结果：** 用户可查看全部贷款、详情、事件、合同、账单派生信息、审批/放款/结清状态和到期提醒。

repay/withdraw 保持 deferred，除非后端新 Contract 解锁。

### P5 — Release / UX Hardening

**用户结果：** 完成 Android runtime、权限、无障碍、缓存/离线只读、长高棉文、性能、商店发布和新增 Help/About/Support（若获批）。

## Recommended Next Contract Scope

下一份 Contract 只允许定义：

```text
P1 Real Home + Read-only Loan
```

必须包含：

1. Auth/Company 前置修复的验收边界（candidate preflight、challengeId、pending OTP、recovery send、Return Intent）。
2. `GET /api/h5/state` DTO：`kyc`, `state.loans`, `events`, `notifications`, `revision`, `pricing`，未知字段忽略。
3. Home State Matrix：无 KYC、KYC 各状态、无贷款、每个 Loan status 的标题/摘要/CTA/目标。
4. `/loans`、`/loans/:loanId`、只读账单与事件详情的路由和错误/离线行为。
5. 15 秒轮询、焦点刷新、401 安全恢复、公司/语言隔离。
6. P1 禁止调用 KYC 写接口、create、quote、sign、apply、repay、withdraw。
7. P1 Android runtime 与 320/360/412dp、130%/200% 字体验收条件。

Trae 只能在该 Contract 经过三方 Gate Review 后进入实现，不应直接开工。

## P0

无新的 P0 资金/身份/跨公司问题被发现于产品重映射审核。

## P1

1. 37 将当前 create 状态写成 `kyc_approved`，与真实 `lib/domain.ts` 的 `registered` 冲突。
2. P1 若只做首页摘要而不做只读 Loan List/Detail，将无法形成现有用户闭环。
3. 真实 Flutter 仍缺 state/Home/Loan read-only 实现，旧 G1 Recovery 资产不能直接视为新 P1 完成。
4. 02/04 中与当前真实 H5/API 冲突的条目尚未被标为修订输入。

## P2

1. Debug/runtime/accessibility evidence 尚未成为产品重映射的可验收输入。
2. 静态金额/期限可能与后台规则漂移。
3. 中文协议的多语言体验与法律翻译策略未决。
4. H5 dead bell/messages 不应移植。

## P3

1. About/Help/Support、视觉 polish、Telegram Android 提醒等新增或后续能力。

## Trae Readiness

```text
TRAE PLANNING: HOLD
```

Claude 应先根据本报告修订 `37` 或生成一份明确 superseding remap，补齐 create 状态、H5 三项导航、repay/withdraw blocked、dead messages、P1 只读 Loan 结果和 02 stale list；之后再生成 P1 Contract。该报告不授权任何 Flutter 实现。
