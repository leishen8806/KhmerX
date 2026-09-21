# KhmerX / PayEase 测试资金闭环
本项目从零实现三个可运行界面：`/mini` 客户端、`/ops` 业务后台、`/lender` 机构后台。根页面可切换演示角色。
## 已实现
- 注册 → KYC → 业务审核 → 机构审批 → 费用确认与测试签名 → 测试放款 → 提现 → 部分／全额还款 → 结清。
- 退回补件、拒绝申请、0/3/4/16 天逾期情景及补缴。
- 默认两个、最多十个 Telegram 渠道，独立名称／用户名／启用配置、凭据连接检查及服务端 initData 签名验证。
- D1 持久化、按登录账号隔离测试数据、乐观并发控制、请求幂等、审计事件、合同快照、测试资金分录、模拟通知。
## 测试与真实接入的界限
此交付是**测试资金闭环与交互原型代码**。三个角色由同一登录用户切换，未实施不同员工账号及机构租户的生产权限。KYC 使用合成资料；签名为输入测试姓名；支付、提现、还款、通知均为模拟执行，不调用真实资金或短信服务。逾期为手动情景，不是生产定时贷后引擎。
机器人 token 尚未提供。用户名配置不代表 Telegram 连接成功；`/api/bots` 通过 getMe 验证所选机器人的服务端凭据，传入 initData 时验证签名与五分钟有效期，但不创建独立 Telegram 登录会话。当前站点使用 Sites/ChatGPT 登录，不是对社会用户开放的 Telegram 正式运营入口。真实 BotFather 菜单、消息发送及 Telegram 内端到端接入仍需机器人凭据和对应发布范围。
## 环境与运行
Node 22.13+（测试使用 Node 24），npm，Cloudflare Workers / D1，Vinext + React。
```sh
npm ci
npm run dev
```
便携本地预览的登录入口为 `/signin-with-chatgpt?return_to=/`，仅本地模拟账号；该模拟认证不会进入生产构建。
```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_faulty_leader.sql
node --test tests/domain.test.mjs
```
本地迁移只执行一次。正式迁移由 Sites 部署应用。生产必须通过 Sites 身份代理访问，不能把信任平台身份头的应用直接暴露为无代理的独立 Worker。
## Telegram 配置
复制 `.env.example` 为本地 `.env`。正式配置通过部署平台的 secret 管理，不能放在前端、源码或 hosting.json。
默认槽位：`TELEGRAM_BOT_TOKEN_1`、`TELEGRAM_BOT_TOKEN_2`。新增第 N 个渠道时使用 `TELEGRAM_BOT_TOKEN_N`（最多 10）。
在业务后台配置真实用户名后点击“验证连接”。未配置 token 时返回未连接；配置不匹配不会通过。
官方参考：https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
## 数据与并发
`demo_workspaces` 按平台用户 ID 保存测试聚合状态，revision 条件更新防止并发覆盖。每次业务请求带唯一 requestId，重复请求直接返回已持久化状态。状态机阻止重复放款、未签约放款、越序审核和超额还款。金额使用整数美分。
此聚合模型用于最多 100 笔测试申请；生产应拆分账户、合同、支付、分录、审计和通知表，实施独立角色权限与机构隔离。
## 验收操作
1. Mini App：填写虚构姓名和额度，选机器人，授权并完成注册。
2. Mini App：确认合成 KYC 并提交。
3. 业务运营：选择申请，审核通过，或退回补件。
4. Mini App：点击申请贷款。
5. 持牌机构：批准，或记录原因后拒绝。
6. Mini App：查看费用，输入测试签名，确认协议。
7. 持牌机构：授权测试放款。
8. Mini App：测试提现，输入部分还款金额或留空全额还款。
9. 业务运营：查看账务与操作记录；还款前可切换逾期情景，再由客户端补缴。
## 构建与部署
`.openai/hosting.json` 已绑定本项目 Site ID，请勿重复创建站点。发布应推送准确源代码版本、打包 dist 并保存／部署对应版本。发布后需核对终态成功。


## 样式库改版（2026-09-21）
参考用户指定的 KhmerX × PayEase 样式库 v1：
https://payease-style.khmerx.org/?release=6b87e79958fd

三端共用 #1677FF 品牌色、#172033 正文、#667085 辅助文字、48px 输入和主按钮、16px 卡片圆角。客户端采用 Calm Flow 申请卡、步骤与手机底部导航；运营端采用 Operator Grid 待办、搜索、状态筛选和每页 6 条记录；机构端采用 Trust Surface 深色导航、事实摘要与申请审计。支持浅深色切换及减少动态效果偏好。仅主题偏好保存在设备，业务资料继续使用已有后端。

审批、拒绝、测试放款、提现及还款增加确认窗口，展示申请编号、状态、金额和角色，成功状态仍以原有服务端响应为准。确认窗口不代表已实现 Maker / Checker；现有单账号角色演示边界保持不变。

本轮是既有测试版的界面与交互改造，不宣称已实现样式库里的全部扩展能力：三语、真实 Telegram 会话、真实 KYC 上传、独立机构授权、双人复核和真实受控资金域仍未接通。搜索和分页仅针对当前最多 100 笔合成测试记录在客户端展示。

## H5 手机号与验证码登录（2026-09-21）
入口：`/h5`，现有三端工作台右上角也提供链接。当前发布的是 `PAYEASE_AUTH_MODE=demo`，只接受 `+12025550100` 至 `+12025550199` 的虚构号码。页面显示随机测试验证码，不向 Telegram 发送消息。

服务端实现 Telegram Gateway `sendVerificationMessage`（由 Telegram 生成 6 位码）和 `checkVerificationStatus`（仅 `code_valid` 登录成功）。Gateway Token 与 BotFather 机器人 Token 不通用。未实现短信回退；真实发送失败不会切换成模拟成功。真实发送需手机号用户明确同意，且号码已注册 Telegram。

- 每个验证码 5 分钟有效、最多 5 次尝试、一次性消费；挑战绑定私有工作区与发起浏览器。
- 重发间隔 60 秒，每个号码每小时 5 次；每浏览器每小时 10 次、每工作区每小时 30 次发送请求上限。校验每浏览器每 10 分钟最多 30 次。
- 客户会话 24 小时有效；随机会话凭据仅放 HttpOnly / SameSite=Strict Cookie，HTTPS 下启用 Secure。数据库仅保存会话摘要，退出立即撤销。
- 手机号只瞬时用于 Gateway 请求；存储加密密钥派生的标识及掩码，不存明文手机号；模拟 OTP 只存摘要，真实 OTP 交由 Telegram 校验。不得记录请求体、Token 或 OTP。
- `/api/h5/state` 只投影当前手机号的申请，禁止调用运营／机构动作；申请保存到原工作区，运营与机构可沿原流程处理。会话本身不授权 `/api/state` 或 `/api/bots`。
- 当前站点仍保留 Sites 所有者访问与 ChatGPT 身份门禁。此功能是私有测试空间内的手机号客户会话，尚不等于面向公众、无需 ChatGPT 的独立客户站点。对外开放需要另行设计管理员身份和客户入口，不能直接把当前三端演示站点设为公开。

### 开通真实发送时的配置
在 Telegram Gateway 官方后台开户并取得 API Token 后，在站点的服务器环境中安全设置 `TELEGRAM_GATEWAY_TOKEN`（secret）及 `PAYEASE_AUTH_MODE=telegram`，然后重新部署。保留已配置的 `PAYEASE_AUTH_SECRET`，不要随意更换；更换会改变手机号对应的客户标识，需另行安排记录迁移和会话撤销。真实模式与模拟模式身份隔离，不会把模拟手机号当作已真实验证号码。
不要把 Token 放到页面、聊天、代码仓库或客户端配置中；不要自动发送真实号码做验收。当前尚未做真实 Telegram 投递验证。

官方资料：
- https://core.telegram.org/gateway
- https://core.telegram.org/gateway/api
- https://core.telegram.org/gateway/verification-tutorial

本地检查：原 9 组业务测试加 H5 认证／隔离测试；`tests/h5-integration-local.py` 验证接口会话、拒绝跨站操作、验证码防重放、客户隔离及退出。集成脚本使用预留测试手机号和本地 Sites 测试身份。数据库增量迁移：`drizzle/0001_real_legion.sql`。
