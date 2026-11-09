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
