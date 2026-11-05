# Standalone 灰度启动验收（2026-11-05）

## 范围与运行方式

本次验收在 macOS 本机完成。Docker Desktop 已通过 `open -a Docker` 尝试启动，但 `docker info` 始终无法连接 daemon，因此没有启动容器。按照任务卡的替代路径，使用 `build:separated` 产物和 `/private/tmp` 下的临时启动包装器运行 `deploy/standalone/server.mjs` 的等价 Node/Miniflare 进程；配置、数据库、R2 模拟目录、扫描器 mock 和代理均未进入仓库。

灰度绑定使用合成值：`PAYEASE_ENV=gray`、`KHMERX_TEST_MODE=false`、`PAYEASE_IDENTITY_PROOF_REQUIRED=true`、`PAYEASE_H5_AUTH_MODE=demo`、`PAYEASE_DEMO_OTP_ALLOWED=true`，公司名为 `KhmerX Gray`。测试 OTP 仅在该隔离灰度运行时使用 `123456`/响应中的 demo OTP。

## 验收结果

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 启动与健康检查 | PASS | `/healthz` 返回 `{"status":"ok"}`；`/readyz` 返回 `{"status":"ready"}`。 |
| 迁移 | PASS | `standalone_migrations` 共 63 条，最新 `0062_audit_manifest_v3_seq.sql`。 |
| H5 demo auth | PASS | `/api/h5/auth` 无 initData 返回 `mode=demo`、公司 `KhmerX Gray`；发送/验证手机号 OTP 成功。响应未把 demoCode 带入 Telegram 模式。 |
| Telegram auth 分支 | PASS | 带 `X-Telegram-Init-Data: synthetic-init-data` 返回 `mode=telegram`，响应中没有 `demoCode`。 |
| 手机→KYC→申请→客户签约 | PASS（真实同一会话） | 同一 Playwright browser context、390px 视口完成手机号验证、4 个 KYC 文件上传、KYC 提交、创建 30 USD 测试贷款、费用确认、`/api/loan/sign` 回调和 apply；最终贷款保持真实后端 `decision_pending`，没有把后台审批伪写成 PASS。截图和 SHA-256 见下方。 |
| KYC 人工审核 | PASS（真实后台会话） | 1440px 浏览器登录本地隔离 `kyc` 员工，打开真实 `/kyc/review`，对另一条 submitted case 逐项勾选并 POST `/api/kyc/review`，返回 200、状态 `approved`、revision 3；截图见下方。该角色是为本地验收临时种子的随机密码员工，不写入仓库。 |
| 贷款审批/放款后台链 | BLOCKED（诚实记录） | 真实后台登录证据已补齐：checker、finance、finance_checker 均通过真实 `/api/team/auth` 会话并打开 `/team`；但当前基线 `portalAllows()` 明确拒绝 lender/finance 的服务机构入口（lender 登录返回“没有持牌机构复核权限”，finance 的页面入口返回“账号不属于服务机构后台”），而 `staffAction()` 的 `approve` 又要求 lender、`approval_check` 需要已有初审、放款步骤需要完整前置状态。因此没有用 DB 或事件模拟补齐审批/放款，也没有宣称通过。 |
| 390px Playwright 视觉烟测 | PASS（页面与会话） | `390x844` 同一 context 的客户截图来自真实登录后的 `/kyc`、提交后 `/kyc` 和贷款申请后 `/h5`；另有 1440px KYC/员工后台截图。没有使用重复的旧截图 blob。 |
| 生产 + demo OTP 负向启动 | PASS | 实际 `server.mjs` 临时副本以字符串绑定 `PAYEASE_ENV=production` + `PAYEASE_DEMO_OTP_ALLOWED=true` 启动 exit=1，错误为 `PAYEASE_DEMO_OTP_ALLOWED is restricted to local/gray H5 runtime`。 |
| Test mode 负向启动 | PASS | 实际 `server.mjs` 临时副本以 `KHMERX_TEST_MODE=true` 启动 exit=1，错误为 `KHMERX_TEST_MODE must be disabled for standalone production boot`。 |
| 审计序列 | PASS | `scripts/audit-seq-verify.mjs`：`seqNull=0`、序列唯一性通过、v2 manifest 可用。初始 standalone 启动审计行数为 2，验收业务流随后新增本地审计事件。 |
| 备份/恢复演练 | PASS（本机等价） | 由于 macOS 无法提供 Linux root-owner `/run/lock` 语义，使用临时 runner 将锁路径映射到 `/private/tmp` 并 stub `stat/flock`；输出 `OK backup/restore, SQLite, object checksums, retention, dry-run and region guard`，覆盖 SQLite、对象校验、保留策略、dry-run、损坏对象拒绝、上传失败拒绝和同区拒绝。 |

## 截图与可复核命令

- 客户已登录 KYC：[r185-01](assets/standalone-gray/r185-01-kyc-authenticated.png)
- 客户 KYC 已提交：[r185-02](assets/standalone-gray/r185-02-kyc-submitted.png)
- 客户贷款已申请（真实后端为 `decision_pending`）：[r185-03](assets/standalone-gray/r185-03-loan-created-and-applied.png)
- KYC 后台工作区：[r185-staff-kyc-dashboard](assets/standalone-gray/r185-staff-kyc-dashboard.png)
- KYC 审核前：[r185-staff-kyc-review-before](assets/standalone-gray/r185-staff-kyc-review-before.png)
- KYC 审核后：[r185-staff-kyc-review-approved](assets/standalone-gray/r185-staff-kyc-review-approved.png)
- checker 登录后台：[r185-staff-checker-dashboard](assets/standalone-gray/r185-staff-checker-dashboard.png)
- finance 登录后台：[r185-staff-finance-dashboard](assets/standalone-gray/r185-staff-finance-dashboard.png)
- finance_checker 登录后台：[r185-staff-finance-checker-dashboard](assets/standalone-gray/r185-staff-finance-checker-dashboard.png)

截图均由以下临时脚本命令生成，命令和哈希对应关系保留在任务执行日志中：

```text
node /private/tmp/standalone-customer-r185-v2.mjs
node /private/tmp/staff-r185.mjs
```

`staff-r185.mjs` 为每个角色创建独立 1440px Playwright context，先通过真实登录 API 建立员工 cookie，再导航 `/team` 截图；KYC 审核使用真实 POST。复制到本报告目录的 9 个 r185 文件 SHA-256：

```text
1d629bf227fdf5a4188720f0306a15b7defdd48c1584c231253dec5414ee3674  r185-01-kyc-authenticated.png
ccdfc4642b01ae7684e48e1e873f9d950719d42c675fc5034d7e705533217dae  r185-02-kyc-submitted.png
ab4b3c381cdf7dea2d909af8b35e64d122a5b98a3fabae2dcce0bdda1ae10c65  r185-03-loan-created-and-applied.png
d180c6dcdf760c2a11a083f434613f0d65acd5e68170c317760a349ed06c599f  r185-staff-checker-dashboard.png
f05c62fddf7e78d201b10e76a515a83abe1e5588be6fbd628c44467f8b417231  r185-staff-finance-checker-dashboard.png
25d761fc791616c79edf74f33f0c6cac297eedc9a450844874801a2d8dbc1f5b  r185-staff-finance-dashboard.png
39592fe0a4ccf3332a6bf1e615d3be240cec97b58e8cf976b54bd4d1021eae86  r185-staff-kyc-dashboard.png
497e200929ca35e1d33d5676bf22f31e765e5b194faf25bd1b56016b1b37df1b  r185-staff-kyc-review-approved.png
e099ab75a0526ef4acdc94151034f3f3f8fd6e8850104f045d9a915224ed09dc  r185-staff-kyc-review-before.png
```

对比现有 `standalone-gray` 目录后没有发现相同 SHA-256；旧报告中的重复/模拟截图不再作为本次返工证据。

## 边界

- 没有部署、远程写入、DNS/Cloudflare 操作或真实短信/资金操作。
- 所有手机号、证件、文件、密钥、扫描器响应和公司配置均为合成测试值；临时值只在 `/private/tmp`。
- 本地后台员工为一次性随机密码种子，密码未写入仓库或报告；finance 的真实页面入口和审批/放款链受当前代码角色矩阵阻塞，未通过修改代码、数据库状态或模拟事件绕过。
- 本报告仅记录本机隔离验收，不代表灰度环境、Telegram 真实签名、外部身份核验、银行核验或真实放款已验证。
