# KYC 状态页修复截图（PR152 follow-up）

使用本地 demo worker 和 Playwright headless Chromium，375×812 CSS 视口、deviceScaleFactor 2、`fullPage:false`；截图在页面加载完成后拍摄。

| 文件 | 语言/状态 |
|---|---|
| `kyc-status-375-zh-needs-info.png` | 中文，待补件 |
| `kyc-status-375-km-approved.png` | 高棉语，已通过 |
| `kyc-status-375-en-approved.png` | English，已通过 |

本轮未修改产品以外的生产配置；截图使用虚构 demo 资料。状态卡现按 `approved` / `needs_info` / `rejected` 使用成功、警示、错误色，状态文案走三语本地化，不再直接显示原始枚举值。进度条和窄屏通过按钮统一使用 `#1677FF` 主色；通过链接允许长文案换行。
