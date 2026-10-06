# Telegram Mini App 真实操作测试报告

测试日期：2026-10-03  
测试入口：Telegram Desktop，已登录账号，聊天 `KhmerXBot`

## 已验证

- Telegram Desktop 中可以看到 `KhmerXBot` 对话。
- Bot 消息中存在 `pay Ease` Mini App 启动按钮。
- `https://payease.khmerx.org/api/h5/auth` 返回 HTTP 200。
- 未带 Telegram `initData` 时服务端明确返回 `authenticated: false`、`mode: "telegram"`，说明没有把未签名客户端字段当作登录凭据。
- `/h5` 页面包含 Telegram WebApp SDK。
- VPS 容器当前运行中，重启次数为 0，日志无崩溃记录。

## 已恢复的自动化问题

第一次点击返回 `noWindowsAvailable`，原因是 CUA 持有过期的 Telegram 窗口句柄。重置 CUA 会话、重新读取应用状态并重新绑定 Telegram 后，Mini App 已经真实打开；无障碍树可以看到 Telegram WebApp URL、签名 `tgWebAppData` 和用户 ID `915006652`。

## 当前阻塞

当前已完成真实启动，但无法继续提交手机号：手机号输入会创建或登录账号，必须使用用户确认的测试号码，不能擅自提交真实手机号。因此以下项目仍不能宣称已通过：

- Telegram `initData` 真实签名登录和服务端写回
- Mini App 内真实 KYC 提交、上传、签名和语言切换
- 真实申请、签约、放款、还款通知链路
- Telegram Bot 三语通知的真实到达

## 结论

当前结果是“真实 Telegram 启动和签名 initData 读取通过，手机号之后的流程待测试号码”。浏览器直接打开 PayEase 不能替代 Telegram `initData` 验证。
