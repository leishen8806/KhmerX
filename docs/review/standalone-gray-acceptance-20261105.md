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
| 手机→KYC→放款状态流 | PASS | 隔离会话完成手机号验证、4 个 KYC 文件上传、KYC 提交、checker 审核通过、创建 30 USD 测试贷款、费用确认、`/api/loan/sign` 回调、apply、`loan.approved`、签约、`finance.approve`；最终状态 `active`，wallet=3000 cents。checker/finance_checker 的两步在无管理后台种子的 standalone 本地数据库中用明确角色事件模拟，未触碰线上。 |
| 390px Playwright 视觉烟测 | PASS（页面级） | `390x844` 视口截图亲自检查：登录页显示 Test environment/OTP 123456、手机号输入与 Continue；KYC 页显示身份与工作信息标题及会话失效保护；贷款签约页显示账单/签约/审批/放款步骤导航。截图见下方。 |
| 生产 + demo OTP 负向启动 | PASS | 实际 `server.mjs` 临时副本以字符串绑定 `PAYEASE_ENV=production` + `PAYEASE_DEMO_OTP_ALLOWED=true` 启动 exit=1，错误为 `PAYEASE_DEMO_OTP_ALLOWED is restricted to local/gray H5 runtime`。 |
| Test mode 负向启动 | PASS | 实际 `server.mjs` 临时副本以 `KHMERX_TEST_MODE=true` 启动 exit=1，错误为 `KHMERX_TEST_MODE must be disabled for standalone production boot`。 |
| 审计序列 | PASS | `scripts/audit-seq-verify.mjs`：`seqNull=0`、序列唯一性通过、v2 manifest 可用。初始 standalone 启动审计行数为 2，验收业务流随后新增本地审计事件。 |
| 备份/恢复演练 | PASS（本机等价） | 由于 macOS 无法提供 Linux root-owner `/run/lock` 语义，使用临时 runner 将锁路径映射到 `/private/tmp` 并 stub `stat/flock`；输出 `OK backup/restore, SQLite, object checksums, retention, dry-run and region guard`，覆盖 SQLite、对象校验、保留策略、dry-run、损坏对象拒绝、上传失败拒绝和同区拒绝。 |

## 截图

- [登录页（390px）](assets/standalone-gray/standalone-shots-login.png)
- [KYC 页会话保护（390px）](assets/standalone-gray/standalone-shots-kyc.png)
- [贷款签约页步骤导航（390px）](assets/standalone-gray/standalone-shots-loan-sign.png)
- [H5 首页（390px）](assets/standalone-gray/standalone-shots-home.png)

截图是本地代理页面级证据；完整业务状态转移以同一 standalone 数据目录中的 API 流程输出为准。由于没有管理后台会话种子，checker/finance_checker 的实际点击 UI 不作生产等价宣称。

## 边界

- 没有部署、远程写入、DNS/Cloudflare 操作或真实短信/资金操作。
- 所有手机号、证件、文件、密钥、扫描器响应和公司配置均为合成测试值；临时值只在 `/private/tmp`。
- 本报告仅记录本机隔离验收，不代表灰度环境、Telegram 真实签名、外部身份核验、银行核验或真实放款已验证。
