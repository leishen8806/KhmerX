# 两家公司硬分离 · 第一批任务卡（2026-11-07）

依据：`docs/plans/2026-11-06-licensed-hard-separation.md`（下称"拆分方案"）、决定 D-50 至 D-54。基线：`origin/main` = `30df6de`（含 0063 公司渠道迁移）。
规范：`docs/tasks/queue/start-codex.md`、`_common.md`、`codex-workflow.md`；worktree 一律用 `git -c core.autocrlf=false worktree add ...`；不联网安装依赖；只用虚构数据；不碰任何 VPS 或 khmerx.org 域名。
**灰度暂停（D-53）**：本批所有卡都只在本地开发和测试。

## 本批不依赖拆分方案 §5 的答案
§5 未定的项按 D-17 先用以下默认值，写进每个 PR 的"假设"段；技术负责人回复后再调整：
- **请求头**：发送时用 `X-Partner-Id`；接收端同时接受 `X-Partner-Id` 和旧的 `X-Institution-Id`（两者都出现且不一致时，返回 400）。
- **资料包**：本批只定义"按引用"的结构（文件编号、类型、sha256、过期时间），不决定具体给哪些字段；实际字段由第二批卡在法务确认后填写。
- **定价**：账单仍由金融服务公司计算，随申请一起发送。

| 卡 | 内容 | 仓库 | 合并条件 |
|---|---|---|---|
| HS-0 | 把拆分方案和 D-50～D-54 提交进仓库 | KhmerX | 纯文档 |
| HS-1 | 回调消费端改为支持"外部机构模式"，并补齐放款、还款、支付失败三个事件 | KhmerX | `lib/**`：Claude 评审 |
| HS-2 | 发件箱：申请和签约事件持久化、签名投递、重试、死信（默认关闭） | KhmerX | 含 `drizzle/**`：Claude 评审后，还须**技术负责人本人批准** |
| HS-3 | 契约测试向量和本地模拟机构 | KhmerX | `tests/**`、`scripts/**`：Claude 评审 |
| HS-4 | 持牌机构新仓库的本地骨架（不推送） | 新仓库（本地） | 等技术负责人建好 GitHub 仓库后再推送 |

顺序：HS-0、HS-1、HS-3 可以并行；HS-2 要用到 HS-3 的签名向量，所以 HS-3 先推送；HS-4 在 HS-3 之后做。

---

## HS-0　提交拆分方案与决定
```
【卡】HS-0　分支：docs/plans/licensed-hard-separation-20261107　Line: server
1. 基于最新 origin/main 新建 worktree（git -c core.autocrlf=false worktree add ...）。
2. 从主工作目录原样复制下面三个文件（内容不改）：
   - docs/plans/2026-11-06-licensed-hard-separation.md
   - docs/tasks/status/2026-11-07-hard-separation-wave1.md（本文件）
   - docs/tasks/status/2026-11-06-separated-gray-codex-prompts.md（已标为撤回，只作留档）
3. docs/tasks/decision-log.md 的表格末尾追加 D-50～D-54 五行，内容取拆分方案 §6；不改已有的行。
   如果 GL-6（docs/tasks/decisions-batch-g-20261106）还没合并，就基于 GL-6 分支堆叠，并在 PR 第一行写"基于 GL-6"。
4. 只 git add 上面四个文件。推送后把分支名发给 Claude。
```

## HS-1　回调消费端：外部机构模式和三个资金事件
```
【卡】HS-1　分支：feat/server/HS-1-external-institution-consumer　Line: server
【先读】拆分方案 §2.4 和 §3；lib/institution-callback-consumer.ts、lib/institution-callback-decision.ts、lib/institution-event-plans.ts、lib/institution-events.ts、lib/domain.ts（applyAction 里的 disburse、repay）、app/api/institution/callback/route.ts、tests/team-integration.test.mjs 第 22 项、docs/review/institution-callback-wiring-20261106.md。
【允许修改】上面几个 lib 文件、lib/runtime-guards.ts（只加读取开关的函数）、tests/ 下相关测试。不改 drizzle/**、deploy/**、app/api/team/**、前端。
【要求】
1. 新增运行时开关 PAYEASE_INSTITUTION_MODE：
   - embedded（默认，等于现在的行为）：loan.approved 只记录 approvalActor，状态停在 decision_pending，等金融服务公司内部的 checker 复核。
   - external：机构在自己系统里已经完成双人复核，所以 loan.approved 直接把状态推进到 approved（待签约），不再要求金融服务公司内部复核。
   不设置或取值非法时按 embedded 处理。
2. 两种模式下都接入下面三个事件（用 buildInstitutionActionPlan 和 assertPlanPrecondition 校验前置状态）：
   - funding.confirmed：signed → active；记录 externalReference 和机构编号；写入现有的资金分录（与 domain 的 disburse 结果一致）。
   - repayment.confirmed：只在 active 状态下处理；amountCents 必须是正整数，且不超过剩余应还；还清后转为 closed，否则保持 active；同一个 externalReference 只入账一次。
   - payment.failed：状态不变；记录一条事件和审计，备注里写明失败的是放款还是还款。
3. 三个事件都要与现有的批准/拒绝走同一套保证：先验签（路由已做）；按 eventId 幂等；通过 revision 条件更新防并发；写审计（auditInsertSql）；前置状态不对时返回 dead_letter 并给出原因码，不得部分写入。
4. 测试（新增，或扩展 tests/team-integration.test.mjs）：
   - external 模式：approved → 客户签约 → funding.confirmed → 部分还款 → 全额还款 → closed；
   - 重复回调、乱序回调（signed 之前到达的 funding.confirmed 进入 dead_letter）、超额还款、同一 externalReference 重复入账；
   - embedded 模式下现有测试全部不变、仍然通过。
【自查】npm test、npm run typecheck、npm run lint、npm run check:client-boundary。PR 描述写"做了什么 / 没做什么 / 假设 / 风险 / 回退方法"，推送后把分支名发给 Claude。
```

## HS-2　发件箱（申请、签约事件的投递）
```
【卡】HS-2　分支：feat/server/HS-2-partner-outbox　Line: server
【注意】新增迁移（drizzle/**）：Claude 评审后，还须技术负责人本人批准合并。PR 第一行写明这一点。
【前置】HS-3 已推送（要用它的签名测试向量）。可以基于 HS-3 分支堆叠。
【先读】拆分方案 §3；lib/institution-callback.ts（签名算法）；lib/notifications/server.ts 里的 telegram_outbox（发件箱的写法可以参照）；app/api/jobs/postloan/route.ts（定时任务入口的写法）；lib/team/workflow.ts、lib/domain.ts 中客户的 apply、sign。
【允许修改】新增 drizzle/0064_partner_outbox.sql（编号以届时 main 上的最新编号为准）和 db/schema.ts 中对应的表定义；新增 lib/partner-outbox.ts、app/api/jobs/partner-outbox/route.ts；在客户 apply、sign 成功的同一个数据库批处理里写入发件箱（只改调用点，不改业务规则）；tests/。
【要求】
1. 表 partner_outbox：id、tenant_id、institution_id、event_type、idempotency_key（唯一）、payload、payload_sha256、status（pending/sending/delivered/dead）、attempts、next_attempt_at、last_error（只存错误码，不存响应体）、created_at、delivered_at。迁移只能新增，不改已有的表；附回退脚本。
2. 写入：只有 PAYEASE_INSTITUTION_MODE=external 时才写。
   - 客户 apply 成功 → application.submitted；
   - 客户 sign 成功 → agreement.signed；
   - 与业务状态变更在同一个批处理里提交，不能出现"状态变了但事件没写"或者反过来的情况。
   - 载荷按拆分方案 §3：applicationId 用公开申请号；customerRef 用按机构派生的化名（HMAC(密钥, tenant|institution|customerId) 截短），不得出现客户 ID、手机号、证件号；KYC 资料只给引用（文件编号、类型、sha256），不含下载地址（下载地址由第二批卡实现）。
3. 投递：POST /api/jobs/partner-outbox（与 jobs/postloan 一样，用定时任务密钥保护）。
   - 一次最多取 20 条到期的 pending 记录，用条件更新抢占为 sending（防止重复发送）。
   - 签名请求头：X-Partner-Id、X-Timestamp、X-Nonce、X-Idempotency-Key、X-Signature，算法与 lib/institution-callback.ts 相同，使用独立的出站密钥 PARTNER_OUTBOUND_SECRETS_JSON。
   - 目标地址来自配置 PARTNER_ENDPOINTS_JSON（每家机构一个 https 地址；只允许 https 和配置里列出的主机）。
   - 2xx 计为 delivered；409 按"对方已收到"处理，但要记录；其他情况按指数退避（30 秒起，最长 1 小时）重试；累计超过 24 小时转为 dead。
   - 请求超时 10 秒。不在日志里记录载荷或密钥。
4. 开关：PARTNER_OUTBOX=on 时才真正投递，默认 off（off 时只写入、不发送）。
5. 测试：用 HS-3 的模拟机构跑通——成功投递；对方 500 后重试成功；超时；24 小时后转 dead；两个 worker 并发不重复发送；embedded 模式下不写发件箱；载荷中不含客户 ID 和手机号。
【自查】同 HS-1。推送后把分支名发给 Claude。
```

## HS-3　契约测试向量与本地模拟机构
```
【卡】HS-3　分支：feat/server/HS-3-arc04-vectors-mock　Line: server
【先读】拆分方案 §3；lib/institution-callback.ts；tests/team-integration.test.mjs 中现有的回调签名用法。
【允许修改】新增 tests/fixtures/arc04-v0/（测试向量）、scripts/mock-institution/（模拟机构）、tests/arc04-vectors.test.mjs；不改 lib/**、app/**。
【要求】
1. 测试向量 tests/fixtures/arc04-v0/signing.json：至少 8 组，每组给出 partnerId、timestamp、nonce、idempotencyKey、body、测试用密钥（明显的虚构值，例如 test-only-secret-1）、规范化后的待签字符串、期望的签名。
   覆盖：空幂等键、含中文的 body、body 末尾有换行、大写签名、过期时间戳、错误 nonce 格式。
   tests/arc04-vectors.test.mjs 用 lib/institution-callback.ts 逐组验证。这份文件之后会原样复制进机构仓库，两边用同一份向量。
2. 事件样例 tests/fixtures/arc04-v0/events/：拆分方案 §3 的 8 个事件各一份合法 JSON 样例，外加 3 份非法样例（缺 applicationId、金额为负、未知 eventType）。
3. 模拟机构 scripts/mock-institution/server.mjs（只用 Node 自带模块，不新增依赖）：
   - 监听本机端口（默认 8799），接收 POST /v0/events，验签、检查 nonce 重复、按幂等键去重；
   - 可以配置：延迟、按比例返回 500、超时、重复应答；
   - 提供本地命令，向金融服务公司的 /api/institution/callback 发送签名回调（loan.approved、loan.rejected、funding.confirmed、repayment.confirmed、payment.failed），用于端到端测试；
   - 只允许连接 127.0.0.1，拒绝其他目标地址。
   - 附 README：怎么启动、怎么配置、怎么发回调。
【自查】npm test、npm run lint。推送后把分支名发给 Claude。
```

## HS-4　持牌机构新仓库的本地骨架（不推送）
```
【卡】HS-4　本地目录：E:\KhmerX\KhmerX-Licensed（新建，git init，默认分支 main）　Line: licensed
【前置】HS-3 已推送。GitHub 上的新仓库由技术负责人创建；创建之前只在本地提交，**不推送、不建远程**。
【先读】拆分方案 §1、§2.1、§2.2、§3；KhmerX 的 package.json、deploy/standalone/*、lib/http/*、lib/team/auth.ts、lib/team/audit-writer.ts、lib/institution-callback.ts。
【范围】本卡只做骨架，不搬审批界面（那是第二批）：
1. 技术栈与 KhmerX 相同（便于第二批直接搬代码）；package.json 只保留骨架需要的依赖，版本与 KhmerX 的锁定文件一致。
   不联网安装依赖：如果离线装不上，停下并报告缺少的包，等技术负责人批准。
2. 从 KhmerX 复制：lib/http/*、lib/request-security.ts、lib/runtime-guards.ts、lib/institution-callback.ts、lib/team/audit-writer.ts（以及它依赖的最少文件），在每个文件头部注明"复制自 KhmerX <提交号> <路径>"。
3. 新写：
   - 迁移 0001：applications、inbound_events、nonces、audit 四张表；
   - POST /v0/events：验签（接受 X-Partner-Id，兼容 X-Institution-Id）、nonce 防重放、幂等、写入 applications；
   - /healthz。
4. 测试：把 KhmerX 的 tests/fixtures/arc04-v0/ 原样复制过来，用同一份签名向量通过测试；用 HS-3 的事件样例测接收端（合法的被接受，非法的被拒绝，重复的幂等）。
5. 禁止：复制任何客户端、KYC、运营、贷后、通知代码；任何真实密钥；任何 KhmerX 的数据库文件。
   用一个测试检查仓库里不出现 app/h5、app/mini、lib/kyc、mobile 等目录。
【交付】在 KhmerX 仓库新建分支 docs/review/hs4-licensed-skeleton-20261107，写一份报告：目录结构、复制清单（来源提交号）、测试结果、待办。推送这个报告分支（只推送报告，不推送新仓库），把分支名发给 Claude。
```

## 本批决定（待随 HS-0 提交进决定记录）
| 编号 | 决定 | 范围与条件 | 状态 |
|---|---|---|---|
| D-55 | 批准合并 HS-2（含迁移 `drizzle/0064_partner_outbox.sql`） | 技术负责人 2026-11-07 16:08 在对话中批准。批准对象是经 Claude 评审的提交 `2cd6891`，加上一次机械变基：先合并 HS-3、HS-1，再把 HS-2 变基到 main，并把发件箱里重复的模式判断换成 `institutionMode()`。变基超出这个范围，或者 0064 有任何改动，都须 Claude 重新评审、技术负责人重新批准。功能默认关闭（`PAYEASE_INSTITUTION_MODE=external` 且 `PARTNER_OUTBOX=on` 才会发送）。不构成任何部署批准；灰度仍按 D-53 暂停。已知缺口：按行存储模式下的发件箱写入没有测试（签名保存功能只支持 `demo_workspaces`），记为待办 | 已确认 |
