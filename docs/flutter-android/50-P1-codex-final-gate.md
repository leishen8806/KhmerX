# P1 Codex Final Gate

**Review date:** 2026-10-08  
**Project:** KhmerX  
**Reviewed:** `48-P1-trae-engineering-gate.md` against `45-P1-entry-home-readonly-loan-contract.md` and `47-P1-contract-final-review.md`  
**Scope:** Independent check for new Contract / UX / Acceptance blockers. No code changed.

## Decision

**CODEX P1 FINAL GATE: HOLD**

## P0

None newly introduced. The gate preserves the required company isolation, snapshot invalidation, logout cleanup, 401 cleanup, and no cross-company rendering conditions.

## P1

### P1-1 — Retry-after clamp contradicts the approved contract

`45 §14`/`§27` and the approved API baseline require:

```text
missing / invalid / <= 0  -> 60 seconds
1..3600                  -> server value
>3600                    -> 3600 seconds
```

`48 §15.2` instead specifies clamping both body and header values to `60..3600`. That changes valid server values `1..59` to 60 seconds and therefore changes the frozen 429 UX contract. The implementation task is otherwise feasible, but its acceptance rule must be corrected to the approved numeric rule before the Engineering Gate can be marked ready.

## P2

The following are legitimate implementation or exit conditions with defined outcomes and tests; they do not require a new product/API decision:

- Three current accessibility overflow failures; fix the affected scroll/layout behavior and complete the 320/360/412dp × 130%/200% matrix.
- Hardcoded-English migration to ARB keys.
- 401 invalidation, safe Return Intent, and GET-only restoration.
- Retry/Guard cookie-header correction, provided the retry-after rule above is used.
- Error mapping, SafeLogger/redaction, and debug cleartext tightening to `10.0.2.2` only.
- Company-scoped locale persistence, warm App Link handling, scanner verification, and Android R1/R2 runtime evidence.
- Fresh debug APK evidence, real OTP integration evidence, ARB linguistic review, `FLAG_SECURE`, App Link asset links, and release hardening.
- 48's summary count of “5” P2 dependencies versus its detailed P2-01..P2-11 list is editorial and nonblocking.

## Contract

**STILL VALID.** 45 and 47 remain internally valid. The retry-after error is in 48's engineering acceptance detail, not a need to redefine Product Remap or the P1 scope.

## Acceptance

**NOT READY.** The 429 acceptance test must prove the full `missing / invalid / <=0 / 1..3600 / >3600` rule, including preservation of 1–59 seconds.

## Engineering Conditions

**BLOCKING** until P1-1 is corrected in the Engineering Gate. All other listed conditions are nonblocking implementation/exit work because their outcomes are already specified and testable.

## Task Cards

`BLOCKED = 0` is otherwise justified: the cards use existing APIs, defined DTOs, existing architecture, and P1 scope. No card requires a new backend endpoint or undefined product behavior. P1-1 is a gate acceptance correction, not a new task-card architecture block.

## Recommendation

Keep Trae implementation on HOLD. Correct the retry-after clamp and its tests, then rerun the final three-party gate. Do not authorize implementation from this review.

