# W2-6 本机联调脚本

脚本只允许在 `PAYEASE_ENV=local` 下运行，使用两个本机 HTTP 服务和各自的持久化 SQLite/D1 文件。所有密码、验证码、会话 Cookie、任务密钥都从运行时环境变量读取，不写入脚本、日志或 Git。

## 运行

前置手动步骤（两套服务均为本机持久化库）：客户依次调用 `POST /api/h5/auth/send`、`POST /api/h5/auth/verify`、`POST /api/kyc/files`、`POST /api/kyc`（save/submit）、`POST /api/h5/state`（create/confirm_bill），员工调用 `GET /api/team` 和 `POST /api/team`（assign）。签名由脚本调用 `GET /api/loan/sign?loan=...`、`POST /api/loan/sign`；机构审批使用 `GET/POST /api/institution/applications`，发件箱分别使用 `POST /api/jobs/partner-outbox`。

在两个服务和本地迁移完成后，设置以下变量：

- `KHMERX_BASE_URL`、`LICENSED_BASE_URL`
- `KHMERX_DB_PATH`、`LICENSED_DB_PATH`
- `CUSTOMER_COOKIE`、`LOAN_ID`、`PUBLIC_REF`、`PARTNER_ID`
- `LENDER_COOKIE`、`CHECKER_COOKIE`、`LENDER_VERSION`、`CHECKER_VERSION`
- `KHMERX_JOB_SECRET`、`LICENSED_JOB_KEY`
- 可选拒绝路径：`REJECT_PUBLIC_REF`、`REJECT_LENDER_VERSION`

然后执行：

```powershell
$env:PAYEASE_ENV='local'
node scripts/local-e2e/w2-6-e2e.mjs
```

脚本按“签名 → apply → 断言 KhmerX 发件箱新增 → 触发 KhmerX 发件箱 → 断言 Licensed 收到申请 → LENDER 审批 → CHECKER 复核 → 触发 Licensed 发件箱 → 断言 KhmerX 贷款 approved 且回调 applied → 断言 agreement.signed → 可选拒绝路径 → 两库分开统计”的顺序运行。任一步断言失败都会非 0 退出，并打印步骤名、HTTP 状态码和错误码；输出不包含 Cookie、密钥或响应正文。
