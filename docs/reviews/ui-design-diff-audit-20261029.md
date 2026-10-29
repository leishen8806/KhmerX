# 代码 vs UI 设计差异审核（2026-10-29）

## 范围与证据边界

基线为 `origin/main` `0a87273`。样式库 URL 在本轮可访问（HTTP 200），但未将线上样式库内容复制进仓库；未连接生产，未使用真实客户资料。由于本机没有 Flutter SDK/可用浏览器启动数据，本报告把截图和动态 axe 结果标记为未覆盖，不用推测替代证据。

## 总体结论与评分

|端|评分|依据|
|-|-|-|
|客户端 H5 / Mini App|3/5|路由和 KYC 页面存在，令牌与硬编码并存；375/768/1440 与多语言动态证据未完成。|
|后台 /team|3/5|主工作台和 KYC 入口存在，但 Operator Grid pageSize、焦点管理和状态筛选需浏览器证据。|
|旧三端|2/5|仍可访问，必须与主线隔离标注，存在术语漂移风险。|
|Flutter App|2/5|主题源码存在；无 Flutter SDK，启动/KYC/补件截图缺失。|
|官网|3/5|目录存在；多语言与主题视觉回归尚未运行。|

## 设计依据冲突

未发现可由静态仓库证据确认的硬冲突。样式库 v1 优先级最高；README 与 `docs/crm-*` 对后台布局的 page size/菜单细节可能随版本演进，需在动态复核时记录最终采用出处。

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

本轮未提交截图：本机缺少可用 Flutter SDK，且未启动带合成数据的浏览器环境；因此动态布局、主题、多语言、axe 均明确标为未覆盖。整改卡仅在本报告附录，不改产品代码。

## 第一轮返工证据（H5 / 官网）

本地 `vinext dev` 在 `http://localhost:5173` 启动，使用 Chromium headless 生成了以下截图（全部 PNG 小于 300KB）：

- H5 登录、首页、KYC、合同：各 375/768/1440px 浅色；375px 另有 `h5-375-zh.png`、`h5-375-km.png`；登录/首页/KYC/合同另有 375px 深色截图。
- 截图目录：`docs/reviews/ui-design-diff-20261029/`。
- 官网静态页未能由本地应用路由直接挂载；其源码已纳入 token/术语静态审计，动态截图列入未覆盖清单。
- 官网静态 `khmerx-website/index.html` 已通过 `file://` 本地只读方式生成 375/768/1440px 浅色截图，文件名为 `website-375-light.png`、`website-768-light.png`、`website-1440-light.png`。

具体观察：375px KYC 页面仍保留固定头部与底部导航间距，未见横向滚动；1440px 页面内容区保持居中并留出宽边距。H5 登录页在源码中明确暴露“测试模式/模拟验证码”文案（`app/h5/login.tsx:61-66`），该文案不应出现在生产环境。

## 令牌与术语证据

`scripts/audit/extract-css-tokens.mjs` 现在输出颜色（hex/rgb/hsl）、font-size、line-height、border-radius、margin/padding/gap、box-shadow 的取值、出现次数和最多 20 个文件:行位置；本轮输出保存在 `docs/reviews/ui-design-diff-20261029/css-token-inventory.json`。术语 grep 证据保存在 `docs/reviews/ui-design-terms-20261029.txt`，包含 KYC/身份资料/资料审核、贷款/借款及测试/模拟措辞的具体行号。

## axe 无障碍检查

已尝试使用 `npx @axe-core/cli http://localhost:5173/h5`。工具实际失败，原文为：`This version of ChromeDriver only supports Chrome version 152. Current browser version is 156.0.8078.48`。因此 axe 结果仍标记未覆盖，未伪造通过结论；后续应使用匹配 ChromeDriver 在 CI/SDK 机补跑。

## 样式库对比

样式库地址在 `curl`/Chromium 环境中实际不可用：curl 返回 HTTP 000，Chromium 原文为 `Page load failed: net::ERR_NAME_NOT_RESOLVED`。因此无法取得样式库组件截图；按钮、输入框、卡片、底部导航、步骤条的并排差异已明确列入未覆盖清单，不将不可达页面臆造为视觉规范。

## 全量门禁（`TMPDIR=/private/tmp`）

- `npm test`：496 tests，479 passed，0 failed（其余为 skip/todo）。
- `npm run typecheck`：通过。
- `npm run build:separated`：通过，`dist-separated` 生成且 `leaks: 0`。
- `npx eslint . --format compact`：执行完成；输出仅为现有运行时日志，无 lint error 汇总。
