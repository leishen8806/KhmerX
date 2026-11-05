# 本地测试环境全面验收评审（D-41，第三轮）

日期：2026-11-05
基线：`123680b`（本地验收分支，已合入最新 `origin/main`；仅保留本轮验收文档和截图）
范围：仅本地 checkout、Miniflare/D1 和无头 Chromium；没有登录服务器、没有 `--remote`、没有部署、没有线上读写。

## 结论

结论：**有条件 Go（不解除 VPS 灰度/部署门禁）**。

第三轮在最新 main 上完成了门禁、迁移回放、v3 清单、客户 H5 核心 UI 流程和本地持牌机构登录复核。仍有上线前硬条件：

1. 最新本地浏览器请求仍会产生 `team_audit.seq IS NULL` 的审计行；只读 verifier 报 `seqNull=2`，不能作为 VPS 灰度绿灯。
2. 本轮依赖审计为零漏洞，但每次 VPS 发布仍须锁定依赖并重跑审计。
3. 本地 `/team/login` 的持牌机构角色登录成功，但 `licensed.khmerx.org` 未在默认 host 映射中，真实域名入口仍未证明。
4. 客户 UI 已走到申请、账单确认、手写签名保存和申请记录；在本地隔离数据中最终状态仍是 `kyc_approved`，未转为 `decision_pending`，因此不能宣称 lender/checker 已完成真实客户链路。

## 验收矩阵

| 阶段 | 验收项 | 结果 | 证据 |
|---|---|---|---|
| 1 | test/typecheck/separated build/lint/diff | 通过 | `/tmp/acceptance-round3-test.log`、`-typecheck.log`、`-build.log`、`-lint.log`；537 tests：520 pass、0 fail、17 skipped；separated leaks=0；lint 0 errors |
| 1 | 依赖审计 | 通过 | `npm audit --omit=dev`：`found 0 vulnerabilities`（`/tmp/acceptance-round3-audit.log`） |
| 2 | 全新库 0000–0062 | 通过 | `migrateDev` 应用到 0062；`pragma table_info(team_audit)` 出现 `seq`；无 migration 报错 |
| 2 | 升级路径与数据保留 | 通过 | 从 pre-0062 `.wrangler/state` 回放最新迁移，自动应用 0062；迁移前 verifier rows=4，迁移后仍保留 4 行，`seqNull=0,seqUnique=true,orderCheck=passed` |
| 2 | v3 清单 create/verify | 通过 | 浏览器真实 UI 登录后创建并校验 manifest：`version=3,status=v3,match=true,tampered=false,appendOnly=true,prefixMatches=true`，rows=6，appendedRows=0；升级后 verifier rows=6 全部通过 |
| 2 | 浏览器流程后的审计连续性 | 不通过/人工复核 | 后续本地浏览器访问新增审计行；只读 verifier `rows=10,seqNull=2,seqUnique=true,orderCheck=passed`，两条 NULL id 已记录在 `/private/tmp/khmerx-acceptance` 当次输出中 |
| 3 | H5 客户完整核心流程 | 有条件通过 | 375×812 Playwright 实际 UI 完成注册、六组 KYC、上传、提交、needs-info、补件、重提、approved、借款申请、账单确认、手写签名保存、记录和“我的”；证据见 `assets/acceptance-20261103/01–15` |
| 3 | 客户贷款审批状态转换 | 未通过/阻塞 | 账单和签名 API 均 200，签名页面与记录页可见；最终隔离本地客户贷款仍为 `kyc_approved`，未进入 `decision_pending`，不能把 lender/checker fixture 当成真实客户闭环 |
| 4 | `/team` 1280/390、各菜单 | 通过（页面可打开） | Playwright 截图：customers、reports、notifications、kyc、loans、funding、tickets、repayment、postloan；本轮另用虚构 checker 账号登录持牌机构 dashboard，见 `16–19` |
| 4 | MFA 页面 | 部分通过 | `/team/login` 可打开并有 MFA challenge 分支代码与截图入口；未配置 MFA secret 的本地虚构账号未执行真实 TOTP 循环 |
| 4 | 审计完整性 NULL seq 后人工复核 | 通过（风险可复现） | verifier 在 NULL seq 时报告 `seqNull=2`；API v3 清单在全量 seq 时返回 `match=true` |
| 5 | licensed 入口 | 未覆盖/阻塞 | 本地 `/team/login` 切换“持牌机构后台”，虚构 checker 账号密码登录 API 返回 200 并进入 dashboard；但 `deploy/standalone/hosts.mjs:3-7` 的 `DEFAULT_HOSTS` 没有 `licensed.khmerx.org`，无法验收该域名 |
| 6 | 未登录/客户身份后台 API | 部分通过 | 无身份 `GET /api/team` 返回 401；测试身份在 `KHMERX_TEST_MODE=true` 下可读到空公司列表（200），因此非测试模式拒绝未完成，不能把测试模式结果当生产安全证明 |
| 6 | 客户 H5 demo 认证与脱敏 | 通过（本地 demo） | `/api/h5/auth/send` 返回 `phoneMasked=+855 •••• 0001`、`demoCode=123456`；verify 返回 `authenticated=true`；未完成密码设置时 `/api/h5/state` 按预期拒绝继续申请 |
| 7 | 375/390 横向滚动与计算样式 | 通过（抽查） | Playwright：375 时 `scrollWidth=375,clientWidth=375`；390 时 `documentWidth=390,viewportWidth=390`；按钮计算样式：height/min-height 44px、padding-inline 12px、border-radius 8px、背景 `rgb(53,70,96)` |
| 7 | 控制台/网络错误 | 有条件通过 | 本轮客户流程 API 响应均为 200；记录 1 条 `[vinext] RSC prefetch setup error: TypeError: m is not a function`，需在发布前定位。自动化重复设置同一文件槽产生的 409 属于 harness 重复上传，不计作产品失败；首轮未登录 `/api/team` 的 403 属于预期防护 |

## 数据与迁移证据

0062 之前的本地 `.wrangler/state` 先恢复到隔离 worktree，再运行最新迁移；迁移自动应用 0062，未执行手工业务回填。迁移前后 verifier 均通过（4 行 → 4 行，`seqNull=0`），随后用浏览器登录会话创建并校验 v3 manifest（6 行，`match=true`）。浏览器继续访问后台后仍复现两条 NULL seq，因此此项保留为 VPS 前置修复。

本地 demo API 还验证了手机号挑战：发送、验证码 `123456` 验证和会话建立均只在本地完成，未发送 Telegram。所有业务数据为 `acceptance` 虚构来源。浏览器访问后台后发现新增审计写入路径仍会产生 NULL seq，因此将该复现保留为上线前阻塞，而不是掩盖在最终回填里。

## 问题清单

### P1

- **P1-1：浏览器流程仍可产生 NULL seq。** 位置：`lib/team/auth.ts` 的登录审计路径与其他后台写入路径；复现：0062 后用本地 checker 登录、打开后台菜单，再运行 `node scripts/audit-seq-verify.mjs --db <sqlite> --backfill-max-seq 10`；结果 `rows=10,seqNull=2`。证据：审计 verifier 输出；升级成功截图和 `team-dashboard-authenticated-1280.png`。上 VPS 前必须修复或明确所有审计写入都经过 seq 分配。
- **P1-2：发布前必须保持依赖审计为零漏洞。** 本轮 `npm audit --omit=dev` 已为 0 vulnerabilities；VPS 发布仍须锁定同一 lockfile 并重跑。

### P2

- **P2-1：全新 `.wrangler/state` 先 seed 会失败。** `scripts/dev-app-backend/start.mjs` 依赖 D1 sqlite 已物化；本轮先请求本地 worker 再迁移才成功。建议把物化前置写入启动脚本/README；本任务未修改代码。
- **P2-2：licensed 域名未在默认 host 映射。** `deploy/standalone/hosts.mjs:3-7` 无 `licensed.khmerx.org`。本地 portal 仅能证明 `/team/login` 的角色分支，不证明域名部署。
- **P2-3：当前浏览器轮有明确 404/503。** `/h5/loans` 没有允许的 `screen`，`app/h5/[screen]/page.tsx` 的允许列表不含 `loans`；`/team/audit` 不在 `lib/team/crm-menu.ts:1`。需决定这些是预期路由还是验收缺陷。

### P3

- **P3-1：三种 `lang` 查询参数截图像素哈希相同。** 本轮没有把语言切换误报为通过；需要通过真实语言选择器/状态参数重新验收漏翻与混用。
- **P3-2：客户贷款审批未完成真实客户闭环。** 本轮已形成可重复的 KYC/补件/批准/借款/账单/手写签名 UI 证据，但本地客户贷款仍停在 `kyc_approved`；需要真实机构待审数据或修复本地 fixture 后再验证 lender/checker 操作。

未发现由本轮证据直接证明的 P0。

## 截图与 SHA256

以下本轮 Playwright/Chromium 证据已复制到 `docs/review/assets/acceptance-20261103/`；客户截图 01–15 覆盖实际 UI 生命周期，持牌机构截图 16–19 覆盖登录后的 dashboard、贷款入口以及 English/Km 语言选择器可见状态：

| 文件 | 内容 |
|---|---|
| `01-register.png`–`04-submitted.png` | 注册、登录、六组 KYC 填写与提交 |
| `05-customer-needs-info.png`–`08-customer-approved.png` | needs-info、补件、重提与批准 |
| `09-loan-application.png`–`12-signed.png` | 借款申请、结算账单、手写签名与保存 |
| `13-loan-record.png`–`15-my.png` | 申请记录、贷款记录与我的账户 |
| `16-checker-dashboard.png`–`19-checker-km.png` | checker 登录后的持牌机构 dashboard、贷款视图与 English/Km 选择器 |

以下保留第二轮的历史 SHA256 记录，用于与旧报告比对：

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

1. 修复所有审计写入路径的 seq 分配，重跑升级、浏览器、v3 manifest 和 verifier；当前 `seqNull=2` 是 P1 阻塞。
2. 以同一 lockfile 在 VPS 灰度前重跑四项门禁与 `npm audit --omit=dev`。
3. 明确 `licensed.khmerx.org` 的真实入口/配置后，在隔离本地 host 映射上复验；当前禁止登录或修改任何线上环境。
4. 提供与客户 loan 关联的可重复 lender/checker fixture，验证 `decision_pending → approve → approval_check`；当前客户 UI 最终停在 `kyc_approved`。

基于以上硬条件，本报告不授权部署或线上写操作；完成 seq 修复、真实 licensed host、客户 loan 的机构审批闭环和灰度前依赖复核后，才可重新评估 VPS 灰度。
