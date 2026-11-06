# H5、App 与 Telegram 渠道状态

## 状态来源与优先级

登录接口在调用认证核心前读取当前租户的 `company_channels` 行：浏览器 H5 使用
`type='h5'`，移动 App 使用 `type='app'`，Telegram Mini App 使用
`type='telegram_miniapp'`。该行存在时 `enabled=0` 返回 `CHANNEL_DISABLED`；启用时
允许继续认证。没有对应行时只记录 warning，并沿用旧的运行时配置，不会因为没有
Bot、没有 `channelId` 或缺少渠道行而额外拦截灰度／演示 H5 手机登录。

运维紧急开关 `PAYEASE_H5_CHANNEL_STATUS=maintenance|disabled` 具有最高优先级，覆盖
数据库行并分别返回 `CHANNEL_MAINTENANCE`（503）或 `CHANNEL_DISABLED`（403）。未设置
或使用其他值时不作为状态覆盖。当前仍只允许在本地测试环境验证；测试环境 VPS 和正式
环境的部署、配置写入均暂缓，须由负责人另行评估批准。

## 请求识别

- 浏览器 H5 请求不带 `X-Payease-Client: app`，按 `type='h5'` 判断。
- 移动 App 复用 `/api/h5/auth*` 接口，并由网络层发送固定的
  `X-Payease-Client: app`，按 `type='app'` 判断。服务端只接受精确值 `app`，避免客户
  端任意字符串改变渠道类型。
- Telegram Mini App 使用 `/api/h5/auth/telegram`；服务端在验证 Telegram 身份前按
  当前候选租户的 `type='telegram_miniapp'` 行判断。

所有上述判断都在 `send`、`verify`、账号登录和 Telegram 登录进入认证核心之前执行；
GET 预检也返回 `channelErrorCode`，供界面显示独立的维护／停用页面。
