# Team shell title / breadcrumb review — 2026-11-02

## Scope

- Capture commit: pending final commit on `fix/team/shell-title` (implementation base `origin/main` `d612010`).
- Browser: Playwright Chromium headless.
- Viewports: 390×844 and 1280×844; first screen, menu collapsed at mobile width.
- API responses were synthetic and contained no secrets.

## Verified states

| Route | Top title | Parent menu | `document.title` | Horizontal overflow |
| --- | --- | --- | --- | --- |
| `/team/kyc` | KYC 审核队列 | `KYC 审核队列 / 客户中心` | `KYC 审核队列 · KhmerX 后台` | false |
| `/team/customers?view=客户列表` | 客户列表 | `客户列表 / 客户中心` | `客户列表 · KhmerX 后台` | false |
| `/team/reports?view=客户漏斗` | 客户漏斗 | `客户漏斗 / 报表中心` | `客户漏斗 · KhmerX 后台` | false |

The six screenshots below were opened and visually checked. On mobile, the title remains on one line and the language/account controls remain visible; on desktop, the sidebar and parent breadcrumb remain aligned.

## Screenshot hashes

```text
1a18fe8ee9e51b5d1090605e6c358326113e7496152bdfb1af94217588895b5f  customers-1280.png
f8e9d741603db878541c736ee8c438b84fcdd4c5eef07f7c6465b23d04c3cc8d  customers-390.png
60ed1595f7287f223338f1d692f8bdb9384f6e7f94e8e1c27b814c9235582f1d  kyc-1280.png
70fce835b66718c8e2239113f34efe8e8716354562651dfb7fbca739607daa3b  kyc-390.png
dfa3ff79e9aba7544e681233ef6eee185f71bff01f6d05e6e67474e4e3d5e90a  reports-1280.png
93bef42d20f5194cbd50d856df126591d74bc7f0282d496b1d4020942b8d780b  reports-390.png
```

Assets: `docs/review/assets/team-shell-title-20261102/`.
