# #170 验收 P2/P3 补充证据（2026-11-05）

## P2-1：全新本地 D1 初始化

`scripts/dev-app-backend/start.mjs` 在导入 `seed.mjs` 前，对本地 worker 的 `/api/team` 发起一次测试请求，并带上固定测试公司 cookie。该请求只用于让 Wrangler/Miniflare 物化本地 D1 SQLite 文件；未迁移时返回的错误被忽略，随后 `seed.mjs` 打开本地文件并执行 `migrateDev`。README 已记录该顺序和“不接触远程 D1”的边界。

本轮在没有 `.wrangler/state` 的新工作树验证：priming request 触发 `no such table: team_members`（证明 worker 已触碰 D1），随后输出 `dev migrations applied: 63` 和 `seeded public workspace ...`，启动成功。

## P2-3：路径有效性

- `/h5/loans`：HTTP 404；`app/h5/[screen]/page.tsx` 的允许 screen 列表不包含 `loans`。源代码入口扫描没有发现产品链接指向该路径，因此它不是有效路由，不修改。
- `/team/audit`：HTTP 404；团队页面的有效 section 是 `customers/reports/notifications/tickets/kyc/loans/funding/repayment/postloan`，审计入口实际是 `/team#team-audit`，数据接口是 `/api/team/audit-integrity`。源代码没有链接指向 `/team/audit`，因此它不是有效路由，不修改。

## P3-1：H5 语言切换

语言由 `MiniShell` 的语言选择器决定：初始值优先读取 URL `lang`，其次读取 `localStorage` 的 `payease-language`；点击选择器会更新 `localStorage`、URL 和客户端状态，并提交 `/api/h5/locale`。本轮新增脚本 `scripts/dev-app-backend/h5-language-switch.mjs`，实际点击选择器并断言 `.mini-app[lang]` 和底部导航文案。

Playwright 结果：

| 语言 | 断言文案 | 截图 SHA-256 |
|---|---|---|
| en | `Home` | `789314582be3494e2a39c36906bc7d5a9221b5e4cee7571b146fe5a7716638e4` |
| km | `ទំព័រដើម` | `1f6da8609501ee47aa49ac4ee141cbf2dc409a69b1be75e1e26fc530d54d2dd6` |
| zh | `首页` | `f5b702656196e1e89fc89f3cbca4d83c58e07d199b36d231e7d2e6ef9ea404bf` |

截图目录：`docs/review/assets/acceptance-p2-language/`。

## D-42：客户端认证渠道与灰度前置项

本轮新增审计报告 `docs/review/client-auth-config-audit-20261105.md`。验收矩阵新增普通 H5/App（手机号验证码）与 Telegram Mini App（signed initData）两条互斥渠道路径；灰度模板显式要求 `KHMERX_TEST_MODE=true`、`PAYEASE_H5_AUTH_MODE=demo`、`PAYEASE_TELEGRAM_AUTH_MODE=telegram`。生产等价配置仍由 standalone boot 拒绝 test mode。完整 375px 三语登录截图、H5 全流程和非 demo `123456` 负向证据列为上 VPS 前未完成门禁，不能用代码审计替代。
