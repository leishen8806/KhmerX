# KYC 状态页修复截图（PR152 follow-up）

使用本地 demo worker 和 Playwright headless Chromium，375×812 CSS 视口、deviceScaleFactor 2、`fullPage:false`；截图在页面加载完成后拍摄。复拍命令（本地端口 5174）：

```sh
node /private/tmp/pw-run/pr152shots.mjs
```

| 文件 | 语言/状态 |
|---|---|
| `kyc-status-375-zh-needs-info.png` | 中文，待补件 |
| `kyc-status-375-km-approved.png` | 高棉语，已通过 |
| `kyc-status-375-en-approved.png` | English，已通过 |

本轮未修改产品以外的生产配置；截图使用虚构 demo 资料。状态卡现按 `approved` / `needs_info` / `rejected` 使用成功、警示、错误色，状态文案走三语本地化，不再直接显示原始枚举值。进度条和窄屏通过按钮统一使用 `#1677FF` 主色；通过链接允许长文案换行。

复拍后 SHA-256：

| 文件 | SHA-256 |
|---|---|
| `kyc-status-375-en-approved.png` | `e280c6608a45325025468a618fb99525d932fa57c628e9da902eccc2b741d8ba` |
| `kyc-status-375-km-approved.png` | `af3ec826d7a4a4a73c97ca94108de6c6ebc16d7302d16b9ff4c9d8025eaf6bce` |
| `kyc-status-375-zh-needs-info.png` | `83312cf04e6e207c082e583046fa663eb155c9e18caa4726a607d79dc1862203` |
