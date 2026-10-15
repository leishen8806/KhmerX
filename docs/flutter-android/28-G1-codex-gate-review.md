# G1 UX / Acceptance Gate Review

Date: 2026-10-07  
Reviewer: Codex — Independent Reviewer + UX / Acceptance Owner  
Scope: Contract readiness only; no UX redesign and no implementation.

## Decision

```text
CODEX G1 GATE: HOLD
UX CONTRACT: NOT READY
ACCEPTANCE CONTRACT: NOT READY
RECOMMENDATION: KEEP HOLD
```

The product decisions are mostly defined, and the six previously closed UX findings remain closed. The current documents are not yet precise enough for objective implementation acceptance because several G1 routes and states are only implied or described in separate sections, and one route has contradictory API scope.

## Closed Findings Check

The following remain CLOSED in `04-ux-architecture.md` and are accepted as closed for this review:

```text
R-3, R-5, R-12, U-4, U-5, U-6
```

Their required behaviors are present: company switch confirmation with preserved A session, two-page recovery, unchecked OTP consent, minimal Home/Me shell, deep-link confirmation, and exceptional auth states with CTAs.

## Route Graph Check

The required flow concepts exist across the route map, G1 contract, and closure section:

- Company select, scan/paste/App Link, candidate validation and preflight
- Password login, Telegram consent/code, password setup
- Recovery send/code/reset
- Minimal authenticated Home and `/me`
- Session expiry, offline, invalid/disabled company, rate limit, and Telegram unavailable

However, the graph is not represented as one complete acceptance graph. Candidate confirmation is a modal/state in prose rather than a traceable Prototype Contract entry, and `/auth/telegram-consent` has no dedicated Prototype Contract row.

## Blocking Findings

### P1-UX-01 — G1 Prototype Contract is incomplete per required fields

The Prototype Contract table in `04` does not provide the required complete fields for every G1 route: Entry, Company Context, API, Data, States, Primary CTA, Secondary CTA, Loading, Offline, Error, Navigation, and Acceptance.

The company routes, Telegram consent route, and minimal Home/Me routes are represented only by abbreviated rows or closure prose. The missing traceability means two implementers could make different choices while both claiming compliance, and Codex could not objectively decide PASS/FAIL from the table alone.

### P1-UX-02 — Minimal Home API scope is contradictory

`04` Prototype Contract currently lists `/home` with `auth/state/kyc` and “13 states”, while the closed U-4 contract explicitly requires the G1 Home placeholder to make no business-state API calls. The G1 scope in `21`/`24` also excludes business APIs.

This must be reconciled before implementation. The acceptance contract cannot simultaneously permit and forbid those calls.

### P1-UX-03 — Auth-route error acceptance is not route-specific enough

The general error matrix defines 400/401/403/409/429/503, offline, and timeout behavior, and `21` defines endpoint mappings. The G1 route rows do not, for each Auth route, bind every required status to a user message, CTA, and navigation target.

Examples include `/auth/telegram-code`, `/auth/password`, `/auth/set-password`, and `/auth/recover/code`. Their rows omit one or more of the required status branches, leaving acceptance dependent on interpretation of the global matrix.

## Non-Blocking Items

### P2-UX-01 — Status duplication across documents

`24` still says the final Codex check is pending, while `26` records that check as PASS. This is an audit-status freshness issue, not a new UX blocker. The current gate result in this document supersedes the pending wording for this review.

### P2-UX-02 — Runtime and accessibility remain exit evidence

The required 320/360/412dp and 130%/200% checks are specified, but they remain implementation-time evidence. Android runtime evidence is also still a G1 exit requirement.

## Required Contract Corrections Before GO

1. Add one G1-only Prototype Contract table covering every required Company/Auth/Home route, including an explicit candidate-confirmation state/entry.
2. Add the missing Company Context and all required per-route fields, including loading, offline, timeout, 400, 401, 403, 409, 429, 503, CTA, and navigation.
3. Make `/home` unambiguously a minimal authenticated placeholder with no `state`/`kyc` business API calls, or explicitly change the G1 scope and acceptance criteria. The current two statements cannot coexist.
4. After those corrections, re-run the final contract check before authorizing implementation.

## Final Summary

```yaml
CODEX G1 GATE: HOLD

P0:
  - none identified in the UX contract review

P1:
  - P1-UX-01 incomplete per-route Prototype Contract
  - P1-UX-02 contradictory /home API scope
  - P1-UX-03 incomplete per-route auth error acceptance

P2:
  - P2-UX-01 stale pending wording in gate packet
  - P2-UX-02 runtime and accessibility evidence still pending implementation

UX CONTRACT: NOT READY
ACCEPTANCE CONTRACT: NOT READY
RECOMMENDATION: KEEP HOLD
```

Trae implementation remains unauthorized until the P1 contract gaps are corrected and independently re-reviewed.
