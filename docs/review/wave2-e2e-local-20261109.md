# W2-6 第一段返工：本地跨进程联调报告

日期：2026-11-09

范围：仅本机、虚构数据；未访问服务器或生产域名。

## 结论

跨进程端到端联调未执行完成，原因是机构仓库当前没有满足任务要求的持久化本地启动与发件箱任务触发入口，不能自行新增机制。已完成本地服务启动检查、现有 API/数据库级测试，以及独立补充测试 PR。

## 逐项结果

| 项目 | 结果 | 证据 |
|---|---|---|
| 合并后的基线 | 通过 | KhmerX `aade333`；KhmerX-Licensed `1e6df81` |
| KhmerX 本地服务 | 通过 | `scripts/dev-app-backend/start.mjs` 使用 `.wrangler/state` 持久化目录；本机监听 `127.0.0.1:8092` 代理、`127.0.0.1:8794` Miniflare；`GET /api/h5/auth` 返回 200 |
| Licensed 本地服务 | 失败 | `server.mjs` 第 6 行固定 `d1Persist:false`，未提供持久化目录参数；只能启动临时内存 D1，不能作为本卡要求的持久化联调证据 |
| 发件箱触发入口 | 未执行 | KhmerX 有 `POST /api/jobs/partner-outbox`（`app/api/jobs/partner-outbox/route.ts`）；Licensed 未发现定时任务或 HTTP dispatch 入口，只有 `dispatchPartnerOutbox()` 函数，按卡要求不能自行新造入口 |
| 批准路径跨进程 HTTP | 未执行 | 缺少 Licensed 持久化库及可调用的发件箱触发入口，不能证明两库间真实 HTTP 传递 |
| 拒绝路径跨进程 HTTP | 未执行 | 同上 |
| 撤回路径跨进程 HTTP | 未执行 | 同上 |
| Licensed 停机 10 分钟补发 | 未执行 | 缺少可持久化 Licensed 数据库和现成 dispatch 入口；未以单元测试替代实际演练 |
| KhmerX 停机 10 分钟补发 | 未执行 | 反向演练依赖 Licensed 的可持久化收件及触发链路 |
| 两库最终发件箱统计 | 未执行 | 未建立跨进程联调数据库；没有可回溯的两库查询结果，未估算 |

## 已覆盖的本地测试证据

- KhmerX `node --experimental-vm-modules --test tests/team-integration.test.mjs`：66/66 通过；包含 `external partner outbox records real customer apply/sign writes only`、`external institution callbacks use the real application and signing path`、`external institution callbacks resolve publicRef in customer rows mode`。
- KhmerX `node --experimental-vm-modules --test tests/partner-outbox.test.mjs`：8/8 通过；测试名 `dispatcher behavior covers delivery, retry, timeout, expiry, lease reclaim, concurrency, and HTTPS gate`。
- KhmerX-Licensed：`approval.test.mjs`、`events-route.test.mjs`、`partner-outbox.test.mjs` 合计 18/18 通过；包含 `D1 idempotency and nonce replay survive a Miniflare restart`、`retry, timeout, expiry and lease reclaim follow delivery states`、`concurrent dispatch claims once and off mode does not send`。

这些是本地 API/数据库级证据，不宣称为跨进程联调或真实停机演练。

## 补充测试 PR

KhmerX-Licensed 分支 `fix/licensed/W2-6a-http-tests`，提交 `433685a`，PR [#7](https://github.com/leishen8806/KhmerX-Licensed/pull/7)。

新增测试：

- `gray and unset environments reject loopback HTTP`
- `local environment rejects non-loopback HTTP`

本机结果：9/9 partner-outbox tests 通过；typecheck、lint 通过。未合并。

## 未覆盖项

没有共享数据库统计、跨进程 HTTP 状态链路、10 分钟停机补发、不重复入库的查询结果；这些均留待机构仓库提供持久化启动方式和现成 dispatch 触发入口后重新执行。

## W2-6b 复跑补充（2026-11-09）

| 项目 | 结果 | 证据 |
|---|---|---|
| Licensed 持久化启动 | 通过 | W2-6b PR 合并后，`npm start` 使用 `.wrangler/state`；`GET http://127.0.0.1:8787/healthz` 返回 200 |
| Licensed 本地迁移 | 通过 | `npm run migrate:local` 输出 0001、0002、0003、0004 均已应用 |
| 虚构员工造数 | 通过 | `seed-staff.mjs` 创建 lender、checker、admin；密钥仅在终端输出，未写入报告或 Git |
| 重启后数据保留 | 通过 | 重启前后本地 SQLite 查询 `SELECT COUNT(*) FROM team_members` 均为 3 |
| 客户 HTTP 注册与 KYC 提交 | 通过 | `scripts/dev-app-backend/kyc-smoke.mjs`：send code、verify code、四个文件上传、save draft、submit 全部通过 |
| 员工 HTTP 登录 | 通过 | `POST /api/team/auth` 返回 `{"ok":true}`；密码和 MFA 仅用于本机验证 |
| 员工会话访问审核接口 | 失败 | 同一 HTTP 代理链访问 `/api/kyc/review` 返回 `AUTH_REQUIRED`；未绕过 HTTP，不直接写库或调函数 |
| 批准、拒绝、撤回跨进程路径 | 未执行 | 审核会话阻塞，无法取得合法审核员上下文 |
| 两方向 10 分钟停机演练 | 未执行 | 前置审核路径未通过；未用单元测试冒充停机证据 |
| 两库发件箱最终统计 | 未执行 | 尚无完成的跨进程业务记录，未估算 |

补充测试 PR：KhmerX-Licensed #7 已合并；W2-6b PR 为 [#8](https://github.com/leishen8806/KhmerX-Licensed/pull/8)，合并提交 `cd129c2`。

## 员工会话修复后的复测（2026-11-09）

| 项目 | 结果 | 证据 |
|---|---|---|
| 固定本机外层身份 | 通过 | 启用现有联调脚本开关 `DEV_TEAM_LOCALHOST=true`；员工会话随后 `GET /api/team` 返回 200 |
| 公司选择 Cookie | 通过 | 登录后调用 `POST /api/team` 的 `customer_enter`；仅记录 Cookie 名称：`payease_staff_session`、`payease_staff_mode`、`payease_staff_company`、`payease_staff_portal`、`payease_company` |
| KYC 审核 HTTP 会话 | 通过 | `GET /api/kyc/review` 返回 200；`POST /api/kyc/review` 返回 200，状态变为 `approved` |
| 发件箱任务接口 | 通过 | Licensed `POST /api/jobs/partner-outbox` + `x-job-key` 返回 `sent=0,dead=0`；KhmerX `POST /api/jobs/partner-outbox` + Bearer 任务密钥返回 `sent=0,dead=0` |
| 批准完整跨进程链路 | 未执行 | 当前已完成客户 KYC 提交与机构审核 HTTP，但尚未完成贷款申请、机构回调、签约和双方发件箱入库的同一客户闭环 |
| 拒绝路径 | 未执行 | 尚未建立可用于该路径的第二个完整跨进程申请 |
| 撤回路径 | 未执行 | 尚未建立可用于该路径的完整跨进程申请 |
| 两方向停机 10 分钟 | 未执行 | 前述业务闭环尚未完成；未用单元测试冒充停机证据 |
| 两库最终统计 | 通过（当前空库基线） | Licensed：`partner_outbox=0`、`inbound_events=0`、`nonces=0`；KhmerX：`partner_outbox=0`、`institution_callback_events=0`、`institution_callback_attempts=0`。这些是当前本地库查询结果，不是业务完成统计 |
