# H5 / Mini App / App 同公司绑定复核（2026-11-05）

## 结论

本次复核确认：正式公开 H5 的 `GET /api/h5/auth` 在没有有效 Telegram initData 的只读请求中返回 HTTP 200，但 `company:null`；灰度 H5 与灰度 API 返回 `company:"KhmerX Gray"`。这不是有效登录证明，而是公司 cookie/部署绑定缺失的可观测差异。修复以部署级 `customerCompanyId` 为权威，在 standalone gateway 注入并纠正 `payease_company`，Telegram Mini App 只验证绑定公司的 bot；多公司且无绑定时继续要求显式选公司，不默认第一家公司。

本任务没有登录、发送验证码、提交表单、数据库迁移、线上写入、服务器访问或部署。正式主机 `159.223.92.104` 和灰度主机 `159.223.77.134` 仅写入运行手册作为负责人批准后的核对边界。

## 只读证据

2026-11-05 10:42（Asia/Phnom_Penh）用 `curl` 对以下公开 GET 做了两种请求：无 initData，以及 `X-Telegram-Init-Data: x`（均不是有效 Telegram initData）。三者均 HTTP 200；没有使用账号或写接口。

| 地址 | `company` | 解释 |
| --- | --- | --- |
| `https://payease.khmerx.org/api/h5/auth` | `null` | 正式公开入口当前没有可解析的公司 cookie/部署绑定 |
| `https://testpayease.khmerx.org/api/h5/auth` | `KhmerX Gray` | 灰度入口已经有公司上下文 |
| `https://testapi.khmerx.org/api/h5/auth` | `KhmerX Gray` | 灰度 API 入口已经有公司上下文 |

响应状态为 200 只代表公开 GET 可达；不能据此推断认证成功或允许跨租户访问。

## 路径与当前解析顺序

### H5 Web

- `app/api/h5/auth/route.ts:8-11` 调用 `owner()`、`customerCompany()` 并将 `company?.name || null` 返回。没有客户 cookie 时，返回 null 是可见症状。
- `lib/h5-auth.ts:40-42` 的 `owner()` 先取 ChatGPT 身份，再从 `customerCompany()` 取租户；它不从客户端提交的任意公司 ID 建立授权。
- `lib/team/server.ts:13-17` 定义 `payease_company`，并通过请求 cookie 查找 active `team_companies`；无 cookie 返回 null，错误或停用公司拒绝。
- `app/api/team/route.ts:8-9` 是服务端按 slug 建立公司上下文的显式入口，不能被 H5 页面用任意 ID 替代。

### Telegram Mini App

- `app/h5/login.tsx:48` 从 Telegram initData 调用 `/api/h5/auth/telegram`，成功后才进入 workspace；失败停留在 Telegram 错误页。
- `app/api/h5/auth/telegram/route.ts:11-46` 读取 initData、请求 channel、公司 cookie 和 bot credential，调用 `loginTelegram`；原逻辑在没有选中公司时会扫描多个 channel/owner，存在部署未绑定时的解析分叉。
- 本修复在同文件增加 `PAYEASE_DEPLOYMENT_COMPANY_ID` 约束：候选 owner 只有绑定公司；cookie 指向其他公司或 bot 验证失败时返回统一 `CHANNEL_COMPANY_MISMATCH`，不回退到其他租户。
- `lib/bot-credentials.ts:14-25` 保持 bot credential 的公司/渠道隔离；本修复不修改 token、数据库或 bot 配置。

### Flutter App

- `mobile/lib/app/config/app_config.dart:17-34,84-87` 由构建参数选择 API base URL 和可选 `DEFAULT_COMPANY_ID`；默认地址必须由构建环境显式提供，不能把客户端值当作授权。
- `mobile/lib/features/company/domain/company_resolver.dart:64-160` 的顺序是 app link、持久化 active company、构建配置 default，并对候选进行 preflight；这允许多公司 App 保持显式选择。
- `mobile/lib/features/auth/data/auth_repository.dart:41-100` preflight 调用 `/api/h5/auth` 并保存返回的公司快照；当前 API 返回名称而非公司 ID，因此 App 不能单独用名称完成授权。
- `mobile/lib/core/network/interceptors/company_cookie_interceptor.dart:9-131` 对非公开请求把 cookie 纠正为当前 `companyId.raw`，`company_context_guard_interceptor.dart` 再做单公司保护。修复后的 gateway 也会在部署绑定时纠正 stale cookie，避免 Web/Mini App/App 入口分叉。

## 发散路径与根因

1. 配置 `companies: []`：gateway 没有可绑定 tenant，H5 会返回 null，Telegram 只能走无 owner/回退错误路径。
2. 配置有多家公司但没有 `customerCompanyId`：不能安全默认第一家公司；必须走服务端显式 slug 选择，否则不同客户端可能看到不同上下文。
3. 单家公司但旧配置没有显式字段：历史 standalone 仍可用 `companies[0]` 兼容解析；灰度 config check 现在要求显式 `customerCompanyId`，防止“后端有公司、部署没有绑定”的漂移。
4. `customerCompanyId` 不在 `companies`：启动配置无效，不能把 cookie 或 bot 绑定到未知租户。
5. 旧版/非 standalone gateway：可能没有注入 cookie 或没有把绑定传给 Workers，导致正式 H5 的 `company:null`。需按下方只读步骤核对运行版本与配置，不可直接改线上。
6. stale `payease_company`：若 gateway 只在缺失时补 cookie，旧公司 cookie 会继续影响 H5/Mini App；本修复在有部署绑定时删除所有旧 customer cookie 并写入唯一绑定值。
7. Telegram channel 与部署公司不一致：旧逻辑可扫描多个公司的 credentials；本修复只向绑定公司验证并统一报 `CHANNEL_COMPANY_MISMATCH`。
8. 客户把公司 ID 放进 App link/default：客户端解析仍须经过 preflight 和服务端公司/成员关系校验；客户端参数不是租户授权。

## 修复边界

- `deploy/standalone/company-config.mjs` 提供纯函数：单公司兼容 `companies[0]`，显式字段优先，多公司未绑定返回 null，显式绑定必须存在于 companies。
- `deploy/standalone/server.mjs` 在启动时验证绑定，将绑定传入 Workers binding；有绑定时重写上游 cookie，并对缺失/冲突 cookie 返回唯一 `payease_company` Set-Cookie。多公司无绑定不自动选择第一家公司。
- `app/api/h5/auth/telegram/route.ts` 只使用绑定公司作为 bot 验证候选，并在 cookie 或验证结果不匹配时返回 `CHANNEL_COMPANY_MISMATCH`。
- `deploy/standalone/gray/check-config.mjs` 对灰度要求单公司且显式绑定，仍只读、屏蔽 secrets、不写回配置；示例配置补充 `customerCompanyId`。
- 没有 drizzle、finance、loan、deployment 或服务器配置变更。

## 验证与负责人核对步骤（不代替批准）

负责人在批准的环境中应先确认：

1. `/data/config.json` 的 `customerCompanyId` 与唯一 `companies[0].id` 完全相同，bot token 属于同一公司；灰度先运行 `node deploy/standalone/gray/check-config.mjs /data/config.json`。
2. 运行版本包含 `PAYEASE_DEPLOYMENT_COMPANY_ID` 注入和 `CHANNEL_COMPANY_MISMATCH` 逻辑；不要只看 HTTP 200。
3. 分别在正式 `159.223.92.104` 与灰度 `159.223.77.134` 的批准窗口内，从对应域名只读 GET `/api/h5/auth`，确认 `company` 为预期名称；本任务不 SSH、不登录、不执行写命令。
4. 在隔离测试中用绑定公司 bot 的有效 initData 验证成功，用另一公司 bot 验证 403 + `CHANNEL_COMPANY_MISMATCH`；再用旧公司 cookie 验证 cookie 被替换为绑定公司。

## 本地门禁

- `npm ci`：完成。
- `node --check deploy/standalone/server.mjs`：通过。
- `node --experimental-vm-modules --test tests/h5-company-binding.test.mjs`：通过。
- `npm run typecheck`：通过。
- `npm run lint`：退出码 0；仓库既有 606 warnings、0 errors（本修复没有新增 lint error）。
- `npm test` 的完整执行需在 CI/本地正式门禁阶段复核；本轮筛选测试中唯一失败是既有 Docker Desktop 无法启动导致的 `gray-config.test.mjs` bootstrap fixture，非代码断言失败。

## 未执行事项

- 未登录、未发送 OTP、未提交 Telegram initData、未写数据库或线上业务。
- 未访问两台主机、未部署、未重启服务、未修改 DNS/Cloudflare、未合并 PR。
- 代码改动包含 `app/api/**` 与 `deploy/**`，PR 必须由负责人按仓库合并规则审批；本任务只允许提交 PR，不允许自行合并。
