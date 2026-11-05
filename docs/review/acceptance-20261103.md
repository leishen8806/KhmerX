# 本地测试环境全面验收评审（D-41，第二轮）

日期：2026-11-05
基线：`987130e384f8abf6eafd8e29e238d0ce973997ef`（本地验收分支，源自 `origin/main` `8eeee227c1639b9b17fbb14bc3faac27d6685623`）
范围：仅本地 checkout、Miniflare/D1 和无头 Chromium；没有登录服务器、没有 `--remote`、没有部署、没有线上读写。

## 结论

结论：**No-Go（有条件 Go 的前置条件尚未满足）**。

第二轮已补齐本机 Playwright 1.55.0 + Chromium 140、重新拍摄 23 张截图、后台各菜单打开、持牌机构角色入口、响应错误/控制台采集、移动端横向溢出检查、计算样式检查，以及从 0062 之前版本升级到最新版本的虚构数据演练。仍有三个上线前阻塞：

1. 升级演练初始库在 0062 后需要显式回填历史 `seq`；并且浏览器流程产生的两条审计行仍为 NULL seq，最终只读 verifier 报 `seqNull=2`。这不是数据丢失，但清单进入人工复核状态，不能作为 VPS 灰度绿灯。
2. `npm audit --omit=dev` 的 high/critical 依赖风险仍未修复（仅记录，不在本任务修复）。
3. 仓库的 `DEFAULT_HOSTS` 没有 `licensed.khmerx.org`；只能在本地 `/team/login` 的“持牌机构后台”切换并用虚构 checker 账号验收，无法证明该域名部署入口。

## 验收矩阵

| 阶段 | 验收项 | 结果 | 证据 |
|---|---|---|---|
| 1 | test/typecheck/separated build/lint/diff | 通过（沿用本分支无源代码变化的门禁日志） | `/private/tmp/khmerx-acceptance-test.log`、`-build.log`、`-lint.log`、`-ui-tests.log`；原报告记录 525 tests：508 pass、0 fail、17 skipped，separated leaks=0，lint 0 errors |
| 1 | 依赖审计 | 不通过/需负责人接受 | 原报告的 `npm audit --omit=dev`：critical `next` 16.0.0–16.4.0；high `zod<4.6.6`、传递依赖 `undici` 7.0.0–7.30.0 |
| 2 | 全新库 0000–0062 | 通过 | `migrateDev` 应用到 0062；`pragma table_info(team_audit)` 出现 `seq`；无 migration 报错 |
| 2 | 升级路径与数据保留 | 有条件通过 | 0062 引入 commit `884aa368`，假设 pre-0062 为父提交 `20c2f8a`；迁移前后关键表：`h5_accounts=4`、`kyc_cases=3`、`loan_index=3`、`team_service_tickets=3`、`team_audit=4`；迁移后首轮回填 verifier：rows=8，seqNull=0、seqUnique=true、orderCheck=passed |
| 2 | v3 清单 create/verify | 通过（回填后） | API 返回 `version=3,status=v3`，verify `match=true,tampered=false,needsManualReview=false`；manifest id `a26961d7-79ed-4aca-bc9d-02000c01f5f6`，rows=8；`audit-seq-verify.mjs --backfill-max-seq 8` 全部通过 |
| 2 | 浏览器流程后的审计连续性 | 不通过/人工复核 | 后续本地浏览器访问新增审计行；只读 verifier `rows=10,seqNull=2,seqUnique=true,orderCheck=passed`，两条 NULL id 已记录在 `/private/tmp/khmerx-acceptance` 当次输出中 |
| 3 | H5 页面与三语言截图 | 部分通过 | Playwright 重新访问 `/h5`、`/h5/kyc`，en/km/zh，1280 与 375；页面可渲染，`/h5/loans` 在当前路由返回 404。三种 `lang` 查询截图哈希相同，说明本轮没有证明语言切换生效 |
| 3 | 登录/注册/KYC 六组/上传/补件/通过/借款/账单/合同/记录/我的完整流程 | 未覆盖 | 当前本地 seed 没有可直接驱动完整客户 UI 状态；本轮只用本地 demo API 完成短信 challenge/verify，返回脱敏 `+855 •••• 0001`，没有伪造 UI 通过结论 |
| 4 | `/team` 1280/390、各菜单 | 通过（页面可打开） | Playwright 截图：customers、reports、notifications、kyc、loans、funding、tickets、repayment、postloan；authenticated dashboard 使用虚构 checker 账号打开，见截图表 |
| 4 | MFA 页面 | 部分通过 | `/team/login` 可打开并有 MFA challenge 分支代码与截图入口；未配置 MFA secret 的本地虚构账号未执行真实 TOTP 循环 |
| 4 | 审计完整性 NULL seq 后人工复核 | 通过（风险可复现） | verifier 在 NULL seq 时报告 `seqNull=2`；API v3 清单在全量 seq 时返回 `match=true` |
| 5 | licensed 入口 | 未覆盖/阻塞 | 本地 `/team/login` 切换“持牌机构后台”，虚构 checker 账号密码登录 API 返回 200 并进入 dashboard；但 `deploy/standalone/hosts.mjs:3-7` 的 `DEFAULT_HOSTS` 没有 `licensed.khmerx.org`，无法验收该域名 |
| 6 | 未登录/客户身份后台 API | 部分通过 | 无身份 `GET /api/team` 返回 401；测试身份在 `KHMERX_TEST_MODE=true` 下可读到空公司列表（200），因此非测试模式拒绝未完成，不能把测试模式结果当生产安全证明 |
| 6 | 客户 H5 demo 认证与脱敏 | 通过（本地 demo） | `/api/h5/auth/send` 返回 `phoneMasked=+855 •••• 0001`、`demoCode=123456`；verify 返回 `authenticated=true`；未完成密码设置时 `/api/h5/state` 按预期拒绝继续申请 |
| 7 | 375/390 横向滚动与计算样式 | 通过（抽查） | Playwright：375 时 `scrollWidth=375,clientWidth=375`；390 时 `documentWidth=390,viewportWidth=390`；按钮计算样式：height/min-height 44px、padding-inline 12px、border-radius 8px、背景 `rgb(53,70,96)` |
| 7 | 控制台/网络错误 | 不通过 | `/private/tmp/acceptance-round2-browser-evidence.json`：控制台/响应错误 4xx/5xx 共 13/4；明确问题包括 `/h5/loans` 404、`/team/audit` 404（该路径不在 `crmQueueSections`）及若干本地 API 503/404 |

## 数据与迁移证据

0062 引入 commit 为 `884aa368f883512480d3335994019ce8a97e9c03`，其父提交 `20c2f8a73fc36e5fb1e6fc5c5cdf7dc6acfe3ba6` 作为“0062 之前”的可复现假设。旧工作树先迁移并写入虚构客户、KYC、贷款、工单和 4 条同毫秒 `created_at` 的审计数据，再复制本地 `.wrangler/state` 到最新工作树。最新迁移应用 0062 后，手工按 `created_at,id` 回填历史 seq；首轮完整数据验证通过，随后创建并校验 v3 manifest。

本地 demo API 还验证了手机号挑战：发送、验证码 `123456` 验证和会话建立均只在本地完成，未发送 Telegram。所有业务数据为 `acceptance` 虚构来源。浏览器访问后台后发现新增审计写入路径仍会产生 NULL seq，因此将该复现保留为上线前阻塞，而不是掩盖在最终回填里。

## 问题清单

### P1

- **P1-1：浏览器流程仍可产生 NULL seq。** 位置：`lib/team/auth.ts` 的登录审计路径与其他后台写入路径；复现：0062 后用本地 checker 登录、打开后台菜单，再运行 `node scripts/audit-seq-verify.mjs --db <sqlite> --backfill-max-seq 10`；结果 `rows=10,seqNull=2`。证据：审计 verifier 输出；升级成功截图和 `team-dashboard-authenticated-1280.png`。上 VPS 前必须修复或明确所有审计写入都经过 seq 分配。
- **P1-2：生产依赖 high/critical 未处理。** 位置：`package-lock.json` 对应 `next`/`zod`/`undici`；复现 `npm audit --omit=dev`。证据：原门禁日志。上 VPS 前由负责人接受风险或升级依赖并重跑门禁。

### P2

- **P2-1：全新 `.wrangler/state` 先 seed 会失败。** `scripts/dev-app-backend/start.mjs` 依赖 D1 sqlite 已物化；本轮先请求本地 worker 再迁移才成功。建议把物化前置写入启动脚本/README；本任务未修改代码。
- **P2-2：licensed 域名未在默认 host 映射。** `deploy/standalone/hosts.mjs:3-7` 无 `licensed.khmerx.org`。本地 portal 仅能证明 `/team/login` 的角色分支，不证明域名部署。
- **P2-3：当前浏览器轮有明确 404/503。** `/h5/loans` 没有允许的 `screen`，`app/h5/[screen]/page.tsx` 的允许列表不含 `loans`；`/team/audit` 不在 `lib/team/crm-menu.ts:1`。需决定这些是预期路由还是验收缺陷。

### P3

- **P3-1：三种 `lang` 查询参数截图像素哈希相同。** 本轮没有把语言切换误报为通过；需要通过真实语言选择器/状态参数重新验收漏翻与混用。
- **P3-2：完整客户业务流程未形成可重复的 UI fixture。** 当前仅完成本地 demo auth API，未伪造合同签署或审批通过截图。

未发现由本轮证据直接证明的 P0。

## 截图与 SHA256

以下全部是在本轮从 Playwright/Chromium 重新生成的文件，旧目录截图已删除：

| 文件 | SHA256 |
|---|---|
| `h5-home-1280-en.png` | `4ae5bcfdb40747682217120b5aa9ccd09fbfd6fc4c2227a04328ae4b98d51ca7` |
| `h5-home-1280-km.png` | `d9f5d9d7f428f12ab2901bdb674c352d38923c55d023349c8a627c865c468bf4` |
| `h5-home-1280-zh.png` | `d9f5d9d7f428f12ab2901bdb674c352d38923c55d023349c8a627c865c468bf4` |
| `h5-home-375-en.png` | `2dab6c2d94237278814151994fb8bd3022de407614f76caa51960bb15eb1279e` |
| `h5-home-375-km.png` | `2dab6c2d94237278814151994fb8bd3022de407614f76caa51960bb15eb1279e` |
| `h5-home-375-zh.png` | `2dab6c2d94237278814151994fb8bd3022de407614f76caa51960bb15eb1279e` |
| `h5-kyc-1280-en.png` | `d9f5d9d7f428f12ab2901bdb674c352d38923c55d023349c8a627c865c468bf4` |
| `h5-kyc-375-en.png` | `2dab6c2d94237278814151994fb8bd3022de407614f76caa51960bb15eb1279e` |
| `h5-loans-1280-en.png` | `7bb1036ef438e1301d5f623c184b68b4be4f35462b1e8db4d3a0f085f9f05455` |
| `team-login-1280-en.png` | `6625abe491b4299d3caff27dae0b1db6f563013bf3565a08f85dd4f62db0750c` |
| `team-login-lender-1280.png` | `f0954fb32d6265ad576ff2d7905b770b272a8f0b5ccab4b7290721defce31b54` |
| `team-dashboard-authenticated-1280.png` | `128d8843c44667dfae41eee587893bfbeb22e9b4ceb6a5633e0a521d6f35e9ea` |
| `team-dashboard-390.png` | `89f35960353170d41a13c2c39021a6d385ccbba7d302167414378018c11505ae` |
| `team-kyc-390.png` | `c9c8bdad0774acaf51f66271ea67eb6be2e3cb82d343911c3fc167434836cabc` |
| `team-customers-1280.png` | `999b41719bb428a4c75994e21decadadae890b84a27290b400bb26e4f03f4480` |
| `team-reports-1280.png` | `268ebe5c4e29bf9e81a12fe3ea55bf34ce4ca6f6e3d01d0f583c10488529d4bb` |
| `team-notifications-1280.png` | `0dfbdf901bd99dfd6508b4d64b2619251be0982301076fd00bcc191286441b92` |
| `team-kyc-1280.png` | `34b043726bb2c51db0bd2ea64d37b58576beb3e36234bda5d04f5975a7e4b73c` |
| `team-loans-1280.png` | `ae07cbf1c1ad7ecd9f753e3e27f68dc72c8987d0695f22f1c3de423847c72168` |
| `team-funding-1280.png` | `c50177d7a83c2d37a5f490469d84809eca763eecdd398181800d7ad344a8e5cd` |
| `team-tickets-1280.png` | `ed8dadf074d377842be8dd0d16e115cc998a4101671485d39235beb9ac287f1e` |
| `team-repayment-1280.png` | `2c15ffe9607d196998cb796b69d415b0945bc6bc0ccb6d9e5008db64e2329bc6` |
| `team-postloan-1280.png` | `340942a8afb774a461a9c7d5fa3134489dd66c6035fcc2c1dc8228c31d57ba6a` |

## 未覆盖与下一步

1. 修复所有审计写入路径的 seq 分配，重跑升级、浏览器、v3 manifest 和 verifier。
2. 处理或正式接受依赖审计 high/critical；不得以本地截图替代风险决定。
3. 明确 `licensed.khmerx.org` 的真实入口/配置后，在隔离本地 host 映射上复验；当前禁止登录或修改任何线上环境。
4. 为客户 KYC/补件/批准、借款、账单确认、合同签署建立一次性本地 fixture，重新做三语言 375/390 全流程；当前报告只把已观察到的页面和 API 证据写为部分通过。

基于以上 P1/P2 阻塞，本报告不解除 D-40 暂停，也不授权 VPS 灰度、部署或线上写操作。
