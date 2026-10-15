# G1 UX / Acceptance Re-Review

Date: 2026-10-07  
Reviewer: Codex — Independent Reviewer + UX / Acceptance Owner  
Reviewed: `02-api-contract.md`, `04-ux-architecture.md` §18–§19, `21` v2.2 §5.17/§6.2, `24`, `25`, `26`, `27`, `28`.

## Result

```text
CODEX G1 UX GATE: GO
UX CONTRACT: READY
ACCEPTANCE CONTRACT: READY
THREE-PARTY GATE: READY
TRAE IMPLEMENTATION: HOLD
```

The three P1 findings from `28` are closed by `04` §19 G1 Prototype Contract v2. This is a contract gate only; it does not authorize implementation before the formal three-party approval.

## Route Inventory

The complete G1 inventory is **16 routes + 1 application state**:

1. `/startup`
2. `/company/select`
3. `/company/scan`
4. `/company/paste-link`
5. `candidateConfirm` (application state, not a new route)
6. `/auth/login` (preflight/resolving)
7. `/auth/telegram-consent`
8. `/auth/telegram-code`
9. `/auth/password`
10. `/auth/set-password`
11. `/auth/recover`
12. `/auth/recover/code`
13. `/home`
14. `/me`
15. `/me/company`
16. `/me/language`

No Loan, KYC, Quote, `/api/h5/state`, or other G2/G3 route is admitted into the G1 contract.

## Prototype Contract Coverage

`04` §19 defines every inventory item with:

- entry and active/candidate company context;
- API and required data;
- UI, loading, empty, offline, timeout, and unknown states;
- explicit 400/401/403/404/409/429/503 behavior, including `N/A` where inapplicable;
- primary CTA, enabled condition, loading behavior, secondary CTA;
- success/failure navigation, back behavior, and Return Intent;
- security, localization, accessibility, acceptance, manual acceptance, and automation coverage.

The candidate confirmation state explicitly covers A → B confirmation, cancellation, preflight failure, B unavailable, network failure, and preservation of A.

## Auth Error Matrix

The route cards and shared bindings define:

- Password login: uniform 401, 403 meaning split, 429 clamp/countdown, 503 manual retry.
- OTP send/verify: consent gate, sending/sent, wrong/expired/5-attempt lock, account conflict, Telegram unavailable, 429, 503, offline, timeout, pending restore without auto-send.
- Password setup: 12–128 validation, 401 Return Intent, 403 registration state, 409 refresh, 429 if present, 503/offline/timeout.
- Recovery send/reset: only `/api/h5/auth/recovery` with `send`/`reset`; mismatch, wrong/expired/exhausted, 429/503, success to password login.

## Return Intent Matrix

`RET-GET` allows safe GET/navigation restoration after authentication. `RET-POST` never auto-replays a command; the user must explicitly initiate it again. The matrix covers `/home`, `/me`, `/me/company`, and all sensitive Auth/Recovery actions.

## Company UX

R-3, R-5, R-12, U-4, U-5, and U-6 remain **CLOSED**. Company switching is explicit, candidate-scoped, and preserves A. Deep links select a company only and never authenticate. Logout runs under A, clears only A, and retains other company sessions.

## Minimal Home

`/home` is frozen as a minimal authenticated landing page. It uses `AuthSnapshot`/`CompanySummary`, makes no network request for rendering, and does not call `/api/h5/state`, `/api/kyc*`, `/api/loan/*`, or `/api/h5/locale`. Current company, switch, logout, language, and version behaviors are defined.

## Accessibility

Every core G1 card references the same acceptance baseline: 320dp, 360dp, 412dp; 130% and 200% font scale; 48dp touch targets; long Khmer copy wrapping/scrolling; reachable primary CTA; accessible labels and localized state text.

## Localization

All state and action copy is key-based in `en`, `km`, and `zh`. Runtime choices are limited to `auth.languages ∩ bundled locales`; server-disabled Chinese cannot remain selectable. Company language preferences remain isolated.

## P0

None at the UX or acceptance-contract layer.

## P1

None. Closed items:

- P1-UX-01: complete route inventory and full Prototype Contract fields;
- P1-UX-02: `/home` boundary reconciled with `21` §5.17;
- P1-UX-03: route-level Auth error/CTA/navigation bindings.

## P2

- Android runtime, screenshot/logcat, and accessibility execution evidence remain implementation exit evidence.
- G0/G1 implementation findings remain open until Trae implements and Codex independently verifies them.
- `24` remains PENDING for formal three-party approval by design.

## UX Contract Readiness

**READY** — no route or state requires Trae to invent behavior.

## Acceptance Contract Readiness

**READY** — Codex can determine PASS/FAIL from the route cards, shared matrices, and required automation/manual evidence.

## Three-party Gate Readiness

**READY** — `24` is updated to `UX CONTRACT = READY` and `ACCEPTANCE CONTRACT = READY`, while Gate Decision remains PENDING until the formal three-party review.

## Final Summary

```text
CODEX G1 UX GATE: GO
REVIEW_FILE: E:/KhmerX/KhmerX/docs/flutter-android/31-G1-ux-acceptance-rereview.md
PROTOTYPE ROUTES: 16 covered + 1 application state / 16 + 1 total
P0: 0
P1: 0
P2: implementation/runtime evidence only
UX CONTRACT: READY
ACCEPTANCE CONTRACT: READY
THREE-PARTY GATE: READY
TRAE: HOLD
```
