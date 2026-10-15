# Backend CR Bundle Final Re-review

**Date:** 2026-10-09  
**HEAD:** `d916b4515a93057d7dd2a0673ebbca39a7bfd242`  
**Scope:** Final adversarial re-review of 57/58/59/60/61 against 62/63/64/65. No files 57–65, 02, 45, or 55 were modified.

## Result

**BACKEND CR BUNDLE FINAL RE-REVIEW: FAIL**

P1-R1, P1-R2, and P1-R3 are closed at contract level. However, one cross-contract P1 remains: CR-012 registers `FUNDING_EXCEPTION` as a `REVERSAL_NOT_ALLOWED` reason while CR-007 explicitly permits reversal in `FUNDING_EXCEPTION`. This makes the public error behavior non-deterministic.

## P0

- None confirmed from this final contract review.

## P1

- **P1-CROSS-1 — OPEN:** `REVERSAL_NOT_ALLOWED.details.reason` in CR-012 includes `FUNDING_EXCEPTION`, but CR-007 §3.5.1 says `FUNDING_EXCEPTION` reversals are allowed and do not reopen/change phase. Remove that reason or define the separate forbidden condition. Until corrected, error coverage and client handling are contradictory.

## P2

- D1 rollback/concurrency proof, ARB wording, and MFA rebind runtime tests remain implementation evidence gates.
- Fresh-volume migration remains a release gate, not a contract ambiguity.
- The emergency authorization target-binding hardening remains a security gate.

## P1-R1: CLOSED

### EXTERNAL SOURCE UNIQUENESS: PASS

The final contract consistently defines:

`tenantId + channel + sourceRefNormalized`

without `loanId`, with first validated binding to loan/customer/amount/currency. Manual claims do not reserve a bank reference; employee confirmation binds it. Provider callbacks bind only after callback verification and PaymentIntent matching. The unique binding row is the cross-loan serialization point.

### CROSS-LOAN REUSE: PASS

Same binding is idempotent. A different loan, customer, amount, or currency produces no posting, a reconciliation exception, and `409 EXTERNAL_REFERENCE_CONFLICT`. Concurrent attempts permit exactly one binding. Legacy `team_repayment_receipts` is required to backfill the same binding protection.

**Implementation gate:** the callback consumer must map its verified provider reference into this same `ExternalSourceBinding` path; it must not rely only on eventId/idempotencyKey dedupe.

## P1-R2: CLOSED

### SETTLED REVERSAL: PASS

The contract requires approved reversal, maker-checker, MFA, reason, original ledger reference, idempotency, audit, and a shared settlement engine.

### CONTROLLED REOPEN: PASS

One loan-level CAS transaction appends the reversal, recalculates the position, reopens only when remaining is positive, clears the current settled marker, increments financial version, and updates the projection. No ordinary repayment endpoint can reopen a loan.

### DELINQUENCY RECOMPUTE: PASS

Reopen recalculates from the original due date, immutable bound policy, and current Asia/Phnom_Penh date. It cannot unconditionally map `SETTLED → CURRENT`. No accrual is backfilled during the settled interval.

### VOIDED REVERSAL: PASS

`VOIDED` cannot reopen through repayment reversal and returns `REVERSAL_NOT_ALLOWED(reason=VOIDED)`.

## P1-R3: CLOSED

### REISSUE ELIGIBILITY: PASS

Only `FUNDING_EXCEPTION` plus an approved REISSUE resolution and no active instruction can enter the reissue path.

### NEW ACCOUNT CONFIRMATION: PASS

Old confirmation is historical only. Reissue requires a new confirmation bound to loan, current account reference/version, snapshot hash, KYC revision, confirmation ID, request id, and expiry.

### NEW INSTRUCTION: PASS

A brand-new `DisbursementInstruction` is mandatory. The returned instruction remains immutable history.

### VOID: PASS

VOID creates explicit `VOIDED`, blocks reissue, repayment, delinquency accrual, and further funding, and is not represented as settlement.

## FINANCIAL TERMS SOURCE: PASS

Principal, contract fee, term, fundedAt/dueAt, allocation policy, and bound delinquency policy are sourced from immutable accepted contract/quote snapshots and copied into `loan_financial_terms`. Mutable workspace JSON is explicitly excluded.

## LEGACY ERROR MIGRATION: PASS

The alias table covers the currently emitted generic meanings, including:

- `INVALID_VERIFICATION_CODE`
- `INVALID_FILE`
- `INVALID_KYC`
- `INVALID_ARGUMENT`
- `CONFLICT`

Old and canonical codes may coexist during migration; new paths use explicit codes; `UNCLASSIFIED_ERROR` is not public.

## EMERGENCY AUTH FACT: CORRECT

The documents now match current code:

- one-time consumption;
- MFA approval;
- requester-only use;
- `funding` scope required;
- loan/action/cents recorded on consumption, not pre-bound and validated;
- `admin` is not in `highRiskRoles`.

This is correctly classified as partially closed and requiring hardening.

## MIGRATION SECURITY FACT: CORRECT

- Trigger `BEGIN/END` splitting: **CONFIRMED CLOSED**.
- `0030/0031) audit-table conflict: **CONFIRMED CLOSED**.
- Fresh-volume migration: **CONFIRMED OPEN** because `0015` contains a semicolon in a comment and `splitSql` still does not skip comments.

## AUTHORITY MODEL: PASS

| Concern | Authority |
|---|---|
| External payment fact | `ExternalSourceBinding` / provider reference uniqueness |
| Repayment accounting | `repayment_ledger` |
| Penalty/fee accounting | `loan_charge_ledger` |
| Financial position | Shared canonical server calculation |
| Loan activation | Authoritative funding confirmation |
| Closure/reopen | Shared financial settlement engine |
| Delinquency | Server engine + immutable bound policy |
| Public API errors | CR-012 registry |

## LIFECYCLE MATRIX: PASS

| Phase | Repayment | Delinquency accrual | Funding/reissue | Closure |
|---|---|---|---|---|
| signed | No | No | First instruction allowed | No |
| funding pending/processing | No | No | Await confirmation | No |
| active | Yes | Yes, per bound policy | No ordinary reissue | Shared engine only |
| FUNDING_EXCEPTION | No | Suspended | Approved REISSUE only | Blocked |
| closed / SETTLED | No | No | No | Reversal only through controlled reopen |
| VOIDED | No | No | No | Terminal |
| reopened active | Yes | Recomputed from original due date | No ordinary reissue | Shared engine |

## ERROR COVERAGE: INCOMPLETE

The registry covers the required named errors, including:

`EXTERNAL_REFERENCE_CONFLICT`, `REVERSAL_NOT_ALLOWED`, `RECEIVING_ACCOUNT_STALE`, `DISBURSEMENT_NOT_AVAILABLE`, and `ALLOCATION_POLICY_MISSING`.

But the `REVERSAL_NOT_ALLOWED) reason whitelist contradicts CR-007 by including `FUNDING_EXCEPTION`. This is the remaining P1. `failureCode` remains separate from HTTP errors.

## OPEN DECISIONS

No new product/legal/provider values are required for this final review. Existing decisions remain correctly classified as implementation or production gates:

- OD-4.3: implementation gate for checker threshold/approval.
- OD-4.4: P6-B/provider implementation and production gate.
- OD-5.1: account-validation implementation input.
- OD-5.2: confirmation TTL implementation input.
- OD-5.3: returned-funds implementation/production gate; state semantics are frozen.
- OD-5.4: fundedAt/dueAt rule is specified but remains implementation blocker until owner/legal confirmation.
- OD-7.3: production financial-posting gate until allocation order is supplied.
- OD-7.4: accrual implementation gate.
- OD-7.5: waiver/write-off implementation gate.
- OD-7.6: accrual-basis input; state-only mode remains safe.
- OD-12.1: deprecation decision; does not block implementation.

## SECURITY GATES

- `paymentVerified`: **CONFIRMED OPEN**
- callback replay insertion: **CONFIRMED OPEN**
- callback consumer absence: **CONFIRMED OPEN**
- MFA rebinding: **APPEARS CLOSED — TEST REQUIRED**
- Admin financial dual control: **REQUIRES RE-VERIFICATION**
- Emergency authorization: **PARTIALLY CLOSED — REQUIRES HARDENING**
- migration trigger splitting: **CONFIRMED CLOSED**
- fresh-volume migration: **CONFIRMED OPEN**
- `0030/0031` audit conflict: **CONFIRMED CLOSED**

## D1 IMPLEMENTATION TEST GATES

These do not create a contract failure while semantics remain deterministic:

- remote D1 rollback parity;
- concurrent financial interleavings;
- fresh-volume migration replay after the parser fix;
- max batch/parameter limits;
- outbox atomicity on converted paths.

## CONTRACT VERDICTS

- **CR-004:** PASS, subject to the CR-012 reason correction and implementation gates.
- **CR-005:** PASS, subject to security/production gates.
- **CR-006:** PASS, subject to outbox and device lifecycle tests.
- **CR-007:** PASS, subject to the CR-012 reason correction and policy inputs.
- **CR-012:** CHANGE REQUIRED — remove or redefine `FUNDING_EXCEPTION` under `REVERSAL_NOT_ALLOWED`.

## IMPLEMENTATION

**NOT AUTHORIZED DURING REVIEW**

## TRAE

**HOLD**

## NEXT

**CLAUDE CONTRACT FIXES** — one narrow fix: reconcile the `REVERSAL_NOT_ALLOWED` reason whitelist with CR-007, then rerun this final review.

