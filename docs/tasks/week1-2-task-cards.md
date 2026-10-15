# 第 1–2 周任务卡（可直接复制成 GitHub Issue）

约定：负责人 苏晨 = 服务端与数据线；大旺 = 客户端线；技术负责人（你）= 合并与拍板。
分支命名 `feat/<线>/<编号>`；每个 PR ≤ 400 行；`main` 只能通过 PR 合并；每张卡完成 = 代码 + 测试 + 文档 + 回退方案。

## GitHub Projects 设置（一次性）
- 看板列：Backlog / Ready / In progress / In review / Done。
- 字段：Owner、Stream（server/client/arch/ops）、Milestone（M0–M5）、Estimate（天）、Depends on、Status。
- 标签：`stream:server`、`stream:client`、`arch`、`security`、`blocked`。
- 里程碑：M0 环境与安全收口、M1 PostgreSQL 与按行存储、M2 直传/队列/限流、M3 机构契约与发件箱、M4 机构系统第一版、M5 压测与灰度。
- 仓库设置：保护 `main`（必须 PR、必须通过检查、必须 Code Owner 审核、禁止强推）；你来合并。
- `.github/` 下已放 `CODEOWNERS`、PR 模板、任务卡 Issue 表单（GitHub 用户名是占位符，需替换）。

---

## ARC-00　统一错误体与请求编号契约　〔Claude，M0〕
目标：产出 `docs/contracts/ARC-00-error-and-envelope.md`。验收：技术负责人确认。**S2、D1、D4、D5 依赖它。**

## R-01　仓库整理　〔大旺 + 技术负责人，M0，0.5 天〕
范围：把 `mobile/`、`scripts/dev-app-backend/`、`scripts/apk/`、`docs/flutter-android/` 提交到分支 `app/flutter-import`（来源 `wip/gate-b-local`）并提 PR；补 `.gitignore`（`mobile/build`、`.dart_tool`、`*.log`、`.tmp-*`）；技术负责人在 GitHub 上设置 `main` 保护。
验收：`main` 上有 Flutter 源码；`flutter analyze` 0 问题；仓库里没有构建产物。
不许：改任何服务端代码。

## S1　本地开发环境与数据库连接抽象　〔苏晨，M0，2 天〕
范围：`docker-compose.dev.yml`（PostgreSQL 16、Redis 7）、`.env.example`、`npm run dev:db`；`lib/db/`：定义 `DbPort`（`query/exec/tx`），先提供现有 D1 实现，并预留 `DB_WRITE_URL` / `DB_READ_URL`（初期同值）。
验收：新人 `docker compose up` 一键起环境；现有测试全绿；README 写明启动步骤。
不许：迁移业务表；改 `lib/store.ts`。

## S2　处理器包装与统一错误体（按 ARC-00）　〔苏晨，M0，3 天，依赖 ARC-00〕
范围：`lib/http/`（`ApiError`、`route()`、requestId 读取与回传）；先迁移 `/api/state`、`/api/bots`、`/api/h5/state`、`/api/team/products`、`/api/kyc` 五个路由；`lib/h5-auth.ts` 的 `failure()` 不再把业务错误变 503；注册冲突返回 `ACCOUNT_ALREADY_REGISTERED`。
验收：ARC-00 第 8 节 1–4 条的契约测试通过；原有 124+ 个测试不下降；新增每个迁移路由的错误用例。
不许：改成功响应形状；改业务规则。

## S3　安全收口　〔苏晨，M0，2 天〕
范围：写接口 Origin 全部强制（`/api/state`、`/api/bots`、`customer-tags`、`tickets`）；`/api/h5/auth` 缺 `CF-Connecting-IP` 时不再落入共用桶；生产启动断言 `KHMERX_TEST_MODE` 关闭并在就绪检查里报告；复核 `bot-credentials.ts` 日志不含 token。
验收：各项有测试；缺 Origin 的写请求返回 403 `CROSS_SITE_REQUEST`。

## S4　网关小修　〔苏晨，M0–M1，0.5 天〕
范围：`deploy/standalone/server.mjs`：限流正则兼容查询串；剥离 `x-forwarded-for` 等不可信头。（该网关后续会被负载均衡取代，只做最小改动。）

## D1　`apiFetch` 升级　〔大旺，M0，2 天，依赖 ARC-00〕
范围：`lib/api-client.ts`：15 秒超时、AbortSignal、GET 才重试、`lib/client-id.ts` 生成请求编号、全局 401 事件、写操作支持幂等键选项；`app/workspace.tsx`、`lib/analytics.ts` 的裸 `fetch` 改用统一客户端。
验收：单元测试覆盖超时、重试、401、请求编号；仓库内无裸 `fetch('/api…')`。

## D4　按错误码显示多语言　〔大旺，M0–M1，2 天，依赖 ARC-00、D1〕
范围：`en/km/zh` 错误文案表（新文件，不改 `lib/i18n.tsx` 的巨型文件）；界面统一按 `code` 取文案；删除 `login.tsx` 里 `message.includes('请使用验证码或密码登录')` 的判断，改用 `ACCOUNT_ALREADY_REGISTERED`。
验收：缺文案的 code 导致测试失败；用户界面不再显示服务端中文 `error` 原文。

## D5　Flutter 对齐新错误体　〔大旺，M1，1 天，依赖 S2〕
范围：`mobile/lib/core/network/` 的错误映射增加 `INTERNAL_ERROR`、`VALIDATION_FAILED`、`ACCOUNT_ALREADY_REGISTERED`；`requestId` 展示；`flutter test` 全绿。

## D2　Flutter 持续集成　〔大旺，M0，1 天，依赖 R-01〕
范围：`.github/workflows/flutter.yml`：`flutter analyze`、`flutter test`。验收：PR 上自动运行。

## D3　拆分超大客户端文件　〔大旺，M1，3 天，依赖 D1〕
范围：把 `app/h5/login.tsx` 拆成无界面的会话/登录层（Telegram、验证码、密码）和界面；`app/kyc/client.tsx` 拆出共用逻辑，去掉 `mini` 布尔分叉；不改行为。
验收：现有测试全绿，新增会话层单元测试；单个文件 < 300 行。

---

## 依赖顺序
ARC-00 →（S2、D1）→（D4、D5）；R-01 → D2；S1 独立；S3、S4 独立。
第 1 周交付 ARC-00、R-01、S1、S2、D1；第 2 周交付 S3、S4、D4、D2；D3、D5 在 M1 早期。
