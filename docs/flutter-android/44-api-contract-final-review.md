# 02 API Contract Final Review

**Review date:** 2026-10-08  
**Reviewed:** `docs/flutter-android/02-api-contract.md` v3  
**Baseline:** `43-api-contract-reconciliation-review.md` and current H5/API source  
**Scope:** Final verification of the eight findings only. No code was changed.

## 43 Findings

| Finding | Status | Verification |
|---|---|---|
| P1-1 `error.code` + `REQUEST_FAILED` | **CLOSED** | `02` now records response `code`, the ordinary 400 `REQUEST_FAILED` collapse, and prohibits inferring hidden backend reasons. |
| P1-2 `repay` / `withdraw` backend blocked | **CLOSED** | `02` records HTTP 403 `CUSTOMER_SETTLEMENT_FORBIDDEN`, no feature flag, and no executable Android action. |
| P1-3 100-loan limit | **CLOSED** | `02` states **CONFIRMED ABSENT** in the complete current customer create path and retains only the unfinished-loan/KYC preconditions. |
| P1-4 unknown loan status fallback | **CLOSED** | Unknown/future values are safe read-only states, never coerced to `registered`, never given write CTAs, and do not crash. |
| P1-5 remaining amount clamp | **CLOSED** | `02` freezes `max(0, amount + fee - paid)` when no authoritative server remaining field exists. |

## P2

| Finding | Status | Verification |
|---|---|---|
| P2-1 P1 state field boundary | **CLOSED** | `02` now defines Home/list/detail fields, ignored internal fields, event filtering/order, and latest-five behavior. |
| P2-2 `needs_info` P1/P2 boundary | **CLOSED** | API supports edit/resubmit in P2; P1 only reads `state.kyc.status`, does not call `GET /api/kyc`, and does not expose review text. |
| P2-3 Mini App-only capabilities | **CLOSED** | Telegram silent auth and reminder subscription are explicitly Mini App-only; Native Android uses Gateway/password/session recovery. |

## Critical Truth Check

- `repay`: unavailable / backend blocked.
- `withdraw`: unavailable / backend blocked.
- 100-loan count limit: absent in the current customer create path.
- Customer create response: `kyc_approved`.
- Unknown loan status: safe read-only fallback.
- Remaining: `max(0, amount + fee - paid)` as display derivation when no authoritative server field exists.

## P1 State

`02` now provides enough API evidence to write the **P1 Entry + Real Home + Read-only Loan Contract** without guessing Home fields, Loan List fields, Loan Detail fields, `needs_info` source, remaining source, or unknown-status behavior.

## Final Decision

No P0 or P1 findings remain open. The API baseline is ready for P1 Contract authoring. This review does not authorize implementation.

