# GL-1 本地运行时复验报告

基线：`6ae15944c066cb55f7ee8b8b7c2a0cba842825b3`。本卡仅做本机只读/测试证据采集；未访问 VPS、灰度域名、Telegram 或真实手机号。

## E1 全新状态与依赖

结果：**离线安装失败；获批后完成一次联网安装，但依赖门禁仍失败**。

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

npm ci   # only after explicit approval in the current conversation
added 681 packages, and audited 682 packages in 1m
27 vulnerabilities (1 low, 18 moderate, 8 high)
```

实际结果：本 worktree 没有 `.wrangler/state`。离线安装因本机 npm 缓存缺少 `zod-validation-error@4.0.2` 失败；经当前对话明确批准后，仅在本 worktree 执行一次联网 `npm ci`，安装成功但 npm 报告 27 个漏洞。

预期结果：离线安装成功后启动本地后端，并看到 `dev migrations applied: 63`。

处理：未执行 `npm audit fix`，未改 lockfile，未在其他目录安装依赖。由于卡片要求 `npm audit --omit=dev` 为 0，当前 E1 仍未通过。

## E2 审计 seq

结果：**未完成**。依赖已安装，但 `npm run build` 在 `check:client-boundary` 阶段因 Windows 双盘符路径失败，未生成 `dist/server`，因此无法启动本地服务、登录后台、运行 `audit-seq-verify.mjs` 或创建 v3 清单。

## E3 客户全流程

结果：**未完成**。因构建未生成本地 worker，未执行注册、KYC、机构回调、复核、签约、放款或还款流程。

## E4 D-42 门禁

结果：**未完成**。因本地 worker 无法构建，未生成三语言截图，未执行 H5 demo/负向验证码验证，未执行 Mini App initData 检查。

## E5 全量门禁

结果：**失败**。`npm test` 有失败项（包括审计 verifier 相关用例）；`npm run typecheck` 通过；`npm run lint` 退出码 0，但有 605 条既有 warning；`npm run check:client-boundary` 失败，复现 Windows 双盘符路径 `E:\E:\KhmerX\wt-GL-1\app`；`npm audit --omit=dev` 通过，输出 `found 0 vulnerabilities`。

## 其他准备文件

以下卡片点名文件已在 `6ae1594` 与本 worktree 中确认存在，并已在继续执行前完整读取：

- `docs/review/acceptance-20261103.md`
- `docs/review/acceptance-p2-20261105.md`
- `docs/review/client-auth-config-audit-20261105.md`
- `docs/review/institution-callback-wiring-20261106.md`

## 结论

GL-1 **未通过**：离线缓存缺包；获批联网安装后开发依赖审计报告 27 个漏洞，虽生产依赖审计为 0，但全量测试和客户端边界检查仍失败，构建/本地服务无法启动，因此没有产生运行时、浏览器、数据库或灰度证据。没有修改业务代码或配置。
