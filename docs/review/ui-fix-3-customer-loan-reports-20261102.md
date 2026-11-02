# UI-FIX-3 customer, loan, and report list visual evidence

Date: 2026-11-02 (Asia/Phnom Penh)

Before captures use `origin/main` at `3983e3d`; after captures use `feat/ui/fix-3-customer-loan-reports` at `48f30b3`. Playwright used synthetic local identity headers and route-mocked `/api/team` and `/api/state` responses; no production or remote service was contacted. All captures are first-screen screenshots with `fullPage: false`.

## Capture matrix

| Page | Viewport | Before | After | SHA-256 before / after |
|---|---:|---|---|---|
| `/team/customers?view=客户列表` | 1280 | [before](assets/ui-fix-3-customer-loan-reports/before-customers-1280.png) | [after](assets/ui-fix-3-customer-loan-reports/after-customers-1280.png) | `524e0914059d31fce94efce243e3fe72617693a553e622b326318451e6cf16dc` / `c8b9bb97d2741453630f5a7b7ef81793d125da05e0a5312522ded6dceac7f866` |
| `/team/customers?view=客户列表` | 390 | [before](assets/ui-fix-3-customer-loan-reports/before-customers-390.png) | [after](assets/ui-fix-3-customer-loan-reports/after-customers-390.png) | `323da169c7118fbf85ab0db69faf9e68d3060c854f7f65ed9b34b56795205bfe` / `323da169c7118fbf85ab0db69faf9e68d3060c854f7f65ed9b34b56795205bfe` |
| `/team/reports?view=客户漏斗` | 1280 | [before](assets/ui-fix-3-customer-loan-reports/before-reports-1280.png) | [after](assets/ui-fix-3-customer-loan-reports/after-reports-1280.png) | `e6f9d30ad91938959c67e2e6b9dc025dd4dea7aca867d83c160ee51e7712159a` / `2b47c27ed7a82fe437620242c3a8fac47ba8dde06f85088a6585599e2b0be3a0` |
| `/team/reports?view=客户漏斗` | 390 | [before](assets/ui-fix-3-customer-loan-reports/before-reports-390.png) | [after](assets/ui-fix-3-customer-loan-reports/after-reports-390.png) | `fcacf81f7c908207edab5741427369612187967720e6fd32ffe10c076dcc2666` / `fcacf81f7c908207edab5741427369612187967720e6fd32ffe10c076dcc2666` |

The mobile first-screen captures are intentionally unchanged where the existing CRM sidebar occupies the viewport; the responsive row and button changes are covered by the shared styles and by the desktop capture, while the 390px dimensions and first-screen state remain recorded honestly.
