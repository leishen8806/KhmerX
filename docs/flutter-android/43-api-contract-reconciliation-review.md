# 02 API Contract Reconciliation Quick Review

**Review date:** 2026-10-08  
**Reviewed:** `docs/flutter-android/02-api-contract.md`  
**Compared with:** Product Remap V3/42 and current H5/API source  
**Scope:** API fact reconciliation only. No code or API document was modified.

## Result

**02 API CONTRACT QUICK REVIEW: FAIL**  
**P1 CONTRACT AUTHORING: HOLD**

`02` still contains several old statements that would cause a P1 implementation or contract test to call blocked actions, omit response codes, or implement the wrong state/amount semantics.

## Required API Reconciliation

| # | Required fact | Result in `02` | Severity |
|---:|---|---|---|
| 1 | `error.code` is present in current JSON errors | `02` says there is no error-code field | **P1 — must fix** |
| 2 | Non-`KycError` `POST /api/h5/state` failures collapse to HTTP 400 with `code: REQUEST_FAILED` | Not recorded; it still describes concrete Chinese business errors as the normal contract | **P1 — must fix** |
| 3 | Customer `repay` is backend-blocked with HTTP 403 and `CUSTOMER_SETTLEMENT_FORBIDDEN` | `02` says the customer can execute it directly | **P1 — must fix** |
| 4 | Customer `withdraw` is backend-blocked with the same 403 code | `02` says the customer can execute it directly | **P1 — must fix** |
| 5 | The complete customer create path has no 100-loan count check | `02` asserts a hard-coded per-workspace 100-loan limit | **P1 — must fix** |
| 6 | Domain constructor defaults to `registered`; customer create is overridden before persistence and returned as `kyc_approved` | `02` is materially correct here | Closed |
| 7 | Loan compatibility includes current, legacy, and unknown values with read-only generic fallback | `02` lists current/legacy values but does not define unknown-value fallback or the full P1 compatibility behavior | **P1 — must clarify** |
| 8 | `GET /api/h5/state` returns the full filtered state; P1 uses the explicitly bounded loan/event fields and ignores internal fields | Broad response shape is present, but P1 field boundary is not carried through precisely | P2 |
| 9 | Remaining display is `max(0, amount + fee - paid)`; this is a display derivation, not fee calculation | `02` omits the clamp and only gives the unclamped arithmetic | **P1 — must fix** |
| 10 | First `GET /api/kyc` access may initialize a `draft` case | Correctly recorded | Closed |
| 11 | KYC `rejected` is terminal in the current backend path | Correctly recorded as locked | Closed |
| 12 | KYC `needs_info` is editable/resubmittable at the API layer; P1 product behavior is status-only and must not call this API | API capability is present, but the P1 status-only boundary is not explicit | P2 |
| 13 | Amount/term are not server-driven in the current H5 create path; server validates the fixed values | Correctly recorded | Closed |
| 14 | `/api/loan/quote` is not current; it remains CR-001/target flow only | Correctly recorded | Closed |
| 15 | Current H5 flow is create → billing/confirm_bill → sign → apply; CR-001 target flow is quote-before-create | Flow distinction is correctly recorded | Closed |
| 16 | Current legal terms are Chinese-only | Correctly recorded | Closed |
| 17 | Telegram silent auth and Telegram reminder subscription are Mini App-only; Android uses Gateway/password/recovery | `02` mentions no Telegram deep-link login but does not state the full Mini-only boundary | P2 |

## 100-loan Limit

**CONFIRMED ABSENT.** The reviewed customer create path is:

`POST /api/h5/state` → `mutate` customer preconditions → `customerAction`/`applyAction('create')` → customer-path `kyc_approved` override → workspace payload persistence → filtered response.

The path checks for an existing unfinished customer loan and approved KYC, but contains no `loans.length`, `>=100`, or `MAX_LOANS` guard. The existing `100` statement in `02` must be removed or replaced with this conservative conclusion.

## P0

None found in the document itself.

## P1

1. Correct the error contract to include `code`, including `REQUEST_FAILED` collapse for ordinary state-action failures.
2. Replace direct customer `repay`/`withdraw` behavior with the actual 403 backend block and `CUSTOMER_SETTLEMENT_FORBIDDEN` code.
3. Replace the 100-loan assertion with **CONFIRMED ABSENT** and retain only the unfinished-loan precondition.
4. Add unknown loan-status read-only fallback and the complete P1 compatibility mapping.
5. Add the frozen remaining derivation `max(0, amount + fee - paid)`.

## P2

1. Align the P1 state field boundary and ignored internal fields with Remap V3 Appendix B.
2. State that `needs_info` is an API capability for P2, while P1 is status-only and does not call `GET /api/kyc`.
3. Explicitly mark Telegram silent auth and reminder subscription as Mini App-only.

## API Baseline

**NOT READY.** The stale P1-impacting statements must be corrected in `02` before authoring the P1 API/DTO Contract.

