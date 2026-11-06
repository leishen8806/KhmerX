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

结果：**部分完成，运行时证据不足**。

续跑记录：按要求在同一 worktree 执行了索引清理/恢复；`drizzle/0062_audit_manifest_v3_seq.sql` 与 `lib/i18n.tsx` 的 CRLF 检查均为 0，恢复后 Git 状态干净。Windows 客户端边界检查仍因已知 GL-5 双盘符路径缺陷失败；未修改脚本，记录 Claude Linux 侧既有 PASS（126 files）。改用 `node scripts/run-framework.mjs build` 后本地构建成功。

本地服务曾以虚构环境变量启动，完成 63 条开发迁移并播种公开 workspace；数据库文件为本地 `.wrangler/state/.../faaf2b0445ab934c3aac48ddf0cdfade8f9bac050be98993748742cdd2cb05fb.sqlite`。只读 verifier 输出 `version v3`、`rows 0`、`seqNull count 0`、`seqUnique true`，但这是空数据库，不能证明真实业务写入。浏览器使用虚构 checker 账号尝试登录，分别返回“你没有权限执行此操作”/“请求未完成，请重试”，未能进入后台或创建清单。`kyc-smoke.mjs` 随后因其默认连接 `127.0.0.1:80` 而本地服务在 8092，失败：`fetch failed ... ECONNREFUSED 127.0.0.1:80`。因此没有客户流程或 KYC 写入证据。

## E3 客户全流程

结果：**未完成**。后台登录被本地权限/路由阻断，未执行注册、KYC、机构回调、复核、签约、放款或还款流程；未访问远端环境。

## E4 D-42 门禁

结果：**未完成**。未生成三语言截图，未执行 H5 demo/负向验证码验证，未执行 Mini App initData 检查。

## E5 全量门禁

结果：**失败**。`npm test`：551 项，527 通过、5 失败、19 跳过；失败均在 `tests/audit-seq-verify.test.mjs`（verifier 基线、backfill、NULL/duplicate、NULL id limit、remote/production 参数检查）。`npm run typecheck` 通过；`npm run lint` 退出码 0，但有 605 条既有 warning；`npm run check:client-boundary` 失败，复现 Windows 双盘符路径 `E:\E:\KhmerX\wt-GL-1\app`；`node scripts/run-framework.mjs build` 通过；`npm audit --omit=dev` 通过，输出 `found 0 vulnerabilities`。开发依赖的 27 个漏洞仅记录，未修复。

## 其他准备文件

以下卡片点名文件已在 `6ae1594` 与本 worktree 中确认存在，并已在继续执行前完整读取：

- `docs/review/acceptance-20261103.md`
- `docs/review/acceptance-p2-20261105.md`
- `docs/review/client-auth-config-audit-20261105.md`
- `docs/review/institution-callback-wiring-20261106.md`

## 结论

GL-1 **未通过**：离线缓存缺包；获批联网安装后开发依赖审计报告 27 个漏洞，虽生产依赖审计为 0，但全量测试和客户端边界检查仍失败，构建/本地服务无法启动，因此没有产生运行时、浏览器、数据库或灰度证据。没有修改业务代码或配置。
