# H5 灰度手机号 OTP 运行手册（2026-11-05）

本手册只适用于 `testpayease.khmerx.org` 灰度，不适用于正式域名。灰度仍启用身份证明中间件，但 H5 演示 OTP 是独立开关；不得把 `KHMERX_TEST_MODE` 打开。

## 单公司灰度注入

`deploy/standalone/server.mjs` 在配置只有一家公司且请求没有 `payease_company` 时，才会注入该公司的 cookie。单公司配置必须同时满足：

```json
{
  "companies": [{
    "id": "t_<真实 UUID>",
    "slug": "khmerx-gray",
    "accounts": [{"role": "admin", "email": "<灰度管理员邮箱>", "hash": "<v2 PBKDF2 hash>"}]
  }],
  "bindings": {
    "PAYEASE_ENV": "gray",
    "KHMERX_TEST_MODE": "false",
    "PAYEASE_IDENTITY_PROOF_REQUIRED": "true",
    "PAYEASE_AUTH_MODE": "telegram",
    "PAYEASE_H5_AUTH_MODE": "demo",
    "PAYEASE_TELEGRAM_AUTH_MODE": "telegram",
    "PAYEASE_DEMO_OTP_ALLOWED": "true"
  }
}
```

注入前先用真实值替换所有 `replace-with-*` 占位符，再执行：

```sh
node deploy/standalone/gray/check-config.mjs /data/config.json
```

预期为 `GRAY CONFIG CHECK: PASS`。该检查器只读取配置，不写回配置，也不会输出令牌。`PAYEASE_DEMO_OTP_ALLOWED=true` 只会在 `PAYEASE_ENV=local/gray` 的 H5 `demo` runtime 生效；`KHMERX_TEST_MODE` 仍必须为 `false`，所以 MFA、双人审核、病毒扫描和密码发行保护保持生产路径。

## 多公司绑定

多公司配置不能自动选择第一家公司。网关不会为多公司访客补写 `payease_company`；必须先建立明确的公司选择：

- 员工入口使用 `POST /api/team`，JSON 为 `{ "action": "enter", "slug": "<company-slug>" }`；服务端按当前员工成员关系校验权限后写入受保护的后台公司 cookie。
- 客户入口使用 `POST /api/team`，JSON 为 `{ "action": "customer_enter", "slug": "<company-slug>" }`；服务端只接受已存在且 active 的公司 slug，再写入 `payease_company`。
- 切换客户公司后重新 `GET /api/h5/auth`，确认返回的 `company` 与目标公司一致；不要让客户端直接把任意公司 ID 当作授权依据。

测试/验收记录必须同时保留：目标 slug、服务端返回的公司名称、`payease_company` 是否由服务端写入，以及跨公司 slug 被拒绝的状态码。线上正式域名禁止使用演示 OTP 开关。

## 手机号 OTP 验收

H5 灰度页面应显示“测试环境 · 验证码 123456”，注册策略必须返回 `phoneVerification=true`。流程为：输入带国家区号的手机号 → 同意接收验证码 → 输入 `123456` → 进入账号设置/贷款流程。服务端的 `challengeId`、OTP 和会话都绑定浏览器 token 与公司 owner；不能通过手机号直接获得已存在账号的访问权。

Flutter App 的 `AuthRepository` 只调用 `/api/h5/auth/send`、`/api/h5/auth/verify` 并提交 `phone/consent` 或 `challengeId/code`，不把客户端 `mode` 当作认证依据。服务端通过 `X-Telegram-Init-Data` 选择 Telegram channel，否则选择 H5 phone channel；因此 App 的旧 `mode=telegram` 默认值只用于兼容响应模型，不能切换服务端认证通道。

## 启动拒绝条件

- `KHMERX_TEST_MODE=true`：standalone 启动拒绝。
- `PAYEASE_DEMO_OTP_ALLOWED=true` 且 `PAYEASE_ENV` 不是 `local/gray`：standalone 启动拒绝。
- 生产环境身份证明标记与演示 OTP 同时开启：运行时 `assertProductionSafe()` 拒绝启动。
