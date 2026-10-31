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

第三轮复拍后 SHA-256（本地 demo worker，客户先置为 `needs_info` 拍中文，再由本地审核脚本置为 `approved` 拍高棉语/英文）：

| 文件 | SHA-256 |
|---|---|
| `kyc-status-375-en-approved.png` | `029e4c56e437078a5389884d81daf17add23076c7f6476c714abd0aa48b3d9fa` |
| `kyc-status-375-km-approved.png` | `f4244b436422d676d8f9fa3a5c25627f0912d537f0041a3052fc020cc8b91462` |
| `kyc-status-375-zh-needs-info.png` | `d8a381638ac3ab372e71e863c5d648a5b92ed91898fcf4f0d89172365500d668f9` |

## 第三轮门禁证据

- `progress` 的样式根因是原生控件默认外观；仅设置 `accent-color` 不足以覆盖 Chromium 的默认绿色绘制。
- 已对 `.kyc-customer-progress progress` 增加 `appearance:none` / `-webkit-appearance:none`，并显式设置 `::-webkit-progress-bar`、`::-webkit-progress-value`、`::-moz-progress-bar`；轨道为 `#e6edf7`，进度值为 `#1677ff`。
- Playwright 实测：`getComputedStyle(progress).appearance === "none"`；截图中进度值已为品牌蓝色。`git grep` 未发现该组件存在其他 `appearance:none` 或 progress pseudo 规则覆盖它。
- 本轮截图服务启动于分支提交 `ba78a19ff3b34456e58a911a67925e5dbfe942bf`；没有复用旧分支服务。
