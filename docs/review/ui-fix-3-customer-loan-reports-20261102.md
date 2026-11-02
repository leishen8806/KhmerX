# UI-FIX-3 customer, loan, and report list visual evidence

Date: 2026-11-02 (Asia/Phnom Penh)

Before captures use merged `origin/main` at `1d3a282` (after PR #162); after captures use `feat/ui/fix-3-customer-loan-reports` at the final screenshot-fix commit. Playwright used synthetic local identity headers and route-mocked `/api/team` and `/api/state` responses; no production or remote service was contacted. All captures are first-screen screenshots with `fullPage: false`; the 390px capture keeps the CRM menu collapsed (`打开菜单` visible) and `scrollY: 0` after the first matching row was brought into view.

## Capture matrix

| Page | Viewport | Before | After | SHA-256 before / after |
|---|---:|---|---|---|
| `/team/customers?view=客户列表` | 1280 | [before](assets/ui-fix-3-customer-loan-reports/before-customers-1280.png) | [after](assets/ui-fix-3-customer-loan-reports/after-customers-1280.png) | `524e0914059d31fce94efce243e3fe72617693a553e622b326318451e6cf16dc` / `c8b9bb97d2741453630f5a7b7ef81793d125da05e0a5312522ded6dceac7f866` |
| `/team/customers?view=客户列表` | 390 | [before](assets/ui-fix-3-customer-loan-reports/before-customers-390.png) | [after](assets/ui-fix-3-customer-loan-reports/after-customers-390.png) | `450df8f75845e5828a8677298d394b3b368553cdfeabe8a997e6d4c27f822c90` / `1f1a4ac18e7d22d9f5148041eb83acea942fab0715a8ba11ab1347310b190e27` |
| `/team/reports?view=客户漏斗` | 1280 | [before](assets/ui-fix-3-customer-loan-reports/before-reports-1280.png) | [after](assets/ui-fix-3-customer-loan-reports/after-reports-1280.png) | `e6f9d30ad91938959c67e2e6b9dc025dd4dea7aca867d83c160ee51e7712159a` / `8a8f083b85b21bdf295fb9160dfc098b32793825ee9b0691e2d9bde126128b73` |
| `/team/reports?view=客户漏斗` | 390 | [before](assets/ui-fix-3-customer-loan-reports/before-reports-390.png) | [after](assets/ui-fix-3-customer-loan-reports/after-reports-390.png) | `553b923280b42ae8ee4007027ae0b43adf755f0e28db984f73c4c337eac6f72a` / `f00d654993264bc4ca6abc64b6a6a0518d96e75854d52a8fa68ce00f0f4f1baf` |

## Mobile verification

- Customer list: both before and after show two visible `OperatorRow` customer rows (`CUS-0001`, `CUS-0002`), the first row is visible without horizontal overflow, and the menu remains collapsed. The after capture reflects the merged #162 mobile sidebar behavior.
- Report center: all four KPI `OperatorRow` cards are visible before and after, with the collapsed menu and no horizontal overflow.
- KPI values now render as uniform large, left-aligned numbers beneath each title without the status-pill background; the export control stays on one line at 390px.
- The rendered customer-list and report-center rows do not receive `actions` props in this PR, so no vertical action-button stack is present in these two screenshots. This is recorded as a verification gap rather than inferred from CSS; the requested action-button evidence cannot be claimed by these captures.
