# Gate A Error Foundation — Acceptance Re-review

```yaml
Project: KhmerX
Root: E:/KhmerX/KhmerX
Remote: git@github.com:leishen8806/KhmerX.git
HEAD: d916b4515a93057d7dd2a0673ebbca39a7bfd242
Basis:
  - 78-Gate-A-error-foundation-acceptance-review.md
  - 79-Gate-A-targeted-fix-implementation-report.md
Scope: targeted re-review only; no implementation, database, contract, plan, or report changes
```

## Decision

```yaml
PROJECT IDENTITY CHECK: PASS
GATE A ACCEPTANCE RE-REVIEW: FAIL
GATE A: REJECTED
IMPLEMENTATION: NO FURTHER CHANGES AUTHORIZED BY THIS REVIEW
TRAE: HOLD
GATE B: HOLD
NEXT: TRAE TARGETED FIX
```

## P0

```yaml
count: 0
```

## P1

```yaml
count: 0
P1-A1: CLOSED
P1-A2: CLOSED
P1-A3: CLOSED
```

## P2

```yaml
count: 1
```

### P2-1 — Details value validation is incomplete

`hardenDetailValue()` still accepts values that the re-review contract requires to be rejected or stripped:

- `expiresAt` accepts unsafe integers because it checks only `Number.isFinite` and `>= 0`.
- `currentStatus` accepts arbitrary identifier-like strings such as `employeeId`, rather than a frozen status enum.
- `field` accepts arbitrary identifier-like internal names such as `internalId`.
- `limitCents` uses a bound inconsistent with its own comment (`100_000_000_000_00`, approximately `1e13`, rather than the stated `1e11`).

Independent reproduction:

```text
new ApiError('AUTH_REQUIRED', {
  details: {
    expiresAt: Number.MAX_SAFE_INTEGER + 1,
    currentStatus: 'employeeId',
    field: 'internalId',
    limitCents: 1000000000000
  }
}).details
```

The values are retained. This leaves the required details validation check open.

## Required Matrix

```yaml
P1-A1: CLOSED
PRIMARY ERROR EXITS WITHOUT code: 0
PRIMARY ERROR EXITS WITHOUT traceId: 0
PRIMARY ERROR EXITS WITHOUT X-Request-Id: 0
TRACE CONTINUITY: PASS

P1-A2: CLOSED
UNREGISTERED PUBLIC CODE EXPOSURE: 0
LEGACY ALLOWLIST: PASS
UNREGISTERED EXISTING CODE HANDLING: PASS

P1-A3: CLOSED
UNVALIDATED SAFE MESSAGE PUBLIC EXPOSURE: 0
SETTLEMENT SAFE VARIANT: PASS
LEGACY MESSAGE SAFETY: PASS

DETAILS VALUE VALIDATION: FAIL
DETAILS.REASON: PASS
SEMANTIC TEST QUALITY: PASS
REQUEST_FAILED PRIMARY PATH: PASS
UNCLASSIFIED PUBLIC EXPOSURE: 0
TRACE TRUST MODEL: PASS

DATABASE CHANGES: 0
SCOPE: PASS
WORKTREE ATTRIBUTION: PASS
```

## Evidence

### P1-A1

`/api/h5/state` and `/api/state` now create a trace before early exits and route cross-site, oversized, invalid JSON, customer/input, known typed, legacy, and unexpected errors through the standard envelope. Auth routes use `failure()` with classified envelopes. Static inspection found zero primary exits missing `code`, `traceId`, or `X-Request-Id`; route-level tests passed.

### P1-A2

`classify()` now permits only registry codes or the finite `APPROVED_LEGACY_ALIAS_SET` (`CONFLICT`, `INVALID_VERIFICATION_CODE`, `INVALID_FILE`, `INVALID_KYC`, `INVALID_ARGUMENT`, `REQUEST_FAILED`). Unknown explicit codes fail closed to `500 INTERNAL_ERROR` and invoke the unregistered-code metric. Direct tests for all previously observed unregistered examples passed.

### P1-A3

`ApiError` uses the registry message by default and permits only the exact code-specific settlement variant. Arbitrary, SQL-like, provider, stack-like, and staff-only overrides were independently exercised and were not emitted.

### Semantic coverage and reason rules

The strengthened semantic test covers the required critical codes and status/retry/UI/log metadata. `REVERSAL_NOT_ALLOWED` remains HTTP 409 with only `VOIDED` and `ALREADY_REVERSED`; cross-code reasons are stripped.

## Test Results

```yaml
TARGETED TESTS: PASS (24 passed, 0 failed, 0 skipped)
FULL BACKEND REGRESSION: PASS (186 passed, 0 failed, 1 pre-existing skip)
SKIP: kyc-local; unchanged and unrelated to Gate A
TEST INTEGRITY: PASS
NEW STATIC ERRORS: 0
NEW STATIC WARNINGS: 0
PRE-EXISTING WARNING: 1 no-explicit-any warning in lib/h5-auth.ts
CONTRACT GAP: 0
```

No migration, D1 schema, financial, repayment, disbursement, delinquency, or push changes were introduced by the targeted fix. B0 files remain separately attributed and were not modified by this fix.

## Required Trae Fix

Close P2-1 by enforcing the exact value shapes and bounds required by CR-012, including safe integer checks for timestamps/amounts and controlled enums for `field` and `currentStatus`; add regression assertions for the rejected examples above. Re-run the targeted suite, full regression, static checks, and this acceptance re-review.

## Final State

```yaml
P0: 0
P1: 0
P2: 1
GATE A: REJECTED
IMPLEMENTATION: NO FURTHER CHANGES AUTHORIZED BY THIS REVIEW
TRAE: HOLD
GATE B: HOLD
NEXT: TRAE TARGETED FIX
```
