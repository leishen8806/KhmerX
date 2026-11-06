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

## UI 设计（静态原型，#186）

静态原型位于 `docs/design/channel-config/`，通过 `?screen=<name>&locale=zh|en|km` 选择页面和语言；数据全部为虚构值，不调用 API、不写入本地或远端状态。视觉变量和布局沿用 `app/globals.css` 的 `:root`、`.shell`、`.top`、`.panel`、`.pill`、`.error`、`.success` 语言。截图证据位于 `docs/review/assets/channel-config-ui/`。运行范围仅是本地 standalone/dev harness；VPS 与正式环境步骤暂缓，等本地验收和负责人评估后再执行。

### 后台页面、字段映射与权限

| 原型 screen | 用途 | 关键字段（对应数据字段） | 权限与安全边界 |
| --- | --- | --- | --- |
| `list` 渠道列表 | 按公司分组查看 Telegram Mini App、H5、App 的绑定状态 | `tenant_id`、`type`、`label`、`enabled`、`auth_mode`、`source_channel`、`hosts_json`/bot 标识、`languages_json`、`default_language`、Token `configured/last4`、`updated_by/updated_at` | `admin` 查看全部；`checker`/`finance_checker` 只读机构摘要和审批状态；`finance`/`lender` 按既有入口矩阵只看业务摘要；`audit` 只读审计摘要；不显示 token 原文 |
| `detail-telegram` Telegram 详情/编辑 | 展示 Bot、Mini App 和 webhook 元数据，预览可编辑草稿 | `tenant_id`、`type=telegram`、`bot_telegram_id`、`bot_username`、`mini_app_url`、`webhook` 非密文元数据、`auth_mode`、`languages_json`、`default_language`、`notifications_enabled`、Token 状态 | `admin` 可看并提交草稿；`checker`/`finance_checker` 可读；Token 仅 configured/末四位；替换 Token 要 MFA；停用或 auth mode 变化要二人复核 |
| `detail-h5` H5 详情/编辑 | 检查 host/origin、手机号认证和语言 | `hosts_json`、`allowed_origins_json`、`entry_slug`、`auth_mode`、`phone_verification`、`password_setup`、`languages_json`、`default_language`、`enabled`、`notifications_enabled` | `admin` 可读写草稿；`phone_verification`、`PAYEASE_ENV`、Demo OTP 为环境/策略只读；`checker`/`finance_checker` 只读；host 冲突 fail-closed |
| `detail-app` App 详情/编辑 | 检查 API、Cookie allow-list 和版本升级策略 | `api_base_url`、`cookie_hosts`、平台/包标识、`min_supported_version`、下载 URL、`hosts_json`、`auth_mode`、`phone_verification`、`password_setup`、`enabled` | `admin` 可读写草稿；客户端仅消费已发布配置；环境字段只读；`finance`/`lender` 不见配置入口 |
| `add` 新增流程 | 选择类型、填参数、校验、保存；展示 host/bot 冲突 | 新记录的 `tenant_id`、`type`、`label`、`entry_slug`、`hosts_json`/Bot ID、`allowed_origins_json`、`source_channel`、认证和语言字段 | 仅 `admin` 可发起；保存前 schema/唯一性校验；冲突不得覆盖，迁移走审批；最终发布仍需 MFA/审计 |
| `review` 双人复核 | 停用渠道或修改认证方式的发起、待复核、批准/驳回 | `enabled`、`auth_mode`、变更前后脱敏 diff、`updated_by`、`updated_at`、复核人和请求号 | 发起人不能批准自己的变更；另一位授权 `admin`/指定 reviewer 才能批准；MFA、`team_audit`、拒绝原因必填 |
| `selfcheck` E4 自检 | 检查公司绑定、host/bot 唯一性、环境、Token 脱敏、语言 | 读取 `tenant_id`、`hosts_json`、`allowed_origins_json`、Telegram 标识、`auth_mode`、`languages_json`；只展示规则结果 | `admin` 可运行/查看；其他有入口的角色只读结果；不代替部署启动门禁，失败不隐藏具体规则但不泄露密钥 |
| `audit` 审计记录 | 按公司/动作过滤并查看前后 diff | `tenant_id`、`updated_by`、`updated_at`、动作、请求号、字段 before/after；Token/secret 脱敏 | `audit` 和 `admin` 只读；审计不可编辑/删除；不得在日志或 diff 中写入 secret |
| `roles` / `forbidden` | 展示角色可见性矩阵和无权限空状态 | `portalAllows` 角色映射、公司范围；无权限页不渲染 `hosts_json`、Bot、Token | 权限在服务端和页面双重 fail-closed；无权限用户只看到可解释提示，不可通过 URL 猜测敏感字段 |

### 客户端入口、状态与数据来源

| 原型 screen | 入口/状态与字段 | 解析与权限约束 |
| --- | --- | --- |
| `client-h5-*` | H5 手机号、验证码、默认 OTP 提示、错误（错误/过期、频率限制）、停用 | 由 host/origin 解析 `company_channels` 的 `tenant_id`、`hosts_json`、`allowed_origins_json`、`phone_verification`、`default_language`；错误只显示可行动文案，不泄露公司或密钥；Demo OTP 仅 local/gray |
| `client-mini-loading` / `success` / `mismatch` | Telegram 自动登录、成功公司身份、跨公司 mismatch（`CHANNEL_COMPANY_MISMATCH`） | 先验签 initData，再按 `bot_telegram_id`/`bot_username` 与 `tenant_id` 解析；成功页全程保持同一公司身份，mismatch fail-closed |
| `client-app-default` / `upgrade` / `offline` | App 登录、最低版本升级提示、API 不可用重试 | 由 `api_base_url`、`cookie_hosts`、版本/下载字段构造请求；沿用 `CompanyCookieStore` 隔离，跨公司 Cookie 不复用；升级/接口不可用不改变资金状态 |
| `client-h5-disabled` / `client-maintenance` | 渠道停用和维护页 | `enabled=false` 或运行时维护状态只显示统一停用/维护文案；不渲染 host、Bot、Token；登录态和公司身份不跨租户迁移 |

客户端三种语言（中文/English/ខ្មែរ）均使用渠道的 `languages_json`/`default_language`，缺失语言按既定 fallback；原型的所有显示值为虚构值。

### 待 Claude/负责人决定的问题

1. `finance`/`lender` 是否应在后台看到“渠道配置”入口，还是继续只保留 checker/finance_checker 的机构摘要矩阵？
2. host/bot 冲突的最终归属、迁移审批责任人和历史数据回填规则是什么？
3. MFA 强度、双人复核 reviewer 角色、SLA、超时/撤回/紧急停用流程是否需要单独策略？
4. E4 自检失败的严重级别、阻断发布规则和 `api_base_url`/Gray 配置的 owner 是谁？
5. App 各平台的最低版本、下载 URL、强制升级时间窗是否已有 owner 和正式清单？
6. 客户端语言缺失时的 fallback 顺序，以及 Telegram/H5/App 的维护文案是否统一？
7. UI 评审通过后，PR-c 是否只做只读页，还是同时开放已具备 MFA/二人复核门禁的草稿写入？

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
