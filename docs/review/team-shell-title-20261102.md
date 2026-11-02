# Team shell title / breadcrumb review — 2026-11-02

## Scope

- Capture commit: `8bd1c98` (implementation commit on `fix/team/shell-title`; based on `origin/main` `d612010`).
- Browser: Playwright Chromium headless.
- Viewports: 390×844 and 1280×844; first screen, menu collapsed at mobile width.
- API responses were synthetic and contained no secrets.

## Verified states

| Route | Top title | Parent menu | `document.title` | Horizontal overflow |
| --- | --- | --- | --- | --- |
| `/team/kyc` | KYC 审核队列 | 客户中心 | `KYC 审核队列 · KhmerX 后台` | false |
| `/team/customers?view=客户列表` | 客户列表 | 客户中心 | `客户列表 · KhmerX 后台` | false |
| `/team/reports?view=客户漏斗` | 客户漏斗 | 报表中心 | `客户漏斗 · KhmerX 后台` | false |

The six screenshots below were opened and visually checked. On mobile, the title remains on one line and the language/account controls remain visible; on desktop, the sidebar and parent breadcrumb remain aligned.

## Screenshot hashes

```text
1a18fe8ee9e51b5d1090605e6c358326113e7496152bdfb1af94217588895b5f  customers-1280.png
22d8eead22edc61702e6b3f92216d121f8cf1b9d6ca80d5c28e42bddcab46695  customers-390.png
60ed1595f7287f223338f1d692f8bdb9384f6e7f94e8e1c27b814c9235582f1d  kyc-1280.png
e4f6d5de5a276ac478d002e097ac1146e700b50b4eab4b07b732810c43d9eba2  kyc-390.png
8104a9d395109580c1b35aa7f92a68deb36da29b3c6e1a83c6ebfe9e2628c54a  reports-1280.png
93bef42d20f5194cbd50d856df126591d74bc7f0282d496b1d4020942b8d780b  reports-390.png
```

Assets: `docs/review/assets/team-shell-title-20261102/`.
