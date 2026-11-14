# W2-6 本机联调脚本

脚本只允许在 `PAYEASE_ENV=local` 下运行，使用两个本机 HTTP 服务和各自的持久化 SQLite/D1 文件。所有密码、验证码、会话 Cookie、任务密钥都从运行时环境变量读取，不写入脚本、日志或 Git。

## 运行

启动 KhmerX 开发代理前，在同一 PowerShell 会话执行 `$env:DEV_PROXY_HOST = '127.0.0.1'`，让代理只监听本机。

脚本现在自行完成客户验证码登录、KYC 上传/提交、员工复核、create、confirm_bill、分配、签名和 apply。Licensed 审批员、复核员的邮箱、密码、TOTP 密钥只从运行时环境变量读取。

在两个服务和本地迁移完成后，设置以下变量：

- `KHMERX_BASE_URL`、`LICENSED_BASE_URL`
- `KHMERX_DB_PATH`、`LICENSED_DB_PATH`
- `PARTNER_ID`、`KHMERX_JOB_SECRET`、`LICENSED_JOB_KEY`
- `LICENSED_LENDER_EMAIL`、`LICENSED_LENDER_PASSWORD`、`LICENSED_LENDER_MFA`
- `LICENSED_CHECKER_EMAIL`、`LICENSED_CHECKER_PASSWORD`、`LICENSED_CHECKER_MFA`
- 可选 `KHMERX_DEMO_OTP`（默认使用本地演示验证码）

然后执行：

```powershell
$env:PAYEASE_ENV='local'
node scripts/local-e2e/w2-6-e2e.mjs
```

阶段撤回路径：先运行 `node scripts/local-e2e/w2-6-e2e.mjs prepare`，完成准备后运行 `cancel`；该阶段会提交 `cancel_application`，触发发件箱，核对机构侧 `withdrawn`，并验证再次审批返回 409。`prepare`、`apply`、`tick`、`finish` 仍可按停机演练顺序使用。

脚本每次运行生成两个新的虚构客户，依次跑批准和拒绝路径。任一步断言失败都会非 0 退出，并打印步骤名、HTTP 状态码和错误码；输出不包含 Cookie、密码、TOTP 密钥或响应正文。
