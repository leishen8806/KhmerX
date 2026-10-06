# KhmerX 三语文案审计与补齐清单

审计日期：2026-10-03  
范围：官网、Telegram Mini App、H5、KYC、借款签约、账单、管理后台、通知和服务端错误消息。

## 结论

- 当前扫描到 **62 个代码文件、584 行含中文文本**。该数字包含重复文案、代码注释和服务端错误消息，不等于 584 个独立翻译条目。扫描脚本为 `scripts/audit-i18n.mjs`，可用 `node scripts/audit-i18n.mjs --lines` 输出明细。
- 官网 `khmerx-website` 的页面文案基本为英文，未发现需要保留在页面上的中文文案；语言按钮仍显示三语名称，这是语言切换控件，不属于正文翻译缺失。
- Mini App 公共导航、语言选择和通知模板已有英文/高棉语/中文基础资源，但业务页仍存在大量中文硬编码。
- 管理后台已经有公共语言切换入口，但各业务面板、表格列、弹窗、审核说明和错误提示尚未全部接入资源。
- 借款协议目前只有中文源文件 `lib/agreements/loan-terms-zh.json`，英文和高棉语版本尚未形成同结构、可审计的正式版本。这是上线前最高优先级缺口。

## 按页面/模块的检查结果

| 区域 | 主要文件 | 当前状态 | 需要补齐 |
|---|---|---|---|
| 官网 | `khmerx-website/index.html`、`news/*.html`、`about.html`、`help.html`、`security.html` | 英文正文为主，页面可用 | 校对英文 SEO/GEO、确认高棉语页面的标题/描述/导航一致性 |
| Mini App 外壳 | `lib/i18n.tsx`、`components/mini-shell.tsx` | 公共导航、语言开关、基础状态已接入 | 把业务组件中的中文字符串全部替换为 key，并接入语言回退 |
| 首页/用户旅程 | `components/customer-journey.tsx`、`components/mini-client.tsx` | 流程提示、状态、步骤和还款提示仍有中文硬编码 | 英文/高棉语/中文三套资源；状态值也要统一翻译 |
| KYC | `app/kyc/client.tsx`、`components/kyc-orders.tsx` | 表单标签、校验、上传、签名、审核提示仍有大量中文 | 字段标签、必填提示、文件错误、审核状态、人工修改说明全部资源化 |
| 借款签约 | `app/loan/sign/client.tsx`、`app/agreements/loan/page.tsx`、`lib/loan-signing.ts` | 界面和协议说明主要为中文 | 建立同版本 EN/KM 协议，显示语言、版本号、签署快照和审计记录 |
| 账单/还款 | `components/loan-bill.tsx`、`components/repayment-panel.tsx` | 账单字段、金额说明、还款结果仍有中文 | 金额/日期/逾期/结清等字段资源化，避免服务端直接返回中文展示 |
| 通知 | `components/telegram-notifications.tsx`、`lib/notifications/core.ts` | Telegram 逾期提醒已有三语模板；通知管理界面仍有中文 | 补齐注册、KYC、放款、还款、催收等模板的三语版本和后台预览 |
| 管理后台 | `app/team/client.tsx`、`app/team/login/client.tsx`、`components/postloan-panel.tsx`、`components/funding-panel.tsx`、`components/servicing-config.tsx`、`components/business-bots.tsx` | 公共切换已接入，业务面板仍以中文为主 | 菜单、按钮、表格、审核、权限、审计、错误和空状态全部接入 admin 资源 |
| 服务端消息 | `lib/store.ts`、`lib/kyc/server.ts`、`lib/team/server.ts`、`lib/bot-credentials.ts` | 部分错误/校验消息直接写中文 | API 返回稳定 error code，前端按 locale 映射；禁止把中文作为跨端协议字段 |
| H5 登录 | `app/h5/login.tsx`、`app/api/h5/*` | 登录流程可用，需复核手机号、Telegram 验证提示 | 三语发送验证码、失败、过期、重试和成功文案 |

## 翻译资源规则

1. 所有用户可见文案使用稳定 key，不在组件中直接写中文、英文或高棉语。
2. 资源按 `en`、`km`、`zh` 三个 locale 保持同一 key 集合；缺失 key 在构建审计中失败。
3. 服务端只返回 `errorCode`、字段名和参数，不返回用于展示的自然语言；客户端按当前语言显示。
4. 协议、费用、逾期和风控结果必须保存 `locale`、`templateVersion`、渲染快照，不能因为后来切换语言而改变已签署内容。
5. 正式部署可以关闭中文，但不能删除中文资源；关闭由后台客户端语言开关控制，已选择中文的用户要安全回退到英文。

## 开发顺序

### P0（上线前）

- 借款协议 EN/KM 正式版本及版本审计。
- KYC 表单、上传、签名和审核结果三语。
- Mini App 首页、申请贷款、费用确认、放款、还款、失败/补件提示三语。
- 服务端错误码和前端 locale 映射。

### P1

- 管理后台所有业务面板和审核弹窗三语。
- Telegram 注册、KYC、放款、还款、催收通知模板三语回归。
- 补充缺失 key 的 CI 审计脚本，并将其纳入构建检查。

### P2

- 官网英文 SEO/GEO 和高棉语 SEO 文案逐页校对。
- 三语术语表、金融/法律词汇审阅和本地化人工复核。

## 验收清单

- 每个页面分别以 `en`、`km`、`zh` 首次进入、刷新、退出再进入。
- 关闭中文后，所有中文入口隐藏，已有中文用户自动回退英文且不丢失业务数据。
- KYC、签约、还款、通知和后台审核各跑通一条成功、一条校验失败、一条服务端错误路径。
- Telegram 通知按用户 locale 发送，后台可以预览三语模板。
- 运行文案扫描：除协议源文件、术语表和开发注释外，生产展示代码不得出现未登记的中文硬编码。

## 2026-10-06 本轮更新

- Mini App 的 KYC、客户旅程、审核队列、补件、代修改、文件上传、授权、审核决定和状态提示已补入 `lib/i18n.tsx` 的 English / Khmer / 中文资源映射；字段选项中的中英高棉组合文本也会按当前语言拆分显示。
- 本轮继续补齐 KYC 订单队列、跟进状态、审核校验、联系人完整性、地址/地图、材料上传、合同签名与服务端常见错误提示的三语展示映射，并覆盖动态联系人编号、资料版本和更新时间文本。
- KYC 页面仍保留中文源字段和服务端错误作为业务协议/回退源，页面展示由稳定映射转换；正式发布关闭中文时不删除中文资源。
- 本地合成测试新增并通过：`draft → submit → needs_info → reviewer amend → customer resubmit → approved`，同时覆盖文件隔离、版本冲突、重复审核和拒绝分支。
- 本轮构建与校验：`npx tsc --noEmit`、`npm run build`、`node --test tests/kyc.test.mjs`、`KYC_TEST_URL=http://localhost:5173 KYC_TEST_PHONE_A=+12025550192 KYC_TEST_PHONE_B=+12025550193 node --test tests/kyc-local.test.mjs` 均通过。

### 尚未声称完成的范围

- 管理后台的全部业务字段仍有部分历史中文硬编码，需继续把 `AdminLocaleShell` 的资源从导航扩展到每个业务面板。
- 借款协议正式英文/高棉语版本和服务端错误码化仍需单独完成，不能把本轮 KYC 页面映射视为法律文本翻译完成。
