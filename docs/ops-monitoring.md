# KhmerX 生产环境守候与异常预警

建立日期：2026-10-03

## 监控范围

- `payease.khmerx.org`：Mini App/H5 入口，`/api/h5/auth` 应返回 HTTP 200 且 `mode=telegram`。
- `admin.khmerx.org`：管理后台入口，应可以访问并进入 `/team/login`。
- `api.khmerx.org`：私有 API 域名，未带认证时返回 401 属于预期，不把 401 当作故障。
- VPS `159.223.92.104`：Caddy 状态、`app-payease-1` 容器状态、重启次数、4300 监听和最近错误日志。

## 预警条件

- 公开入口 DNS/HTTPS 失败、超时、502 或连续 5xx。
- Mini App auth 接口不再返回 200 或不再是 Telegram 模式。
- Caddy 非 active、应用容器停止或重启次数增加。
- 应用日志出现崩溃、无法启动、数据库连接失败或持续 5xx。

## 当前建立的守候

已在 Codex 当前任务创建 **KhmerX VPS 异常监控**，按小时运行；正常时静默，异常或恢复时通知。按 Asia/Phnom_Penh 时间，00:00–07:00 为休息窗口：仅重大故障立即通知，普通短暂异常延迟到 07:00 后汇总。监控不会自动重启、修改配置或部署，避免影响同一 VPS 上的 OA 系统。

## 当前即时检查

2026-10-03 检查结果：

- `payease.khmerx.org/api/h5/auth`：HTTP 200。
- `admin.khmerx.org`：HTTP 200（跟随登录重定向后可访问）。
- `api.khmerx.org`：HTTP 401，符合私有接口预期。
- Caddy：active。
- `app-payease-1`：running，重启次数 0，日志无新崩溃信息。
