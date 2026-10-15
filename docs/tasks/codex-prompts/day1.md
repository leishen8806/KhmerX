# 第 1 天 Codex 提示词（B0、S2、D1、S3）

使用方法：每个提示词整段复制给对应的 Codex 会话；每个任务一个独立 `git worktree`。
前置：`docs/contracts/ARC-00-error-and-envelope.md` 已由技术负责人确认。

---

## B0　基线压测脚本　〔大旺的 Codex〕
```
【角色】你在 KhmerX 仓库（E:\KhmerX\KhmerX）里实现任务 B0，只在 scripts/loadtest/ 下新增文件。

【背景】我们要在 15 天内让申请主流程支撑 600 人并发。第一步是对当前系统做基线压测，找出第一个撑不住的环节。已知嫌疑：每个租户的贷款状态是一整块 JSON，每次写要整块读写并用 revision 乐观锁重试（lib/store.ts 的 mutate），读状态时还对每笔贷款各查一次库（hydratePublicRefs）。网关限流在 deploy/standalone/server.mjs。

【目标】产出可重复运行的压测脚本，模拟 N 个虚拟用户走完"登录 → 保存资料 → 上传文件 → 提交 → 轮询状态"，输出延迟、错误率和错误分布。

【允许修改】scripts/loadtest/**（新增）
【禁止修改】其余所有文件

【必须遵守】
- 先读：app/api/h5/auth/**、app/api/h5/state/route.ts、app/api/kyc/**、lib/store.ts、lib/h5-auth.ts、lib/h5-auth-core.ts、deploy/standalone/server.mjs，弄清真实请求序列（Origin、Content-Type、Cookie、x-telegram-init-data 或手机号验证码流程、演示模式验证码）。
- 使用 k6（优先）；脚本要能参数化虚拟用户数（100/300/600/1000）、持续时间、目标主机。
- 只针对本地或预发环境；脚本里加主机白名单保护，拒绝对 payease.khmerx.org / admin.khmerx.org / api.khmerx.org 生产域名运行。
- 测试数据全部虚构（手机号用 +1202555xxxx 段），不得出现真实资料。
- 输出：控制台摘要 + JSON 报告（p50/p95/p99、错误率、按状态码和 code 分类、上传成功率）。

【步骤】
1. 写 README（如何启动本地后端、如何运行、如何读报告）。
2. 实现登录与会话建立（注意 Cookie jar 与 Origin）。
3. 实现资料保存与文件上传（JPG 小图，≤200KB）、提交、状态轮询。
4. 加"阶梯加压"场景：100 → 300 → 600，每档 3 分钟。
5. 在本地后端实际跑一遍 50 用户，贴出报告。

【验收标准】
- 50 虚拟用户在本地能跑通完整流程并生成报告。
- 报告能区分 409 冲突、429 限流、5xx 和超时。
- 对生产域名运行会立即拒绝。

【自查命令】node scripts/loadtest 下的脚本自检；不要运行 npm test 以外的无关命令。

【交付】分支 feat/client/B0，PR 小于 400 行；PR 描述里贴 50 用户的报告和已知局限。遇到需求不明确，停下提问。
```

---

## S2　处理器包装与统一错误体　〔苏晨的 Codex〕
```
【角色】你在 KhmerX 仓库实现任务 S2。

【背景】审计发现：错误响应形状不一致；lib/h5-auth.ts 的 failure() 把所有非 AuthError 异常都变成 503"登录服务暂不可用"，业务错误被误报；app/api/state/route.ts 把 e.message 原样返回；requestId 不贯通（kyc/server.ts 的 traceId 与响应体 requestId 不同）。契约见 docs/contracts/ARC-00-error-and-envelope.md。

【目标】实现 ApiError 与 route() 处理器包装，并迁移五个路由，使其满足契约。

【允许修改】
- 新增 lib/http/（api-error.ts、request-id.ts、route.ts、index.ts）
- lib/h5-auth.ts（failure/json/input 改为委托新包装，保持对外导出名称不变）
- lib/kyc/server.ts（failed()）
- app/api/state/route.ts、app/api/bots/route.ts、app/api/h5/state/route.ts、app/api/team/products/route.ts、app/api/kyc/route.ts
- lib/error-codes.ts（新增 INTERNAL_ERROR、VALIDATION_FAILED、ACCOUNT_ALREADY_REGISTERED；codeForError 保留为兜底）
- tests/ 下新增 http-contract.test.mjs
【禁止修改】成功响应形状；业务规则；lib/store.ts；lib/domain.ts；其它路由（本任务只迁移上面五个）

【必须遵守】
- 先读 ARC-00 全文与 lib/h5-auth.ts、lib/kyc/server.ts、lib/error-codes.ts、五个路由文件。
- 未知异常：状态码 500、code INTERNAL_ERROR、响应里没有异常文本，完整堆栈和 requestId 只写服务端日志。
- 已知业务错误（权限、校验、冲突）不得返回 503。
- 响应头 X-Request-Id 与响应体 requestId 必须同一个值；客户端传来的合法 UUID 要沿用。
- 写接口的 Origin 一律强制（缺失即 403 CROSS_SITE_REQUEST）。
- 保持现有导出名称和调用方式向后兼容，避免一次改动所有调用点。
- 注册时账号已存在返回 409 ACCOUNT_ALREADY_REGISTERED（原先靠中文文案区分的那处）。

【步骤】
1. 实现 lib/http/*，并为 ApiError、requestId 解析、异常转换写单元测试。
2. 让 failure()/json()/failed() 委托到新实现。
3. 迁移五个路由到 route()。
4. 写契约测试：遍历这五个路由，断言失败体形状、状态码、requestId 一致、未知异常不泄露。

【验收标准】
- ARC-00 第 8 节 1–4 条对五个路由有测试且通过。
- 原有测试不下降（npm test 全绿）。
- 构造未知异常：状态 500，响应无异常文本，日志含堆栈。
- 构造业务校验错误（例如 /api/team/products 的权限错误）：不是 503。

【自查命令】npm test；npm run typecheck；npm run lint；npm run check:client-boundary

【交付】分支 feat/server/S2；PR 小于 400 行，超过则拆成"lib/http + 测试"和"路由迁移"两个 PR 并说明顺序；PR 描述写清没迁移的路由列表。需求不明确就停下提问。
```

---

## D1　apiFetch 升级　〔大旺的 Codex〕
```
【角色】你在 KhmerX 仓库实现任务 D1。

【背景】lib/api-client.ts 目前只有 31 行：加 x-request-id（用 crypto.randomUUID，非 HTTPS 会失败）、credentials:'include'、失败抛 ApiClientError，没有超时、重试、统一 401 处理。app/workspace.tsx 和 lib/analytics.ts 有裸 fetch。错误体契约见 docs/contracts/ARC-00-error-and-envelope.md。

【目标】升级 apiFetch，使所有客户端请求走统一入口并满足契约。

【允许修改】lib/api-client.ts、lib/client-id.ts、app/workspace.tsx、lib/analytics.ts、tests/ 下新增 api-client.test.mjs
【禁止修改】lib/i18n.tsx；服务端代码；其它页面

【必须遵守】
- 先读 ARC-00 §1、§5 与现有 lib/api-client.ts、lib/client-id.ts。
- 请求编号用 lib/client-id.ts 的实现，不得直接 crypto.randomUUID()。
- 默认 15 秒超时（AbortSignal），可按请求覆盖；只有 GET 可自动重试（最多 2 次，指数退避，仅对网络错误和 502/503/504）；写请求不得自动重试，除非传入幂等键。
- 写请求支持选项 idempotencyKey（头名 X-Idempotency-Key），同一次用户操作重试要复用同一个键。
- 401（code AUTH_REQUIRED）触发全局事件（例如 window 的 CustomEvent 'khmerx:auth-required'），不在库里写跳转逻辑。
- ApiClientError 保留 code、status、requestId，新增 params；Error.message 不再作为界面判断依据（保留兼容）。
- app/workspace.tsx 与 lib/analytics.ts 改用统一客户端；analytics 保持 fire-and-forget（keepalive，错误吞掉）。
- 保持现有调用点的函数签名向后兼容。

【步骤】
1. 重写 lib/api-client.ts 并写单元测试（超时、GET 重试、写请求不重试、幂等键复用、401 事件、请求编号）。
2. 替换两处裸 fetch。
3. 全仓搜索 fetch('/api，确认只剩 api-client.ts 内部。

【验收标准】
- 单元测试覆盖上面每一条行为并通过。
- 仓库内除 lib/api-client.ts 外无 fetch('/api…')。
- 旧调用点无需改动即可工作（npm test 全绿）。

【自查命令】npm test；npm run typecheck；npm run lint；npm run check:client-boundary

【交付】分支 feat/client/D1；PR 小于 400 行；描述里列出对外行为变化。需求不明确就停下提问。
```

---

## S3　安全收口　〔苏晨的 Codex，S2 合并后开始〕
```
【角色】你在 KhmerX 仓库实现任务 S3。

【背景】审计发现：员工写接口 /api/state、/api/bots、/api/team/customer-tags、/api/team/tickets 用 assertAllowedOrigin(...,false)，缺 Origin 头会放行；/api/h5/auth 的 GET 有写库副作用，缺 CF-Connecting-IP 时所有访客落入 'unknown' 共用限流桶；测试模式变量 KHMERX_TEST_MODE 一旦误开会同时关闭 MFA、双人审核和文件扫描，生产没有断言；lib/bot-credentials.ts 附近日志可能含 token。

【目标】收口以上四类问题，并各有测试。

【允许修改】app/api/state/route.ts、app/api/bots/route.ts、app/api/team/customer-tags/route.ts、app/api/team/tickets/route.ts、app/api/h5/auth/route.ts、lib/h5-auth.ts、lib/request-security.ts、lib/bot-credentials.ts、lib/kyc/server.ts、lib/team/server.ts（仅限测试模式读取处）、新增 lib/runtime-guards.ts、tests/ 新增 security-hardening.test.mjs
【禁止修改】成功响应形状；业务规则

【必须遵守】
- 先读以上文件和 deploy/standalone/server.mjs 里的 identity proof 与 KHMERX_TEST_MODE 处理。
- 写接口一律强制 Origin，缺失返回 403 CROSS_SITE_REQUEST（用 S2 的 ApiError）。
- /api/h5/auth：缺可信客户端 IP 时不得落入共用桶；拒绝或使用请求内唯一标识，并写明取舍。
- runtime-guards：集中读取测试模式；生产启动时若测试模式开启则抛错；让就绪检查能报告该状态。
- 复核 bot-credentials 日志：错误对象不得带含 token 的 URL，必要时脱敏。

【验收标准】
- 缺 Origin 的写请求在上述四个接口返回 403 CROSS_SITE_REQUEST（有测试）。
- 缺 IP 头的请求不会共享同一个限流桶（有测试）。
- 生产模式下测试模式开启会让启动失败（有测试）。
- 日志中不出现 token（有测试或断言）。

【自查命令】npm test；npm run typecheck；npm run lint；npm run check:client-boundary

【交付】分支 feat/server/S3；PR 小于 400 行。需求不明确就停下提问。
```
