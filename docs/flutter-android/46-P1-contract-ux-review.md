# P1 Contract + UX Independent Review

**Review date:** 2026-10-08  
**Reviewed:** `45-P1-entry-home-readonly-loan-contract.md`  
**Authority checked:** `02` v3, `41`, `42`, `44`  
**Scope:** Product Contract, UX Contract, Acceptance Contract. No code changed and Trae remains unauthorized.

## Decision

**P1 CONTRACT / UX REVIEW: FAIL**  
**TRAE ENGINEERING GATE: HOLD**  
**TRAE IMPLEMENTATION: HOLD**

The P1 user scope is otherwise sufficiently detailed, but one P1 contract contradiction must be corrected before the Engineering Gate.

## P0

None found. Company isolation, logout invalidation, 401 cleanup, and no cross-company rendering are explicitly covered.

## P1

### P1-1 — `Endpoints.getKyc` boundary contradicts itself

`45 §6.1` says the future P2 `getKyc` endpoint definition is **REUSE / P1 forbidden**, while `§33` architecture guard 1 says to **delete** the `getKyc` constant inside P1. These are different engineering decisions and leave the implementation contract ambiguous.

Required resolution:

```text
KEEP endpoint definition for future P2 / P1 must not call it
```

The guard and task card must enforce usage prohibition and request-count zero without deleting the future API definition. This is the only blocking P1 finding in this review.

## P2

1. `refreshListenable` is a reasonable current GoRouter implementation input, but the observable contract is router refresh on auth/company/candidate state changes; the document should avoid making a specific mechanism the long-term product contract.
2. OQ-1 is functionally already frozen as **30 seconds, waiting states only, foreground and visible**; remove the question wording and keep it as a policy. This is deliberately different from H5's 15-second polling.
3. OQ-2 is already resolved as **P1 local UI locale only; no `POST /api/h5/locale`**. Remove it from the open-question table or mark it CLOSED.
4. OQ-3 (`FLAG_SECURE`) is correctly nonblocking P2/release work.
5. OQ-4 should be frozen as the task-card report name `50-P1-implementation-report.md`, not left as a project-adjustable question.
6. OQ-5 generic localized reject-event copy is a nonblocking P2 copy decision and does not affect state behavior.
7. Company-level locale persistence is specified; logout preserves the company preference by implication. Add one explicit acceptance assertion for restart, switch, and logout to remove any remaining test ambiguity.

## SCOPE

**PASS.** Entry, Auth, Real Home, state read, Loan List, read-only Detail, latest five events, repayment summary, Me, locale, password, company switch, and logout are included. KYC writes, loan writes, settlement, messages, H5 fallback, and persistent offline business cache are excluded.

## ROUTES

**PASS.** The inventory has real purposes for all routes, no `/feature/*`, no KYC or loan-application route, no Messages route, and explicit guards/back behavior. Company links only select a company and do not authenticate.

## HOME

**PASS.** H1–H22 plus cold-offline H21' cover KYC, current/legacy/unknown loan statuses, loading, refresh failure, offline, and 401. Each actionable row has one valid primary destination at most one secondary; disabled future actions terminate in a four-part page-local status panel.

## LOANS

**PASS.** The shared `GET /api/h5/state` snapshot drives list and detail. Fields, `createdAt` descending order, term fallback, short-ID derivation, read-only behavior, `max(0, amount + fee - paid)`, and latest-five event filtering/sorting are explicit. P4 extends the same detail route rather than creating a second model.

## AUTH

**PASS.** E.164 canonical input, consent from an unchecked control, OTP/pending recovery, masked-display versus canonical resend, password/recovery, candidate preflight, App Link runtime handling, auth/company/password guards, 401 Return Intent, and no POST replay are covered.

## LOCALE

**PASS.** The contract selects `server languages ∩ bundled locales`, drives `MaterialApp.locale`, requires ARB keys for all P1 user-facing text, and chooses the local-only policy with no P1 `POST /api/h5/locale`.

## NETWORK

**PASS.** `GET /api/h5/state` is the sole business source, retry is bounded to safe GET failures, real `code`/`retryAfter`/HTTP fallback mapping is required, and tests retain the company Cookie/Guard context after retry. The implementation must not copy a raw Cookie header to bypass the guard.

## SECURITY

**PASS.** Company A state is discarded before B loads, mismatched snapshots are never rendered, logout/401 clear memory, secrets and full identifiers are excluded from logs, and debug cleartext is limited to `10.0.2.2` with no release-wide allowance.

## TEST CONTRACT

**PASS.** The contract includes table-driven H1–H22/H21', unknown status, remaining clamp, event filtering, company isolation, logout/401 invalidation, locale, hardcoded-string, route, forbidden-endpoint, retry/Guard, and request-count tests.

## RUNTIME

**PASS as an exit requirement.** R1/R2 emulator or device evidence covers Entry, Auth, Home, Loans, Detail, Me, language, company switch, and logout. Build-only evidence is explicitly insufficient.

## OPEN QUESTIONS

- OQ-1: **CLOSED** — freeze 30-second polling only for waiting states while foreground and visible; H5's 15 seconds is not reused.
- OQ-2: **CLOSED** — P1 local UI locale only; no server locale sync.
- OQ-3: **P2 NONBLOCKING** — `FLAG_SECURE` / recent-task screenshot policy.
- OQ-4: **CLOSED** — implementation report name is `50-P1-implementation-report.md`.
- OQ-5: **P2 NONBLOCKING** — generic localized reject event copy is acceptable for P1.

## RECOMMENDATION

Keep the P1 implementation on HOLD. Correct P1-1 by retaining the future `getKyc` endpoint definition while forbidding all P1 use and testing zero requests. Then re-review the small editorial OQ cleanups and proceed to the Trae Engineering Gate. Do not write Flutter code in this review.

