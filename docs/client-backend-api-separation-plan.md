# KhmerX 客户端 / 后端构建分离与 API 对接方案

版本：v1.0  
日期：2026-10-08  
适用范围：PayEase Mini App/H5、服务机构后台、持牌机构后台、Telegram 及第三方接口

## 1. 目标与结论

本次复核的目标不是改变现有业务规则，而是把前端交付物、后端 API、数据和第三方凭据的边界固定下来，支持独立构建、独立发布和独立回滚。

当前结论：

- 业务测试和构建基线正常，但当前仍是单体 Vinext 应用。
- 页面、API 路由、领域逻辑、D1/R2 访问和鉴权代码仍在同一源码/构建链路内。
- `npm run build` 会分别生成 client、RSC、SSR 产物，但部署时由同一个 `payease` 容器统一承载，不能视为客户端/后端已经分离。
- 客户端组件直接散落调用相对路径 `/api/...`，目前没有统一 API client、契约版本、请求 ID 和错误适配层。
- 当前优先方案是“先分离构建和部署，再分离源码边界”，保持现有页面和业务 API 兼容，避免一次性重写造成登录、KYC 和贷款流程中断。

## 2. 本次代码复核结果

### 2.1 已通过的基线

本地复核结果：

- 自动化测试：124 通过，1 跳过，0 失败（共 125 项）。
- 构建：通过，Vinext 完成 client/RSC/SSR/SSR route 构建。
- API 路由：36 个 `route.ts`。
- 错误响应：已有稳定 `code` 字段映射，客户端可按 code 本地化。
- 现有鉴权：客户会话、员工会话、Telegram initData 校验、公司/部门权限和持牌机构回调签名已有测试覆盖。
- KYC 文件：服务端扫描网关 fail-closed，客户端不应直接连接 ClamAV/R2。

### 2.2 必须在分离前处理的耦合

| 范围 | 当前状态 | 分离要求 |
|---|---|---|
| 客户端请求 | 各组件直接 `fetch('/api/...')` | 统一 `packages/api-client`，不再在页面内拼 URL |
| 错误处理 | 保留中文 `error`，部分组件直接展示 | 使用 `{ code, error, requestId }`，UI 按 code 翻译 |
| 客户鉴权 | Cookie + Telegram/H5 session | 抽象为 API Auth Adapter，客户端只持有会话，不接触数据库 |
| 员工鉴权 | 仍兼容 Gateway/SSO 与公司密码 | 生产后台以独立 staff session 为主，Gateway 仅作为兼容适配器 |
| 数据访问 | API 路由直接依赖 `lib/store`、D1/R2 | 只允许 API 服务访问 D1/R2；客户端构建禁止引用这些模块 |
| 文件上传 | 客户端直接 POST `/api/kyc/files` | 第一期保留兼容接口；第二期改为短期 upload token/预签名上传 |
| 第三方接口 | Google、Telegram、ClamAV 在服务端调用 | 凭据只在 API/worker 环境，前端环境变量不得含密钥 |
| 路由 | 页面和 API 同一域名同一应用 | 前端静态资源与 API 服务独立，外部仍可通过 `/api` 兼容代理 |
| 部署 | 单 `payease` 容器 | 拆为 `payease-client` 与 `payease-api` 两个可独立发布单元 |

## 3. 目标部署拓扑

```text
Telegram Mini App / H5
          │
          │ HTTPS
          ▼
  payease.khmerx.org       admin.khmerx.org
  客户端静态站点            后台静态站点
          │                  │
          └──────┬───────────┘
                 │ /api 兼容代理（推荐）
                 ▼
          api.khmerx.org / payease-api
                 │
      ┌──────────┼──────────┐
      ▼          ▼          ▼
     D1         R2       ClamAV/Google/Telegram
  业务数据库   文件对象    仅后端访问
                 │
                 ▼
        持牌机构回调 / 事件队列
```

域名职责：

- `payease.khmerx.org`：Mini App/H5 前端静态资源；短期保留 `/api` 反向代理。
- `admin.khmerx.org`：服务机构后台、持牌机构后台前端；短期保留 `/api` 反向代理。
- `api.khmerx.org`：后端 API 对外地址，作为后续独立客户端的正式入口；首次上线不要求客户端立即切换到跨域直连。
- 持牌机构后端：当前仍可部署在同一 VPS/数据库，但只能通过 API/回调边界访问；后续迁移到独立服务器时不改变客户端契约。

## 4. 推荐源码结构

第一阶段可以在现有仓库内渐进改造，不立即复制业务代码：

```text
apps/
  client/                 # Mini App/H5 与后台浏览器客户端
  api/                    # API Worker/服务入口，逐步承接 app/api
packages/
  api-contracts/          # 请求/响应 schema、错误码、分页、事件模型
  api-client/             # fetch、超时、重试、requestId、auth、错误映射
  domain/                 # 不依赖浏览器的贷款/KYC/资金/权限规则
  i18n/                   # zh/en/km 文案与错误码本地化
  security/               # CSRF、签名、nonce、审计上下文
  db/                     # 仅 api 使用的 D1/R2/迁移适配
```

硬边界：

- `apps/client` 不得导入 `db`、`lib/store`、`lib/kyc/server`、`cloudflare:workers`、ClamAV 客户端或任何服务端密钥。
- `apps/api` 不得依赖 React 页面、浏览器 `window`、localStorage 或 Telegram WebApp UI。
- `packages/domain` 只接收显式输入和依赖接口，不读取 Cookie、Request 或环境变量。
- 所有跨边界数据都通过 `packages/api-contracts` 定义。

## 5. API 对接方案

### 5.1 统一响应格式

成功：

```json
{
  "data": {},
  "requestId": "req_..."
}
```

失败：

```json
{
  "error": "legacy message",
  "code": "AUTH_REQUIRED",
  "requestId": "req_..."
}
```

约束：

- `code` 是稳定机器码，中文/英文/高棉语只放在客户端本地化表。
- 每个写操作接受或生成 `requestId`；资金、KYC、签约、审核、回调操作同时支持幂等键。
- 列表统一 `page/pageSize` 或 cursor、`total/nextCursor`、`filters`、`sort`。
- 失败响应不返回数据库堆栈、第三方 token、原始身份证资料或内部路径。

### 5.2 版本化 API 分组

第一阶段保留旧路径作为兼容层，内部映射到 v1 handler；新客户端只使用 `/v1`。

```text
/v1/auth/telegram              Telegram initData 登录
/v1/auth/h5                    H5 注册、OTP、密码登录
/v1/auth/session                当前会话、退出、失效

/v1/customer/me                 当前客户资料与公司上下文
/v1/customer/kyc                KYC 草稿/提交/补件/重提
/v1/customer/kyc/files          文件上传、状态、删除/清理
/v1/customer/loans              贷款申请、账单、还款状态
/v1/customer/loans/:id/sign     费用确认与签约
/v1/customer/locale             客户端语言设置

/v1/admin/workspace              今日概览、待办、风险资金、审计摘要
/v1/admin/customers              客户列表和 360 详情
/v1/admin/kyc/queue               KYC 队列、补件、审核决定
/v1/admin/loans                   申请、审批、放款、还款、贷后
/v1/admin/servicing               工单、通知、催收、补件任务
/v1/admin/products                产品、费率、费用、风控版本
/v1/admin/reports                 报表查询与脱敏导出
/v1/admin/organization            公司、部门、员工、角色、数据范围
/v1/admin/security                审计、登录 IP、权限变更、应急事件

/v1/institution/callbacks         持牌机构签名回调
/v1/telegram/webhook              Telegram 事件入口（如启用）
/v1/healthz                       进程存活
/v1/readyz                        数据库/扫描器/必要配置就绪
/v1/version                       构建版本、迁移版本、提交号
```

### 5.3 认证与跨域

推荐采用“外部同源代理、内部服务分离”：

1. `payease.khmerx.org/api/*` 和 `admin.khmerx.org/api/*` 由 Caddy/Nginx 反代到 `payease-api`。
2. 浏览器继续使用同源 Cookie，保持当前 `SameSite=Strict` 和 CSRF/Origin 防护，不在第一阶段开放宽泛 CORS。
3. `api.khmerx.org` 作为服务到服务和后续原生客户端入口，使用显式 bearer/session token、allowlist CORS 和 CSRF token。
4. 不允许 `Access-Control-Allow-Origin: *` 与 credentials 同时使用。
5. 如果未来必须跨域浏览器直连：只允许 `https://payease.khmerx.org`、`https://admin.khmerx.org` 等精确来源，设置 `Vary: Origin`、`Access-Control-Allow-Credentials: true`，并重新评估 Cookie Domain/SameSite；不能只删除 `sameOrigin` 校验。

身份适配器：

- 客户：Telegram initData → Telegram 用户身份；H5 OTP/密码 → customer session。
- 员工：公司代码 + 邮箱 + 密码/MFA → staff session；Gateway/SSO 只作为遗留兼容适配器。
- 持牌机构：机构 API key + HMAC timestamp/nonce/body 签名；禁止把机构密钥送到浏览器。

## 6. 文件、数据库和审计边界

- D1 迁移只由 API 发布流程执行，客户端发布绝不触碰数据库。
- R2 文件对象只由 API 或短期上传 token 访问；下载必须再次校验公司、客户、KYC 槽位和权限。
- ClamAV 只挂在内部网络，扫描失败继续 fail-closed；客户端只能看到 `FILE_SCAN_PENDING/REJECTED/READY` 等状态码。
- Google Geocoding、Telegram Bot/Gateway、持牌机构 callback 均由 API 调用，记录超时、重试、requestId 和审计事件。
- 审计记录 append-only；API 写入操作必须带 actor、company、role、requestId、object、before/after 摘要。
- 测试清理接口只能存在于受保护运维路由，不得进入公共客户端 bundle。

## 7. 分阶段实施

### 阶段 0：兼容基线（当前）

- 保持现有 `/api/*` 路径和页面可用。
- 新增 API 契约目录，先覆盖 auth、KYC、loan、team 四类高风险接口。
- 新增统一 `api-client`，逐个替换客户端中的直接 `fetch`。
- 对每个接口补充 `requestId`、错误码、超时、401/403/409 处理。

验收：现有 124/125 测试基线不下降；页面不再直接 import 服务端模块。

### 阶段 1：构建分离（推荐先上线）

- 生成独立 `client` 构建包：仅静态资源和客户端运行时。
- 生成独立 `api` 构建包：Worker/API handler、迁移、扫描器连接和服务端依赖。
- Docker 拆分 `payease-client` 与 `payease-api`；共享只读版本元数据，不共享运行时文件系统。
- Caddy/Nginx 路由 `/` 到 client，`/api/*` 到 api；保留旧域名兼容。

验收：两个镜像可分别构建、分别重启、分别回滚；client 容器无数据库密钥，api 容器不提供前端源码目录。

### 阶段 2：API v1 与契约测试

- 将旧 `/api/*` handler 映射到 `/v1/*`。
- 采用 schema 校验生成客户端类型和接口文档。
- 加入 contract test：auth、KYC 提交/补件/重提/通过、贷款签约、资金状态、后台权限、持牌机构回调。
- 在 CI 中固定 OpenAPI/schema 变更审核。

验收：前端只使用 `api-client`；旧路径和 v1 返回语义一致；错误码可在三语文案中完整映射。

### 阶段 3：独立发布与后续迁移

- client/API 使用独立版本号、部署记录和健康检查。
- API 数据库、R2、扫描器按后端权限最小化隔离。
- 持牌机构后台先保留同机部署，之后只迁移 API 服务和数据库，不修改客户端契约。
- 逐步把 API 迁移到独立服务器或 Cloudflare Worker/容器平台。

验收：能单独发布前端而不重启 API；能单独发布 API 而不重新构建前端；回滚任一侧不丢失会话、KYC 文件或审计记录。

## 8. 上线验收清单

### 构建与部署

- [ ] `build:client`、`build:api`、`build:all` 分别可重复执行。
- [ ] client 构建产物不包含 `.env`、数据库配置、Bot token、扫描器地址或服务端代码。
- [ ] api 构建产物包含迁移版本、健康检查和版本信息。
- [ ] client/API 可单独重启、扩容、回滚。

### API 与认证

- [ ] Telegram Mini App 登录、H5 登录、员工登录均通过 API 完成。
- [ ] 401/403/409/429/5xx 均带稳定 `code` 和 `requestId`。
- [ ] 同源代理下 Cookie、CSRF、Origin 防护保持有效。
- [ ] 跨域直连只使用明确 allowlist，不使用 `*`。
- [ ] 角色、公司、部门、持牌机构数据范围在 API 服务端再次校验。

### 业务闭环

- [ ] KYC：draft → submitted → supplement → resubmit → approved/rejected。
- [ ] 贷款：申请 → 费用确认 → 签约 → 审批 → 放款 → 账单 → 还款/结清。
- [ ] 后台：列表查询、新增、编辑、修改、导出、审计回读均能在同一 API 契约下完成。
- [ ] 文件：上传 → 扫描 → READY/REJECTED → 读取权限 → 清理，数据库和对象状态一致。
- [ ] 持牌机构：签名回调、幂等、过期、重放和失败重试均可审计。

### 生产验证

- [ ] `payease.khmerx.org`、`admin.khmerx.org`、`api.khmerx.org` 健康检查通过。
- [ ] API 版本、提交号、迁移版本可查询。
- [ ] 数据库写入后回读，刷新、重新登录、切换角色后状态一致。
- [ ] 只使用合成测试数据；真实生产客户、真实证件和资金不用于验收。
- [ ] 部署前备份 D1/R2 和外部配置，保留 API 与 client 独立回滚点。

## 9. 当前风险与处理顺序

1. **最高优先级：跨域鉴权误改。** 先采用同源 `/api` 反代，禁止直接放宽 CORS。
2. **高优先级：客户端直接 fetch 分散。** 先统一 API client，再迁移域名，避免错误处理和 token 逻辑分叉。
3. **高优先级：服务端模块被客户端引用。** 用构建检查阻止 `db/store/cloudflare` 进入 client bundle。
4. **中优先级：旧路径与 v1 并存。** 旧接口保留兼容期，完成回归后再下线。
5. **中优先级：持牌机构同机部署。** 先 API 隔离和签名边界，后续再做服务器迁移。

## 10. 本次结论

当前代码可继续运行和发布，但“前后端构建分离”尚未完成；已完成的是单体应用内部的多类构建产物生成。正式实施应按阶段 0 → 1 → 2 → 3 推进，先建立同源 API 兼容层和独立容器，再迁移源码和域名。这样可以在不破坏现有 Telegram 登录、KYC、贷款、后台权限和持牌机构回调的前提下完成真正的客户端/API 分离。

## 11. 评审修订与当前实施状态（2026-10-08）

根据评审意见，以下约束已加入实施基线：

- `api.khmerx.org` 在兼容期继续使用 Cookie + Origin，不改为强制 Bearer，也不新增 `/api/mobile/*`。
- 旧 `/api/*` 的成功响应形状保持不变；统一 `{data, requestId}` 只用于未来 `/v1`。
- 网关身份注入层暂不移除；API 独立后必须只在内部网络可达，并继续要求身份签名证明。
- 通过 `PAYEASE_ALLOWED_ORIGINS` 配置精确来源，不从内部 `request.url` 或不可信转发头推导来源。
- KYC 文件上传继续经 API 扫描、加密、配额和审计；暂不改为未经扫描的 R2 预签名直传。
- Flutter/Android 作为既有 API 消费者纳入契约测试，保持旧路径和响应形状。

本次已落地的阶段 0 代码：

- 新增 `lib/request-security.ts`，统一浏览器 API 的精确 Origin allowlist。
- `h5-auth` 与 KYC 写接口已使用统一来源策略，支持反向代理后的固定公网来源。
- 状态、Bot、客户标签、工单写接口已接入同一来源策略，并返回 `CROSS_SITE_REQUEST`。
- 新增浏览器安全的 `lib/api-client.ts`，统一 API base、credentials、`X-Request-Id` 和错误码解析；后续页面按业务域逐步迁移。

尚未完成的阶段 1 工作：拆分 client/API 构建与容器、独立网关单元、契约 fixtures、静态依赖边界检查和可逆迁移演练。完成前不切换生产域名或跨域直连。

## 12. 构建分离第一步（2026-10-09）

已新增 `npm run build:separated`，执行顺序为：

1. 客户端依赖边界检查。
2. 生成现有 Vinext client/RSC/SSR 构建。
3. 输出 `dist-separated/client` 和 `dist-separated/api` 两个独立工件目录。
4. 对工件执行敏感路径检查，不允许 `.env`、配置密钥、私有目录进入输出。

当前工件边界：

- `client`：只包含浏览器静态资源，当前由边缘容器优先服务静态文件，并将页面路由回源 API 的 SSR；通过同源 `/api` 代理对接后端。
- `api`：包含 Worker/SSR 服务端 bundle、迁移和独立部署所需文件；当前仍带有 SSR 路由，因此它是“API 可独立部署工件”，不是纯 API-only bundle。

这一步完成了构建和发布目录分离，但尚未切换线上代理，也未宣称完成最终的 `client-rendering service / api-only service` 源码拆分。当前客户端容器必须保留页面路由 SSR 回源；下一步需完成 SSR 客户端渲染 spike，并在独立网关后验证 Cookie、Origin、Android 兼容矩阵。

## 13. 客户端静态容器（2026-10-09）

已新增 `deploy/client/`：

- Caddy 只服务 `dist-separated/client`。
- `/api/*` 通过 `PAYEASE_API_UPSTREAM` 反向代理到现有网关/API。
- 客户端容器不挂载 `/data`，不接收数据库、R2、Telegram、KYC 或 ClamAV 凭据。
- 默认监听本机 `127.0.0.1:4310`，与现有 API `127.0.0.1:4300` 并行验证。

此容器尚未接入线上 Caddy/Nginx。切流前必须完成静态客户端对 Mini App、后台、文件下载和登录 Cookie 的 smoke test，并确认 API 网关仍剥离外来身份头并签发身份证明。

API 过渡容器另外提供 `/healthz`、`/readyz`、`/version`，编排使用 `/readyz`
检查数据库就绪状态；这些端点不替代业务接口鉴权，API 仍必须置于网关/反向代理之后。

## 14. API 独立容器（2026-10-09）

已新增 `deploy/api/`：

- 使用 `dist-separated/api/server` 作为服务端 bundle。
- 同时携带 `dist-separated/client`，保证当前 SSR/Worker 路由在过渡期仍可正确提供静态资源。
- 继续使用现有 `server.mjs` 网关逻辑，不绕过身份证明、Host 校验、Cookie 会话和扫描器。
- API 监听本机 `127.0.0.1:4320`，避免直接暴露公网；客户端容器通过反代访问。
- `/opt/payease/data` 和 `/opt/payease/clamav` 仍在镜像外持久化。

这仍是过渡期 API/SSR 工件，不是最终 API-only bundle；最终拆分前必须完成 SSR 客户端渲染 spike 与线上兼容验收。

## 15. VPS 预上线基线（2026-10-09）

已完成只读预检查：VPS Docker/Compose/Caddy 正常，当前 PayEase 仍由
`127.0.0.1:4300` 的旧 standalone 容器提供服务；OA 容器与扫描器仍在运行，
根分区使用约 81%。线上域名基线可访问：官网与后台登录返回 200，
`payease.khmerx.org/api/h5/auth` 返回 200。

新加入的 `/healthz`、`/readyz` 尚未部署到线上，因此线上访问仍返回 404；这证明
当前线上实例未切换到本轮 API 镜像。下一阶段应先在 VPS 备份 `/opt/payease/data`
与当前 Compose，再以本地构建的 API 镜像做旁路端口验收，确认健康检查、Cookie、
Origin、后台登录和 Mini App API 后再安排可回滚切换。

当前 Caddy 配置语法校验通过，80/443 正常监听，仍将业务域名反代到旧的 4300
端口；本轮没有修改 Caddy 或线上服务。

旁路部署使用 `deploy/separated/compose.yaml`：客户端只暴露 `4310`，API、扫描器
和 ClamAV 通过 `payease-separated` 内部网络互通，避免 Linux 上容器访问宿主机
`127.0.0.1:4300` 导致 502。旁路服务通过后才能切换 Caddy。

旁路首次启动还暴露出镜像架构要求：macOS 本机构建的默认镜像为 arm64，VPS 为
amd64；已改用 `docker buildx build --platform linux/amd64` 重新构建并加载到 VPS。
原 arm64 镜像未继续使用，失败容器已清理。

## 16. VPS 旁路验收（2026-10-09）

已完成备份并启动旁路实例：

- 生产数据备份保存在 VPS `/opt/payease/backups/separation-20261009024321/`。
- API 使用备份数据副本，监听 `127.0.0.1:4320`；客户端监听 `127.0.0.1:4310`。
- `/healthz`、`/readyz`、`/version` 均返回成功。
- 旁路 `/h5` 与 `/api/h5/auth` 返回 200。
- 客户端 Logo 静态资源返回 200，客户端 `/h5` 经内部 `api-separation:4300`
  回源返回 200。

旁路实例尚未接入 Caddy，现有 4300 生产容器和域名流量未改变。下一步应做登录、
Cookie/Origin、Mini App、KYC 合成文件扫描和回滚演练，全部通过后才允许切换。

旁路无状态 smoke test 已通过：客户端 `/h5`、后台 `/team/login`、客户端 API
代理和 `/api/h5/auth` 均返回 200；未登录状态接口返回 401；旁路版本接口返回
构建标识。未执行真实登录、KYC 写入、文件上传或任何资金操作。

旁路认证模式读取为 `telegram`，未登录错误保持旧字段 `error`，同时返回稳定
机器码 `AUTH_REQUIRED`；生产数据目录与 staging 数据副本分别约 7.4M/7.5M，
当前没有把旁路请求写入生产目录。

会话 smoke test 已确认响应使用 `HttpOnly; SameSite=Strict; Secure` 访客 Cookie，
并带 HSTS 与 `X-Content-Type-Options`。无 Telegram 身份时，允许来源与非法来源
均在登录前置检查处返回 `AUTH_REQUIRED`；真实 Telegram initData 验收仍需设备账号。
