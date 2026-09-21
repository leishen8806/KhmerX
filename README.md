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
