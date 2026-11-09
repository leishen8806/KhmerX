# 两家公司硬分离 · 第二批任务卡（不依赖法务的部分，2026-11-09）

依据：docs/plans/2026-11-06-licensed-hard-separation.md（下称"拆分方案"）；决定 D-55～D-63。基线：KhmerX main = f5581cd；KhmerX-Licensed main = bf3657e。
规范：docs/tasks/queue/start-codex.md、_common.md、codex-workflow.md；worktree 一律用 git -c core.autocrlf=false 创建；依赖用 junction 复用 E:\KhmerX\wt-GL-1\node_modules；不联网安装依赖；只用虚构数据；不碰任何 VPS 或 khmerx.org 域名。灰度仍暂停（D-58）。

## 本批决定（随 W2-0 提交）
| 编号 | 决定 | 范围与条件 | 状态 |
|---|---|---|---|
| D-62 | 关闭 PR #223（机构出资回调改为财务复核后放款） | 技术负责人 2026-11-09 03:04 在对话中决定。与 D-57、D-61 方向相反；放款由持牌机构在自己的系统里双人复核 | 已确认 |
| D-63 | 先开工第二批中不依赖法务的部分 | 技术负责人 2026-11-09 03:04 在对话中决定。范围：W2-1～W2-6。KYC 资料包内容与文件拉取、客户同意书、借款协议签署、还款渠道仍等拆分方案 §5 的答复；从 KhmerX 删除机构代码等机构系统联调通过后再做 | 已确认 |

## 本批不做（等 §5 答复）
KYC 资料包字段与文件拉取、客户同意书文案、借款协议由谁签及怎么签、客户还款付给谁和走什么渠道、从 KhmerX 删除机构代码。

## 卡片一览
| 卡 | 仓库 | 内容 | 依赖 | 合并条件 |
|---|---|---|---|---|
| W2-0 | KhmerX | 记录 D-62、D-63；关闭 #223 | — | 文档 |
| W2-1 | KhmerX | 回调消费端按公开申请号找贷款（联调前必修） | — | Claude 评审；需要新迁移时还须负责人批准 |
| W2-2 | Licensed | 机构员工账号、登录、二次验证、会话、审计 | — | Claude 评审 |
| W2-3 | Licensed | 审批与复核（审批员 + 复核员双人） | W2-2 | Claude 评审 |
| W2-4 | Licensed | 机构发件箱：签名发送回调给金融服务公司 | — | Claude 评审 |
| W2-5 | Licensed | 放款与还款登记（放款员 + 放款复核员双人；资金额度） | W2-3、W2-4 | Claude 评审，**且须负责人本人批准（资金逻辑）** |
| W2-6 | 两个仓库 | 本地两系统端到端联调 | W2-1、W2-3、W2-4（W2-5 合并后补测放款与还款） | 文档报告 |
机构审批工作台界面（把现有"持牌机构后台"页面搬过去）放在第三批，等 W2-2～W2-5 的接口稳定后再做。

---

## W2-0　记录决定、关闭 #223
```
【卡】W2-0　分支：docs/tasks/wave2-decisions-20261109　Line: server
1. 基于最新 origin/main 新建 worktree；从主工作目录原样复制 docs/tasks/status/2026-11-09-hard-separation-wave2.md（本文件）和 docs/tasks/status/2026-11-09-zhixu-dispatch.md。
2. docs/tasks/decision-log.md 末尾追加 D-62、D-63 两行（内容取本文件"本批决定"），不改已有的行；确认 D-01～D-63 连续。
3. 只 git add 这三个文件；推送；在 GitHub 上建 PR。
4. 在 GitHub 上关闭 #223，评论："按技术负责人 2026-11-09 的决定 D-62 关闭：放款归持牌机构（D-57），机构内部双人复核在机构系统中完成。"不删分支。
5. 把 PR 链接发给 Claude。
```

## W2-1　回调消费端按公开申请号找贷款（KhmerX）
```
【卡】W2-1　分支：fix/server/W2-1-callback-public-ref　Line: server
【问题】发件箱发给机构的 applicationId 是贷款的公开申请号（loan.publicRef，O 开头），机构回调会原样带回这个号码；
而回调消费端把 applicationId 当作内部贷款编号（loan.id）查找，结果一律是 LOAN_NOT_FOUND，回调进入死信。
HS-1 的测试传的是内部编号，所以没有发现。
【先读】lib/partner-outbox.ts（applicationId 的来源）、lib/institution-callback-consumer.ts、lib/institution-events.ts、lib/customer-shards.ts（loan_index 的结构）、tests/team-integration.test.mjs 里的 external 用例。
【允许修改】lib/institution-callback-consumer.ts、lib/institution-events.ts、tests/。确实需要新迁移时，先停下报告，不要自己加。
【要求】
1. 回调里的标识按以下优先级解析：
   - 有 loanId → 按内部编号查（兼容现有接收方式）；
   - 只有 applicationId → 按 publicRef 查。
   两者都有但指向不同贷款 → dead_letter，原因码 APPLICATION_ID_MISMATCH。
2. 两种存储模式都要支持：
   - demo_workspaces：在 state.loans 里按 publicRef 查；
   - 按行存储（CUSTOMER_ROWS=on）：如果 loan_index 没有 public_ref 列，不能遍历所有客户的数据。这时停下，报告需要哪个迁移（新增 public_ref 列和索引，并回填），等技术负责人批准后再继续；不要自行新增迁移。
3. 测试：external 模式下用真实 apply 拿到 publicRef，再用"只带 applicationId=publicRef"的回调走完 批准 → 签约 → 放款 → 还款 → 结清；
   另外覆盖 loanId 与 applicationId 不一致、applicationId 不存在两种情况。
【自查】本机实际运行 npm test、npm run typecheck、npm run lint 并贴出结果。推送后把分支名和提交号发给 Claude。
```

## W2-2　机构员工账号与登录（KhmerX-Licensed）
```
【卡】W2-2　分支：feat/licensed/W2-2-staff-auth　Line: licensed
【先读】拆分方案 §2.1、§2.2；KhmerX 的 lib/team/auth.ts、lib/team/policy.ts、app/api/team/auth/route.ts、app/team/login/client.tsx，以及 drizzle 中 team_members、team_staff_credentials、team_staff_sessions、team_staff_limits、team_mfa_challenges、team_mfa_recovery_codes 几张表的定义。
【范围】从 KhmerX main 复制（文件头注明"复制自 KhmerX <提交号> <路径>，修改：…"），改成机构自己的版本：
1. 角色只保留四个：lender（审批员）、checker（复核员）、finance（放款员）、finance_checker（放款复核员），外加 admin（机构管理员，只管员工账号，不能审批或放款）。
2. 功能：密码登录（PBKDF2，与 KhmerX 相同参数）、TOTP 二次验证（审批、复核、放款相关角色必须开启）、会话（HttpOnly + SameSite=Strict Cookie，8 小时）、登录限流、登出；admin 创建、停用员工。
3. 去掉 KhmerX 特有的部分：ChatGPT/Sites 外层身份、公司代码、部门、"业务后台 / 机构后台"入口切换、邀请令牌。机构只有一个租户。
4. 新迁移 0002：员工、凭据、会话、限流、MFA 相关表（机构仓库自己的编号）。所有写入都经过复制来的 audit-writer。
5. 界面：只做一个最简登录页（账号、密码、二次验证码）。样式不追求，第三批再搬工作台。
6. 测试：错误密码、限流、未开二次验证的审批角色不能登录、会话过期、停用账号立即失效、admin 不能调用审批接口。
7. 不得复制客户端、KYC、运营、贷后、通知代码；repo-boundary 测试必须通过。
【自查】npm run typecheck、npm run lint、npm test、npm run build，本机实际运行并贴出结果。推送分支并建 PR，CI 必须通过；把 PR 链接发给 Claude。
```

## W2-3　审批与复核（KhmerX-Licensed）
```
【卡】W2-3　分支：feat/licensed/W2-3-approval　Line: licensed
【依赖】W2-2 已合并。
【先读】KhmerX 的 lib/team/workflow.ts 中 approve、reject、approval_check 三个分支，lib/team/policy.ts 的 requireDifferent，lib/domain.ts 中 approve、reject 的状态规则。
【要求】
1. applications 表增加审批相关字段（迁移 0003）：decision（none/approved/rejected）、approved_by、checked_by、reject_reason、decided_at、checked_at。
2. 状态规则：
   - submitted →（审批员批准）pending_check →（另一名复核员复核通过）approved；
   - submitted →（审批员拒绝，必须填写原因）rejected；
   - pending_check →（复核员退回，必须填写原因）submitted。
   复核员不能是批准人本人（照搬 requireDifferent）。
   withdrawn 的申请不能审批；agreement.signed 只接受 approved 状态的申请（修改 W2-0 之前的接收逻辑：签约前必须已经批准）。
3. 接口：申请列表（分页、按状态筛选）、申请详情、批准、拒绝、复核通过、复核退回。全部要求登录和对应角色，用 version 字段做乐观并发控制，按 requestId 幂等，每一步写审计。
4. 复核通过 → 写入机构发件箱一条 loan.approved；拒绝 → 写入 loan.rejected（带 reason）。发件箱写入与状态更新在同一个批处理里，用 changes()=1 保证状态更新成功才写入（做法同 KhmerX 的发件箱）。
   如果 W2-4 还没合并，就先基于 W2-4 分支堆叠，并在 PR 第一行写明。
5. 测试：双人规则、本人不能复核、并发审批只有一次成功、重复请求幂等、拒绝必须有原因、撤回后不能审批、回调事件只在复核通过后写入。
【自查】同 W2-2。PR 链接发给 Claude。
```

## W2-4　机构发件箱（KhmerX-Licensed）
```
【卡】W2-4　分支：feat/licensed/W2-4-outbox　Line: licensed
【先读】KhmerX 的 lib/partner-outbox.ts、drizzle/0064_partner_outbox.sql、tests/partner-outbox.test.mjs；KhmerX 的 app/api/institution/callback/route.ts（对方接收端的要求）；tests/fixtures/arc04-v0/（签名向量和事件样例）。
【要求】
1. 复制 KhmerX 的发件箱实现，改为机构方向：表 partner_outbox（迁移 0004，字段与 KhmerX 0064 一致，包括 lease_until）；
   事件类型：loan.approved、loan.rejected、funding.confirmed、repayment.confirmed、payment.failed。
2. 载荷：eventType、eventId（发件箱记录 id）、applicationId（原样使用金融服务公司提交时的 applicationId）、occurredAt；
   按事件类型加 reason、externalReference、amountCents、paymentType。不得包含任何客户资料。
3. 请求头：X-Partner-Id 和 X-Institution-Id 同时发送（值相同；KhmerX 接收端两者都接受，不一致会拒绝）；签名算法与签名向量一致；出站密钥 PARTNER_OUTBOUND_SECRETS_JSON；目标地址 PARTNER_ENDPOINTS_JSON（只允许 https）。
4. 投递接口 POST /api/jobs/partner-outbox，用任务密钥保护；PARTNER_OUTBOX=on 才发送，off 时只写不发。
   重试、租约、24 小时转死信、409 视为对方已收到，全部与 KhmerX 一致。
5. 测试：参照 KhmerX 的发件箱行为测试（成功、500 后重试、超时、24 小时死信、租约回收、并发不重复发送、只投 https），并用 KhmerX 的签名向量验证签名正确。
【自查】同 W2-2。PR 链接发给 Claude。
```

## W2-5　放款与还款登记（KhmerX-Licensed）
```
【卡】W2-5　分支：feat/licensed/W2-5-funding　Line: licensed
【注意】资金逻辑：Claude 评审后，还须技术负责人本人批准才能合并。PR 第一行写明这一点。
【依赖】W2-3、W2-4 已合并。
【先读】KhmerX 的 lib/team/workflow.ts 中 disburse_request、disburse 分支，lib/team/admin-funds.ts（登记还款），lib/funding-limits.ts，lib/team/funding-settings.ts，lib/domain.ts 中 disburse、repay 的金额规则。
【要求】
1. 只做测试资金的登记，不连接任何真实支付或银行渠道。
2. 放款：申请状态必须是 signed（收到 agreement.signed）→ 放款员发起（填写外部流水号）→ 另一名放款复核员复核（不能是发起人，也不能是审批或复核这笔申请的人）→ funded。
   复核前检查机构资金额度（照搬 funding-limits 的规则，额度配置只有 admin 能改）。funded 时写入发件箱 funding.confirmed（externalReference、amountCents）。
3. 还款：放款员登记还款（金额、外部流水号）→ 放款复核员复核 → 写入 repayment.confirmed。
   金额必须是正整数，且不超过剩余应还；同一外部流水号只能登记一次；还清后申请状态为 closed。
4. 放款或还款被复核退回 → 写入 payment.failed（paymentType 为 funding 或 repayment）。
5. 测试：双人规则（包括"审批人不能放款复核"）、额度不足被拒、超额还款被拒、流水号重复被拒、并发只成功一次、事件只在复核通过后写入。
【自查】同 W2-2。PR 链接发给 Claude。
```

## W2-6　本地两系统端到端联调
```
【卡】W2-6　报告分支：docs/review/wave2-e2e-local-<日期>（KhmerX 仓库）　Line: server
【依赖】W2-1、W2-3、W2-4 已合并（W2-5 合并后补测放款和还款）。
【要求】
1. 在本机同时启动 KhmerX 本地服务（scripts/dev-app-backend，PAYEASE_INSTITUTION_MODE=external，PARTNER_OUTBOX=on）和机构系统本地服务，只监听 127.0.0.1。
2. https 限制：两边的发件箱只投 https。本地联调需要放行 http://127.0.0.1 时，只能在 PAYEASE_ENV=local 下放行，并且放行代码必须有测试证明 gray 和 production 环境下仍然只投 https。
   这项代码改动另开小卡、单独评审，不在本卡里改。
3. 用虚构客户走完：KYC → 申请 → 金融服务公司发件箱投递 → 机构收到 → 审批员批准 → 复核员复核 → 机构发件箱回调 → 金融服务公司状态变为待签约 → 客户签约 → agreement.signed 送达机构。
   W2-5 合并后继续：放款 → 金融服务公司状态变为还款中 → 部分还款 → 全额还款 → 结清。
4. 故障注入：机构服务停掉 10 分钟再启动，金融服务公司发件箱要能自动补发，不丢单、不重复；同一回调重复发送，状态只变一次。
5. 报告：每一步写时间、两边的状态、发件箱记录状态。不写密钥。推送报告分支并建 PR，把链接发给 Claude。
```
