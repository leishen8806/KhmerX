# KhmerX H5 / Mini App → Flutter Android
# 用户端功能对照与重新分期

```
Document:  37-h5-miniapp-to-flutter-product-remap.md
Date:      2026-10-08
Owner:     Claude（Product / Requirements / Architecture / API Contract / Delivery Planning）
Status:    HISTORICAL — 第一次 Product Remap；Codex 评审 FAIL（见 38）；已被 39-h5-miniapp-to-flutter-product-remap-v2.md 取代（本文内容未改）
Evidence:  H5/Mini App UI、客户后端 API、Flutter 现状三份只读取证（读码，未运行应用）；关键结论（客户还款被硬拒绝、无 /api/loan/quote、3 个底部标签、无还款开关）由我二次抽查。
Not done:  不写 Flutter 代码；不改 04；不改 Trae 实现；不改后端；不批准 CR-001。
```

状态词：**REAL**（有服务端动作且可用）· **PARTIAL** · **LEGACY**（死代码/重复/孤儿）· **MOCK**（界面存在但服务端拒绝或仅记账）· **NOT IMPLEMENTED**。

---

## 1. Executive Summary

1. **H5 与 Telegram Mini App 是同一份代码**（`app/h5/layout.tsx` 挂载 `H5Login`，`MiniClient` 渲染所有屏）。唯一差别是 Mini App 多一条 `initData` 静默登录。因此 Android 的对照基线只有一个：**"H5/Mini 客户端"**。
2. 真实的用户闭环是：**登录 → 首页 → KYC（8 步）→ 申请（金额/期限）→ 费用账单确认 → 手写签名 → 提交审批 → 等待放款 → 还款中/已结清**。登录之后的全部价值都在这条线上，而 Android 目前**只做了登录之前**。
3. Flutter 现状：Foundation（Cookie/网络/存储/错误/本地化）扎实；Company + Auth 已有页面，但 Codex 复验（`35`）**仍为 FAIL**；`/home` 是工程占位页；**`GET /api/h5/state`、KYC、贷款在 Flutter 中零实现**（仅声明了端点常量）。
4. **产品纠偏**：G1 不是产品阶段，而是"进入 App"的基础。新的分期按用户可感知的闭环划分（§13）：Phase 1 进入 + 真实首页 → Phase 2 KYC → Phase 3 借款申请 → Phase 4 借款生命周期 → Phase 5 完整体验/发布。
5. **三个会改变计划的事实**（取证发现，旧 Android 文档未体现）：
   - **客户还款/提现在服务端被硬编码拒绝**（`POST /api/h5/state` 对 `repay`/`withdraw` 返回 403 `CUSTOMER_SETTLEMENT_FORBIDDEN`；无任何开关）。H5 里的"去还款/提现"按钮是 **MOCK**。Android **没有可实现的客户还款**，只能做**只读的还款账单**。
   - **没有借款前报价接口**。今天 `create` 会立即创建贷款并生成账单；H5 的"账单确认"发生在贷款已存在之后。CR-001 尚未实现。
   - **H5 底部只有 3 个标签**（首页 / 借款记录 / 我的），**没有"消息"**；铃铛图标是死链。`04` 的 4 标签导航与现实不符。
6. **CR-001 的新位置**：只阻塞 **Phase 3 里"创建申请"这一个 Gate（Pre-Application Quote）**，不阻塞登录、首页、KYC、借款只读生命周期（§15）。
7. **推荐下一步**：先关闭 Phase 1（修完 `35` 的 P1，再接 `/api/h5/state` 做真实首页），不要在 Auth 上继续堆叠。

---

## 2. Product Positioning（冻结）

> **KhmerX Flutter Android = 现有面向普通借款用户的 H5 / Telegram Mini App 的原生 Android 客户端。**

- 范围：**普通借款用户**。不含运营后台、机构后台、员工端、审批后台、贷后后台、财务后台（继续 Web）。
- 复用现有 H5 API，作为"浏览器兼容客户端"：Cookie 会话 + `Origin` 头；不新增 `/api/mobile/*`、不用 Bearer。
- Android **增量**（H5 没有，Android 需要）：多公司（扫码/App Link/最近公司/切换）、Android 原生上传（相机/相册）、手写签名画布、前台刷新策略。
- Android **不做**：Telegram 静默登录（需要 `initData`，原生拿不到）、Telegram 还款提醒订阅（同样需要 `initData`）、推送、客户端费用计算。
- 沿用并保持不变的技术约束：服务端驱动业务规则、整数分金额、公司隔离、Cookie 认证、Origin、requestId、无离线写队列、安全日志、安全存储。**产品重排 ≠ 重写架构。**

---

## 3. Current H5 User Journey（以代码为准）

入口 `/` → `/h5` → `H5Login` 状态机：

1. **进入/登录**：手机号（`+855`）→ 注册/登录视图；菜单含密码登录、验证码登录、忘记密码。生产为 `telegram` 模式（验证码经 Telegram Gateway；`demo` 仅 `KHMERX_TEST_MODE=true`）。
2. **注册策略**（`lib/registration-policy.ts`）：Telegram 模式下需手机号验证；`passwordSetup` 默认开 → 账号安全页强制设置 ≥12 位密码；服务端对所有客户 API 强制 `requireRegistrationComplete`（403）。
3. **首页** `/h5/home`：`GET /api/h5/state`（每 15 秒轮询 + 获得焦点时刷新）。
4. **KYC** `/h5/kyc`：8 步（个人资料、证件正面、证件反面、自拍、联系人、工作与资产、银行账户、授权），每次"下一步"即服务端保存草稿；最后一步"提交人工审核"。
5. **申请** `/h5/apply`：金额 $30/$50/$100/$500，期限 14/28 天，测试资金同意 → `create`（**立即创建贷款，状态 `kyc_approved`**）。
6. **账单** `/h5/bill`：展示本金、利息、服务费、实际到账、应还总额 → `confirm_bill`（带 `quoteId`）。
7. **签约** `/h5/sign`：读协议（仅中文）→ 勾选同意 → 手写签名 → `POST /api/loan/sign`（保存不可变合同）→ "提交贷款审批" → `apply` → `decision_pending`。
8. **等待**：员工审批（两阶段）→ `signed`（待放款）→ 员工放款 → `active`（还款中）。
9. **还款中/结清**：状态页展示应还、已还、到期日；"去还款/提现"按钮存在但**服务端拒绝**；员工登记还款，足额后 `closed`。
10. **我的** `/h5/me`：资料卡（脱敏手机号、公司）、身份资料入口、借款记录、账户安全（设置/修改密码、忘记密码）、Telegram 还款提醒、语言切换、退出登录。

## 4. Current Mini App User Journey

与 §3 **相同**，差异仅：
- 先尝试 `POST /api/h5/auth/telegram`（`X-Telegram-Init-Data`）静默登录；失败回退到验证码视图。
- Telegram 还款提醒订阅（`POST /api/telegram`）只在 Mini App 内可用。
- Telegram 渠道固定 `bot-1`（`login.tsx:35`）。

---

## 5. Backend Capability Map（客户可调用的真实 API）

| 能力 | 端点 | 状态 | 备注 |
|---|---|---|---|
| 选择公司入口 | `POST /api/team {action:'customer_enter', slug}` | REAL（**`02` 未记录**） | 设置 `payease_company`；Android 已通过扫码/深链自带公司 id，可不用 |
| 预检/浏览器令牌 | `GET /api/h5/auth` | REAL | 返回 company、authenticated、session、pending、policy、languages |
| 发送验证码 | `POST /api/h5/auth/send` | REAL | `{phone, consent:true}`；非幂等；限流 5/h/手机 |
| 验证验证码 | `POST /api/h5/auth/verify` | REAL | 首次验证即创建账号 |
| 密码登录/设密码 | `POST /api/h5/auth/account` | REAL | `password_login`、`set_password`（≥12 位；改密需当前密码）；`register` 在 telegram 模式恒 409 |
| 找回密码 | `POST /api/h5/auth/recovery` | REAL | `send`/`reset`；重置使该账号所有会话失效 |
| 登出 | `POST /api/h5/auth/logout` | REAL | |
| Telegram 静默登录 | `POST /api/h5/auth/telegram` | REAL，**仅 Mini App** | Android 不可用 |
| 语言 | `POST /api/h5/locale` | REAL | 影响 Telegram 提醒语言；`GET /api/h5/auth` 的 `languages` 控制可选语言 |
| **用户状态** | `GET /api/h5/state` | REAL | `{state:{loans,events,entries,notifications,…}, revision, kyc:{status}\|null, pricing}`；**没有** company/limits 字段 |
| **用户动作** | `POST /api/h5/state` | REAL | 有效客户动作：`create`、`confirm_bill`、`apply`（`sign`/旧动作不可达）；`repay`/`withdraw` **403** |
| KYC 视图/保存/提交 | `GET/POST /api/kyc` | REAL | revision 乐观锁；首次 GET 创建 `draft` |
| KYC 文件 | `POST/GET /api/kyc/files` | REAL | 原始字节 + `x-kyc-slot`；JPEG/PNG/PDF；≤10 MB；每客户 ≤40 行；生产需杀毒扫描 |
| 地址地理编码 | `POST /api/kyc/geocode` | REAL（需 Google Key） | 可选；无限流 |
| 协议/签名 | `GET/POST /api/loan/sign` | REAL | 签名 PNG/JPEG，三个自定义头；**协议仅中文** |
| 合同查看 | `GET /api/kyc/contract?loan=` | REAL | |
| Telegram 提醒 | `GET/POST /api/telegram` | REAL，**仅 Mini App 可订阅** | |
| 埋点 | `POST /api/analytics/events` | REAL | `source` 只接受 `mini_app`/`h5`（无 `android`） |
| **借款前报价** | `/api/loan/quote` | **NOT IMPLEMENTED**（CR-001） | 无路由、无表 |
| 客户还款/提现 | `POST /api/h5/state {repay|withdraw}` | **MOCK/被禁用** | 硬编码 403；底层仅记账，无支付通道 |
| `/api/state` | 通用沙盒 | LEGACY | App 不得使用 |

**Loan 状态机（客户可观察）**：`kyc_approved`（创建后，含账单确认与签名，状态不变）→ `decision_pending`（客户 `apply`）→ `signed`（员工二次审批通过，界面"待放款"）→ `active`（员工放款）→ `closed`（足额还款）；`rejected` 由员工驳回。`registered/kyc_pending/needs_info/approved` 为旧状态，H5 客户路径不会出现。**没有 `overdue` 状态**（逾期仅员工置位 `demoDays`）。
**KYC 状态**：`draft → submitted → approved | needs_info | rejected`；`rejected` 在代码中是**终态**（无重新申请路径）。
**错误**：响应带 `code`（多数由中文文案子串推断，脆弱）；`POST /api/h5/state` 中非 `KycError` 的失败**统一折叠为 400 `REQUEST_FAILED`**，客户端无法区分金额错误/状态变化/并发冲突。

---

## 6. Functional Inventory（主表）

> Android 阶段：P1–P5 对应 §13 的 Phase 1–5。"H5 / Mini"两列同码，合并给出。

| ID | 用户功能 | H5 / Mini App | Backend API | 当前真实状态 | Android 必须做 | Android 阶段 |
|---|---|---|---|---|---|---|
| ENT-01 | 选择公司 / 扫码 / 粘贴链接 / App Link | H5 无（cookie 驱动） | — | NOT IMPLEMENTED（H5）；Flutter PARTIAL | 是（Android 增量） | P1 |
| ENT-02 | 切换公司 | H5 无 | — | Flutter PARTIAL（见 35） | 是 | P1 |
| AUTH-01 | 预检 | REAL | `GET /api/h5/auth` | Flutter REAL | 是 | P1 |
| AUTH-02 | Telegram 验证码登录（同意→发送→验证） | REAL | `send`/`verify` | Flutter PARTIAL（35：challenge 未保留） | 是 | P1 |
| AUTH-03 | 密码登录 | REAL | `account` | Flutter REAL | 是 | P1 |
| AUTH-04 | 强制设置密码 | REAL | `account set_password` | Flutter PARTIAL | 是 | P1 |
| AUTH-05 | 找回密码 | REAL | `recovery` | Flutter PARTIAL（35：send 未调用） | 是 | P1 |
| AUTH-06 | 会话恢复 / 401 Return Intent / 24h 绝对过期 | PARTIAL（401 仅在 MiniClient 处理，其余屏只显示错误） | — | Flutter PARTIAL | 是 | P1 |
| AUTH-07 | 登出 | REAL | `logout` | Flutter REAL | 是 | P1 |
| AUTH-08 | Telegram 静默登录 | REAL（仅 Mini） | `auth/telegram` | — | **否**（原生不可用） | — |
| AUTH-09 | 修改密码（账户安全） | REAL | `account set_password` | NOT IMPLEMENTED（Flutter） | 是 | P1（随 Me） |
| HOME-01 | 状态驱动首页（KYC/贷款/CTA） | REAL | `GET /api/h5/state` | Flutter：占位页 | 是 | **P1** |
| HOME-02 | 首页刷新（15s 轮询 + 焦点刷新） | REAL | 同上 | NOT IMPLEMENTED | 是（前台刷新策略） | P1 |
| KYC-01 | KYC 总览/完成度/缺项 | PARTIAL（完成度仅非 Mini 视图） | `GET /api/kyc` | NOT IMPLEMENTED | 是 | P2 |
| KYC-02 | 个人与身份（姓名、性别、学历、婚姻、省/区、地址） | REAL | `POST /api/kyc` | NOT IMPLEMENTED | 是 | P2 |
| KYC-03 | 证件正反面 + 自拍上传 | REAL | `kyc/files` | NOT IMPLEMENTED | 是（原生相机/相册） | P2 |
| KYC-04 | 联系人（2 必填 + 1 选填） | REAL | `POST /api/kyc` | NOT IMPLEMENTED | 是 | P2 |
| KYC-05 | 工作与资产（含车辆/住房条件上传） | REAL | `POST /api/kyc` + `files` | NOT IMPLEMENTED | 是 | P2 |
| KYC-06 | 银行/收款账户（ABA/ACLEDA/Wing） | REAL | `POST /api/kyc` | NOT IMPLEMENTED | 是 | P2 |
| KYC-07 | 授权同意 + 可选设备定位 + 地址地理编码 | REAL | `POST /api/kyc`、`geocode` | NOT IMPLEMENTED | 是（定位可选） | P2 |
| KYC-08 | 草稿保存（每步服务端保存） | REAL | `POST /api/kyc save` | NOT IMPLEMENTED | 是（沿用"服务端草稿、本机无 PII"） | P2 |
| KYC-09 | 提交审核 | REAL | `submit` | NOT IMPLEMENTED | 是 | P2 |
| KYC-10 | 补件（`needs_info`）与重提 | REAL | 同上 | NOT IMPLEMENTED | 是 | P2 |
| KYC-11 | 审核状态/结果展示 | REAL | `GET /api/kyc` | NOT IMPLEMENTED | 是 | P2 |
| KYC-12 | `rejected` 后重新申请 | **NOT IMPLEMENTED（后端无路径）** | — | — | **待产品/后端决策**（§20 OPD-3） | — |
| LOAN-01 | 选择金额/期限（30/50/100/500；14/28 天） | REAL | `POST /api/h5/state create` | NOT IMPLEMENTED | 是（金额/期限列表**未由 API 下发**，见 §20） | P3 |
| LOAN-02 | **借款报价（Pre-Create Loan Quote）** | **NOT IMPLEMENTED**（今天无此接口；H5 在本地预览计算） | 需 CR-001 | — | 是，**受 CR-001 阻塞** | P3 |
| LOAN-03 | **报价确认（Quote Confirmation）** | REAL（但发生在贷款创建之后，`confirm_bill`） | `confirm_bill` | NOT IMPLEMENTED | 是 | P3 |
| LOAN-04 | 创建申请 | REAL（**非幂等**，AF-6） | `create` | NOT IMPLEMENTED | 是（受 CR-001 约束） | P3 |
| LOAN-05 | 条款阅读（服务端 blocks，仅中文） | REAL | `GET /api/loan/sign` | NOT IMPLEMENTED | 是（语言见 OPD-5） | P3 |
| LOAN-06 | 手写签名 | REAL | `POST /api/loan/sign` | NOT IMPLEMENTED | 是（原生画布→PNG） | P3 |
| LOAN-07 | 提交审批 | REAL | `apply` | NOT IMPLEMENTED | 是 | P3 |
| LOAN-08 | 借款记录列表 | REAL | `GET /api/h5/state` | NOT IMPLEMENTED | 是 | **P1（只读）**/P4 |
| LOAN-09 | 借款详情/进度（状态、金额、到期、事件） | REAL | 同上 | NOT IMPLEMENTED | 是 | P1（只读）/P4 |
| LOAN-10 | 合同查看（含签名图） | REAL | `kyc/contract`、`kyc/files` | NOT IMPLEMENTED | 是 | P4 |
| LOAN-11 | **还款账单（Repayment Bill，只读）** | PARTIAL（无专用结构，由 amount+fee−paid、dueAt、entries 推导） | `GET /api/h5/state` | NOT IMPLEMENTED | 是（只读） | P4 |
| LOAN-12 | 事件时间线（最近 5 条，中文映射） | REAL | `state.events` | NOT IMPLEMENTED | 是 | P4 |
| LOAN-13 | 逾期提示 | **PARTIAL**（无逾期状态；仅 `dueAt` 与提醒通知） | `state.notifications` | NOT IMPLEMENTED | 展示到期日；逾期提示待后端 | P4/P5 |
| LOAN-14 | 已结清后再次申请 | REAL（`closed`/`rejected` 后可再 `create`） | `create` | NOT IMPLEMENTED | 是 | P4 |
| ACT-01 | 客户还款 | **MOCK**（403） | `repay` | — | **否**（见 OPD-1） | — |
| ACT-02 | 客户提现 | **MOCK**（403） | `withdraw` | — | **否** | — |
| NOTI-01 | 站内通知（铃铛/消息） | **NOT IMPLEMENTED**（铃铛死链；仅贷后提醒显示在状态页） | `state.notifications` | — | 仅贷后提醒（P4）；"消息"标签不做 | P4 |
| NOTI-02 | Telegram 还款提醒订阅 | PARTIAL（仅 Mini；UI 自述"待联通验收"） | `/api/telegram` | — | **否**（需 `initData`） | — |
| SET-01 | 语言切换（受公司开关限制） | REAL | `GET auth` + `POST locale` | Flutter PARTIAL（仅本地） | 是 | P1 |
| SET-02 | 公司切换 | H5 无 | — | Flutter PARTIAL | 是 | P1 |
| SET-03 | 关于 / 帮助 / 客服 | **NOT IMPLEMENTED**（H5 无） | — | — | 最小静态页（客服渠道待定，OPD-4） | P5 |
| SET-04 | 账户删除 | NOT IMPLEMENTED | — | — | 否（后端无；商店政策再评估） | — |

---

## 7. Page / State Inventory

| 页面 / 状态 | H5 / Mini App（同码） | API 来源 | Android 映射 | Flutter 已有？ |
|---|---|---|---|---|
| 启动/加载 | `MiniRouteLoading`、错误卡"重新加载" | `GET /api/h5/auth` | `/startup` | 有（REAL） |
| 登录入口（注册视图） | `login` view | auth | `/auth/login`+consent | 有（PARTIAL） |
| 验证码验证 | `verify` view | send/verify | `/auth/telegram-code` | 有（PARTIAL） |
| 密码登录 | `password` view | account | `/auth/password` | 有 |
| 账号安全/设密码 | `security` view | account/send/verify | `/auth/set-password`、`/me/password` | 部分（`/me/password` 无） |
| 找回密码 | `recovery` view | recovery | `/auth/recover`、`/auth/recover/code` | 有（PARTIAL） |
| 公司选择/扫码/粘贴/候选确认 | **无** | — | `/company/*` | 有（PARTIAL，35 P1） |
| 首页（加载/错误/有未结贷款/无贷款+KYC 通过/无贷款+KYC 未通过） | `/h5/home` | state | `/home` | **占位** |
| KYC 8 步 + 加载/错误/脏数据/只读（submitted/approved/rejected）/needs_info | `/h5/kyc` | `/api/kyc` | `/kyc/*` | **无** |
| 申请（有未结申请/KYC 未通过/表单） | `/h5/apply` | state/kyc | `/loan/apply` | **无** |
| 账单（未确认/已确认） | `/h5/bill` | state | `/loan/:id/quote`（命名见 §10） | **无** |
| 签约（加载/错误/同意/画布/已保存） | `/h5/sign` | loan/sign | `/loan/:id/sign` | **无** |
| 借款记录（列表/空状态） | `/h5/records` | state | `/loans` | **无** |
| 借款进度/详情（各状态） | `/h5/status` | state | `/loans/:id` | **无** |
| 找不到借款 | `/h5/*?loan=` | — | 详情内空态 | **无** |
| 合同 | `/h5/contract` | kyc/contract | `/loans/:id/contract` | **无** |
| 还款/提现屏 | `/h5/repay`、`/h5/withdraw` | state（被拒） | **不做** | 仅 FeatureDisabledPage 桩 |
| 我的（资料卡/菜单） | `/h5/me` | state | `/me` | 有（仅菜单） |
| 语言 | 头部旗标菜单 | auth+locale | `/me/language` | 有（本地） |
| 公司切换 | **无** | — | `/me/company` | 有（PARTIAL） |
| 铃铛/消息 | 死链 | — | **不做** | — |
| 关于/帮助 | **无** | — | `/me/about` | 无 |
| 离线 | **H5 无处理**（显示原始 fetch 错误） | — | 通用离线横幅/重试 | 无 |

---

## 8. Flutter Current State

**已完成（Foundation，保留）**：Dio 管线与拦截器（Origin、公司 Cookie 注入+Guard、重试、错误映射、脱敏）、按公司隔离的 Cookie jar（CF-0/CF-6 基础通过）、SecureKv/KeySchema、LocaleController（en/km/zh）、GoRouter + RouterGate + Return Intent、`app_links`/`mobile_scanner`、特性开关桩、约 165 个单元/组件测试（`flutter analyze` 干净，debug APK 可构建）。
**Company/Auth 页面**：已有 15 条路由；`35`（Codex 复验）**仍为 FAIL**：候选公司在确认前被激活且缺候选预检、找回 `send` 未调用 API、OTP challenge 未保留、扫码无权限拒绝降级、401 Return Intent 无证据、**无 Android 运行证据（无设备/AVD）**、**无无障碍证据**。（取证代理称此后代码又新增了 `return_intent_test`、`scanner_fallback_test`、`candidate_invariant_provider_test`、`layout_g1_test` 等，**是否已关闭 35 的 P1 未核实**，以 Codex 复验为准。）
**业务层**：`/api/h5/state`、`/api/kyc` 仅有端点常量，**无仓储/DTO/控制器/页面**；无贷款、签名、账单代码；`/feature/repay|withdraw` 仅"功能未开放"桩；`core/money` 无调用方。
**首页**：占位，仅显示公司 id 与认证状态，按钮：切换公司、语言、登出。

---

## 9. H5/Mini App → Flutter Gap Matrix

| 现有用户功能 | Android 当前 | Gap | 优先级 |
|---|---|---|---|
| 状态驱动首页（`/api/h5/state`） | 占位 | 无 state 仓储/DTO/首页状态模型 | **P0**（主流程入口） |
| KYC 8 步 + 上传 + 提交 + 补件 | 无 | 全部 | **P0**（无 KYC 无法借款） |
| 申请 → 账单确认 → 签名 → 提交 | 无 | 全部（含 CR-001 前置） | **P0** |
| 借款记录/详情/进度 | 无 | 全部 | **P1** |
| 合同查看 | 无 | 全部 | **P1** |
| 登录闭环（OTP/密码/找回/设密码） | PARTIAL（35 FAIL） | 修 P1：找回 send、challenge 保留、候选预检、扫码降级 | **P0**（入口） |
| 修改密码 | 无 | `/me/password` | P1 |
| 还款账单（只读）/事件时间线 | 无 | 全部 | P1 |
| 语言（`POST /api/h5/locale`） | 仅本地 | 服务端同步（可选） | P2 |
| 关于/帮助/客服 | 无（H5 亦无） | 新增最小页 | P2 |
| 离线/弱网体验 | 无 UI | 全局离线横幅、重试、保留输入 | P2 |
| 无障碍/高棉文案 | 无证据 | 320–412dp、130/200% 字体 | P2 |
| 客户还款/提现 | 桩页 | **后端禁止，无可实现项** | —（见 OPD-1） |
| Telegram 提醒订阅 | 无 | 原生不可用 | —（接受差异） |
| 通知/消息中心 | 无 | H5 亦无；不创造 | P3（如产品要求再议） |
| 逾期展示 | 无 | 后端无逾期状态 | P3 |

---

## 10. Home State Model

**数据来源**：`GET /api/h5/state` 的 `kyc.status`（`null` ⇒ `none`）+ `state.loans`（"未结贷款" = 第一笔状态非 `closed`/`rejected`）。**首页不需要调用 `/api/kyc`。**
**H5 现状只有 5 种首页形态**（加载/有未结贷款/KYC 通过无贷款/KYC 未通过/错误）；Android 采用 `04` §6 更细的矩阵，但**必须服务端驱动**，下表为冻结草案（交 Codex 做界面）：

| 状态（kyc / loan） | Summary | Primary CTA | Secondary CTA | Required API | Navigation |
|---|---|---|---|---|---|
| kyc=null/`draft`（none/draft） | 完成度与缺项（draft 才有） | 完成身份认证 / 继续完善资料 | 查看流程 | state（+ P2 起 `GET /api/kyc` 取缺项） | `/kyc` |
| kyc=`submitted` | 资料审核中（轮询） | 查看审核进度 | 查看资料 | state | `/kyc` 只读 |
| kyc=`needs_info` | 审核意见 | 去补充资料 | 查看原资料 | state + `GET /api/kyc`（review.reason） | `/kyc` 定位缺项 |
| kyc=`rejected` | 未通过 | 查看结果 | 联系客服 | state | `/kyc` 只读；**无重新申请**（OPD-3） |
| kyc=`approved`，无未结贷款 | 可申请借款 | 申请借款 | 查看 KYC | state | `/loan/apply`（Phase 3；此前显示"即将开放"） |
| loan=`kyc_approved`，账单未确认 | 申请已创建，待确认账单 | 确认借款报价（账单） | 查看贷款 | state | `/loans/:id/quote` |
| loan=`kyc_approved`，账单已确认，无合同 | 待签约 | 阅读条款并签名 | 查看账单 | state + `GET /api/loan/sign` | `/loans/:id/sign` |
| loan=`kyc_approved`，已有合同 | 协议已签署 | 提交申请 | 查看合同 | state | `apply` |
| loan=`decision_pending` | 等待机构审批（轮询） | 查看进度 | 查看合同 | state | `/loans/:id` |
| loan=`signed` | 已通过，待放款 | 查看进度 | 查看合同 | state | `/loans/:id` |
| loan=`active` | 应还/已还/到期日 | 查看还款账单 | （还款/提现 **不提供**） | state | `/loans/:id` |
| loan=`closed` | 已结清 | 查看记录 | 再次申请 | state | `/loans` |
| loan=`rejected` | 申请未通过（原因文案） | 查看原因 | 申请新借款 | state | `/loans/:id` |
| 全局：加载/缓存/离线/错误 | 保留旧内容，显示更新时间 | 重试 | — | state | — |

**Minimal Home（G1 工程中间态）仅保留为过渡**：在 Phase 1 内被上表替换；"切换公司/语言/登出"移入 `/me`。
`04` §6 中"报价状态""create unknown 结果""ruleVersion mismatch"等行依赖 CR-001 或 KYC 规则版本，随 Phase 3/2 启用。

---

## 11. Navigation Model

**依据**：H5/Mini 实际只有 **3 个标签：首页 / 借款记录 / 我的**；铃铛为死链，`state.notifications` 只有贷后提醒显示在借款详情；Android **不做推送/站内信**，"消息"标签没有数据源。
**对比**：

| 方案 | 结论 |
|---|---|
| A. 首页 / 借款 / 我的（3 标签） | **推荐**。与 H5 一致；事件与提醒并入借款详情；不创造不存在的能力 |
| B. 首页 / 借款 / 消息 / 我的（`04` 现状） | 不推荐：消息标签只能展示"最近 5 条事件"的重复信息，且 H5 没有；若未来有真实通知中心再升级 |

任务页（KYC、账单、条款、签名）隐藏底部导航，顶部返回 + 进度。**交 Codex 评估是否采纳 A 并更新 `04`。**

---

## 12. Target Android User Journey（冻结）

```
Launch → Company / Auth → User Home（真实）
  → KYC（8 步，服务端草稿）→ 审核中 / needs_info 补件 / approved
  → 申请（金额/期限）→ 借款报价 → 报价确认 → 条款 → 手写签名 → 提交审批
  → 审批状态（decision_pending）→ 放款状态（signed → active）
  → 借款详情（合同、事件、还款账单只读）→ 结清（closed）→ 再次申请
```
还款/提现不在目标主流程内（后端禁止；见 OPD-1）。

---

## 13. New Delivery Phases

> 按"用户可感知的业务闭环"划分。每阶段都在真实 H5 后端上可验收。

### Phase 0 — Foundation（保留，已完成）
Flutter / Router / Dio / Cookie / Storage / Localization / Security（原 G0，HELIX PASS）。**不改。**

### Phase 1 — 进入 App + 真实首页 + 只读借款（取代旧 "G1 = Company+Auth"）
- **User Value**：登录后立刻看到自己真实的 KYC 与借款状态和下一步，而不是工程占位页。
- **Included**：Company 选择/扫码/App Link/切换（修 `35` 的 P1）；Auth 全流程（OTP、密码、设密码、找回、会话恢复、Return Intent、登出）；**`/api/h5/state` 仓储 + DTO（容忍未知字段，忽略 staff-actor 字段）**；**真实 Home（§10，除 Phase 3 的申请入口外）**；**借款记录列表 + 借款详情（只读，状态/金额/到期日）**；Me（语言、公司切换、修改密码、退出）；3 标签导航；前台刷新策略；全局错误/离线横幅。
- **Existing H5 reference**：`login.tsx`、`mini-client.tsx`（home/records/status/me）、`mini-shell.tsx`。
- **Backend APIs**：`GET /api/h5/auth`、`send`、`verify`、`account`、`recovery`、`logout`、`GET /api/h5/state`、（可选）`POST /api/h5/locale`。
- **Flutter Routes**：`/startup`、`/company/*`、`/auth/*`、`/home`、`/loans`、`/loans/:id`、`/me`、`/me/company`、`/me/language`、`/me/password`。
- **Dependencies**：旧 G1 契约 `21`（有效）+ `35` 的 P1 关闭；`02` 修订（见 §17）。
- **Blocked By**：无（不依赖 CR-001）。
- **Acceptance Flow**：新装 → 选公司 → 验证码登录 → 强制设密码 → 看到首页状态 → 进入借款详情 → 登出 → 重启恢复；A/B 公司隔离；账号在 H5 上已有 KYC/贷款时，Android 首页与 H5 一致。
- **Exit Criteria**：`35` 全部 P1 关闭；Android 模拟器/真机运行证据（L1/L2′）；320/360/412dp 与 130/200% 字体；首页每个状态有测试（假服务数据取自真实 `state` 形状）；无 KYC/申请/签名代码；Codex 独立复验 PASS。

### Phase 2 — KYC 完整闭环
- **User Value**：用户能在手机上完成并提交身份认证、补件、查看结果。
- **Included**：KYC 总览/缺项；8 步表单（个人、证件正反面、自拍、联系人、工作与资产、银行、授权）；原生相机/相册上传（压缩、≤10 MB、JPEG/PNG/PDF 规则、重试）；每步服务端保存（revision 乐观锁，409 合并提示）；提交；`needs_info` 补件与重提；`submitted` 轮询；`approved/rejected` 只读；可选设备定位与地址地理编码；KYC 规则版本不匹配只读。
- **Existing H5 reference**：`app/kyc/client.tsx`、`lib/kyc/core.ts`、`options.json`。
- **Backend APIs**：`GET/POST /api/kyc`、`POST/GET /api/kyc/files`、`POST /api/kyc/geocode`。
- **Flutter Routes**：`/kyc`、`/kyc/step/:id`、`/kyc/upload/:slot`、`/kyc/result`。
- **Dependencies**：Phase 1；选项值映射表（options.json 的中文 `value` 必须原样提交，界面标签本地化）。
- **Blocked By**：无（不依赖 CR-001）。生产需 `KYC_SCAN_URL` 才能上传（运维项）。
- **Acceptance Flow**：新账号 → 8 步填写（含中途退出再进入恢复草稿）→ 上传 4 个必填材料 + 条件材料 → 提交 → 员工在 Web 驳回为 `needs_info` → App 定位缺项补件 → 重提 → 员工通过 → 首页变为"可申请借款"。
- **Exit Criteria**：全部字段/材料规则与服务端一致（服务端为准）；无 PII 落盘（草稿只在服务端）；弱网上传失败可重试；Codex 复验 PASS。

### Phase 3 — 借款申请（含 Loan Quote Gate）
- **User Value**：KYC 通过的用户能完成"选金额期限 → 看清费用 → 确认 → 签约 → 提交审批"。
- **Included**：金额/期限选择；**Loan Quote（借款报价）**；**Quote Confirmation（报价确认）**；Create；条款阅读（服务端 blocks）；手写签名（原生画布→PNG）；提交审批（`apply`）；结果/超时未知态处理。
- **Existing H5 reference**：`apply`/`bill`/`sign` 屏、`app/loan/sign/client.tsx`、`components/loan-bill.tsx`、`lib/pricing.ts`。
- **Backend APIs**：`POST /api/h5/state`（`create`/`confirm_bill`/`apply`）、`GET/POST /api/loan/sign`；**Pre-create quote：CR-001（未实现）**。
- **Flutter Routes**：`/loan/apply`、`/loans/:id/quote`、`/loans/:id/sign`、`/loans/:id/submit`。
- **Dependencies**：Phase 1、2；`07-CR-001`；`create` 非幂等问题（AF-6）。
- **Blocked By**：**CR-001**（仅阻塞"创建申请"Gate，见 §15）。
- **Acceptance Flow**：approved 用户 → 选 $50/14 天 → 看到报价（服务端算，客户端不算）→ 确认 → 创建 → 条款 → 签名 → 提交 → 首页显示"等待机构审批"。
- **Exit Criteria**：报价/创建/签名/提交各自在弱网/重试下不产生重复贷款；错误按 `code`+状态分支（需后端修 `/api/h5/state` 错误折叠，见 §19）；CR-001 已按 G3 的 8 条件解除；Codex 复验 PASS。

### Phase 4 — 借款生命周期
- **User Value**：用户能随时看到审批/放款/还款状态、合同和应还账单。
- **Included**：借款详情全状态（`decision_pending/signed/active/closed/rejected`）；事件时间线；合同查看（含签名图）；**还款账单（只读：应还总额、已还、剩余、到期日、台账）**；贷后提醒通知展示；已结清/被拒后再次申请；轮询策略。
- **Existing H5 reference**：`status` 屏、`app/contract/view.tsx`、`components/loan-bill.tsx`。
- **Backend APIs**：`GET /api/h5/state`、`GET /api/kyc/contract`、`GET /api/kyc/files?id=`。
- **Dependencies**：Phase 1（详情骨架）、Phase 3（合同数据）。
- **Blocked By**：无（只读，可早于 Phase 3 对"H5 已创建的贷款"验收）。
- **Acceptance Flow**：对 Web 端推进的贷款依次观察 `decision_pending → signed → active → closed`，App 状态与 H5 一致；合同与签名图可见。
- **Exit Criteria**：每个状态有首页 CTA 与详情内容；金额均为整数分、服务端值；Codex 复验 PASS。
- **说明**：客户还款/提现不在本阶段（OPD-1）。

### Phase 5 — 完整用户体验 / 发布
- **Included**：缓存与预加载（只读展示缓存，离线禁写）；弱网；无障碍；高棉/英文/中文文案终审；`POST /api/h5/locale` 同步；关于/帮助/客服最小页；`repay/withdraw` 开关仅在后端真实支持后再议；Android 运行证据全集；Release（签名、混淆、网络安全配置收紧）。
- **Exit Criteria**：发布清单（release 签名、无 cleartext、无 debug 配置）、完整 Android 证据包、Codex 最终验收。

---

## 14. Phase Dependencies

```
Phase 0 Foundation ─► Phase 1 (Entry + Home + read-only loans)
                         ├─► Phase 2 KYC ─► Phase 3 Loan Application ◄── CR-001
                         └─► Phase 4 Lifecycle (read-only; contract needs Phase 3 data to be creatable in-app,
                                                 but can be verified against H5-created loans)
Phase 2 + 3 + 4 ─► Phase 5 Experience / Release
```
Phase 2 与 Phase 4 可并行（互不依赖）。Phase 3 依赖 2 与 CR-001。

---

## 15. CR-001 Placement

| 功能 | 是否被 CR-001 阻塞 |
|---|---|
| 登录 / 首页 / 公司 / 借款只读 / KYC / 合同 / 还款账单（只读）/ 设置 | **否** |
| 金额/期限选择（UI）、借款报价展示（Pre-Application Quote） | **是**（接口不存在） |
| 创建申请（`create`，要求携带 quoteId + billConfirmed，且幂等） | **是**（AF-6：当前 `create` 非幂等，活动申请检查先于 requestId 去重） |
| 条款/签名/提交审批 | 否（但前置依赖已创建的贷款，因此实际排在 Create 之后） |

**结论**：CR-001 只阻塞 **Phase 3 的 "Loan Quote + Create" Gate**。Phase 1/2/4/5 全部可推进。CR-001 保持 PROPOSED，本文**不批准**。
**潜在捷径（不推荐，需产品决策，OPD-2）**：按 H5 现状走"先创建再确认账单"。违背已冻结的"报价先于创建"，且创建后客户无法取消（H5 D4）、`create` 非幂等，**不建议用于生产**。

---

## 16. Existing Flutter Asset Reuse

| 资产 | 处置 | 说明 |
|---|---|---|
| core/network（管线、拦截器、端点）、core/session（Cookie/公司上下文）、core/error、core/logging、core/storage、core/localization | **KEEP** | 按产品需要增补端点/DTO；错误映射需与"带 `code` 的真实响应"对齐 |
| app/router（Gate、Return Intent、deep link） | **KEEP** | 业务路由在其上增加；`/feature/*` 桩替换 |
| app/bootstrap/providers | **REUSE** | 增加 state/kyc/loan 提供者，逐步拆分文件 |
| features/auth（仓储+页面） | **REUSE** | 修 35 的 P1；将 1000 行的 `auth_placeholder.dart` 拆分/改名 |
| features/company | **REUSE** | 修"确认前激活""候选预检""扫码降级" |
| features/startup | **KEEP** | |
| features/home（占位 + Me/Company/Language 混在一个文件） | **REFACTOR** | Home 重写为状态驱动；Me/Company/Language 拆文件 |
| features/settings/locale_notifier（7 行桩） | **REMOVE** | 与 providers 内 LocaleNotifier 重复 |
| core/feature_flags、`/feature/repay|withdraw` 与 FeatureDisabledPage | **DEFER → 重新定义** | 后端无开关；客户还款/提现不提供。保留 flag 位但默认关；删除误导性的路由占位或改为"不可用" |
| core/money | **DEFER** | Phase 3/4 首次使用（整数分展示） |
| app/theme | **REUSE** | |
| G0/G1 合同与评审文档 | **保留为历史** | 见 §17 |

---

## 17. Deprecated / Intermediate Work & Migration Decision

| 文档/工件 | 处置 |
|---|---|
| `01` 需求、`02` API 合同、`05` 技术架构 | **继续有效，但需修订**：`01`/`05` 的 "G0–G5" 产品含义由本文 Phase 1–5 取代；**`02` 需 v3 更新**（取证发现的陈旧项：响应带 `code`；客户 repay/withdraw 被硬拒绝且**无开关**；"100 单上限"已移除；非 `KycError` 失败折叠为 400；`customer_enter`；`rejected` 终态；`bots` 泄露字段；staff-actor 字段） |
| `04` UX | **继续有效，待 Codex 更新**：导航 3 vs 4 标签、首页矩阵与"无还款"、`/feature/*` |
| `07` CR-001 | 继续有效（PROPOSED），含义同 §15 |
| `10`、`19`（G0 合同） | 继续有效（Foundation） |
| `21` G1 合同（v2.3 APPROVED） | **继续有效**，重命名定位为 **"Foundation Feature Set A：Company + Auth"，并入 Phase 1**；其"Minimal Home"仅作过渡 |
| `22–36`（G1 评审/验收/恢复报告） | **历史实施记录**；`35` 的 P1 作为 Phase 1 的待关闭项继承 |
| `24` Gate Packet | 历史；Phase 1 另建新 Gate Packet |
| 旧 "G1/G2/G3" 产品含义 | **由 Phase 1–5 替代**：G1→Phase 1 的一部分；G2（KYC+借款只读）→ Phase 2/4；G3（报价与申请）→ Phase 3（保留 "CR-001 阻塞"） |
| `30-G1-implementation-report.md` | 保留为 Trae 的 G1 报告文件名；Phase 1 报告另用新编号 |

不删除任何历史文件。

---

## 18. Acceptance Strategy

1. **以真实后端形状为准**：假服务（FakeKhmerXServer）的 `state`/`kyc`/错误体必须取自真实路由代码/抓取样例，而非客户端实现的镜像（H8 教训）。
2. **与 H5 对拍**：每阶段用同一测试账号，在 H5 与 Android 上对同一状态比较关键字段（首页 CTA、金额、状态）。
3. **Android 运行证据**：模拟器或真机（L1/L2′），路由渲染、假服务全流程、截图/logcat、App Link intent；每阶段必须有，不得再次延后。
4. **无障碍/字体**：320/360/412dp、130%/200%。
5. **安全**：不记录 OTP/密码/Cookie/完整手机号/文件内容；KYC 草稿仅服务端；生产冒烟仅限无副作用端点；禁止自动操作真实用户账号。
6. **Codex 独立复验**每阶段 Exit。

---

## 19. Risks

| 风险 | 影响 | 缓解 |
|---|---|---|
| Android 只做了入口，用户价值为零 | 项目推进感错觉 | 本文分期；Phase 1 以"真实首页"为退出标准 |
| `POST /api/h5/state` 失败统一 400 `REQUEST_FAILED` | 客户端无法区分错误，重试/提示不准确 | 后端小改（保留 `code`/状态，类似 `failure()`）— **需后端 CR**，Phase 3 前 |
| `create` 非幂等 + 无取消 | 重复/卡死的申请 | CR-001 + 幂等；产品需定义"放弃申请" |
| 借款协议仅中文 | 高棉/英文用户无法读懂协议（合规） | OPD-5 |
| KYC `rejected` 终态 | 被拒用户无出路 | OPD-3 |
| 金额/期限列表未由 API 下发 | 客户端硬编码，与服务端漂移 | 后端暴露 limits（P2 CR）或服务端为准+错误提示 |
| 客户还款/提现不可用 | 用户期望与现实不符 | 明确产品文案：还款由机构渠道/员工登记 |
| 员工可见字段泄露到客户响应 | 隐私 | 客户端忽略；后端清理（见 `code-audit-20261008.md` N-08） |
| 无 Android 运行证据 | 阶段退出无依据 | 每阶段强制 |
| 选项值为中文 `value` | 与本地化标签耦合 | 映射表测试，原样提交 |
| 24 小时绝对会话 | 每日需重新登录 | Return Intent 与友好提示 |
| 安全审计中的高危项（MFA、应急授权、迁移） | 属后台，但影响上线 | 另行追踪，不属于本分期 |

---

## 20. Open Product Decisions

| ID | 决策 | 推荐 | 阻塞 |
|---|---|---|---|
| OPD-1 | 客户还款/提现：后端硬禁用，Android 如何呈现？ | 仅"还款账单（只读）+ 还款指引（经机构/客服渠道）"；不提供按钮；待真实支付通道（KESS/KHQR）再设计 | Phase 4 文案 |
| OPD-2 | CR-001 之前是否允许"H5 平价流程"（先创建再确认账单）？ | **不允许用于生产**；仅可在测试构建内以开关验证 | Phase 3 |
| OPD-3 | KYC `rejected` 后是否允许重新申请？ | 需后端支持（新案件或重新开放）；否则首页显示"联系客服" | Phase 2 首页 |
| OPD-4 | 客服/帮助渠道来源（Telegram 机器人？电话？） | 公司级配置或固定入口；需业务提供 | Phase 5 |
| OPD-5 | 借款协议多语言（当前仅中文） | 需法务提供 km/en 版本并由服务端 `blocks` 下发；否则明示"以中文版为准" | Phase 3 上线 |
| OPD-6 | 底部导航 3 标签 vs 4 标签 | 3 标签（§11）；交 Codex | Phase 1 UI |
| OPD-7 | 金额/期限/额度由 API 下发还是客户端常量 | 推荐后端在 `state` 下发（P2 CR）；过渡用常量 + 服务端校验 | Phase 3 |
| OPD-8 | Android 埋点 `source` | 后端允许 `android`（小改）或沿用 `h5` | Phase 5 |
| OPD-9 | Android 的"消息中心" | 不做；事件并入借款详情 | Phase 4 |
| OPD-10 | 账户删除（商店政策） | 发布前评估，后端暂无 | Phase 5 |

---

## 21. Recommended Next Phase

**Phase 1 — 进入 App + 真实首页 + 只读借款**。具体顺序：
1. Codex 评审本文（产品定位、分期、3 标签导航、首页状态模型）。
2. Claude 在评审后更新 `02`（v3，取证修正）并起草 **Phase 1 合同**（`/api/h5/state` DTO、首页状态机、借款只读、Me、刷新策略；沿用 `21` 作为"Company+Auth"子集，不推翻）。
3. Trae 先关闭 `35` 的全部 P1（含 Android 运行证据与无障碍），再实现 state/首页/借款只读。
4. 并行启动：后端 CR 草案（`/api/h5/state` 错误码、limits 下发）与 CR-001 的 G3 解除条件推进——**均不阻塞 Phase 1/2**。

**本文不授权 Trae 开工；Phase 1 合同批准前，Trae 保持 HOLD。**
