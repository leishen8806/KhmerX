# P1 Final Delta Gate

**Review date:** 2026-10-08  
**Project:** KhmerX  
**Reviewed:** C1–C5 in `49-P1-claude-final-gate.md` against `02`, `45`, `47`, `48`, and current source  
**Scope:** Delta verification only. No code or contract files were modified.

## C1 — HTTP 403 Mapping

**VALID.** Current server code commonly emits inferred `FORBIDDEN` for 403 (`lib/error-codes.ts`) and distinguishes cross-site through the actual message `不允许跨站操作`; it does not provide a dependable `CROSS_SITE_FORBIDDEN` code. The approved behavior is message/catalog plus explicit-code mapping for known cases, with unknown 403 mapped to generic forbidden and never automatically to cross-site.

## C2 — retryAfter Clamp

**VALID.** The frozen rule is default 60, preserve every valid 1–3600 value, and cap values above 3600. Source priority is body `retryAfter`, then `Retry-After`, then 60. Values 1–59 must remain unchanged. The current mapper still requires implementation correction, but 49 states the correct acceptance behavior and introduces no new contract decision.

## C3 — Locale Persistence Key

**VALID.** The clarification correctly requires the existing `KeySchema`/approved storage abstraction. The current `KeySchema` can be extended with the approved company preference key; an ad-hoc `v1/app/locale/${companyId}` string is not permitted. Observable behavior remains the already-frozen company-scoped locale lifecycle.

## C4-A — `billing.net` Fallback

**VALID.** `02` and `45` specify `billing.net ?? amount`; `billing.principal` is not the fallback. The current H5 display also uses `billing.net ?? amount`, so the clarification matches the real state/display behavior.

## C4-B — Empty Loans UX

**VALID.** `41`, `42`, `45`, and `47` require an informational empty Loans state only. It has no enabled or disabled application button and no Loan Application CTA; application remains P3.

## C5 — Regression Baseline

**VALID.** The correct baseline is 165 executed, 162 passing, and three known A11y failures. Previously passing tests must not be removed, skipped, disabled, or made failing; new P1 tests may increase the total; all tests, including the three A11y cases, must pass before P1 Exit. This is measurable and does not freeze the test count at 162.

## Contract Integrity

None of C1–C5 introduces new product behavior, a backend API, P2/P3/P4 scope, or unresolved contract ambiguity. They correct implementation assumptions while preserving the approved P1 contract.

**CONTRACT DELTA = NON-MATERIAL CLARIFICATION**

## Final Decision

P0 = 0 and P1 = 0 for the delta review. The remaining work is implementation and exit evidence, including applying the C2 parser rule and completing the A11y/runtime/build conditions.

