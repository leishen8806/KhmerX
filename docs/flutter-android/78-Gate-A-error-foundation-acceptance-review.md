# Gate A — CR-012 Error Foundation Acceptance Review

```yaml
Project: KhmerX
Root: E:/KhmerX/KhmerX
Remote: git@github.com:leishen8806/KhmerX.git
HEAD: d916b4515a93057d7dd2a0673ebbca39a7bfd242
Implementation report: 76-Gate-A-error-foundation-implementation-report.md
Scope: acceptance only; no code, database, contract, plan, or report changes
```

## Decision

```yaml
PROJECT IDENTITY CHECK: PASS
GATE A ACCEPTANCE: FAIL
GATE A: REJECTED
IMPLEMENTATION: NO FURTHER CHANGES AUTHORIZED BY THIS REVIEW
TRAE: HOLD
NEXT: TRAE TARGETED FIX
```

## P0

```yaml
count: 0
```

No demonstrated public secret disclosure or financial/database mutation was introduced by Gate A. The findings below are P1 because they break the frozen error/trace contract on primary paths or permit unregistered public error codes.

## P1

```yaml
count: 3
```

### P1-1 — Primary error exits bypass the standard envelope and trace

`app/api/h5/state/route.ts` has an outer `catch` that calls `failure(e)` without a server trace. Errors thrown by `customer()`, `input()`, or the outer request setup can therefore return a legacy body without `traceId` and without `X-Request-Id`.

`app/api/state/route.ts` also returns raw JSON before the classified catch for cross-origin rejection and oversized request rejection. Those responses have no canonical `code`/`traceId` envelope. These are primary `/api/h5/state` and `/api/state` exits, so this is not merely deferred migration breadth.

Required fix: generate one trusted trace at route entry and route every error exit through `classify` + `toEnvelope` (or an equivalent helper) while preserving the stable status/code semantics.

### P1-2 — Unknown explicit AuthError/KycError codes are emitted publicly

`classify()` emits any explicit legacy error code as-is without checking the authoritative registry or an approved legacy-code allow-list. A direct reproduction returns:

```json
{"error":"x","code":"NOT_A_REGISTERED_CODE","traceId":"req_x"}
```

The repository contains explicit codes absent from `ERROR_REGISTRY`, including `TELEGRAM_INITDATA_REPLAY`, `PASSWORD_ADMIN_ISSUE_FORBIDDEN`, `PAYMENT_RECEIPT_UNVERIFIED`, `INVITE_TOKEN_REQUIRED`, and `KYC_SCAN_REQUIRED`. This contradicts the required guarantee that unknown/unregistered canonical codes cannot silently enter a public API.

Required fix: validate explicit codes against the canonical registry or a frozen, separately declared legacy allow-list; unknown values must be mapped safely and counted rather than emitted verbatim. Add a regression test covering an unknown explicit AuthError/KycError code.

### P1-3 — ApiError safe-message boundary is not enforced

`ApiError` accepts `opts.safeMessage` verbatim. `ApiError.ensureSafeMessage()` exists but is not used by the constructor, and no test rejects an unsafe/internal message. The current call sites happen to pass user-safe text, but the foundation permits SQL, stack, provider, or internal lifecycle text to become a public `error` field.

Required fix: enforce the safe-message policy in the constructor or remove arbitrary caller-supplied messages in favor of the registry message; add an assertion against internal/exception text.

## P2

```yaml
count: 2
```

- `error-coverage.test.mjs` verifies required CR-004/005/006/007 code presence, but does not assert each code's frozen status/retry/UI semantics. Registry inspection is consistent; add semantic fixture coverage during the targeted fix.
- `ApiError` details whitelist filters keys and reasons, but does not validate value shapes for `missing`, numeric limits, `expiresAt`, or `retryAfter`. This is hardening debt, not the current rejection cause.

## Scope

```yaml
SCOPE: PASS
```

Inspected Gate A changes are limited to the typed error foundation, registry, envelope/classification, trace propagation, legacy aliases, primary `REQUEST_FAILED` migration, and related tests. No repayment, disbursement, delinquency, push, or financial product implementation was attributable to Gate A.

## Worktree Attribution

```yaml
WORKTREE ATTRIBUTION: PASS
```

The implementation report explicitly separates B0 files (`deploy/standalone/Dockerfile`, `scripts/lib/*`, `scripts/b0/*`, `tests/migrations-replay.test.mjs`) from Gate A. The acceptance review does not count B0 as Gate A evidence.

## Required Acceptance Matrix

```yaml
DATABASE CHANGES: 0
ERROR REGISTRY: PASS
API ERROR: FAIL
STAGED MIGRATION SAFETY: FAIL
REQUEST_FAILED PRIMARY PATH: FAIL
DOMAIN ERROR MAPPING: PASS
TRACE TRUST MODEL: PASS
GATEWAY ERROR ENVELOPE: PASS
UNCLASSIFIED PUBLIC EXPOSURE: 0
DETAILS WHITELIST: PASS
LEGACY COMPATIBILITY: FAIL
RETRY BOUNDARY: PASS
CROSS-CR ERROR COVERAGE: COMPLETE
REGISTRY EXPORT: PASS
NEW TEST QUALITY: PASS
```

### Evidence notes

- `REVERSAL_NOT_ALLOWED` is correctly registered as HTTP 409 with only `VOIDED` and `ALREADY_REVERSED`; `FUNDING_EXCEPTION` is not a permitted reason.
- Trace tests pass for forged inbound headers, gateway proof adoption, response/header equality, and requestId separation.
- The targeted Gate A suite passed 23/23 tests.
- Full backend regression passed 160 tests, failed 0, skipped 1. The skipped `kyc-local` test is pre-existing and unrelated to Gate A.
- ESLint reported 0 errors and 8 warnings, all matching existing warning categories; no new static error was observed.
- `UNCLASSIFIED_ERROR` did not appear in the public envelope tests; unexpected bare errors map to 500 `INTERNAL_ERROR`.

## Test Results

```yaml
GATE A TESTS: PASS (23 passed, 0 failed, 0 skipped)
FULL REGRESSION: PASS (160 passed, 0 failed, 1 pre-existing skip)
NEW STATIC ERRORS: 0
```

## Deferred A4/A5 Breadth

```yaml
DEFERRED A4/A5 BREADTH: P2
RATIONALE: Remaining unmapped plain errors and broad AuthError/KycError rollout can remain staged only after explicit unknown-code values are prevented from public emission and migrated primary exits have complete trace envelopes.
```

## Contract Gap

```yaml
CONTRACT GAP: 3 implementation gaps
```

The three P1 findings above are implementation defects against the existing CR-012 contract; no new product or API semantics are invented.

## Required Trae Targeted Fixes

1. Close every primary-route error exit with a trusted trace and canonical envelope, including the outer H5 state catch and early `/api/state` rejects.
2. Add registry/legacy allow-list validation for explicit AuthError/KycError codes and tests for unknown codes.
3. Enforce the ApiError safe-message boundary and add a leakage regression test.
4. Re-run the Gate A suite, full regression, static checks, and this independent acceptance review.

## Final Acceptance

```yaml
P0: 0
P1: 3
P2: 2
SCOPE: PASS
WORKTREE ATTRIBUTION: PASS
DATABASE CHANGES: 0
GATE A: REJECTED
TRAE: HOLD
NEXT: TRAE TARGETED FIX
```
