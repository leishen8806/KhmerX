# GL-1 本地运行时复验报告

基线：`6ae15944c066cb55f7ee8b8b7c2a0cba842825b3`。本卡仅做本机只读/测试证据采集；未访问 VPS、灰度域名、Telegram 或真实手机号。

## E1 全新状态与离线依赖

结果：**失败，按任务卡要求停止本卡**。

执行摘要：

```text
git rev-parse HEAD
6ae15944c066cb55f7ee8b8b7c2a0cba842825b3

Test-Path .wrangler/state
False

npm ci --offline
npm error code ENOTCACHED
npm error request to https://registry.npmjs.org/zod-validation-error/-/zod-validation-error-4.0.2.tgz failed:
cache mode is 'only-if-cached' but no cached response is available.
```

实际结果：本 worktree 没有 `.wrangler/state`，但离线安装因本机 npm 缓存缺少 `zod-validation-error@4.0.2` 失败。

预期结果：离线安装成功后启动本地后端，并看到 `dev migrations applied: 63`。

处理：未联网重试、未复用其他版本 `node_modules`、未启动服务。若要继续，需要技术负责人在当前对话中明确批准一次联网 `npm ci`；本报告本身不构成批准。

## E2 审计 seq

结果：**未完成**。因 E1 离线安装失败，按卡片规则停止；未启动本地服务，未登录后台，未运行 `audit-seq-verify.mjs`，未创建 v3 清单。

## E3 客户全流程

结果：**未完成**。未启动本地服务，未执行注册、KYC、机构回调、复核、签约、放款或还款流程。

## E4 D-42 门禁

结果：**未完成**。未生成三语言截图，未执行 H5 demo/负向验证码验证，未执行 Mini App initData 检查。

## E5 全量门禁

结果：**未完成**。因 E1 停止，未运行 `npm test`、`npm run typecheck`、`npm run lint`、`npm run check:client-boundary` 或 `npm audit --omit=dev`。

## 其他准备文件

以下卡片点名文件在 `origin/main`/本 worktree 中未找到，未擅自从其他分支补取：

- `docs/review/acceptance-20261103.md`
- `docs/review/acceptance-p2-20261105.md`
- `docs/review/client-auth-config-audit-20261105.md`
- `docs/review/institution-callback-wiring-20261106.md`

## 结论

GL-1 **未通过**：阻塞点是本机离线 npm 缓存不完整。没有产生运行时、浏览器、数据库或灰度证据；没有修改业务代码或配置。
