# 公司渠道关联配置标准化计划

## 目标与不变项

将 Telegram Mini App、H5、App 的“公司归属、认证方式、主机/机器人绑定、语言与注册步骤”从分散配置收敛到公司级渠道记录。解析结果必须唯一且一致；任何密钥仍只允许进入现有加密凭据/运行时环境；本计划不修改资金、放款或还款规则。单公司部署继续保留现有兜底行为，但多公司必须按请求渠道解析，冲突返回 `CHANNEL_COMPANY_MISMATCH`。

## 现状映射

| 现状 | 新标准字段/处理 |
| --- | --- |
| `team_companies.id/name/slug/active` | `company_channels.tenant_id` 外键、`label`/入口 `entry_slug`、启停状态的公司上界；现有 `client_zh_enabled/client_en_enabled/client_km_enabled` 迁移为渠道 `languages`/`default_language` 默认值。 |
| `telegram_bot_credentials.owner/bot_id/telegram_id/username/label/token_encrypted` | Telegram 专属 `bot_telegram_id`、`bot_username`、展示 label 和 token 配置状态；`token_encrypted` 不复制、不解密、不回显，仍由现有 `bot-credentials` 读写。 |
| `lib/store.ts` 的 Bot 记录与 `phoneVerification/passwordSetup` | `company_channels.phone_verification/password_setup`；H5/App 强制 true，Telegram 迁移现值。 |
| `deploy/standalone/hosts.mjs` 和 `server.mjs:215` | `company_channels` 的 H5 `hosts`/`allowed_origins` 为未来主解析源；server:215 的单公司注入 cookie 保留为单公司兼容兜底，不能作为多公司解析。 |
| `mobile/lib/core/session/company_cookie_store.dart`、`WhitelistCookieJar`、`company_cookie_interceptor.dart` | Cookie jar 的公司隔离机制保留；App 渠道新增 `api_base_url`、`cookie_hosts`、平台/版本元数据，由公司渠道配置下发/构造，不再把 host 列表写死在客户端。 |
| H5 auth 的 `PAYEASE_H5_AUTH_MODE`、`PAYEASE_DEMO_OTP_ALLOWED` | 渠道只读显示运行时认证状态；demo 仅允许 local/gray 且由环境变量控制，后台不可修改；正式环境禁止 demo。 |
| `publicIdentifier`/loan `sourceChannel` (`TG/H5/AP/...`) | `company_channels.source_channel` 与借款来源一致；解析时记录 channel id/type，不改既有财务状态机。 |

## 数据模型与迁移

新增 `company_channels`（PR-a）字段：`id`、`tenant_id`、`type`、`label`、`enabled`、`auth_mode`、`phone_verification`、`password_setup`、`languages_json`、`default_language`、`source_channel`、`hosts_json`、`allowed_origins_json`、`entry_slug`、OTP 参数、App 平台/包标识/API host/cookie hosts/版本下载字段、Telegram bot 标识/mini app/webhook 非密文元数据、`notifications_enabled`、`updated_by/updated_at`。Webhook secret 不落明文；若未来实现配置写入，沿用现有加密 secret storage。

约束：`(tenant_id,id)` 唯一；启用 H5/App 主机与 allowed origin 全局唯一；Telegram username/telegram id 全局唯一；`type` 与 `source_channel` 有限枚举；H5/App 的 `phone_verification=1`；`auth_mode=demo` 仅 local/gray 运行时可生效。所有 JSON 在服务端以 schema 校验，避免把自由文本当作 host 或 secret。

回填：每个 active `team_companies` 至少产生一个 H5 渠道（id `h5-<slug>`，hosts 由 standalone config/hostRules 显式映射；若无显式 host 则保留空值并标记未完成，不能猜测）；每个启用 Bot 产生 Telegram 渠道元数据，凭据表只作为关联来源；App 渠道仅当已有明确网络配置时回填，否则不造假记录。语言从公司三列 flags 回填。迁移脚本必须幂等、可重复执行，并写 `team_audit` 的系统回填事件。

回滚：PR-a 只新增表和索引，不删除旧字段/旧凭据；回滚通过停止新读路径并删除未被业务引用的 `company_channels` 行（保留审计）或恢复到旧分支，禁止回滚旧数据表和凭据。上线前导出新表计数/hash，回滚验收要求旧 H5/Telegram 路径仍可用。

## 接口与解析

- `GET /api/h5/auth` 增加 `channelType`、`channelId`，不返回任何密钥；单公司 fallback 只在没有显式 channel mapping 时使用。
- 新读层提供 `resolveCompanyChannel({host, origin, apiHost, cookieCompany, telegramBotId})`；H5 按 host，Telegram 按经过 initData 验签的 bot，App 按 API host + 唯一公司 cookie。零或多结果均返回明确错误，跨来源得到不同公司返回 `CHANNEL_COMPANY_MISMATCH`。
- 新写接口先只读展示；若实现写入，必须 MFA、租户管理员权限、二人复核（停用当前唯一渠道/auth_mode 变化）和 `auditInsertSql`，响应只展示 token configured/末四位，不回显 token/secret。

## 后台页面

新增“渠道配置”页：公司分组显示三类渠道的 enabled、auth mode、绑定 host/bot、语言、Token configured。运行时只读项（环境、demo 开关、扫描器状态）单独标注“由部署配置控制”。第一版先做只读并覆盖空/重复绑定告警；写操作在 MFA/双人复核 API 具备并测试后再开放。

## 测试与门禁

1. 迁移：全量 `standalone_migrations` 到最新、空库/重复执行、回填计数/hash、外键和唯一索引、回滚旧路径。
2. 解析：H5 host、Telegram bot、App api host+cookie 的单公司、多公司、未绑定、双绑定、cookie mismatch，均验证错误码和不泄漏密钥。
3. 安全：demo 正式环境拒绝、H5/App 强制 phone verification、token 不出 API/日志、MFA/二人复核/审计 guard。
4. UI：后台只读矩阵和空状态；Flutter 多公司 cookie 隔离、动态 host allow-list、版本升级提示。
5. 门禁：`TMPDIR=/private/tmp npm test`、typecheck、`TMPDIR=/private/tmp npm run build:separated`、lint，以及 Flutter `flutter test`/analyze（环境可用时）；每个 PR 只保留自己的范围并检查相对 `origin/main` diff。

## PR 拆分（每个约 400 行以内）

- **PR-a `[needs-owner-approval]`**：仅 drizzle 迁移、回填 SQL/临时检查脚本、迁移测试；负责人批准前不合并。
- **PR-b**：服务端只读 schema/解析层、`CHANNEL_COMPANY_MISMATCH`、H5 auth 字段、单元/集成测试；不改资金状态机。
- **PR-c**：后台渠道配置只读页面、权限矩阵、脱敏展示和页面测试；写接口留在后续。
- **PR-d**：check-config 与 standalone 启动自检，覆盖重复 host/bot、环境 auth_mode、缺字段；更新灰度验收证据。
- **PR-e**：Flutter 网络配置/CompanyCookieStore 从公司渠道读取 `cookie_hosts/api_base_url`，保留每公司隔离与 fail-closed；等待 Flutter CI 通过。

依赖顺序为 PR-a → PR-b → PR-c/PR-d → PR-e。所有 PR 开发分支独立、普通提交推送、不合并；迁移 PR 由负责人决定是否合并。
