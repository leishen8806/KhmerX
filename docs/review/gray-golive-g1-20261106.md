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

结果：**部分完成，运行时证据仍不足**。

续跑记录：按要求在同一 worktree 执行了索引清理/恢复；`drizzle/0062_audit_manifest_v3_seq.sql` 与 `lib/i18n.tsx` 的 CRLF 检查均为 0，恢复后 Git 状态干净。Windows 客户端边界检查仍因已知 GL-5 双盘符路径缺陷失败；未修改脚本，记录 Claude Linux 侧既有 PASS（126 files）。改用 `node scripts/run-framework.mjs build` 后本地构建成功。

续跑 3：只改名了该 worktree 的 `.wrangler/state`，未删除仓库文件；按卡片环境变量启动本地服务，确认 `dev migrations applied: 63`。使用站点账号登录后台成功并访问今日概览；密码登录的 checker/lender 虚构账号仍返回请求未完成，未以此绕过权限。设置 `APP_BACKEND_PORT=8092` 后 `kyc-smoke.mjs +12025550130` 成功：发送/验证演示验证码、KYC 读取、4 个虚构文件上传、保存、过期 revision 拒绝、提交、提交后锁定均通过。`KHMERX_TEST_MODE=true` 仅作为本地脚本回放环境变量，使 `kyc-review.mjs approved` 成功，状态从 submitted 变为 approved。通过后台审计 API 创建 v3 清单并验证，返回 `match=true`、`tampered=false`、`needsManualReview=false`、`appendOnly=true`；仅在本地浏览器会话中执行。

最新只读 verifier：`version v3`、`rows 4`、`seqNull count 0`、`seqUnique true`。这证明本地合成写入的审计行满足 seq 检查，不证明灰度或生产状态。服务随后已停止。

## E3 客户全流程

结果：**部分完成**。本地合成客户 KYC 申请→提交→approved 已完成；机构回调签名批准、checker 复核、签约、测试放款、还款未完成。密码登录 checker/lender 被本地接口拒绝，未伪造或绕过机构权限；未访问远端环境。

## E4 D-42 门禁

结果：**未完成**。未生成三语言截图，未完成 H5 负向验证码（`123456` 必须被拒绝）验证，未执行 Mini App initData 检查；本地 KYC smoke 使用的是开发演示验证码流程，不能替代该负向门禁。

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

## 续跑 4（2026-11-06）

### 登录诊断

- 启动命令按 `scripts/dev-app-backend/README.md` 执行，代理端口为 `8092`，Miniflare 为 `8794`；日志显示 `dev migrations applied: 0`，未达到卡片要求的 63。
- `checker@example.test`（持牌机构后台）通过浏览器提交后，`POST /api/team/auth` 返回 **200**，随后进入 `/team`；服务日志记录 `POST /api/team/auth 200 OK`。
- `lender@example.test` 使用同样流程只提交一次，`POST /api/team/auth` 返回 **403**；页面显示“你没有权限执行此操作”。按卡片规则不再重试。未记录密码或 Cookie。

### E3 替代证据

由于 lender 登录失败，浏览器贷款全流程未执行。按卡片要求运行 `node --test tests/team-integration.test.mjs` 作为 API 级替代，但测试在加载阶段失败：`TypeError: vm.SyntheticModule is not a constructor`（Node.js v25.9.0）。因此 E3 结论为 **失败**，没有可用的 API 级替代证据；不把它写成浏览器流程通过。

### E4 门禁

- 375px 三语言截图：**失败**。`h5-language-switch.mjs` 所需 Playwright 浏览器可执行文件不存在；按本地冻结未执行 `npx playwright install`，因此没有生成截图或 SHA-256。
- Demo 正向：引用续跑 3 的 `kyc-smoke.mjs +12025550130` 记录，演示验证码流程已通过；这是本地 harness 证据，不是灰度证据。
- H5 负向与 Mini App initData：运行 `node --test tests/h5-auth.test.mjs`，26/26 通过。覆盖用例包括：`challenge and session expiry and auth mode changes fail closed`、`provider failures never fall back to demo, enumerate phones or produce sessions`、`Telegram initData replay key is stable across ordering and hash casing variants`、`Telegram login hides verifier details behind a stable error code`、`provider code invalid and mismatched request IDs fail closed`。运行时负向验证留到灰度冒烟。

### E5 分类结论

- **已通过**：checker 本地登录（HTTP 200）；H5 认证静态/集成单测 26/26；续跑 3 已记录的本地 `seqNull=0` 与 v3 清单匹配。
- **API 级替代**：本次未产生（team-integration 在 Node 25 加载阶段失败）。
- **留到灰度冒烟**：真实运行时的负向验证码、Mini App initData、三语言截图/设备显示、机构回调后的完整贷款链路。
- **失败**：lender 登录 HTTP 403；启动日志迁移计数为 0 而非 63；375px 截图因缺少 Playwright 浏览器未执行。
