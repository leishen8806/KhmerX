# W2-6 本机联调脚本

脚本只允许在 `PAYEASE_ENV=local` 下运行，使用两个本机 HTTP 服务和各自的持久化 SQLite/D1 文件。所有密码、验证码、会话 Cookie、任务密钥都从运行时环境变量读取，不写入脚本、日志或 Git。

## 运行

在两个服务和本地迁移完成后，设置以下变量：

- `KHMERX_BASE_URL`、`LICENSED_BASE_URL`
- `KHMERX_DB_PATH`、`LICENSED_DB_PATH`
- `CUSTOMER_COOKIE`、`LOAN_ID`、`PUBLIC_REF`、`PARTNER_ID`
- `LICENSED_COOKIE`、`LENDER_VERSION`、`CHECKER_VERSION`
- `KHMERX_JOB_SECRET`、`LICENSED_JOB_KEY`

然后执行：

```powershell
$env:PAYEASE_ENV='local'
node scripts/local-e2e/w2-6-e2e.mjs
```

脚本按“读取签约条款 → 上传真实 1×1 PNG 签名 → apply → 触发 KhmerX 发件箱 → 读取 Licensed 申请 → 审批与复核 → 触发 Licensed 发件箱 → 查询两库状态统计”的顺序运行。输出只包含步骤状态、错误码和聚合统计，不输出 Cookie、密钥或响应正文。
