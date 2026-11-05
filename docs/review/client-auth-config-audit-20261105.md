# 客户认证与公司配置审计（D-42，2026-11-05）

本报告只基于仓库代码、灰度模板和本地隔离运行；没有登录 VPS、没有修改远程数据库或线上配置。

## 结论摘要

- 普通 H5 与 App 共用 `/api/h5/auth`、`/send`、`/verify`、`/account` 手机认证接口；Flutter endpoint 定义在 `mobile/lib/core/network/endpoints.dart:62-105`，页面文案仍称 Telegram 验证，属于待拆分的客户端文案/正式短信任务。
- Telegram Mini App 通过 `Telegram.WebApp.initData`（`app/h5/login.tsx:35-41`）和 `X-Telegram-Init-Data` 进入 `/api/h5/auth/telegram`；服务端在 `app/api/h5/auth/telegram/route.ts:11-42` 验证 initData、bot credential 和 replay nonce。
- 本 PR 让 `/api/h5/auth` 按该渠道信号选择 runtime：普通浏览器/App 使用 `PAYEASE_H5_AUTH_MODE`，Telegram 使用 `PAYEASE_TELEGRAM_AUTH_MODE`；普通 H5 不再因部署级 Telegram mode 被强制显示 Telegram 登录。
- `demoCode=123456` 仍只由 `lib/h5-auth-core.ts:53-70` 的 `demo` mode 生成；Telegram Gateway 和错误分支不回退 demo。灰度模板显式启用 demo 仅用于测试，生产启动在 `deploy/standalone/server.mjs:27` 拒绝 `KHMERX_TEST_MODE=true`。

## 1. 公司绑定审计

| 渠道 | 当前绑定来源 | 证据 | 失配情况 |
|---|---|---|---|
| H5 普通浏览器 | `payease_company` cookie → `team_companies.id` | `lib/team/server.ts:13-18`、`app/api/team/route.ts:7` | 无 cookie 时 `customerCompany()` 为 null；多公司部署不会猜默认公司 |
| Telegram Mini App | 先读取 cookie；无 cookie 时按活动公司与 bot credential 枚举并验证 initData，成功后写 `payease_company` | `app/api/h5/auth/telegram/route.ts:17-42`、`lib/bot-credentials.ts:14-28` | 无活动公司/bot、无有效 initData，或多公司无法唯一验证时失败，不会静默选第一家公司 |
| App | cookie jar 保留 `payease_company`，API 仍走 H5 endpoints | `mobile/lib/core/session/whitelist_cookie_jar.dart:1-75`、`mobile/lib/core/network/endpoints.dart:62-105` | 未选择公司或 cookie 被清除时，后端返回 `company=null`/需重新选公司 |

Standalone gray 单公司部署在 `deploy/standalone/server.mjs:211-214` 只在请求没有公司 cookie 时注入唯一 `cfg.companies[0].id`；正式多公司 host 不能依赖这个兜底。`deploy/standalone/hosts.mjs:3-31` 仅做 host 角色 allowlist，不是 host→company 映射。因而线上 `payease.khmerx.org` 返回 `company=null` 的仓库侧原因是请求没有 `payease_company` 且该部署未提供单公司默认绑定；host 允许并不等于租户绑定。Runbook：单公司 gray 必须保留唯一 `companies[0]`；正式多公司必须在入口流程调用 `customer_enter` 写 cookie，或增加经过评审的显式 host→tenant 映射，不能按 host 猜测。

## 2. 登录方式审计

- 原实现从 `PAYEASE_AUTH_MODE` 构造一个全局 runtime：`lib/h5-auth.ts:16`；`/api/h5/auth` 原先直接返回该 mode。
- demo OTP 与响应字段位置：`lib/h5-auth-core.ts:53-70`。仅 `mode==='demo'` 生成 hash/`demoCode`；`mode==='telegram'` 调 Gateway，provider 失败会将 challenge 标成 failed 并抛错。
- 本 PR 增加 `PAYEASE_H5_AUTH_MODE` 与 `PAYEASE_TELEGRAM_AUTH_MODE`，并在 `app/api/h5/auth/route.ts:6` 根据 `X-Telegram-Init-Data` 选择渠道；Telegram route 固定 `runtime('telegram')`。默认仍兼容原 `PAYEASE_AUTH_MODE`。
- 灰度样例现在是 `KHMERX_TEST_MODE=true`、`PAYEASE_H5_AUTH_MODE=demo`、`PAYEASE_TELEGRAM_AUTH_MODE=telegram`；这是灰度测试配置，不能复制到生产。

## 3. 后台管理入口与权限

- 公司创建/平台级更新（名称、启用状态、客户端语言）要求 `platformAdmin()`，见 `lib/team/server.ts:31,65-90`；平台管理员由 `KYC_REVIEWER_EMAILS` 且无 `staffTenantId` 判定。
- 公司 Admin 可修改客户端语言开关 `client_en/km/zh_enabled`，见 `lib/team/server.ts:91,108-112`；`app/team/client.tsx:183` 读取和提交这些设置。
- 普通员工不能调用组织管理：`lib/team/server.ts:91` 要求当前公司 `admin`；KYC 写入还有 `guardKyc()` 角色限制（`lib/team/server.ts:30`）。
- 公司 slug 进入后台/客户入口由 `app/api/team/route.ts:7` 查询 active tenant 后写 `TEAM_COOKIE` 或 `payease_company`。
- 公司更新和语言修改调用 `audit()`/`auditInsertSql`（`lib/team/server.ts:88,111`），审计 writer 使用 append-only `team_audit` seq；本次未改数据库 schema。
- 当前没有后台可视化的认证 mode、host 绑定或 Telegram bot 绑定设置；这些仍是 deployment bindings/credential table 的运维配置，不能由普通公司 Admin 任意切换。正式短信接入需另卡。

## 4. 测试开关与风险分级

- `KHMERX_TEST_MODE` 由 `lib/runtime-guards.ts` 读取，并控制 demo 允许性；`lib/h5-auth-core.ts:27` 在 demo 且未允许时 fail closed。
- standalone production 在 `deploy/standalone/server.mjs:27-28` 拒绝 test mode/不安全身份校验配置；生产示例不改为 demo。

| 等级 | 问题 | 影响 | 建议 |
|---|---|---|---|
| P0 | 旧版全局 `PAYEASE_AUTH_MODE=telegram` 同时决定 H5 与 Mini App | 普通 H5/App 不能按负责人要求走手机号验证码 | 本 PR 用显式 channel runtime；正式短信仍需独立 provider 任务 |
| P0 | 灰度模板原先 `KHMERX_TEST_MODE=false` 且 Telegram-only | 本地/灰度无法验收 123456 | 本 PR 只在 gray template 开启 demo，并保留生产 guard |
| P1 | `payease.khmerx.org` 无公司 cookie/默认租户 | H5 `/api/h5/auth` 返回 `company=null` | 按部署类型配置唯一公司或显式 customer_enter/host mapping；不在多公司环境静默选第一家 |
| P1 | 正式生产短信 provider 尚未接入 | 不能把 demo OTP 当真实认证 | 另立短信 provider 任务：接口、密钥、频率限制、错误 fail-closed、审计与回滚 |
| P2 | App 复用 H5 API，但 Flutter 文案仍写 Telegram | 用户认知与实际渠道不一致 | 单独 App 文案/验收卡；本卡不改 mobile |
| P2 | 后台没有认证 mode/host/bot 的公司设置页 | 运营需靠 reviewed deployment config，无法自助查看 | 先设计只读展示和平台/公司 Admin 权限边界，禁止把 secrets 暴露到 UI |
| P3 | 三语登录提示当前集中在 H5 client 页面 | 文案扩展需保持 zh/en/km 一致 | 本 PR 增加显式三语测试环境标识；完整 locale 组件化可后续整理 |

## 5. 验收与上 VPS 清单

- [x] H5/App 与 Telegram 按渠道选择，不在同一页面二选一。
- [x] demoCode 只在 demo channel 返回；Telegram 请求不出现 123456。
- [x] gray template 显式包含 `KHMERX_TEST_MODE=true` + `PAYEASE_H5_AUTH_MODE=demo` + Telegram mode；生产启动仍拒绝 test mode。
- [ ] 本地 375px zh/en/km 登录截图及 sha256；需要在独立 acceptance run 中完成。
- [ ] 本地 H5：手机号 + 123456 → KYC → 借款 → 签约完整流程；需要复用第三轮脚本完成。
- [ ] 生产等价 env：`demoCode` 不返回，123456 无法通过；需用本地 worker 的非-demo fixture 验证。
- [ ] VPS 灰度前核对真实 config placeholders、单公司绑定、Telegram bot/gateway secrets、TLS/DNS、scanner health；不在本 PR 部署。
- [ ] 正式上线前另行完成 SMS OTP provider，不允许任何 provider failure fallback 到 123456。

## #170 验收矩阵补充

| 用例 | 证据/状态 |
|---|---|
| 普通 H5/App 无 initData | 代码与单测：H5 channel → phone OTP；gray demo 返回 123456 |
| Telegram Mini App 有 initData | 代码与单测：Telegram channel → signed initData route；不返回 demoCode |
| 灰度配置 | `deploy/standalone/gray/check-config.mjs` 强制三项 channel bindings，配置样例可读验证 |
| 公司绑定 | 单公司 gray 的 standalone 注入可用；多公司必须显式 cookie/入口，`payease.khmerx.org` 的 null 已解释 |
| 后台权限/审计 | `team/server.ts` 的 platform/Admin/employee checks 与 audit writer 位置已核对 |
