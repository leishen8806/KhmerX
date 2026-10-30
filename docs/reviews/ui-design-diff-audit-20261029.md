# 代码 vs UI 设计差异审核（2026-10-29）

## 范围与证据边界

基线为 `origin/main` `0a87273`。本轮只读审核使用本地合成/空会话数据，不连接生产、不使用真实客户资料、不改产品代码。截图脚本为 `scripts/audit/ui-audit-round2.mjs`，每次导航等待 `networkidle` 后再额外等待 1 秒，并记录页面正文摘要；由于该工作树没有 Playwright 依赖，脚本已提交但本轮未能启动，因此既有 PNG 仅作为历史证据，不把加载态误报为完整流程覆盖。

## 总体结论与评分

|端|评分|依据|
|-|-|-|
|客户端 H5 / Mini App|3/5|路由和 KYC 页面存在，令牌与硬编码并存；375/768/1440 与多语言动态证据未完成。|
|后台 /team|3/5|主工作台和 KYC 入口存在，但 Operator Grid pageSize、焦点管理和状态筛选需浏览器证据。|
|旧三端|2/5|仍可访问，必须与主线隔离标注，存在术语漂移风险。|
|Flutter App|2/5|主题源码存在；无 Flutter SDK，启动/KYC/补件截图缺失。|
|官网|3/5|目录存在；多语言与主题视觉回归尚未运行。|

## 设计依据冲突

样式库 URL 在同一网络上下文重试仍为 `ERR_NAME_NOT_RESOLVED`（原始日志见 `style-library-error-20261029.txt`），因此本轮不声称取得外部样式库对照。README 中的 #1677FF/#172033/#667085、48px、16px 圆角作为待核对基线，偏离值见 `css-token-deviations-20261029.csv`。

## 前十问题（本轮可证实/可复核）

1. 全局色值未完全收敛为令牌（UI-001）。
2. 375px 固定底栏遮挡风险尚无截图证据（UI-002）。
3. /team 每页 6 条约束缺少动态确认（UI-003）。
4. KYC 材料查看器焦点、错误关联未完成 axe 证据（UI-004）。
5. Flutter 深浅主题与 reduce-motion 未在 SDK 机验证（UI-005）。
6. zh/en/km 截断与字体回退未完成（UI-006）。
7. 遗留端与主线术语/样式可能混评（UI-007）。
8. 样式库与仓库令牌的版本同步尚无自动检查。
9. 真实数据态（空、错误、补件、已提交）尚无可重复视觉夹具。
10. 视觉截图未纳入 CI 体积与命名校验。

## 整改卡

- UI-FIX-01（全局令牌）：收敛颜色、圆角、间距；涉及 `app/globals.css` 与主题；验收为无新增硬编码色值并通过 token 脚本；P1。
- UI-FIX-02（公共组件）：统一按钮、输入、标签、空/加载/错误态及焦点；涉及 H5/team 公共组件；验收为三宽度截图与 axe；P1。
- UI-FIX-03（客户端页面）：逐页覆盖登录、KYC、账单、合同和还款；验收为合成数据截图矩阵；P1。
- UI-FIX-04（后台页面）：验证 pageSize=6、筛选、分页、查看器；验收为 Operator Grid/Trust Surface 截图；P1。
- UI-FIX-05（App/官网/遗留）：SDK 机补 Flutter 与官网三语言主题证据，遗留端单独章节；验收为截图和术语表；P2。

## 交付限制

本轮不把历史加载态 PNG 解释为流程完成证据。产品源码未发现 `prefers-color-scheme`/主题切换实现，故深色模式按“产品未提供可验证支持”记录；删除了与浅色图字节重复的 `contract-375-dark.png`、`h5-375-dark.png`，避免重复证据。KYC、借款、账单、合同的合成数据全流程（含补件/已通过）仍列入未覆盖清单，不能以加载态替代。

## 第二轮真实页面截图

使用 `scripts/audit/ui-audit-round2.mjs`，对每个页面执行 `goto(..., waitUntil: 'networkidle')` 后再等待 1 秒，并写入 `round2-capture-results.json`。本轮新增/覆盖 15 张截图（H5 登录、首页、KYC、合同与官网，375/768/1440）。H5 各路由稳定显示“Your session has expired”，因此这是已加载完成的未登录态，不冒充已登录业务流程；官网三宽度均加载完成并记录了英文/高棉语主体文字。深色模式经源码和实际页面核对没有可验证样式支持，报告为产品不支持，不保留伪深色截图。375px zh/km 历史文件保留但未证明 locale 参数已真正切换完整业务主体文字，仍列入 UI-010 未覆盖。

## 第一轮返工证据（H5 / 官网）

本地 `vinext dev` 在 `http://localhost:5173` 启动，使用 Chromium headless 生成了以下截图（全部 PNG 小于 300KB）：

- H5 登录、首页、KYC、合同：各 375/768/1440px 浅色；375px 另有 `h5-375-zh.png`、`h5-375-km.png`；登录/首页/KYC/合同另有 375px 深色截图。
- 截图目录：`docs/reviews/ui-design-diff-20261029/`。
- 官网静态页未能由本地应用路由直接挂载；其源码已纳入 token/术语静态审计，动态截图列入未覆盖清单。
- 官网静态 `khmerx-website/index.html` 已通过 `file://` 本地只读方式生成 375/768/1440px 浅色截图，文件名为 `website-375-light.png`、`website-768-light.png`、`website-1440-light.png`。

具体观察：历史 375px KYC PNG 是英文加载/截断状态，不能支持“全流程无横向滚动”的强结论；1440px 图仅能支持静态视口存在。H5 登录页在源码中明确暴露“测试模式/模拟验证码”文案（`app/h5/login.tsx:61-66`），该文案不应出现在生产环境。375px zh/km 文件分别保留，但页面主体文字未达到完整语言切换验收，转入未覆盖清单。

## 令牌与术语证据

`scripts/audit/extract-css-tokens.mjs` 现在输出颜色（hex/rgb/hsl）、font-size、line-height、border-radius、margin/padding/gap、box-shadow 的取值、出现次数和最多 20 个文件:行位置；本轮输出保存在 `docs/reviews/ui-design-diff-20261029/css-token-inventory.json`。术语 grep 证据保存在 `docs/reviews/ui-design-terms-20261029.txt`，包含 KYC/身份资料/资料审核、贷款/借款及测试/模拟措辞的具体行号。

## axe 无障碍检查

已尝试使用 `TMPDIR=/private/tmp npx @axe-core/cli http://127.0.0.1:5173/h5`，在 axe 执行前因 ChromeDriver 152/Chrome 156 不匹配失败；原始错误保存在 `docs/reviews/ui-design-diff-20261029/axe-error-20261029.txt`。因此本轮没有 axe PASS、对比度或触控目标实测数值，必须在匹配浏览器环境补跑。

## 样式库对比

样式库地址 `https://ant.design/components/overview/` 在同一网络上下文重试：curl HTTP 000，Chromium 原文 `Page load failed: net::ERR_NAME_NOT_RESOLVED`。原始命令、时间和错误见 `style-library-error-20261029.txt`。按钮、输入框、卡片、底部导航、步骤条的并排差异列入 UI-013 未覆盖清单，不将不可达页面臆造为视觉规范。

## 全量门禁（`TMPDIR=/private/tmp`）

- `npm test`：496 tests，479 passed，0 failed（其余为 skip/todo）。
- `npm run typecheck`：通过。
- `npm run build:separated`：通过，`dist-separated` 生成且 `leaks: 0`。
- `npx eslint . --format compact`：当前 ESLint 未内置 compact formatter（命令返回 2）；改用 JSON formatter 完整扫描，结果为 780 files、42 errors、33425 warnings（既有基线与本轮文档脚本均未宣称 lint PASS）。
