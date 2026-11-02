# Team shell title / breadcrumb review — 2026-11-02

## Scope

- Capture commit: `f78a5a5` (follow-up commit on `fix/team/shell-title`; implementation base `origin/main` `d612010`).
- Browser: Playwright Chromium headless.
- Viewports: 390×844 and 1280×844; first screen, menu collapsed at mobile width.
- API responses were synthetic and contained no secrets.

## Verified states

| Route | Top title | Parent menu | `document.title` | Horizontal overflow |
| --- | --- | --- | --- | --- |
| `/team/kyc` | KYC 审核队列 | `KYC 审核队列 / 客户中心` | `KYC 审核队列 · KhmerX 后台` | false |
| `/team/customers?view=客户列表` | 客户列表 | `客户列表 / 客户中心` | `客户列表 · KhmerX 后台` | false |
| `/team/reports?view=客户漏斗` | 客户漏斗 | `客户漏斗 / 报表中心` | `客户漏斗 · KhmerX 后台` | false |

The eight screenshots below were opened and visually checked. On mobile, the title remains on one line and the language/account controls remain visible; on desktop, the sidebar and parent breadcrumb remain aligned. The two report screenshots were also checked with Playwright `getComputedStyle`: all four KPI value elements returned `font-size: 24px`, `font-weight: 700`, and `color: rgb(23, 32, 51)` (`--color-text-primary`).

## Screenshot hashes

```text
1a18fe8ee9e51b5d1090605e6c358326113e7496152bdfb1af94217588895b5f  customers-1280.png
f8e9d741603db878541c736ee8c438b84fcdd4c5eef07f7c6465b23d04c3cc8d  customers-390.png
60ed1595f7287f223338f1d692f8bdb9384f6e7f94e8e1c27b814c9235582f1d  kyc-1280.png
70fce835b66718c8e2239113f34efe8e8716354562651dfb7fbca739607daa3b  kyc-390.png
dfa3ff79e9aba7544e681233ef6eee185f71bff01f6d05e6e67474e4e3d5e90a  reports-1280.png
f388a949b41d501be285578cbd7492604f9fb76d8e57c85b711ce8f91a8e9fd7  reports-1280.png (round 3)
c2107e016e5a6acc037749a669496f9b94be19d675aecd3c8f5bd67c7d024d44  reports-390.png (round 3)
```

Assets: `docs/review/assets/team-shell-title-20261102/`.
