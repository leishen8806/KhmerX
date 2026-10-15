# Product Remap V2 Re-Review

日期：2026-10-08
审核人：Codex 独立 Product / UX Review
范围：只复核 `39-h5-miniapp-to-flutter-product-remap-v2.md`；未写 Flutter 代码、未改后端、未授权 Trae。

## Result

```text
PRODUCT REMAP V2 RE-REVIEW: FAIL
P1 CONTRACT PLANNING: HOLD
TRAE: HOLD
```

`39` 已正确修复大部分 `38` 的事实问题，但仍不能接受 Claude 声称的 “P0 OPEN = 0 / P1 OPEN = 0”。至少 OPD-1 与 OPD-2 仍标注为需要业主确认且明确 BLOCKS P1；P1 首页对未来 KYC/Loan 功能的 CTA 行为没有冻结成可验收 Contract。

## 38 P1 Closure Matrix

| Finding | 38 conclusion | 39 correction | Real-code verification | Status |
|---|---|---|---|---|
| F38-P1-1 create 状态 | Domain 与 customer path 状态冲突 | §8 分层为 domain `registered`、customer persistence `kyc_approved` | `lib/domain.ts` 的 `applyAction(create)` 先写 `registered`；`lib/store.ts` customer `mutate` 在写库前覆盖为 `kyc_approved`，并附 billing/kyc revision | CLOSED |
| F38-P1-2 P1/P4 边界 | 只做首页摘要无法闭环 | P1 加入 Loan List/Detail、最近 5 条事件、还款摘要；P4 定义完整时间线/台账/合同 | §18/§21 的字段和边界已明确 | CLOSED |
| F38-P1-3 Flutter 旧 G1 状态 | 旧 G1 不能直接算产品完成 | 降级为 Existing Entry/Auth Engineering Asset，P1 内 REUSE + FIX | `mobile` 仍是工程资产，不能替代新 P1 产品实现；39 已正确区分 | CLOSED |
| F38-P1-4 API/UX 文档陈旧 | 02/04 与现实冲突 | 列为 STALE / 02 REVISION REQUIRED，不改历史文档 | 39 的 stale 清单与真实 `/api/h5/state`、三项导航、403 settlement reject 一致 | CLOSED |

**Additional P1 blockers in 39:** OPD-1（未来 CTA 行为）和 OPD-2（P1 state DTO/字段/状态映射）仍未冻结，故不能认定 Product P1 全部 CLOSED。

## Loan Create State Verification

真实调用链：

```text
H5 MiniClient
→ POST /api/h5/state {action:create,...}
→ app/api/h5/state/route.ts
→ lib/store.ts::mutate(owner,p,customer)
→ lib/domain.ts::customerAction / applyAction
→ customer create override
→ D1 demo_workspaces payload persistence
→ response {state: next, ...}
```

具体结论：

```text
domain default = registered
customer path = requires KYC approved; otherwise 409
persisted customer state = kyc_approved
customer response state = kyc_approved
billing = generated before persistence for tenant owners
```

依据：`lib/store.ts` 在 `creationCase` 存在时把 `next.loans[0].status` 改为 `kyc_approved`，随后用 `UPDATE demo_workspaces SET payload=...` 持久化，并由 `/api/h5/state` 返回该状态。

Android handling：以服务端响应和 persisted state 为准；容错全部 10 个状态，但对 legacy/unknown 状态只读展示，绝不根据 `domain` 默认值自行推断。新 Android P1 不调用 create。

## Loan Status Reality

| Status | 分类 | 说明 |
|---|---|---|
| `registered` | LEGACY / DOMAIN-LEVEL | `applyAction(create)` 默认值；H5 customer create 在写库前覆盖，不应假设为客户新建响应 |
| `kyc_pending` | LEGACY / STAFF-COMPATIBILITY | 旧状态，仍在 enum/旧动作兼容层 |
| `needs_info` | LEGACY / STAFF-COMPATIBILITY | 旧状态；KYC `needs_info` 是独立 KYC 状态，不能混同 |
| `kyc_approved` | ACTIVE CURRENT | 现有 H5 customer create 结果及 KYC 通过后的申请状态 |
| `decision_pending` | ACTIVE CURRENT | 客户 apply 后等待机构审批 |
| `approved` | LEGACY / TRANSIENT | 领域/员工旧流程兼容值；当前审批路径会继续转为 `signed` |
| `rejected` | ACTIVE CURRENT | 机构拒绝后的客户可见终态 |
| `signed` | ACTIVE CURRENT | 审批通过、等待放款 |
| `active` | ACTIVE CURRENT | 已放款、还款中 |
| `closed` | ACTIVE CURRENT | 已结清 |

没有独立 `overdue` Loan status；逾期只能作为 dueAt/通知/测试 demoDays 的派生展示。

## P1 / P4 Boundary

39 已达到字段级边界，且不会重复实现：

### P1 Read-only Detail

- summary/status
- amount
- term
- disbursed amount when present (`billing.net`/wallet)
- total due / paid / remaining summary
- due date
- latest five events
- one read-only primary CTA based on status: view progress, view bill summary, view record, or re-auth

P1 不执行 create、quote、confirm_bill、sign、apply、repay、withdraw。

### P4 Full Lifecycle

- complete event timeline beyond the latest five
- contract document and signature artifact
- repayment ledger/detailed schedule
- lifecycle-specific detail beyond the P1 summary
- read-only post-loan reminders and full historical detail

P4 可针对 H5 已创建/历史贷款验收，不依赖 P3 先创建新贷款；P3/CR-001 只影响新 Android 创建路径。

## Phase 1 User Closure

P1 目标闭环已定义为：

```text
Launch → login/restore → GET /api/h5/state → real Home
→ KYC state + Loan state → Loan List → read-only Detail
→ recent events/repayment summary → back Home
```

但当前 Flutter 仍未实现 `/api/h5/state` repository、真实 Home、Loan List/Detail，因此这是 Product Contract scope，尚不是实现完成证据。

## Future Feature Entry Strategy

39 的 OPD-1 当前写为：P1 显示“此步骤将在后续版本开放”，目标仍指向 `/kyc` 或 `/loan/apply`。这不足以作为客观验收标准，也容易产生死按钮。

### OPD-1 RECOMMENDATION

```text
B. Show disabled CTA with explanation
```

具体行为：

- **No KYC / Draft**：显示真实状态卡和缺项/审核状态；主 CTA 显示禁用的“身份资料功能将在 P2 开放”，旁边提供可操作的“查看当前状态”。不跳 `/kyc`，不外链 H5。
- **KYC Needs Info**：显示审核意见和需要补件的状态；“补充资料将在 P2 开放”保持禁用；允许查看已保存状态，不提供 resubmit 假动作。
- **KYC Approved + no loan**：显示“已通过，可申请借款”的状态卡；“借款申请将在 P3 开放”保持禁用；可操作入口只允许查看 KYC 状态或贷款记录。
- **Submitted / Rejected**：只读状态卡；rejected 为终态，不提供重提按钮。客服入口只有在 NEW PRODUCT ADDITION 获批后才出现。

这样用户看到的是可用的状态产品，不是会跳到空页面的 Coming Soon 按钮，也不是外链回 H5 的混合方案。

OPD-1 必须在 P1 Contract 中冻结上述 CTA 文案、disabled 状态、不可导航规则后才能关闭。

## Home State Review

39 的状态矩阵覆盖：

- KYC `none/draft/submitted/needs_info/rejected/approved`
- Loan `registered/kyc_pending/needs_info/kyc_approved/approved/decision_pending/signed/active/closed/rejected`
- 首次加载、刷新失败、离线、401

矩阵方向正确，但 OPD-2 仍需冻结以下字段级合同：

- `GET /api/h5/state` response DTO 的最小字段
- null KYC 的确切展示文案
- 未结贷款选择优先级
- unknown status 的只读 fallback
- recent event ordering/count
- disbursed amount 缺失时的显示规则
- remaining amount 的服务端字段/派生字段边界

因此 Home matrix **内容完整但 Contract 尚未 CLOSED**。

## Navigation

```text
Home / Loans / Me
```

已与真实 `components/mini-shell.tsx` 三项底部导航一致。Messages/铃铛不进入 Android Navigation；铃铛 dead UI。Telegram silent auth 与 Telegram reminder subscription 明确为 `MINI-APP ONLY`。About/Help/Customer Service 明确为 `NEW PRODUCT ADDITION`，不属于迁移基线。

## Backend Reality

确认：

- `/api/loan/quote` 不存在，CR-001 只阻塞 P3 新 Android Quote/Create 目标路径。
- `/api/h5/state` customer `repay/withdraw` 返回 403 `CUSTOMER_SETTLEMENT_FORBIDDEN`，无 feature flag，当前路线图不实施。
- KYC rejected 在当前代码无 resubmit 路径，按终态处理。
- `create` customer path 的持久化和 response 为 `kyc_approved`，domain 默认 `registered` 仅是中间领域值。

## Flutter Reuse

| Asset | Decision |
|---|---|
| G0 Foundation | KEEP / REUSE |
| Company/Auth/Router | REUSE + FIX；35 是工程缺陷证据，不是新产品 Gate |
| Cookie/Origin/Secure Storage/Redaction | KEEP |
| Locale | REUSE；P1 Contract 需接入 server languages 和公司隔离 |
| Minimal Home | REMOVE/REFACTOR 为真实 state Home |
| Scanner/Deep Link | REFACTOR；候选 preflight、权限拒绝、粘贴回退必须进工程 Backlog |
| FeatureFlags repay/withdraw | REMOVE from customer product path；保留文档阻断说明 |

## API Staleness

| 事项 | 状态 | 依据 |
|---|---|---|
| response now has `code` | CONFIRMED | `app/api/h5/state/route.ts` 和 auth/KYC errors 返回 code/error 结构 |
| repay/withdraw now rejected | CONFIRMED | state route 硬编码 `CUSTOMER_SETTLEMENT_FORBIDDEN` 403 |
| 100 loan cap removed | NOT CONFIRMED | 当前代码未找到可把“已移除”作为事实的独立证据，不能从 39 推断已移除 |
| non-Kyc state errors collapse to 400 `REQUEST_FAILED` | CONFIRMED | state route catch-all 返回 400 通用错误 |

## Product Decisions

### BLOCKS P1

- **OPD-1**：P1 future CTA 采用 disabled + explanation（本复审建议 B），不跳未来路由、不外链 H5。
- **OPD-2**：冻结 `/api/h5/state` Home DTO、状态映射、unknown fallback、未结贷款优先级、事件/还款摘要字段。

### BLOCKS P2

- KYC 8 个分组与文件/定位权限策略。
- rejected 终态继续沿用，或未来增加后端重提能力。
- 离线只读缓存范围。

### BLOCKS P3

- CR-001 Option A/B；静态金额/期限是否改为 server-driven；中文条款法律翻译策略。

### NONBLOCKING

- About/Help/Support 是否作为新增产品能力。
- Android 视觉 polish、Telegram reminders、埋点 source。

## Corrected Phase Plan

### P0 Foundation

用户结果：安全启动、公司上下文、会话恢复/退出、Cookie/Origin/日志/本地化可审计。

### P1 Entry + Real Home + Read-only Loan

用户结果：登录/恢复后看到真实 KYC/Loan 首页；可查看借款列表、只读详情、最近五条事件、还款摘要；可切换语言/公司并退出。P1 不写 KYC、create、quote、confirm_bill、sign、apply、repay、withdraw。

### P2 KYC

用户结果：编辑 8 个 KYC 分组、服务端草稿保存、文件、提交、needs_info、approved/rejected 只读。

### P3 Loan Application

用户结果：KYC approved 用户完成当前 H5 create/billing/confirm/sign/apply 分支或 CR-001 目标 Quote/Create 分支。CR-001 blocks P3 only。

### P4 Full Loan Lifecycle

用户结果：查看完整时间线、合同、签名、还款台账/明细、贷后提醒和历史详情；可针对 H5 已存在贷款验收，不依赖 P3。客户 repay/withdraw 仍 deferred。

### P5 Release Hardening

用户结果：Android runtime、权限、无障碍、离线只读、长 Khmer、性能、商店发布；新增 Help/About/Support 若获批。

## Recommended P1 Contract Scope

P1 Contract 必须冻结：

1. Existing Entry/Auth asset 的 REUSE + FIX 清单（candidate preflight、challengeId、pending OTP、recovery send、Return Intent）。
2. `GET /api/h5/state` 的最小 DTO、未知字段忽略、刷新/焦点/401/offline 行为。
3. Home State Matrix 全部 KYC/Loan 状态与 unknown fallback。
4. `/loans` 和 `/loans/:id` 字段、recent five events、repayment summary、只读 CTA。
5. Home future CTA 的 OPD-1 disabled 文案和不可导航断言。
6. 三项底部导航：Home/Loans/Me；无 Messages。
7. P1 禁止 KYC 写、create、quote、confirm_bill、sign、apply、repay、withdraw。
8. Android runtime 与 320/360/412dp、130%/200% 字体验收。

## P0

无新的 P0 资金、身份或跨公司风险。

## P1

1. OPD-1 尚未由产品方确认，未来 CTA 行为仍可被实现成死按钮或错误跳转。
2. OPD-2 Home DTO/状态字段虽然已列出，但未形成已批准的字段级 Contract。
3. Flutter 真实 P1 尚未实现；39 只能作为 Product Remap，不是实现证据。

## P2

1. 旧 `04`、`02` 需要后续 superseding revision。
2. 静态金额/期限可能产生 H5/Android 版本漂移。
3. 中文法律条款翻译与离线缓存策略待决定。

## P3

1. About/Help/Support、Telegram Android reminders、视觉 polish。

## Trae Planning Decision

```text
P1 CONTRACT PLANNING: HOLD
TRAE: HOLD
```

`39` 的事实修正可保留，但必须先关闭 OPD-1/OPD-2，再生成 P1 Contract；本轮不授权 Trae 实现。
