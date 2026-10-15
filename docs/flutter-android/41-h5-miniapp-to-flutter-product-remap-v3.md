# H5 / Mini App → Flutter Android Product Remap v3

```
Document:   41-h5-miniapp-to-flutter-product-remap-v3.md
Date:       2026-10-08
Owner:      Claude（Product / Requirements / Architecture / API Contract / Delivery Planning）
Status:     PROPOSED v3 — READY FOR CODEX PRODUCT REMAP V3 FINAL REVIEW（不自批；不授权 Trae）
Supersedes: 39（v2，Codex 40 判 FAIL）；37 为第一次 Remap 历史记录；38/40 为 Codex 评审（未改）
Source:     40-product-remap-v2-rereview.md — 只针对其仍 OPEN 的 P0/P1 修订；已确认事实不重新证明
Evidence:   真实 H5/后端代码 > 40 > 39 > 37 > 旧 Android 文档。本轮对 create 调用链、响应形状、100 单上限、剩余应还公式、事件排序、当前 Flutter 候选/找回代码做了现场复核。
Not done:   不写 Flutter 代码；不写 P1 Contract/DTO/仓储/状态机；不改 02、04；不覆盖 37/38/39/40；不批准 CR-001；不授权 Trae。
```

产品阶段统一命名 **P0–P5**，**不再使用 G1/G2/G3 表示产品含义**（Gate 文档可单独用 Gate 编号）。

---

## 1. Executive Summary

1. **本版只处理 40 仍 OPEN 的 3 个 Product P1**（附录 A）：OPD-1 未来 CTA、OPD-2 Home/借款字段级冻结、"Remap 不是实现证据"。其余已确认事实（见 §2、§6、§11、§23）保持不变，不再重新证明。
2. **OPD-1 已冻结（采用 40 的建议 B）**：P1 中不存在"点击后进入未实现流程"的主 CTA；KYC/申请尚未开放的入口一律为**禁用 + 说明**，旁边提供可操作的"查看当前状态"（页面内状态说明，不跳转、不外链 H5）。见 §10。
3. **OPD-2 已冻结**：Home 决策表按 KYC×Loan **组合**给出，CTA 唯一；`GET /api/h5/state` 的 P1 最小字段、unknown 回退、未结贷款优先级、事件排序/数量、缺失字段显示、剩余应还的"派生边界"见附录 B。
4. **Loan Create 状态给出最终可执行结论**（§8）：领域默认 `registered`；客户端点前置要求 KYC `approved`；客户路径在落库前覆盖为 `kyc_approved`；响应即 `kyc_approved`。Android 当前客户路径期望值 = `kyc_approved`，`registered` 仅是领域默认/遗留兼容输入。
5. **P1/P4 边界字段级冻结**（§18、§21、附录 B），Trae 无需猜测。
6. **"不是实现证据"**：本文是产品范围，不是实现完成证据；Flutter 当前代码（已较 `35` 前进，候选页已含预检、找回已调用 `recoverySend`、已有 `pendingOtpChallenge`）**仍未经独立复验**，且 `state`/Home/借款/KYC 全部未实现 → 工程输入见 §15（P1 Engineering Inputs）。
7. 推荐下一份 Contract：**P1**；**不授权 Trae**；先 Codex V3 终审。

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
前置：KYC case = approved（lib/store.ts:25，否则 409）；无其它未结贷款（否则 409）
1. 选择金额(3000/5000/10000/50000 分) + 期限(14/28 天) + 测试资金同意
2. POST /api/h5/state {action:'create', name, amount, termDays, consent, requestId}
3. GET /api/loan/sign → 勾选同意 → POST /api/loan/sign（签名）→ loan.contract/signedAt（状态不变）
4. POST {action:'confirm_bill', loanId, billConfirmed:true, quoteId} → billConfirmedAt（状态不变）
   （H5 实际顺序：账单确认在签约前；签约要求 billConfirmedAt 已存在）
5. POST {action:'apply', loanId, billConfirmed:true, quoteId} → decision_pending
6. 员工：approve → approval_check → signed → disburse → active → 还款登记 → closed；reject → rejected
```

### 8.1 Loan Create 状态——最终结论（真实调用链）

```
H5 MiniClient → POST /api/h5/state → app/api/h5/state/route.ts
  → lib/store.ts::mutate(owner, p, customer)
  → lib/domain.ts::customerAction → applyAction('create')
  → store.ts customer-path override → D1 UPDATE demo_workspaces.payload
  → route.ts 返回 {...data, kyc, pricing, state: customerState(...)}
```

| 层 | 结论 | 证据 |
|---|---|---|
| Domain constructor default | `status:'registered'` | `lib/domain.ts:43` |
| Customer endpoint precondition | 需 KYC case `approved`，否则 409「请先完成 KYC 资料审核…」；另需无未结贷款（409）；金额/姓名/同意校验失败 → 通用 400 | `lib/store.ts:25`、`:22`；`domain.ts:40-42` |
| Customer-path state override | `creationCase` 存在时：`status='kyc_approved'`，写入 `kycCaseId`/`kycRevision`/`note` | `lib/store.ts:41` |
| Billing | 租户 owner（`t_` 前缀）在持久化前附加 `billing`（`calculateBill`，`quoteId` 随机 UUID，`fee = total − principal`） | `lib/store.ts:44` |
| Persisted state | `kyc_approved` | `lib/store.ts:54`（`UPDATE demo_workspaces SET payload=…`） |
| API response state | `kyc_approved`（`customerState` 只过滤归属，不改状态） | `domain.ts:83-86`；`state/route.ts` POST |
| Historical / legacy compatibility | `registered`/`kyc_pending`/`needs_info`/`approved` 可能存在于旧数据/沙盒路径；客户路径不再产生 | enum `domain.ts:5` |
| **Android handling（冻结）** | **当前客户路径期望值 = `kyc_approved`。`registered` 仅视为领域默认/遗留兼容输入，不与 `kyc_approved` 并列为"同等概率的当前结果"。P1 不调用 create。收到任何非当前态按 §8.2 只读容错，绝不根据领域默认值推断。** | — |

已知缺陷（影响 P3，不影响 P1）：`create` 非幂等（活动申请检查先于 requestId 去重，AF-6）；创建后客户无法取消/修改；`pricing` 在 state 中返回但 H5 不使用。

### 8.2 Loan Status Compatibility（字段级，供 P1 Contract 直接引用）

| Status | 当前客户路径可产生？ | 历史数据可能？ | Home 行为 | 借款记录行为 | 借款详情行为 |
|---|---:|---:|---|---|---|
| `registered` | 否（被覆盖） | 是（遗留/沙盒） | 借款驱动：「借款处理中」→ 主 CTA 查看借款详情（可点） | 显示行，状态标签「处理中（旧流程）」 | 只读通用详情，无任何写入口 |
| `kyc_pending` | 否 | 是 | 同上 | 同上 | 同上 |
| `needs_info`（贷款） | 否（与 KYC `needs_info` 无关） | 是 | 同上 | 同上 | 同上 |
| `kyc_approved` | **是**（create 结果） | 是 | 借款驱动，按 `billConfirmedAt`/`contract` 分 3 个摘要（见 §10）；主 CTA 查看借款详情 | 状态「待确认账单/待签约/待提交」 | 只读；信息行「确认账单与签约暂不支持在 App 内完成」（文字，非按钮） |
| `decision_pending` | 是（apply 后） | 是 | 「等待机构审批」；主 CTA 查看借款详情 | 「待审批」 | 只读 + 最近事件 |
| `approved` | 否（当前审批路径继续转 `signed`；不落库给 H5 客户） | 是（遗留/过渡） | 同 `registered` 的通用处理 | 通用状态标签 | 只读通用详情 |
| `signed` | 是（员工二次审批后） | 是 | 「已通过，待放款」 | 「待放款」 | 只读 + 最近事件 |
| `active` | 是（放款后） | 是 | 「还款中」+ 剩余应还 + 到期日 | 「还款中」 | 只读 + 还款摘要 + 到期日 |
| `closed` | 是 | 是 | 无未结贷款时：「已结清」 | 「已结清」 | 只读 |
| `rejected` | 是 | 是 | 无未结贷款时：「申请未通过」 | 「未通过」 | 只读（原因文案见下） |
| **未知值** | — | — | 通用「借款状态更新中」；主 CTA 查看借款详情 | 通用标签 | 通用只读；记录脱敏日志 |

规则：状态标签由**客户端按状态值本地化**（ARB）；服务端 `note`（中文、可能含员工文案）**不展示**。`rejected` 的"原因文案"在 P1 使用通用本地化文案，不展示服务端原文。

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

### 10.1 决策规则（唯一、确定）

输入全部来自 `GET /api/h5/state`：`kyc.status`（`null`⇒`none`）与 `state.loans`（服务端数组为最新在前；客户端按 `createdAt` 降序稳定排序）。
1. **未结贷款** = 第一笔状态不是 `closed` 且不是 `rejected` 的贷款（含 legacy/unknown 状态）。服务端保证至多一笔未结贷款。
2. **有未结贷款 → 借款驱动**（卡片说明贷款；KYC 以一行只读文字陈述，不再给 KYC 按钮）。
3. **无未结贷款 → KYC 驱动**；KYC 为 `approved` 时再按"最近一笔贷款"决定（无 / `closed` / `rejected`）。
4. **每个状态只有一个 Primary CTA**，最多一个 Secondary。**禁止**同时出现"补 KYC / 申请贷款 / 查看贷款"三个同级按钮。
5. 金额、费用、到期日来自服务端；客户端不计算费用（剩余应还的派生边界见附录 B）。

### 10.2 Future CTA Policy（OPD-1 已冻结，采用 40 建议 B）

- P1 **不存在**会导航到未实现流程的主 CTA，也**不外链 H5**。
- KYC 编辑（P2）、借款申请（P3）尚未开放的入口：显示**禁用的主按钮 + 说明文字**，并提供可操作的 Secondary「查看当前状态」。
- 「查看当前状态」= 页面内的状态说明面板（bottom sheet），**仅使用 `state.kyc.status`**，说明当前状态、下一步需要做什么、该操作暂不支持在 App 内完成。**不新增路由、不调用 `GET /api/kyc`**。
- 不使用"Coming Soon 页面"；不出现会引向空页面的按钮。
- **`GET /api/kyc` 在 P1 不调用**：①首次 GET 会创建 `draft` 案件（`lib/kyc/server.ts:53` 副作用）；②`review.reason` 是中文员工文案且响应含员工字段，未经本地化与脱敏不得展示。因此 **P1 不展示审核意见原文**。
- 因此 P1 已知的真实产品限制（须在发布说明中如实告知）：处于 KYC `none/draft/needs_info` 的用户，P1 阶段在 App 内只能**看到**状态，补件/填写需在 H5/Mini App 完成，直到 P2 发布。

### 10.3 Real Home Matrix（可直接进入 Contract）

> "CTA enabled?"：✔ 可点；✖ 禁用（带说明）。Secondary 栏的"查看当前状态"= §10.2 的页面内说明面板。

| # | KYC | Loan（最近/未结） | Card content | Primary CTA | CTA enabled? | Destination | Secondary | Reason |
|---|---|---|---|---|---:|---|---|---|
| H1 | none（`null`） | 无贷款 | 尚未开始身份认证；需先完成才能借款 | 开始身份认证 | ✖ | — | 查看当前状态 | P2 未开放；不跳 `/kyc` |
| H2 | draft | 无贷款 | 身份资料未提交 | 继续完善资料 | ✖ | — | 查看当前状态 | 同上 |
| H3 | submitted | 无贷款 | 身份资料审核中（轮询刷新） | 查看当前状态 | ✔ | 状态说明面板 | — | 只读状态，有价值 |
| H4 | needs_info | 无贷款 | 审核人员需要您补充资料（**不展示原文**） | 补充资料 | ✖ | — | 查看当前状态 | P2 未开放；P1 不显示审核意见 |
| H5 | rejected | 无贷款 | 身份资料未通过（终态，**无编辑/重提**） | 查看当前状态 | ✔ | 状态说明面板 | — | 终态；客服入口仅在 NEW-01 获批后出现 |
| H6 | approved | 无任何贷款 | 身份资料已通过；可申请借款 | 申请借款 | ✖ | — | 查看借款记录 | P3 未开放 |
| H7 | approved | 最近一笔 `closed`，无未结 | 上一笔借款已结清 | 查看借款记录 | ✔ | `/loans` | — | 再次申请属 P3，P1 不展示 |
| H8 | approved | 最近一笔 `rejected`，无未结 | 上一笔申请未通过 | 查看借款详情 | ✔ | `/loans/:id` | — | 只读 |
| H9 | 任意 | 未结 `kyc_approved`，`billConfirmedAt` 为空 | 借款申请已创建，待确认账单 | 查看借款详情 | ✔ | `/loans/:id` | — | 确认账单属 P3；详情内文字说明 |
| H10 | 任意 | 未结 `kyc_approved`，已确认账单，无 `contract` | 待签署借款协议 | 查看借款详情 | ✔ | `/loans/:id` | — | 签约属 P3 |
| H11 | 任意 | 未结 `kyc_approved`，已有 `contract` | 协议已签署，待提交审批 | 查看借款详情 | ✔ | `/loans/:id` | — | 提交属 P3 |
| H12 | 任意 | 未结 `decision_pending` | 等待机构审批（轮询） | 查看借款详情 | ✔ | `/loans/:id` | — | |
| H13 | 任意 | 未结 `signed` | 审批通过，待放款 | 查看借款详情 | ✔ | `/loans/:id` | — | |
| H14 | 任意 | 未结 `active` | 还款中：剩余应还 / 到期日 | 查看借款详情 | ✔ | `/loans/:id` | — | **无还款/提现**（BACKEND BLOCKED） |
| H15 | 任意 | 未结 `registered`/`kyc_pending`/`needs_info`/`approved`（legacy） | 借款处理中（旧流程） | 查看借款详情 | ✔ | `/loans/:id` | — | §8.2 |
| H16 | 任意 | 未结，状态值未知 | 借款状态更新中 | 查看借款详情 | ✔ | `/loans/:id` | — | 通用容错 + 脱敏日志 |
| H17 | needs_info/draft（员工代改后） + 有未结贷款 | 同 H9–H16 | 借款卡片 + 一行文字「身份资料需补充」 | 查看借款详情 | ✔ | `/loans/:id` | — | 借款驱动优先；不加 KYC 按钮 |
| H18 | 未知 KYC 字符串 | 无贷款 | 身份资料状态更新中 | 查看当前状态 | ✔ | 状态说明面板 | — | 容错 |
| H19 | 任意 | 首次加载 | 骨架 | — | — | — | — | 无旧内容时 |
| H20 | 任意 | 刷新失败（有旧内容） | 保留旧卡片 + 错误条（最近更新时间） | 重试 | ✔ | 重新请求 | — | |
| H21 | 任意 | 离线（有本次会话内的旧内容） | 旧卡片 + 离线提示 | 重试 | ✔ | 重新请求 | — | P1 仅内存快照，不落盘（落盘缓存属 P5） |
| H22 | 任意 | 401 | 会话已过期 | 重新登录 | ✔ | `/auth/login`（Return Intent 回 `/home`） | — | |

**Overdue**：不是状态。`active` 且 `dueAt` 已过时，仅 **DERIVED DISPLAY POSSIBILITY**（H14 摘要中的到期日文案），**未经 Contract 不进入状态机**。

### 10.4 "Coming Soon 慎用"复核

| 入口 | 帮助用户？ | 造成死路？ | 暗示未有功能？ | 处理 |
|---|---|---|---|---|
| 「开始身份认证 / 继续完善 / 补充资料」 | 说明下一步 | 否（禁用） | 轻微 | 禁用 + 说明；提供可点的状态说明 |
| 「申请借款」 | 告知可借 | 否（禁用） | 轻微 | 禁用 + 说明；secondary 查看借款记录 |
| 「还款 / 提现」 | 否 | — | **是** | **不出现** |
| 「联系客服」 | 无渠道 | — | 是 | 不出现（NEW-01 获批后再加） |
| 消息 / 铃铛 | 否 | — | 是 | 不出现（DEAD UI） |

## 11. Navigation

**默认并冻结：首页 / 借款记录 / 我的（3 项）。**
依据：真实 H5 `mini-shell.tsx` 三项底部导航；铃铛为死链；`state.notifications` 无独立面板；Android 无推送。
**`04` 的四项"首页 / 借款 / 消息 / 我的"标记为 STALE DOCUMENT**，由 Codex 更新。KYC、账单、条款、签名等任务页隐藏底部导航。
**Me 只移植真实项**：资料卡（公司、脱敏手机号）、身份资料入口、借款记录入口、账户安全（设置/修改密码、忘记密码）、语言、登出；Android 增量：**切换公司**；NEW PRODUCT ADDITION：关于/帮助（P5，待决）。

---

## 12. Flutter Coverage

> **本文是产品范围，不是实现完成证据。**

| 能力 | 状态（据当前 `mobile/` 代码） |
|---|---|
| Foundation（Dio 管线、Cookie 公司隔离、Secure Storage、Redaction、Locale、Router） | 已完成，G0 PASS；CF-0/CF-6 基础通过 |
| Company / Auth | 页面存在；代码已较 `35` 前进：候选确认页含 `_preflightCandidate`、确认后才 `activate`；找回页已调用 `recoverySend`；存在 `pendingOtpChallengeProvider`；此外有 return-intent/scanner-fallback 等测试。**这些是否关闭 `35` 的 P1 未经独立复验**，仍按 REUSE + FIX 并入 P1 验收 |
| `GET /api/h5/state` 仓储 / DTO / 页面 | **NOT IMPLEMENTED**（仅端点常量） |
| 正式 Home | **NOT IMPLEMENTED**（现为 Minimal Home 占位） |
| 借款记录 / 详情 | **NOT IMPLEMENTED** |
| 修改密码页 | **NOT IMPLEMENTED** |
| KYC / 贷款 / 签名 | **NOT IMPLEMENTED** |
| Repay/Withdraw 桩 | 存在；与后端阻断不符，P1 移除 |

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

## 15. Engineering Gaps（= P1 Engineering Inputs）

> 与 Product Scope 分开：Auth 技术债不再主导 P1 产品定义，但**不会因 Product Remap 通过而自动消失**。以最新代码现状重新确认如下（"待复验"=代码看似已前进，需 Codex 独立复验后才算关闭）。

| # | 工程输入 | 现状（最新代码） | P1 处置 |
|---|---|---|---|
| E1 | 候选公司：确认前不得激活 + 候选预检 | 候选页已含预检与确认后激活；选择页入口（`choose` 路径）是否先激活未复验 | 待复验 + 补测试（A 保持/B 取消语义） |
| E2 | 找回 `send` | 页面已调用 `recoverySend` | 待复验 |
| E3 | OTP `challengeId`/`retryAt` 保留；pending OTP 自动恢复 | 已有 `pendingOtpChallengeProvider`；自动恢复未复验 | 待复验 |
| E4 | 扫码：权限拒绝/错误/粘贴回退 | 有 `scanner_fallback_test`；未复验 | 待复验 |
| E5 | 401 → Return Intent → 安全 GET 恢复；敏感 POST 不重放 | 有 `return_intent_test`；未复验 | 待复验 |
| E6 | Android runtime | 无设备/AVD 的运行证据 | **必须产出** |
| E7 | 无障碍 | 320/360/412dp、130%/200% 字体证据缺失 | **必须产出** |
| E8 | `GET /api/h5/state` 仓储 + DTO + contract tests（假服务取自真实形状） | 不存在 | P1 新建 |
| E9 | ErrorMapper 对齐真实 `error`+`code` 及折叠的 400 | 与真实响应不一致 | P1 重写 |
| E10 | GET 重试复制 `cookie` 头 → Guard 拒绝 | 审计已发现 | P1 修复 + 补 CF0-T8 真测试 |
| E11 | SafeLogger 空实现、脱敏缺口 | 审计已发现 | P1 修复 |
| E12 | Debug 网络配置：cleartext 仅限 `10.0.2.2` | 过宽 | P1 修复 |
| E13 | 移除 `/feature/repay|withdraw` 桩与 Minimal Home | 存在 | P1 移除/替换 |
| E14 | 拆分 `auth_placeholder.dart`（~1000 行）与 `home_placeholder.dart` | 存在 | P1 重构 |

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

### 18.1 P1 User Outcome

用户可以：安装/打开 App；选择并确认公司；登录或恢复有效 Session；进入**真实业务首页**；看到自己真实的 **KYC 状态与借款状态**；查看自己的**借款记录**；打开已有贷款的**只读详情**（含最近事件与还款信息摘要）；切换允许的语言与公司；修改密码；正常退出。**整个 P1 没有功能性死路。**

### 18.2 Product Scope（用户能做什么）

| 能力 | 范围 |
|---|---|
| Entry | 公司选择/扫码/粘贴/App Link/候选确认/最近公司 |
| Auth | 预检、Telegram Gateway 验证码、密码登录、强制设置密码、找回、会话恢复、401 重登、登出 |
| 真实 Home | §10 矩阵 H1–H22 |
| 借款记录 | §18.3 |
| 借款详情（只读） | §18.4 |
| Me | 资料卡、语言（受服务端开关）、修改密码、切换公司、登出 |
| 导航 | 首页 / 借款记录 / 我的 |
| 刷新 | 15 秒轮询（仅前台且 Home/借款页可见时）、回到前台刷新、下拉刷新 |
| 数据保存 | 仅内存快照；**不落盘借款/金额数据**（P5 再定离线缓存） |

### 18.3 P1 Loan List

```
Data source:      GET /api/h5/state → state.loans（同一响应，无额外请求）
Included:         全部状态（含 closed / rejected / legacy / unknown）
Sort:             createdAt 降序（稳定排序；缺失 createdAt 排最后）
Row fields:       createdAt（Asia/Phnom_Penh 日期）· 期限 = billing.termDays（缺失按 14）· 本金 amount（分→USD）· 状态标签（本地化）· 短编号（由 id 缩写，格式由 Contract 定）
Empty state:      "还没有借款记录"；P1 不提供"开始申请"按钮（P3 起按 KYC/CTA 规则出现）
Tap behavior:     → /loans/:id（只读详情）
Offline behavior: 展示本次会话内最近一次成功的内存快照 + 最近更新时间 + 离线提示；无快照 → 离线空态 + 重试
```

### 18.4 P1 Loan Detail（只读）

```
Included sections:
  A. 头部：状态标签、本金
  B. 事实：期限、实际到账（billing.net，缺失用 amount）、应还总额（amount+fee）、已还（paid）、剩余应还（派生，附录 B）、到期日（dueAt；放款前显示"放款后确定"）
  C. 还款信息摘要（只读）：本金 / 实际到账 / 应还总额 三项（来自 billing）
  D. 最近事件：该贷款最近 5 条（state.events 按服务端顺序取前 5），文案按 action 本地化映射；未知 action →「办理进度已更新」
Excluded sections: 合同与签名（P4）· 完整事件时间线（P4）· 台账 entries（P4）· 账单分项（利息/服务费/预扣明细）（P4）· 贷后提醒通知（P4）· 钱包 wallet · 员工字段 · 服务端 note 原文
Required API fields: 附录 B
Allowed actions: 无（仅返回）
No-action states: 全部状态均无写入口；kyc_approved 显示一行文字「确认账单与签约暂不支持在 App 内完成」；active 不提供还款/提现；会话过期时显示重新登录
```

### 18.5 Engineering Inputs（见 §15；不在此重复）

### 18.6 Excluded（P1 Explicit Exclusions）

KYC 编辑/上传/提交 · 新建借款申请 · 借款报价 · 报价确认/确认账单 · Loan create · 条款/签名/apply · repay · withdraw · 完整合同查看 · 完整还款台账 · 完整事件时间线 · 消息中心 · Telegram 提醒 · 关于/帮助/客服。

### 18.7 Dependencies / Backend

- 依赖：P0；`21`（Company+Auth 子集，REUSE）；E1–E7 验收；02 修订（§24）在 Product Remap PASS 后单独进行。
- API：`GET /api/h5/auth`、`send`、`verify`、`account`、`recovery`、`logout`、`GET /api/h5/state`、（可选）`POST /api/h5/locale`。
- **P1 不调用**：`/api/kyc*`、`POST /api/h5/state`（任何 action）、`/api/loan/*`、`/api/telegram`、`/api/analytics/events`。

### 18.8 Acceptance Journey（无死路）

```
安装/打开 → 公司上下文 → Auth / 会话恢复 → 真实 Home
→ KYC 状态可见 → Loan 状态可见
→ 借款记录 Tab → 只读借款详情（事件 + 还款摘要）
→ 我的 → 语言 / 修改密码 / 切换公司 / 登出
→ 重启恢复；401 后重新登录回到 /home 或安全路径
```
路径中：无 dead route、无占位页、无可点击的不可用主按钮。

### 18.9 Exit Criteria（用户结果）

1. 用户可以安装/打开 App。
2. 用户可以登录或恢复有效 Session。
3. 登录后进入真实业务首页（非 Minimal Home）。
4. 首页显示真实 KYC + Loan 状态，覆盖 §10.3 全部行（含 legacy/unknown）。
5. 用户可以查看本人借款记录。
6. 用户可以打开已有贷款的只读详情。
7. 用户可以切换服务端允许的语言。
8. 用户可以进入账户安全能力（修改密码）。
9. 用户可以正常退出；其他公司会话保留。
10. P1 范围内无功能性死路；假服务请求计数证明 P1 未发出 §18.7 禁止的请求。
11. E1–E7 验收通过：Android 模拟器/真机运行证据；320/360/412dp 与 130%/200% 字体。
12. Codex 独立复验 PASS。

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

### P4 ADDS（相对 P1 的增量，且只能是增量）

| P1 已有 | P4 ADDS |
|---|---|
| 最近 5 条事件 | **完整事件时间线**（该贷款全部事件，含分页/折叠策略） |
| 还款信息摘要（本金/实际到账/应还总额；剩余应还） | **账单分项**（预扣、利息、服务费及其计息时点）与**台账明细**（`state.entries`） |
| —（无合同） | **合同查看**（`GET /api/kyc/contract`、签名图 `GET /api/kyc/files?id=`） |
| 状态标签 + 摘要 | **各状态的生命周期专属区块**（审批进度说明、放款信息、结清摘要） |
| —（无提醒） | **贷后提醒通知**（`state.notifications` 中 `postloan-reminder:*`，只读） |
| 到期日文案 | **到期/逾期派生提示**（仅在有 Contract 后；非状态） |

- **User Outcome**：用户可完整查看审批/放款/结清全过程、合同与还款账单明细。
- **Excluded**：repay/withdraw（BACKEND BLOCKED）；消息中心（DEAD UI）。
- **Backend/API**：`GET /api/h5/state`、`GET /api/kyc/contract`、`GET /api/kyc/files?id=`。
- **Dependencies**：P1（同名"借款详情"在 P4 仅扩展，不新建）；不依赖 P3（可对 H5 已创建的贷款验收）。
- **Acceptance Journey**：Web 端推进一笔贷款 `decision_pending → signed → active → closed`，App 状态/金额/台账与 H5 一致；合同与签名图可见。
- **Exit Criteria**：每个增量项有测试；整数分金额；Codex 复验 PASS。

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
| 3 | 100 单上限 | `create` 分支（`lib/domain.ts:38-44`）与 `lib/store.ts` 中无贷款数量检查；对 `loans.length`/`>=100`/`MAX_LOANS` 的检索无命中（仅 `domain.ts:78` 将 `requests` 去重环截为 500，与此无关）。**结论：已无 100 单上限。** | 本轮现场复核（回应 40 "NOT CONFIRMED"） |
| 4 | `create` 状态 | 领域默认 `registered`；客户路径前置 KYC `approved`；落库与响应均为 `kyc_approved`（§8.1） | 本轮复核；40 已确认 |
| 5 | 业务错误为具体中文 400 | 非 `KycError` 折叠为 400 `REQUEST_FAILED` | 取证 + 38 |
| 6 | 入口 | `/api/team {customer_enter}` 未记录 | 取证 + 38 |
| 7 | KYC `rejected` | 终态；无重提路径 | 取证 + 38 |
| 8 | state/KYC view 额外字段 | `bots[].telegramId`、员工 id、`review.checklist/actor` 泄露到客户响应 | 取证 |
| 9 | 埋点 | `source` 仅 `mini_app`/`h5` | 取证 |

**STALE DOCUMENT**：`04` 的四项导航、`02` 上述条目、`01`/`05` 中以 G0–G5 定义的产品含义。

## 25. Product Decisions

> 已能由代码确定的不再列为 Open：3 标签导航、repay/withdraw 不做、铃铛不移植、Telegram 提醒不进 MVP、overdue 不是状态、rejected 终态、100 单上限已移除、剩余应还公式。

| ID | 决策 | 结论/推荐 | 标记 |
|---|---|---|---|
| OPD-1 | P1 未来 CTA 行为 | **CLOSED（本文冻结）**：禁用 + 说明 + 可点"查看当前状态"（§10.2）；不跳未来路由、不外链 H5、不调 `GET /api/kyc` | CLOSED |
| OPD-2 | Home/借款字段级冻结 | **CLOSED（本文冻结）**：§10、§8.2、附录 B | CLOSED |
| OPD-3 | 离线缓存范围 | P1：仅内存快照；落盘缓存属 P5 | NONBLOCKING（P1 已定）/ 复议于 P5 |
| OPD-4 | 8 步 KYC 在 Android 的分组与权限策略（相机/相册/定位） | 沿用 H5 步骤；定位可选 | **BLOCKS P2** |
| OPD-5 | KYC `rejected` 是否要后端新增重提 | P2 只读展示；后议 | NONBLOCKING |
| OPD-6 | CR-001 Option A/B 最终选择 | 以 `07` 草案 Option B 为推荐，待批准 | **BLOCKS P3** |
| OPD-7 | 金额/期限继续静态还是 server-driven | 先静态 + 服务端校验（STATIC BUSINESS CONFIG IN CLIENT，H5/Android 漂移风险）；后续配置化 | **BLOCKS P3** |
| OPD-8 | 中文协议多语言（LEGAL CONTENT DECISION REQUIRED） | 法务官方译文；否则界面明示"以中文版为准" | **BLOCKS P3 / BLOCKS RELEASE** |
| OPD-9 | P3 路由命名 | P3 Contract 内冻结 | **BLOCKS P3** |
| OPD-10 | 关于/帮助/客服（NEW PRODUCT ADDITION） | P5，待批 | NONBLOCKING |
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
P1 Contract 必须引用本文并包含（对应 40 的 8 项）：
1. Existing Entry/Auth asset 的 REUSE + FIX 清单（§15 E1–E7、E9–E14）；
2. `GET /api/h5/state` 最小 DTO（附录 B）、未知字段忽略、刷新/焦点/401/offline 行为；
3. Home State Matrix H1–H22（§10.3）与 unknown fallback；
4. `/loans`、`/loans/:id` 字段、最近 5 条事件、还款摘要、无写入口（§18.3–18.4）；
5. Home Future CTA 策略（§10.2）的禁用文案 key 与"不可导航"断言；
6. 三项底部导航 Home/Loans/Me；
7. P1 禁止调用清单（§18.7）与假服务请求计数验收；
8. Android runtime 与 320/360/412dp、130%/200% 字体验收。

**不授权 Trae。** 须先 Codex Product Remap V3 终审，再起草 P1 Contract，并通过三方 Gate。

## 附录 A　40 Findings Closure Matrix

| ID | Severity | 40 Finding | Evidence（真实代码） | 39 Current Position | Required Correction | Status |
|---|---|---|---|---|---|---|
| 40-P1-1 | P1 | OPD-1 未来 CTA 行为未冻结，可能产生死按钮 | 40 §Future Feature Entry Strategy；`lib/kyc/server.ts:53`（GET 建案副作用） | 目标仍指向 `/kyc`、`/loan/apply` + "即将开放" | 采用建议 B：禁用 + 说明 + 可点"查看当前状态"（页面内面板），不跳转/不外链/不调 `GET /api/kyc` → 见 41 §10.2、§10.3 H1–H6、§10.4、§25 OPD-1 | **CLOSED** |
| 40-P1-2 | P1 | OPD-2 Home DTO/状态映射/字段级合同未冻结 | `state/route.ts` GET 形状；`mini-client.tsx`（剩余应还 `amount+fee−paid`、`events…slice(0,5)`、`billing?.termDays||14`、`billing?.net??amount`）；`domain.ts:5`、`store.ts:41` | 列出字段但未冻结 unknown/优先级/缺失规则 | 决策规则、H1–H22 组合矩阵、§8.2 状态兼容表、附录 B 字段边界 → 41 §8、§10、附录 B | **CLOSED** |
| 40-P1-3 | P1 | Flutter 真实 P1 未实现，39 不是实现证据 | `mobile/lib`：`state`/Home/借款/KYC 无实现；候选页/找回/pending OTP 已前进但未复验 | 仅在 §12 简述 | 明示"不是实现证据"并列出 P1 Engineering Inputs E1–E14（含"待复验"） → 41 §1-6、§12、§15 | **CLOSED** |
| 40-API-1 | P2 | "100 单上限已移除"未被证实 | `domain.ts:38-44` create 分支无数量检查；检索无命中 | 仅断言 | 补充直接证据 → 41 §24 第 3 项 | **CLOSED** |
| 40-CRE-1 | 确认 | create 调用链/状态 | `domain.ts:43`、`store.ts:25/41/44/54`、`route.ts` | 两层并列 | 最终七行结论 → 41 §8.1；兼容表 → §8.2 | **CLOSED** |
| 40-P2-1 | P2 | 旧 02/04 后续 superseding revision | — | 已列 | 继续列 02 REVISION REQUIRED，**不更新 02** | **CLOSED**（记录） |
| 40-P2-2 | P2 | 静态金额/期限漂移 | `domain.ts:40`、`store.ts:44` | 已标 | STATIC BUSINESS CONFIG IN CLIENT + 漂移风险 → §16、§25 OPD-7 | **CLOSED** |
| 40-P2-3 | P2 | 中文条款法律翻译；离线缓存策略 | `loan-terms-zh.json` | 已标 | LEGAL CONTENT DECISION REQUIRED（OPD-8）；P1 仅内存快照（OPD-3） | **CLOSED** |
| 40-P0 | P0 | 无新的 P0 | — | — | — | **CLOSED** |

**Product P0 OPEN = 0；Product P1 OPEN = 0。**

## 附录 B　P1 / P4 Field Boundary（来自真实 `GET /api/h5/state`）

> 响应形状：`{state:{loans, events, entries, notifications, bots, …}, revision, kyc:{status}|null, pricing}`（`app/api/h5/state/route.ts` GET）。**以下是产品层的字段边界，不是 DTO/仓储设计。**

### B.1 P1 读取并使用的字段

| 来源 | 字段 | P1 用途 | 缺失/异常规则 |
|---|---|---|---|
| `kyc` | `status`（`null` ⇒ none） | Home 矩阵 | `null` ⇒「尚未开始身份认证」；未知字符串 ⇒ H18 |
| `state.loans[]` | `id` | 路由、短编号 | 必需；缺失则丢弃该行并记脱敏日志 |
| | `status` | 标签、Home 分流 | 未知值 ⇒ §8.2 未知行 |
| | `amount`（整数分） | 本金 | 必需 |
| | `fee`（整数分） | 应还总额 = `amount+fee` | 缺失按 0 |
| | `paid`（整数分） | 已还、剩余应还 | 缺失按 0 |
| | `createdAt`（ISO） | 排序、列表日期（Asia/Phnom_Penh） | 缺失排最后、日期显示"—" |
| | `dueAt`（ISO，可缺） | 到期日 | 缺失且状态非 `active/closed` ⇒「放款后确定」；`active` 缺失 ⇒「—」 |
| | `billing.termDays` | 期限 | 缺失按 14（与 H5 一致） |
| | `billing.net` | 实际到账 | 缺失用 `amount`（与 H5 一致）；放款前也可显示（账单值），不暗示已到账 |
| | `billing.principal` / `billing.total` | 还款信息摘要 | 缺失则该摘要行隐藏 |
| | `billConfirmedAt` | 仅用于 H9/H10 分流 | 缺失视为未确认 |
| | `contract`（仅判断是否存在） | 仅用于 H11 分流 | 不解析内容 |
| `state.events[]` | `loanId`、`action`、`at` | 最近 5 条事件 | 取 `loanId` 匹配项；**服务端数组已是最新在前**，取前 5；未知 `action` ⇒「办理进度已更新」；`note`/`role` 不展示 |
| `GET /api/h5/auth` | `session.phoneMasked` | Me 资料卡 | — |

**剩余应还（派生边界）**：`max(0, amount + fee − paid)`，整数分，与 H5 `mini-client` 及 `lib/postloan/core.ts` 的 outstanding 公式一致；**这是对服务端字段的算术组合，不是费用计算**。客户端**不得**计算利息/服务费/预扣。
**已放款金额**：不单独断言"已放款"；显示"实际到账（billing.net）"。`wallet` 不显示。

### B.2 P1 忽略的字段（存在但不使用）

`customerId`、`kycCaseId`、`kycRevision`、`phoneMasked`（loan 内）、`approvalActor`、`approvalCheckedBy`、`fundingActor`、`fundingCheckedBy`（员工 id，隐私）、`note`（中文/可含员工文案）、`signature`、`kyc`（legacy）、`demoDays`、`wallet`、`botId`、`bots[]`/`activeBotId`（含 `telegramId` 等）、`entries`、`notifications`、`requests`、`pricing`、`revision`（P3 才用）。未知字段一律忽略。

### B.3 P4 ADDS 的字段

`state.events[]` 全部（含 `note` 本地化映射策略）· `state.entries[]`（`kind`、`cents`、`debit/credit`、`at`）· `billing.deduction/interest/service/upfront` 及计息时点 · `contract`（解析）+ `GET /api/kyc/contract` · 签名图 `GET /api/kyc/files?id=` · `state.notifications[]`（`postloan-reminder:*`）· 逾期派生（需 Contract）。

## 附录 C　Final Self-check

| 问题 | 回答 |
|---|---|
| Claude 能否在不发明产品行为的情况下写 P1 Contract？ | **YES**：Home 组合矩阵、CTA 策略、列表/详情字段、禁止调用清单、退出标准均已冻结 |
| Codex 能否在不猜测未来 CTA 行为的情况下设计 P1？ | **YES**：未来入口 = 禁用 + 说明 + 页面内状态面板；无跳转/外链/Coming Soon 页 |
| Trae 之后能否不猜测 P1 与 P4 的借款字段归属？ | **YES**：附录 B.1/B.3 |
| QA 能否判定 P1 是否有死路？ | **YES**：§18.8 路径 + §18.9 第 10 条（请求计数 + 无不可用主按钮） |
| 40 中是否仍有 OPEN 的 Product P0/P1？ | **NO**（附录 A） |
| 仍需 Codex 确认 | ① OPD-1 的页面内"状态说明面板"形式（§10.2）；② P1 不展示 KYC 审核意见原文（§10.2）；③ P1 仅内存快照、不落盘（OPD-3） |
