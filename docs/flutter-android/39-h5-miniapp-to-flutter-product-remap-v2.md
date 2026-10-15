# H5 / Mini App → Flutter Android Product Remap v2

```
Document:   39-h5-miniapp-to-flutter-product-remap-v2.md
Date:       2026-10-08
Owner:      Claude（Product / Requirements / Architecture / API Contract / Delivery Planning）
Status:     SUPERSEDED BY 41
Supersedes: 37（保留为"第一次 Product Remap"历史记录）
Source:     38-product-remap-review.md（Codex，FAIL）— 本文只据其真实 P1/Gap 修订
Evidence:   真实代码 > 38 > 37 > 旧 Android 文档。H5/Mini UI、客户后端 API、Flutter 现状三份只读取证 + 本轮对 create 状态的人工复核（见 §8）。
Not done:   不写 Flutter 代码；不改 02/04；不覆盖 38；不批准 CR-001；不授权 Trae。
```

产品阶段统一命名 **P0–P5**，**不再使用 G1/G2/G3 表示产品含义**（Gate 文档可单独用 Gate 编号）。

---

## 1. Executive Summary

1. **基线**：KhmerX Flutter Android = 现有普通借款用户 H5 / Telegram Mini App 的原生 Android 客户端。**One Customer Product Baseline + Environment-specific Entry/Auth**。
2. **38 的 4 个 P1 全部处理**（附录 B）：
   - **P1-1（create 状态）**：经人工复核，两种说法各对一半——领域函数 `applyAction('create')` 写入 `registered`（`lib/domain.ts:43`），**但 H5 客户路径**在持久化前由 `lib/store.ts:41` 覆盖为 `kyc_approved`（且要求 KYC 已 `approved`，否则 409）。**已在 §8 分层写清**，并要求 Android 对 `registered/kyc_pending/needs_info/approved` 等旧状态**防御性容错**。
   - **P1-2**：P1 必须包含只读借款列表/详情（含最近事件与只读账单摘要），不再只是"首页摘要"。
   - **P1-3**：旧 G1 Recovery 资产不再计为新 P1 完成，降级为 "Existing Entry/Auth Engineering Asset"（REUSE + FIX）。
   - **P1-4**：02/04 与真实 H5/API 冲突的条目已列为 **STALE DOCUMENT / 02 API CONTRACT REVISION REQUIRED**（§24），本轮不改 02。
3. **三个以代码为准的结论**：客户 `repay/withdraw` 被服务端硬拒绝 → **BACKEND BLOCKED，不进当前路线图**；铃铛是 **DEAD UI，不移植**；Telegram 提醒订阅是 **MINI APP ONLY，不进 Android MVP**。
4. **导航**：首页 / 借款记录 / 我的（3 项）；`04` 的"消息"标签为 STALE。
5. **阶段（按用户结果）**：P0 Foundation → **P1 Entry + Real Home + Read-only Loan** → P2 KYC → P3 Loan Application（受 CR-001 阻塞）→ P4 Full Loan Lifecycle → P5 Release Hardening。
6. **推荐下一份 Contract：P1**。**不授权 Trae**，须先 Codex 重审与三方 Gate。

---

## 2. Product Baseline（冻结）

> **KhmerX Flutter Android 是现有普通借款用户 H5 / Telegram Mini App 的原生 Android 客户端。**

- 不是 Auth App、不是 Company Management App、不是 Admin App，也不是与 H5 无关的新产品。
- 排除：运营后台、机构后台、员工端、审批、贷后、财务后台（继续 Web）。
- 复用现有 H5 API（浏览器兼容客户端：Cookie 会话 + `Origin`）；不新增 `/api/mobile/*`，不用 Bearer。
- **Android 增量能力（H5 没有，单列为 Android Increment）**：多公司（扫码/App Link/最近公司/切换）、原生相机/相册上传、原生手写签名、前台刷新策略。
- **NEW PRODUCT ADDITION（H5 没有，不算移植）**：关于/帮助/客服。
- 继续有效的技术约束：服务端驱动业务规则、整数分金额、公司隔离、Cookie 认证、Origin、requestId、无离线写队列、安全日志、安全存储。

## 3. H5 / Mini App Relationship

**结论：SAME PRODUCT。** `/h5/layout.tsx` 挂载 `H5Login`，登录后统一渲染 `MiniClient`/`MiniShell`；`/mini` 重定向到 `/h5`。业务功能只规划一套。

| 差异 | H5 | Mini App | Android |
|---|---|---|---|
| 静默登录 `POST /api/h5/auth/telegram`（需 `initData`） | 无 | 有 | **不适用（MINI APP ONLY）** |
| Telegram 提醒订阅 `/api/telegram`（需 `initData`） | 无 | 有 | **不进 MVP（MINI APP ONLY）** |
| 验证码登录（Telegram Gateway）/ 密码 / 找回 | 有 | 有 | 有 |
| 首页/KYC/申请/账单/签约/借款记录/我的 | 同码 | 同码 | 按 P1–P4 |

---

## 4. Existing Customer Journey（真实代码）

入口 `/` → `/h5` → `H5Login` 状态机 → 登录后 `MiniClient`：

1. 预检 `GET /api/h5/auth` → 注册/登录视图 → 验证码或密码 →（telegram 模式）必要时强制设密码（≥12 位）→ 服务端对所有客户 API 强制 `requireRegistrationComplete`。
2. 首页（`GET /api/h5/state`，15 秒轮询 + 焦点刷新）。
3. KYC 8 步（个人、证件正面、证件反面、自拍、联系人、工作与资产、银行、授权）；每次"下一步"服务端保存草稿；最后一步提交。
4. 申请（金额/期限）→ `create` → 账单 → `confirm_bill` → 条款/签名 → `apply` → 待机构审批 → 待放款 → 还款中 → 已结清。
5. 我的：资料卡、身份资料、借款记录、账户安全（设置/修改密码、忘记密码）、Telegram 提醒、语言、登出。

---

## 5. Functional Inventory

> 阶段列使用 P1–P5（§17–22）。"类别"见 §6。

### Entry / Auth

| ID | 用户功能 | H5 / Mini | Backend API | 类别 | Android | 阶段 |
|---|---|---|---|---|---|---|
| ENT-01 | 公司上下文（H5：cookie 决定，无 UI） | 无 UI | `payease_company`；`customer_enter` 另有 | Android Increment | 扫码/粘贴/App Link/最近公司 | P1 |
| ENT-02 | 公司切换 | 无 | — | Android Increment | 是 | P1 |
| AUTH-01 | 预检 | REAL | `GET /api/h5/auth` | REAL | 是 | P1 |
| AUTH-02 | Telegram 静默登录 | Mini 有 | `auth/telegram` | **MINI-APP ONLY** | 否 | — |
| AUTH-03 | Telegram Gateway 验证码登录 | REAL | `send`/`verify` | REAL | 是 | P1 |
| AUTH-04 | 密码登录 | REAL | `account password_login` | REAL | 是 | P1 |
| AUTH-05 | 强制设置密码 | REAL | `account set_password` | REAL | 是 | P1 |
| AUTH-06 | 找回密码 | REAL | `recovery send/reset` | REAL | 是 | P1 |
| AUTH-07 | 会话恢复 / 401 重登 / 24h 绝对过期 | PARTIAL（仅 MiniClient 处理 401） | — | PARTIAL | 是（Return Intent） | P1 |
| AUTH-08 | 登出 | REAL | `logout` | REAL | 是 | P1 |
| AUTH-09 | 语言 | REAL | `GET auth languages` + `POST locale` | REAL | 是 | P1 |
| AUTH-10 | 修改密码（账户安全） | REAL | `account set_password`（改密需当前密码） | REAL | 是 | P1 |

### Home

| ID | 用户功能 | 类别 | API | 阶段 |
|---|---|---|---|---|
| HOME-01 | KYC 状态 + 贷款状态 + 主 CTA + 当前贷款摘要 + 下一步 | REAL | `GET /api/h5/state` | P1 |
| HOME-02 | 前台刷新（15s 轮询、焦点刷新） | REAL | 同上 | P1 |

### KYC

| ID | 用户功能 | 类别 | API | 阶段 |
|---|---|---|---|---|
| KYC-01 | 总览/缺项/完成度 | REAL（完成度分数 H5 仅非 Mini 视图） | `GET /api/kyc` | P2 |
| KYC-02 | 个人与身份 | REAL | `POST /api/kyc` | P2 |
| KYC-03 | 联系人（2 必填 + 1 选填） | REAL | 同上 | P2 |
| KYC-04 | 工作/资产（含车辆/住房条件材料） | REAL | `POST /api/kyc` + files | P2 |
| KYC-05 | 银行/收款账户（ABA/ACLEDA/Wing） | REAL | 同上 | P2 |
| KYC-06 | 授权同意 | REAL | 同上 | P2 |
| KYC-07 | 定位（可选设备定位 + 地址地理编码） | REAL（地理编码需 Google Key） | `geocode` | P2 |
| KYC-08 | 文件上传（证件正反面、自拍、收入证明、条件材料） | REAL（生产需杀毒扫描） | `kyc/files` | P2 |
| KYC-09 | 草稿保存（每步服务端；revision 乐观锁） | REAL | `POST /api/kyc save` | P2 |
| KYC-10 | 提交 | REAL | `submit` | P2 |
| KYC-11 | Submitted（只读，轮询） | REAL | `GET /api/kyc` | P2 |
| KYC-12 | Needs Info → 编辑 → Resubmit | REAL | 同上 | P2 |
| KYC-13 | Approved（只读） | REAL | 同上 | P2 |
| KYC-14 | **Rejected：NO EDIT / RESUBMIT**（服务端终态） | REAL（终态） | — | P2（只读展示） |

### Loan Application — **现有 H5 流程**（CURRENT H5 FLOW）

| ID | 用户功能 | 类别 | API | Android |
|---|---|---|---|---|
| LAPP-01 | 选择金额（$30/$50/$100/$500）/ 期限（14/28 天） | REAL；**STATIC BUSINESS CONFIG IN CLIENT** | — | P3 |
| LAPP-02 | Create（要求 KYC `approved`；非幂等；创建后无法取消） | REAL | `POST /api/h5/state create` | P3（受 CR-001） |
| LAPP-03 | Billing 展示（创建后才生成） | REAL | `loan.billing` | P3 |
| LAPP-04 | Confirm Bill | REAL | `confirm_bill` | P3 |
| LAPP-05 | Terms（服务端 blocks，**仅中文**） | REAL；**LEGAL CONTENT DECISION REQUIRED** | `GET /api/loan/sign` | P3 |
| LAPP-06 | Signature | REAL | `POST /api/loan/sign` | P3 |
| LAPP-07 | Apply | REAL | `apply` | P3 |

**TARGET ANDROID FLOW AFTER CR-001** 见 §9（不是现有接口）。

### Loan Lifecycle

| ID | 用户功能 | 类别 | API | 阶段 |
|---|---|---|---|---|
| LIFE-01 | 借款列表（含历史） | REAL | `state.loans` | **P1** |
| LIFE-02 | 借款详情（状态、金额、期限、到期日、应还/已还） | REAL | 同上 | **P1（只读）** |
| LIFE-03 | 最近事件（H5 显示最近 5 条） | REAL | `state.events` | **P1（最近 5 条）**；完整时间线 P4 |
| LIFE-04 | 还款信息（只读摘要：应还总额、已还、剩余、到期日） | PARTIAL（无专用结构，由 `amount+fee−paid`、`dueAt` 推导） | `state.loans`/`entries` | **P1 摘要**；账单明细/台账 P4 |
| LIFE-05 | 合同查看（含签名图） | REAL | `GET /api/kyc/contract`、`kyc/files` | P4 |
| LIFE-06 | decision_pending / signed / active / closed / rejected 状态 UX | REAL（状态值） | state | P1 基础；P4 完整 |
| LIFE-07 | 已结清/被拒后再次申请 | REAL（可再 `create`） | `create` | P3 |
| LIFE-08 | 逾期提示 | **DERIVED DISPLAY POSSIBILITY**（无 overdue 状态） | `dueAt` + 提醒通知 | P4/P5（需 Contract） |

### Account / Other

| ID | 用户功能 | 类别 | 阶段 |
|---|---|---|---|
| ACC-01 | 语言 / 密码 / 登出 | REAL | P1 |
| ACT-01 | 客户还款 | **MOCK + BACKEND BLOCKED**（403） | 不实施 |
| ACT-02 | 客户提现 | **MOCK + BACKEND BLOCKED**（403） | 不实施 |
| NOTI-01 | 铃铛/消息 | **DEAD UI（DO NOT PORT）** | 不实施 |
| NOTI-02 | Telegram 提醒订阅 | **MINI-APP ONLY** | 不进 MVP |
| NOTI-03 | 贷后提醒通知展示（`postloan-reminder:*`，只读） | REAL（数据在 state 中） | P4 |
| NEW-01 | 关于/帮助/客服 | **NEW PRODUCT ADDITION**（H5 无） | P5（若获批） |

---

## 6. Feature Reality Classification

| 类别 | 条目 |
|---|---|
| **REAL** | 预检、验证码登录、密码登录/设置、找回、登出、语言、`GET/POST /api/h5/state`（create/confirm_bill/apply）、KYC 保存/提交/文件/地理编码、协议与签名、合同查看、借款记录/进度 |
| **PARTIAL** | 401 处理（仅 MiniClient）、还款信息（无专用账单结构）、Telegram 提醒 UI（自述"待联通验收"）、KYC 完成度（仅非 Mini 视图） |
| **LEGACY** | `/kyc`、`/loan/sign`、`/contract`、`/agreements/loan` 员工身份门控的重复页；`CustomerJourney`、`TestFlowMenu`；旧动作 `confirm_kyc/submit_kyc/resubmit/sign` 与旧状态 `registered/kyc_pending/needs_info/approved`（H5 客户路径基本不出现，客户端需容错）；`/api/state` 沙盒 |
| **MOCK** | 客户端"登记测试还款/提现至收款账户"界面；底层仅记账，无支付通道 |
| **DEAD UI** | 铃铛 `/h5/me?panel=messages`（无面板、红点常亮）；`kycPresentation().action` 文案（从未渲染） |
| **MINI-APP ONLY** | `POST /api/h5/auth/telegram` 静默登录；`/api/telegram` 订阅（均需 `initData`） |
| **NOT IMPLEMENTED** | 借款前报价（`/api/loan/quote`）、客户公司切换 UI、关于/帮助/客服、离线处理、账户删除、站内通知中心、KYC rejected 后重提 |
| **BACKEND BLOCKED** | 客户 `repay`/`withdraw`（403 `CUSTOMER_SETTLEMENT_FORBIDDEN`，硬编码，**无 feature flag**）；Pre-Application Quote（CR-001）；KYC rejected 重提 |

---

## 7. Backend Capability Reality

| 能力 | 端点 | 现实 |
|---|---|---|
| 预检 | `GET /api/h5/auth` | REAL。`{company, authenticated, session, mode, pending, policy, languages}` |
| 发送/验证验证码 | `POST /api/h5/auth/send`、`verify` | REAL；send 非幂等，限流；首次验证即建号 |
| 账号 | `POST /api/h5/auth/account` | REAL：`password_login`、`set_password`；`register` 在 telegram 模式恒 409 |
| 找回 | `POST /api/h5/auth/recovery` | REAL：`send`/`reset`；重置使所有会话失效 |
| 登出 | `POST /api/h5/auth/logout` | REAL |
| 语言 | `POST /api/h5/locale` | REAL |
| 状态 | `GET /api/h5/state` | REAL：`{state:{loans,events,entries,notifications,bots,…}, revision, kyc:{status}\|null, pricing}`；**无** company/limits；`kyc` 为 `null` 表示未建案件 |
| 动作 | `POST /api/h5/state` | REAL：`create`、`confirm_bill`、`apply`；**`repay`/`withdraw` → 403 `CUSTOMER_SETTLEMENT_FORBIDDEN`**；非 `KycError` 的失败**折叠为 400 `REQUEST_FAILED`** |
| KYC | `GET/POST /api/kyc`、`POST/GET /api/kyc/files`、`POST /api/kyc/geocode` | REAL；revision 乐观锁；文件原始字节 + `x-kyc-slot`；≤10 MB；每客户 ≤40 行；生产需 `KYC_SCAN_URL` |
| 协议/签名 | `GET/POST /api/loan/sign` | REAL；三个自定义头；协议仅中文 |
| 合同 | `GET /api/kyc/contract` | REAL |
| 报价 | `/api/loan/quote` | **NOT IMPLEMENTED（CR-001）** |
| 埋点 | `POST /api/analytics/events` | REAL；`source` 仅 `mini_app`/`h5` |
| 响应格式 | `{error, code}`（多数 `code` 由中文文案子串推断，脆弱） | 旧 02 "无 code 字段"已过期 |

**Loan 状态（以代码为准）**：`registered | kyc_pending | needs_info | kyc_approved | decision_pending | approved | rejected | signed | active | closed`。客户路径实际出现：`kyc_approved → decision_pending → signed → active → closed`，以及 `rejected`；其余为旧状态。**没有 `overdue` 状态。**
**KYC 状态**：`draft | submitted | needs_info | approved | rejected`（`state.kyc` 为 `null` 时按"未开始"）。**`rejected` 是终态。**
**员工两阶段审批**：`approve` → 仍 `decision_pending`；`approval_check` → `signed`；`approved` 不落库。

---

## 8. Existing H5 Loan Flow（CURRENT H5 FLOW）

```
前置：KYC case = approved（否则 409「请先完成 KYC 资料审核」）；且无其它未结贷款（否则 409）
1. 选择金额(3000/5000/10000/50000 分) + 期限(14/28 天) + 测试资金同意
2. POST /api/h5/state {action:'create', name, amount, termDays, consent, requestId}
     领域层 lib/domain.ts:43：新贷款 status='registered'
     客户路径 lib/store.ts:41：持久化前覆盖为 status='kyc_approved'，绑定 kycCaseId/kycRevision
     lib/store.ts:44：生成 billing（calculateBill，quoteId=随机 UUID，无过期、不单独存储）
     → 持久化后的客户可见状态：kyc_approved，billing 已存在，billConfirmedAt 为空
3. 账单展示（本金、利息、服务费、实际到账、应还总额）
4. POST {action:'confirm_bill', loanId, billConfirmed:true, quoteId} → billConfirmedAt（状态不变）
5. GET /api/loan/sign（blocks，仅中文）→ 勾选同意 → POST /api/loan/sign（签名 PNG，x-loan-*）
     → loan.contract/signedAt（状态不变）
6. POST {action:'apply', loanId, billConfirmed:true, quoteId} → decision_pending
7. 员工：approve → approval_check → signed → disburse → active → 还款登记 → closed；reject → rejected
```
**对 38 P1-1 的复核结论**：`registered` 是 `applyAction` 领域层的写入值；经 H5 客户路径落库的是 `kyc_approved`。**Android 契约以"服务端返回的状态值"为准，并对所有 10 个状态值容错**（旧状态的贷款一律只读展示，不提供写入口）。
已知缺陷：**create 非幂等**（活动申请检查先于 requestId 去重，AF-6）；创建后**客户无法取消/修改**；`pricing` 虽在 state 中返回，H5 不使用；`apply` 前重复校验 `quoteId`。

## 9. Target Android Loan Flow（AFTER CR-001；目前不存在于代码）

```
选择金额/期限（STATIC CONFIG 或后续 server-driven）
→ Quote（POST /api/loan/quote，CR-001）
→ Quote Confirmation（展示服务端报价；客户端不计算）
→ Create（携带 quoteId + billConfirmed:true，幂等，报价绑定）
→ Terms
→ Signature
→ Apply（decision_pending）
```
术语冻结：Loan Quote = 借款报价（Create 前）；Quote Confirmation = 报价确认；Repayment Bill = 还款账单（贷款生命周期）。**两条流程不得混写**：P3 的 Contract 必须拆成"现有 H5 流程分支（仅测试构建验证）"与"CR-001 目标分支（生产路径）"。

---

## 10. Home State Matrix

**唯一事实源**：`GET /api/h5/state`（KYC 来自 `kyc.status`，`null`⇒`none`；贷款来自 `state.loans`）。**未结贷款**=第一笔状态非 `closed`/`rejected` 的贷款。优先级：**有未结贷款 → 按贷款驱动；否则按 KYC 驱动；KYC `approved` 且无未结贷款 → 申请入口。** 所有金额/费用/到期日取自服务端，客户端不重算。
**P1 的写入口约束**：P1 不含 KYC 编辑/创建/签名；P1 中指向 P2/P3 的 CTA 显示"此步骤将在后续版本开放"（OPD-1，须业主确认）。

| KYC | Loan（未结） | 首页摘要 | Primary CTA | Secondary CTA | Target | 生效阶段 |
|---|---|---|---|---|---|---|
| none（`null`） | — | 开始完成身份认证 | 完成身份认证 | 查看流程 | `/kyc`（P1：占位说明） | P2 |
| draft | — | 资料完成度与缺项 | 继续完善资料 | 查看已保存内容 | `/kyc` | P2 |
| submitted | — | 资料审核中（轮询） | 查看审核进度 | 查看资料 | `/kyc` 只读 | P1 展示 / P2 入口 |
| needs_info | — | 需要补充资料（审核意见） | 去补充资料 | 查看原资料 | `/kyc` | P2 |
| rejected | — | 资料未通过（**终态：无编辑/重提**） | 查看结果 | 联系客服（若 NEW-01 获批） | `/kyc` 只读 | P1 展示 / P2 |
| approved | 无 | 可申请借款 | 申请借款 | 查看 KYC | `/loan/apply` | **P3**（此前显示"即将开放"） |
| 任意 | `registered`/`kyc_pending`/`needs_info`（**旧状态**） | 借款处理中（旧流程） | 查看借款进度 | — | `/loans/:id` 只读 | P1 |
| approved | `kyc_approved`，账单未确认 | 申请已创建，待确认账单 | 查看账单 | 查看贷款 | `/loans/:id`（P1 只读）→ 确认 P3 | P1 只读 / P3 |
| approved | `kyc_approved`，账单已确认，无合同 | 待签约 | 去签约 | 查看账单 | `/loans/:id`（P1 只读）→ 签约 P3 | P1 / P3 |
| approved | `kyc_approved`，已有合同（`contract` 存在） | 协议已签署，待提交 | 提交申请 | 查看合同 | `apply`（P3）；合同 P4 | P3 / P4 |
| approved | `approved`（旧：待签约，客户路径不落库） | 待签约 | 查看进度 | — | `/loans/:id` | P1 |
| approved | `decision_pending` | 等待机构审批（轮询） | 查看进度 | 查看合同 | `/loans/:id` | P1 |
| approved | `signed` | 已通过，待放款 | 查看进度 | 查看合同 | `/loans/:id` | P1 |
| approved | `active` | 还款中：剩余应还、到期日 | 查看还款信息 | —（**无还款/提现**） | `/loans/:id` | P1（摘要）/ P4（明细） |
| approved | 最近一笔 `closed`，无未结 | 已结清 | 查看记录 | 再次申请 | `/loans`；`/loan/apply` | P1 / P3 |
| approved | 最近一笔 `rejected`，无未结 | 申请未通过 | 查看原因 | 申请新借款 | `/loans/:id`；`/loan/apply` | P1 / P3 |
| 任意 | 首次加载 | 加载骨架 | — | — | — | P1 |
| 任意 | 刷新失败 | 保留旧内容 + 错误条 | 重试 | — | — | P1 |
| 任意 | 离线 | 最近更新时间 + 离线提示（只读缓存） | 重试 | — | — | P1/P5 |
| 任意 | 401 | 会话过期 | 重新登录 | — | `/auth/login`（Return Intent） | P1 |

**Overdue**：不是状态。到期日已过且 `active` 时，仅可作 **DERIVED DISPLAY POSSIBILITY**（由 `dueAt` 推导的提示文案），**未经 Contract 不进入状态机**。

## 11. Navigation

**默认并冻结：首页 / 借款记录 / 我的（3 项）。**
依据：真实 H5 `mini-shell.tsx` 三项底部导航；铃铛为死链；`state.notifications` 无独立面板；Android 无推送。
**`04` 的四项"首页 / 借款 / 消息 / 我的"标记为 STALE DOCUMENT**，由 Codex 更新。KYC、账单、条款、签名等任务页隐藏底部导航。
**Me 只移植真实项**：资料卡（公司、脱敏手机号）、身份资料入口、借款记录入口、账户安全（设置/修改密码、忘记密码）、语言、登出；Android 增量：**切换公司**；NEW PRODUCT ADDITION：关于/帮助（P5，待决）。

---

## 12. Flutter Coverage

| 能力 | 状态 |
|---|---|
| Foundation（Dio 管线、Cookie 公司隔离、Secure Storage、Redaction、Locale、Router） | 已完成，G0 PASS；CF-0/CF-6 基础通过 |
| Company / Auth 页面 | 存在，但 Codex `35` 复验 **FAIL**（候选在确认前被激活、缺候选预检、找回 send 未调用 API、challenge 未保留、扫码无降级、Return Intent 缺证据、无 Android 运行证据、无无障碍证据）。`35` 之后代码又新增若干测试，**是否关闭 P1 未核实** |
| `GET /api/h5/state` 仓储 / DTO / 页面 | **NOT IMPLEMENTED**（仅端点常量） |
| 正式 Home | **NOT IMPLEMENTED**（现为 Minimal Home 占位） |
| 借款列表 / 详情 | **NOT IMPLEMENTED** |
| KYC / 贷款 / 签名 | **NOT IMPLEMENTED** |
| 修改密码页 | **NOT IMPLEMENTED** |
| Repay/Withdraw 桩 | 存在（FeatureDisabledPage）；与后端阻断不符，需移除 |

## 13. Reuse Matrix

| Existing Flutter asset | Decision | New Phase | Action |
|---|---|---|---|
| Network（Dio 管线、拦截器、endpoints） | **KEEP** | P1+ | 增补 state/kyc/loan 端点与 DTO；错误映射对齐"带 `code` 的真实响应" |
| Cookie（CF-0/CF-6 jar、公司 Cookie 注入与 Guard） | **KEEP** | P1+ | 强约束保持；补 GET 重试 Guard 的缺陷测试 |
| Storage（SecureKv/KeySchema） | **KEEP** | P1+ | 新增缓存键时经 KeySchema |
| SafeLogger / Redaction | **KEEP + FIX** | P1 | 实现真实 SafeLogger；补脱敏缺口 |
| ErrorMapper | **REFACTOR** | P1 | 按真实响应（`error`+`code`、折叠的 400）重写映射与测试 |
| Localization | **REUSE** | P1 | 接入 preflight `languages`、公司隔离；`POST /api/h5/locale` 同步（P1 可选） |
| Router | **REFACTOR** | P1 | 保留 Gate/Return Intent；新增 `/loans`、`/loans/:id`、业务路由；移除 `/feature/*` 桩 |
| Company（选择/候选） | **REFACTOR** | P1 | 候选不提前激活 + 候选预检 + 最近公司 |
| Auth Repository | **REUSE + FIX** | P1 | 保留已校正的 DTO 与登出；补 challenge 保留、pending OTP、recovery send |
| Auth UI | **REFACTOR** | P1 | 拆分 1000 行文件；补错误态/CTA/倒计时 |
| Scanner | **REFACTOR** | P1 | 权限拒绝、错误、粘贴回退 |
| Deep Link | **REFACTOR** | P1 | 候选预检 + 确认状态 |
| Minimal Home | **REMOVE/REFACTOR** | P1 | 替换为 §10 状态驱动首页；公司/语言/登出移入 Me |
| features/settings LocaleNotifier 桩 | **REMOVE** | P1 | 与 providers 内重复 |
| FeatureFlags / `/feature/repay|withdraw` / FeatureDisabledPage | **REMOVE**（从客户产品流） | P1 | 后端无开关且硬拒绝；不实现 flag；仅保留文档层阻断说明 |
| `core/money` | **DEFER** | P1（金额展示）/P3 | 首个消费者出现时启用 |
| Theme | **REUSE** | P1+ | |

**旧 `35` 的 FAIL 项处理**：不再控制产品分期；作为 Existing Entry/Auth Engineering Asset 的 **REUSE + FIX 待办**纳入 P1 Contract 验收（§15）。

---

## 14. Product Gaps（用户可见价值缺口）

| Gap | 阶段 |
|---|---|
| 状态驱动的真实首页 | P1 |
| 借款记录 + 只读详情（含最近事件、还款信息摘要） | P1 |
| 修改密码页 | P1 |
| KYC 总览、8 步、上传、提交、补件 | P2 |
| 借款申请链（金额/期限、报价、确认、创建、条款、签名、提交） | P3 |
| 合同、完整事件时间线、还款账单明细、贷后提醒展示 | P4 |
| 离线只读缓存、无障碍、高棉文案终审、关于/帮助 | P5 |

## 15. Engineering Gaps

| Gap | 说明 |
|---|---|
| `35` 遗留 P1 | 候选公司确认前被激活 / 缺候选预检；recovery send 未调用；challengeId/retryAt 未保留；pending OTP 未自动恢复；扫码权限拒绝/错误/粘贴回退；401 Return Intent 证据 |
| Android runtime | 无设备/AVD 的运行证据；路由渲染、假服务全流程、logcat、App Link intent |
| 无障碍 | 320/360/412dp、130%/200% 字体证据 |
| DTO / 真实形状 | `AuthRepository` 已按审计修正，但 `state`/`kyc`/loan 的 DTO 与 contract tests 不存在；假服务必须取自真实路由形状 |
| 重试与 Cookie | GET 重试复制 `cookie` 头 → Guard 拒绝（见 `code-audit-20261008.md`） |
| 错误映射 | 需按真实 `error`+`code` 与折叠 400 的现实重写 |
| 日志 | SafeLogger 空实现；脱敏正则缺口 |
| Debug 网络配置 | cleartext 范围过宽（须仅 `10.0.2.2`） |

## 16. Backend Gaps（Android 无法自行解决）

| Gap | 影响 | 处置 |
|---|---|---|
| Quote API 未实现（CR-001） | 阻塞 P3 目标流程 | CR-001 G3 解除条件 |
| 客户 repay/withdraw 硬拒绝且无支付通道 | 用户无法在 App 还款 | **BACKEND BLOCKED，不进当前路线图**；待后端新 Contract |
| KYC `rejected` 终态，无重提路径 | 被拒用户无出路 | 产品/后端决策（OPD-5） |
| 状态动作失败折叠为通用 400 `REQUEST_FAILED` | 客户端无法细分 | 后端小改（建议在 P3 前） |
| 金额/期限固定在代码，API 不下发 | H5/Android 漂移风险 | **STATIC BUSINESS CONFIG IN CLIENT**；后续建议服务器配置化（不假装已支持） |
| 协议仅中文 | 高棉/英文用户 | **LEGAL CONTENT DECISION REQUIRED** |
| `create` 非幂等、无取消 | 重复/卡死申请 | CR-001 + 幂等 |
| 客户响应含员工 id 字段（`approvalActor` 等）、`bots[].telegramId` | 隐私 | 客户端忽略；后端清理 |
| 无逾期状态 | 无法展示权威逾期 | 仅 DERIVED DISPLAY，须 Contract |
| `analytics source` 无 `android` | 埋点归类 | 后端小改或沿用 `h5`（NONBLOCKING） |

---

## 17. P0 — Foundation

- **User Outcome**：App 可安全启动、选择公司、恢复/退出当前公司会话；Cookie/Origin/日志/本地化基础可审计。
- **Included**：Flutter 工程、Router、Dio、Cookie jar、Secure Storage、Localization、Redaction（原 G0，HELIX PASS）。
- **Excluded**：任何业务页面。
- **Backend/API**：无。
- **Dependencies**：无。
- **Acceptance Journey**：已通过（G0）。
- **Exit Criteria**：保持有效；变更须经 Foundation Change Policy。

## 18. P1 — Entry + Real Home + Read-only Loan

- **User Outcome**：用户能安装 App、登录/恢复会话、进入**真实首页**看到本人 KYC 与借款状态，并通过**借款记录 → 借款详情**只读查看本人已有借款（状态、金额、期限、到期日、最近事件、还款信息摘要）；可修改密码、切换语言与公司、退出。
- **Included**：Entry（公司选择/扫码/App Link/候选确认/最近公司）· Auth（OTP、密码、设密码、找回、会话恢复、401 Return Intent、登出）· `GET /api/h5/state` 仓储与 DTO（忽略未知字段与员工字段）· 真实 Home（§10）· 借款记录列表 · 借款只读详情（状态标签、金额/费用/应还/已还/剩余、到期日、最近 5 条事件、只读账单摘要）· Me（语言、修改密码、切换公司、登出）· 3 标签导航 · 15 秒轮询/焦点刷新/下拉刷新 · 全局错误/离线横幅 · 公司/语言隔离 ·（可选）`POST /api/h5/locale`。
- **Excluded**：KYC 编辑/上传/提交；Loan create/quote/确认账单/签名/apply；repay/withdraw；合同查看；完整事件时间线；关于/帮助。
- **Backend/API**：`GET /api/h5/auth`、`send`、`verify`、`account`、`recovery`、`logout`、`GET /api/h5/state`、`POST /api/h5/locale`（可选）。
- **Dependencies**：P0；`21`（Company+Auth 子集，REUSE）；`35` 的 P1 关闭；02 修订（§24）。
- **Acceptance Journey**：新装 → 选/确认公司 → 验证码登录 →（必要时）设密码 → 真实首页（与 H5 同一账号状态一致）→ 借款记录 → 借款详情 → 修改密码 → 切换公司再切回（A 会话保留）→ 登出 → 重启恢复；401 后重新登录回到 `/home` 或安全路径。
- **Exit Criteria**：`35` 全部 P1 关闭；首页每个状态有测试（假服务数据取自真实 `state` 形状）；P1 内**无**任何 KYC 写、create、quote、sign、apply、repay、withdraw 调用（架构测试 + 假服务请求计数）；Android 模拟器/真机运行证据（L1/L2′）；320/360/412dp 与 130%/200% 字体证据；CF-0/CF-6 回归保持；Codex 独立复验 PASS。

## 19. P2 — KYC

- **User Outcome**：用户能在手机上查看/编辑 8 个 KYC 分组，服务端保存草稿，上传材料，提交审核，处理 `needs_info` 补件，并看到 approved/rejected 的明确只读结果。
- **Included**：KYC 总览/缺项；8 分组表单（个人、证件正反面、自拍、联系人、工作与资产、银行、授权、定位）；原生相机/相册上传（规则同服务端）；每步服务端保存（revision 乐观锁，409 合并提示）；提交；`submitted` 轮询；`needs_info` 定位缺项并重提；`approved`/`rejected` 只读；可选设备定位与地址地理编码；规则版本不匹配只读。
- **Excluded**：**rejected 后编辑/重提（服务端终态，不设计）**；贷款相关写操作。
- **Backend/API**：`GET/POST /api/kyc`、`POST/GET /api/kyc/files`、`POST /api/kyc/geocode`（可选）。
- **Dependencies**：P1；选项 `value` 映射（服务端中文值原样提交，标签本地化）；运维配置 `KYC_SCAN_URL`。
- **Acceptance Journey**：新账号 → 逐步填写（中途退出可恢复服务端草稿）→ 上传必填材料 → 提交 → Web 端员工置 `needs_info` → App 补件重提 → 通过 → 首页变为"可申请借款"；另验 `rejected` 只读无编辑入口。
- **Exit Criteria**：字段/材料规则与服务端一致；无 PII 落盘（草稿仅服务端）；弱网上传失败可重试；权限拒绝降级；Codex 复验 PASS。

## 20. P3 — Loan Application（**BLOCKED BY CR-001**）

- **User Outcome**：KYC 已通过的用户可选择额度与期限，完成服务端报价确认、创建申请、阅读条款、手写签名并提交审批。
- **Included**：Amount/Term · **Quote** · **Quote Confirmation** · Create · Terms · Signature · Apply；创建结果未知态处理；已结清/被拒后再次申请。
- **Excluded**：repay/withdraw；合同查看（P4）。
- **Backend/API**：`POST /api/loan/quote`（CR-001）、`POST /api/h5/state`（create/apply）、`GET/POST /api/loan/sign`。现有 H5 分支（create→billing→confirm_bill）仅测试构建验证，**不进生产**。
- **Dependencies**：P1、P2；CR-001 G3 解除；OPD-6/7/8。
- **Acceptance Journey**：approved 用户 → 选 $50/14 天 → 服务端报价 → 确认 → 创建（幂等）→ 条款 → 签名 → 提交 → 首页显示"等待机构审批"。
- **Exit Criteria**：弱网/重试不产生重复贷款；错误按状态+`code` 分支（依赖后端不再折叠 400）；金额全部服务端值；协议语言策略已决；Codex 复验 PASS。

## 21. P4 — Full Loan Lifecycle

- **User Outcome**：用户可完整查看审批/放款/结清全过程：完整事件时间线、合同（含签名图）、还款账单明细与到期提醒。
- **Included**：完整事件时间线 · 合同查看 · 还款账单明细（应还总额、已还、剩余、到期日、台账 `entries`）· 各状态高级详情 UX · 贷后提醒通知展示（`postloan-reminder:*`）· DERIVED 到期/逾期提示（**仅在有 Contract 后**）。
- **边界（避免与 P1 重复）**：P1 = 最近 5 条事件 + 还款信息摘要；P4 = 完整时间线 + 台账明细 + 合同。
- **Excluded**：**repay/withdraw（BACKEND BLOCKED，除非后端新 Contract 解锁）**；消息中心（DEAD UI）。
- **Backend/API**：`GET /api/h5/state`、`GET /api/kyc/contract`、`GET /api/kyc/files?id=`。
- **Dependencies**：P1（P3 非必需：可对 H5 创建的贷款验收）。
- **Acceptance Journey**：Web 端推进一笔贷款 `decision_pending → signed → active → closed`，App 状态与 H5 一致；合同与签名图可见；还款明细与服务端一致。
- **Exit Criteria**：每个状态有首页 CTA 与详情内容；整数分金额；Codex 复验 PASS。

## 22. P5 — Release Hardening

- **User Outcome**：App 在弱网、长高棉文、无障碍场景下可靠，可发布。
- **Included**：UX hardening；离线只读缓存；弱网；无障碍；高棉/英文/中文文案终审；Android runtime 全集；release 加固（签名、混淆、网络安全配置收紧）；NEW PRODUCT ADDITION：关于/帮助/客服（若获批）。
- **Excluded**：repay/withdraw（后端不支持，**不强行放 P5**）；Telegram 提醒。
- **Dependencies**：P1–P4。
- **Exit Criteria**：发布清单（无 cleartext/debug 配置）、完整 Android 证据包、Codex 最终验收。

---

## 23. CR-001 Placement

| 范围 | 被 CR-001 阻塞？ |
|---|---|
| P1（入口、首页、只读借款） | **否** |
| P2（KYC） | **否** |
| P4（只读生命周期，来源为现有 `/api/h5/state` 与合同接口） | **否** |
| P3 的 Quote + Create Gate（目标流程） | **是** |
| P3 的 Terms/Signature/Apply | 否，但依赖已创建的贷款，实际排在 Create 之后 |

**CR-001 仅阻塞 Phase 3 Loan Application 目标流程。** CR-001 保持 PROPOSED，本文不批准。

## 24. API Contract Staleness（**02 API CONTRACT REVISION REQUIRED**；本轮不改 02）

| # | 陈旧/缺失项 | 真实代码事实 | 来源 |
|---|---|---|---|
| 1 | "无错误码字段" | 每个 `{error}` 带 `code`（`lib/error-codes.ts`，多数由中文子串推断） | 取证 + 38 |
| 2 | 客户 repay/withdraw 直接执行（F-01） | `POST /api/h5/state` 返回 403 `CUSTOMER_SETTLEMENT_FORBIDDEN`；无 feature flag | 取证 + 38 |
| 3 | 100 单上限 | 已移除 | 取证 |
| 4 | `create` 状态 | 领域层 `registered`；**客户路径落库 `kyc_approved`**（要求 KYC `approved`） | 本轮复核（修正 38 的表述） |
| 5 | 业务错误为具体中文 400 | 非 `KycError` 折叠为 400 `REQUEST_FAILED` | 取证 + 38 |
| 6 | 入口 | `/api/team {customer_enter}` 未记录 | 取证 + 38 |
| 7 | KYC `rejected` | 终态；无重提路径 | 取证 + 38 |
| 8 | state/KYC view 额外字段 | `bots[].telegramId`、员工 id、`review.checklist/actor` 泄露到客户响应 | 取证 |
| 9 | 埋点 | `source` 仅 `mini_app`/`h5` | 取证 |

**STALE DOCUMENT**：`04` 的四项导航、`02` 上述条目、`01`/`05` 中以 G0–G5 定义的产品含义。

## 25. Product Decisions

> 已能由代码确定的不再列为 Open：3 标签导航（代码）、repay/withdraw 不做（BACKEND BLOCKED）、铃铛不移植（DEAD UI）、Telegram 提醒不进 MVP（MINI-APP ONLY）、overdue 不是状态、rejected 终态（代码）。

| ID | 决策 | 推荐 | 标记 |
|---|---|---|---|
| OPD-1 | P1 中指向 P2/P3 的 CTA 行为（KYC/申请尚不可用时） | 展示状态卡 + "此步骤将在后续版本开放"，不跳转外部 | **BLOCKS P1** |
| OPD-2 | 冻结 `GET /api/h5/state` 为首页唯一事实源，及 P1 借款只读字段/状态映射（含旧状态容错） | 确认并写入 P1 Contract | **BLOCKS P1** |
| OPD-3 | 离线是否只读缓存、写操作全部禁用 | 是（无离线写队列已冻结） | **BLOCKS P2**（缓存范围随 P1 先做展示数据） |
| OPD-4 | 8 步 KYC 在 Android 的分组与权限策略（相机/相册/定位） | 沿用 H5 步骤；定位可选 | **BLOCKS P2** |
| OPD-5 | KYC `rejected` 终态是否要后端新增重提路径 | P2 先只读展示；是否改后端后议 | NONBLOCKING（不阻塞 P2 实现） |
| OPD-6 | CR-001 Option A/B 最终选择 | 以 `07` 当前草案 Option B 为推荐，待批准 | **BLOCKS P3** |
| OPD-7 | 金额/期限继续静态还是 server-driven（ruleVersion） | 先静态 + 服务端校验；后续配置化 | **BLOCKS P3** |
| OPD-8 | 中文协议的多语言策略（**LEGAL CONTENT DECISION REQUIRED**） | 法务提供官方译文；否则界面明示"以中文版为准" | **BLOCKS P3 / BLOCKS RELEASE** |
| OPD-9 | P3 路由命名（报价/签约/提交） | P3 Contract 内冻结 | **BLOCKS P3** |
| OPD-10 | 关于/帮助/客服是否新增及渠道来源 | 作为 NEW PRODUCT ADDITION 放 P5 | NONBLOCKING |
| OPD-11 | 账户删除（商店政策） | 发布前评估 | **BLOCKS RELEASE** |
| OPD-12 | Android 埋点 `source` | 沿用 `h5` 或后端增 `android` | NONBLOCKING |

## 26. Migration From Old G1/G2/G3

| 旧 | 新 |
|---|---|
| G0 Foundation | **P0**（继续有效） |
| G1 = Company + Auth（`21` v2.3；`35` FAIL） | **Existing Entry/Auth Engineering Asset**，纳入 **P1** 为 REUSE + FIX；`35` 不再控制分期 |
| G2（KYC + 借款只读） | 拆为 **P2 KYC** 与 **P1/P4 只读借款** |
| G3（报价 + 申请） | **P3**（保留 CR-001 阻塞） |
| 旧 G4/G5（还款提现/发布） | 还款提现删除（BACKEND BLOCKED）；发布 → **P5** |

文档：`01/02/04/05` 需修订（STALE）；`07` 继续有效（PROPOSED）；`10/19/20/21` 继续有效；`22–36` 为历史记录；`24` 为历史 Gate Packet（P1 另建）；`30-G1-implementation-report.md` 保留文件名，P1 报告另编号。不删除历史。

## 27. Acceptance Strategy

1. 假服务/契约测试数据取自**真实路由形状**，不取自客户端实现的镜像。
2. 与 H5 对拍：同一账号同一状态，首页 CTA、金额、状态一致。
3. 每阶段强制 Android 运行证据（模拟器/真机），不得再次延后；无障碍 320/360/412dp 与 130%/200%。
4. 安全：不记录 OTP/密码/Cookie/完整手机号/文件内容；KYC 草稿仅服务端；生产冒烟仅限无副作用端点；禁止自动操作真实用户账号。
5. 每阶段 Codex 独立复验。

## 28. Recommended Next Contract

```
NEXT CONTRACT:
P1 — Entry + Real Home + Read-only Loan
```
内容（对应 38 的 7 项必含）：
1. Auth/Company 前置修复验收边界（候选预检、challengeId、pending OTP、recovery send、Return Intent、扫码降级）；
2. `GET /api/h5/state` DTO：`kyc`、`state.loans`、`events`、`notifications`、`revision`、`pricing`；未知字段忽略，员工字段忽略；
3. Home State Matrix（§10，含全部 10 个 Loan 状态值与 KYC 各状态）；
4. `/loans`、`/loans/:loanId`、最近事件与只读账单摘要的路由和错误/离线行为；
5. 15 秒轮询、焦点刷新、401 安全恢复、公司/语言隔离；
6. P1 禁止调用 KYC 写、create、quote、sign、apply、repay、withdraw；
7. Android runtime 与 320/360/412dp、130%/200% 验收条件。

**不授权 Trae。** 须先 Codex Product Remap 重审，再起草 P1 Contract 并通过三方 Gate。

---

## 附录 A　Codex Findings Matrix（来自 38）

| Finding ID | Severity | Category | Codex Finding | Evidence | Affected 37 Section | Required Correction | Status |
|---|---|---|---|---|---|---|---|
| F38-P1-1 | P1 | Loan Application | 37 把 create 写成直接 `kyc_approved`，与 `lib/domain.ts` 的 `registered` 冲突 | `domain.ts:43` vs `store.ts:41` | §5、§10 | 分层写清并要求状态容错 | **CLOSED**（§8、§10、§24-4；复核发现两层各对一半） |
| F38-P1-2 | P1 | Phase Boundary | P1 只做首页摘要而无只读 Loan List/Detail，闭环不完整 | 38 §Loan Application | §13 Phase 1 | P1 含借款记录/详情/最近事件/还款摘要 | **CLOSED**（§18、§21 边界） |
| F38-P1-3 | P1 | Flutter Reuse | Flutter 仍缺 state/Home/Loan；旧 G1 Recovery 资产不能算新 P1 完成 | 38 §Flutter Coverage | §8、§16 | 旧 G1 降为 Engineering Asset，REUSE+FIX 并入 P1 | **CLOSED**（§12、§13、§26） |
| F38-P1-4 | P1 | Backend Reality | 02/04 与真实 H5/API 冲突条目未标为修订输入 | 38 §API CONTRACT UPDATE REQUIRED | §17 | 列 STALE DOCUMENT / 02 REVISION REQUIRED | **CLOSED**（§24；不改 02） |
| F38-GAP-1 | Gap | Navigation | H5 真实三项导航，04 四项 STALE | `mini-shell.tsx` | §11 | 3 项冻结 | **CLOSED**（§11） |
| F38-GAP-2 | Gap | Backend Reality | repay/withdraw 为 MOCK/BLOCKED，不应列可用或 flag | `state/route.ts` 403 | §6、§16 | BACKEND BLOCKED，不实现 flag | **CLOSED**（§5、§6、§13、§16） |
| F38-GAP-3 | Gap | Product Baseline | 铃铛 DEAD UI，不移植 | `mini-shell` 链接无面板 | §6 | DEAD UI | **CLOSED**（§6、§11） |
| F38-GAP-4 | Gap | Product Baseline | Telegram 静默登录/提醒为 Mini App only | `login.tsx`、`/api/telegram` | §6 | MINI-APP ONLY | **CLOSED**（§3、§6） |
| F38-GAP-5 | Gap | Product Baseline | 关于/帮助/客服是 NEW PRODUCT FEATURE | H5 无 | §6 | NEW PRODUCT ADDITION | **CLOSED**（§2、§5、§11） |
| F38-GAP-6 | Gap | KYC | rejected 终态，不设计重提 | `kyc/server.ts` | §10 | NO EDIT / RESUBMIT | **CLOSED**（§5 KYC-14、§19） |
| F38-GAP-7 | Gap | Loan Lifecycle | overdue 不是状态 | `demoDays` | §6 | DERIVED DISPLAY POSSIBILITY | **CLOSED**（§7、§10） |
| F38-GAP-8 | Gap | Loan Application | 当前 H5 链路与 CR-001 目标链路不能混写 | 38 §Loan Application | §14 | 拆两章 | **CLOSED**（§8、§9） |
| F38-GAP-9 | Gap | Product Decision | 静态金额/期限；中文协议 | 代码 | §20 | STATIC CONFIG / LEGAL DECISION | **CLOSED**（§5、§16、§25） |
| F38-GAP-10 | Gap | Product Decision | 决策未按阻塞阶段分类 | 38 §Product Decisions | §20 | 重分类 | **CLOSED**（§25） |
| F38-P2-1 | P2 | Phase Boundary | runtime/accessibility 需成为可验收输入 | 38 §P2 | §18 | 写入各阶段 Exit | **CLOSED**（§18、§27） |
| F38-P2-2…4 | P2 | Backend Reality | 静态规则漂移；协议翻译；dead bell | 38 §P2 | — | 同上 | **CLOSED**（§16、§25） |
| F38-P3 | P3 | Product Decision | About/Help/Support、视觉 polish、Telegram 提醒 | 38 §P3 | — | NONBLOCKING | **CLOSED**（§25） |

## 附录 B　最终自检

| 项 | 结果 |
|---|---|
| 38 的 P0 | 无新增 P0 |
| 38 的 P1-1 / P1-2 / P1-3 / P1-4 | 全部 CLOSED（附录 A） |
| 任一 Product P1 OPEN | 无 |
| 仍需 Codex 确认的点 | ① F38-P1-1 的复核结论（领域层 `registered` / 客户路径 `kyc_approved`）；② P1 含"最近 5 条事件 + 还款摘要"、P4 含完整时间线/台账/合同的边界；③ OPD-1/OPD-2 |
| 与 38 的分歧 | 仅 F38-P1-1 的表述：38 称 create 实际生成 `registered`；复核显示这只是领域层，客户路径落库为 `kyc_approved`（`store.ts:41`）。已在 §8 保留两层事实，Android 契约对全部状态值容错，因此不影响 38 的修正意图 |
