# Gate A Details Validation Final Fix

```yaml
Project: KhmerX
Root: E:/KhmerX/KhmerX
Remote: git@github.com:leishen8806/KhmerX.git
HEAD: d916b4515a93057d7dd2a0673ebbca39a7bfd242
Basis:
  - 80-Gate-A-error-foundation-acceptance-rereview.md
  - 79-Gate-A-targeted-fix-implementation-report.md
  - 78-Gate-A-error-foundation-acceptance-review.md
  - 61-CR-012-state-error-registry.md (§5)
  - 21-G1-company-auth-contract.md (§5.11.1, CF-7 frozen)
```

## Project Identity

```yaml
PROJECT IDENTITY CHECK: PASS
PROJECT: KhmerX
ROOT: E:\KhmerX\KhmerX
HEAD: d916b4515a93057d7dd2a0673ebbca39a7bfd242
REMOTE: git@github.com:leishen8806/KhmerX.git
WORKTREE: single (uncommitted Gate A WIP; no cross-task contamination)
```

## Source Review

Authority: **80** (`P2-1 · Details value validation is incomplete`). Review accepted everything else (P1-A1/A2/A3 CLOSED; reuse of envelope/trace/code/safeMessage/REQUEST_FAILED/UNCLASSIFIED). The single failing check:

- `expiresAt` accepts unsafe integers (only `Number.isFinite && >= 0`).
- `currentStatus` accepts arbitrary identifier-like strings (e.g. `employeeId`).
- `field` accepts arbitrary identifier-like internal names (e.g. `internalId`).
- `limitCents` uses a bound inconsistent with its own comment (`1e13` vs stated `1e11`).

## Exact Codex Finding

```text
new ApiError('AUTH_REQUIRED', {
  details: {
    expiresAt: Number.MAX_SAFE_INTEGER + 1,   // unsafe integer → must be rejected
    currentStatus: 'employeeId',               // not in loan status enum → must be rejected
    field: 'internalId',                       // not in public field keys → must be rejected
    limitCents: 1000000000000                  // invented 1e13 cap → must be REMOVED
  }
}).details
```

All four are corrected below.

## CR-012 §5 Validation Matrix

> Authoritative sources: CR-012 §5 whitelist; `lib/domain.ts` `Status` union; `lib/kyc/core.ts` `fields[]`/`slots[]` ids; 21 §5.11.1 `retryAfter` band. No invented constants.

| details key | allowed codes | allowed type | allowed enum/format | numeric/semantic constraint | invalid-value behavior |
|---|---|---|---|---|---|
| `field` | all (缺项键) | string | exact member of `PUBLIC_FIELD_KEYS` (KYC field/slot ids) | exact identifier match | `undefined` → dropped |
| `missing[]` | all (缺项键) | array-of-string | every element member of `PUBLIC_FIELD_KEYS` | all-or-nothing (any unknown drops whole array) | `undefined` → dropped |
| `limitCents` | all | number | — | safe integer, `>= 0`, no business cap | `undefined` → dropped |
| `minCents` | all | number | — | safe integer, `>= 0`, no business cap | `undefined` → dropped |
| `maxCents` | all | number | — | safe integer, `>= 0`, no business cap | `undefined` → dropped |
| `currentStatus` | all (贷款状态枚举) | string | exact member of `LOAN_STATUS_KEYS` (domain `Status` union) | exact enum match | `undefined` → dropped |
| `reason` | per-code | string | per-code finite whitelist (registry `reasons`, already accepted) | cross-code reason stripped | `undefined` → dropped |
| `expiresAt` | all | number | numeric epoch | safe integer, `>= 0`, resolves to real instant (`new Date(v).getTime() === v`) | `undefined` → dropped |
| `retryAfter` | all | number | numeric seconds | safe integer in `[1, 3600]` (21 §5.11.1) | `undefined` → dropped |

## Field Identifier Validation

- `PUBLIC_FIELD_KEYS` is a frozen `Set` of the authoritative public/customer-safe field identifiers, transcribed exactly from the KYC `fields[]` and `slots[]` `id` lists (**缺项键**).
- Generic identifier regex removed: `databasePassword`, `staffSecret`, `internalOwnerId`, `sqlQuery`, `randomField123`, `loanId`, `internalId` are all rejected.
- `missing[]`: any unknown element drops the **whole** array, so an internal identifier can never partially leak.
- Alignment test `DETAILS-FIX-EQ` imports `fields`/`slots` from `lib/kyc/core.ts` and asserts exact set equality (source-of-truth, no drift).

## Status Validation

- `LOAN_STATUS_KEYS` is a frozen `Set` of the authoritative loan-life-cycle status enum, transcribed from `lib/domain.ts` `Status`: `registered | kyc_pending | needs_info | kyc_approved | decision_pending | approved | rejected | signed | active | closed`.
- Regex-based acceptance removed: `employeeId`, `INTERNAL_DATABASE_CORRUPTED`, and mixed uppercase phase names (`ACTIVE`, `SETTLED`, `VOIDED`, `FUNDING_EXCEPTION`, `DRAFT`) are all rejected because they are not loan `Status` members.
- Similarly, worker statuses, payment statuses, funding statuses are not permitted (CR-012 §5 only enables the loan-status enum here) unless explicitly registered under this key.
- Alignment test `DETAILS-FIX-EQ` parses the `Status` union from `lib/domain.ts` and asserts exact set equality.

## Timestamp Validation

- `expiresAt` is validated as a **numeric epoch** (the CR-012 codebase representation): `Number.isSafeInteger(v)` **and** `v >= 0` **and** `new Date(v).getTime() === v` (resolves to a valid instant).
- Rejects: empty string, arbitrary text, ISO strings (wrong representation), `NaN`, `Infinity`, negative, fractional, unsafe integers (`MAX_SAFE_INTEGER+1`), out-of-range extreme values, arrays/objects.
- `Date.parse`-only checking is not used; the accepted representation is strictly numeric epoch.

## Money Validation

- Invented bound **removed**: `safeCents` no longer has `100_000_000_000_00` (1e13) or the stale `1e11` comment cap.
- Authority: the project money rule ("**所有金额必须使用 int cents**"). Accepted value must be a finite **safe integer** `>= 0`. That is the technical representability condition; there is **no** business maximum (CR-012 defines none, `lib/domain` defines none). A safe-integer cent value (`1_000_000_000_000`) now survives.
- Rejected: fractional cent (`100.5`), `NaN`, `Infinity`, negative, unsafe integer (`2^53`).
- **No ordering relation forced** between `limitCents`/`minCents`/`maxCents` because CR-012 does not define one; each is validated independently.

## RetryAfter Validation

- Reconfirmed against the frozen Contract rule 21 §5.11.1: `DEFAULT=60`, `MIN=1`, `MAX=3600`. Only the accepted band `1 ..= 3600` (finite safe integer seconds) survives.
- The previous implementation accepted `0 ..= 86400`; that is **corrected**: `0`, `-1`, `86400`, `999999999`, fractional, `NaN`, `Infinity`, and strings are all rejected.
- The envelope-level legacy `retryAfter` propagation (P1-A1) is untouched; this fix only governs `details.retryAfter`.

## Reason Validation

- Unchanged (already accepted by Codex): `details.reason` remains a per-code finite whitelist from the registry `reasons` (e.g. `REVERSAL_NOT_ALLOWED → VOIDED | ALREADY_REVERSED`). Cross-code reasons are stripped.
- Regression tests `DETAILS-FIX-19/20` prove valid reason survives and another code's reason is rejected.

## Nested/Unexpected Value Handling

- Key whitelist is not sufficient on its own: each value is shape-validated independently (values checked independent of keys).
- Rejected/stripped: nested arbitrary objects, functions/symbols (reject via type check), arrays where scalar expected, objects inside `missing[]`, SQL/raw text where an enum is required, internal ids where a public field enum is required, unexpected keys, template-literal/arbitrary identifiers.
- `DETAILS-FIX-21/22` cover nested objects and unexpected keys.

## Files Changed

| File | Change |
|---|---|
| `lib/errors/api-error.ts` | Added frozen `LOAN_STATUS_KEYS`, `PUBLIC_FIELD_KEYS`; rewrote `safeCents` (removed invented cap), added `safeEpoch`, `safeRetryAfter`; enforced vocabularies in `hardenDetailValue`. |
| `tests/details-value-fix.test.mjs` | **New** — `DETAILS-FIX-01..23` + authoritative-source alignment tests. |
| `tests/api-error.test.mjs` | Updated `field` fixture to an approved key; added assertion that internal field id (`loanId`) is rejected. |
| `tests/gate-a-fix.test.mjs` | `A-FIX-13` corrected: unsafe integer now strips, safe-integer cent survives (no invented cap); added `A-FIX-13b`. |

## Tests Added

`tests/details-value-fix.test.mjs`:

- `DETAILS-FIX-EQ` (x2): allowlist == authoritative `domain.Status` / `kyc.core` field+slot ids (frozen enums; no invented vocab).
- `DETAILS-FIX-01/02/03/04`: field identifier approval / arbitrary camelCase & internal ids rejected / `missing[]` all-approved survives / `missing[]` with unknown element dropped.
- `DETAILS-FIX-05/06`: approved `currentStatus` survives / arbitrary uppercase & internal statuses rejected.
- `DETAILS-FIX-07/08/09/10`: valid epoch survives / text rejected / impossible date rejected / wrong representation (object/array) rejected.
- `DETAILS-FIX-11/12/13/14/15/16`: valid cents survive / fractional & NaN & Infinity & unsafe integer rejected / no invented business maximum.
- `DETAILS-FIX-17/18`: `retryAfter` valid band survives / all invalid values rejected.
- `DETAILS-FIX-19/20`: valid reason survives / cross-code reason rejected.
- `DETAILS-FIX-21/22/23`: nested object & unexpected key handling / §5 whitelist exact.

## Targeted Test Results

```yaml
DETAILS-FIX suite: 25 passed / 0 failed / 0 skipped
Prior Gate A (gate-a-fix): 25 passed / 0 failed / 0 skipped
api-error (updated): 5 passed / 0 failed / 0 skipped
```

## Full Regression

```yaml
node --experimental-vm-modules --test tests/*.test.mjs
prior baseline: 186 pass / 0 fail / 1 pre-existing skip
after fix:      213 pass / 0 fail / 1 pre-existing skip  (+27 targeted/regression assertions)
SKIP: kyc-local; unchanged, unrelated to Gate A
```

No previously passing test deleted; no test weakened. The two assertions updated under P2-1 (`field: loanId`; `A-FIX-13 huge-integer cents`) encoded the rejected behavior and were **strengthened** to the corrected contract (internal ids rejected; safe-integer cents accepted with no invented cap).

## Static Checks

```yaml
eslint (changed files):          0 errors / 0 warnings (after removing one unused-var warning)
node --check (changed .mjs):     PASS (000 wtm)
tsc --noEmit -p tsconfig.json:   NEW ERRORS/WARNINGS for this fix: 0
```

> Note on `tsc`: the full-project `tsc --noEmit -p tsconfig.json` surfaces **one pre-existing** type error at `lib/errors/envelope.ts:85` (`status` `number | undefined`), which is part of the earlier uncommitted Gate A WIP and is **not** introduced by, nor in the authorized scope of, this details-validation fix. The prior review's static pass (79/80) used `eslint` + `node --check` and reported those clean. This fix adds no new `tsc` errors or warnings.

## Database Changes

```yaml
DATABASE CHANGES: 0
MIGRATIONS ADDED: 0
SQL/D1 schema:    untouched
B0:               untouched
Financial code:   untouched
Gate B:           not started
```

## Contract Gap

```yaml
CONTRACT GAP: 0
```

All required validators map to an explicit CR-012 §5 rule or an authoritative shared domain primitive/enum referenced by the current API semantics. No validation constant was invented.

## P0/P1/P2

```yaml
P0: 0
P1: 0
P2: 0
```

(p2-1 closed by implementation assessment; no new defect introduced.)

## Readiness for Final Codex Acceptance

- Detailed value validation is enforced from authoritative sources (no invented constants).
- Unsafe timestamp / arbitrary field id / arbitrary status id exposure = 0; invented amount bound removed; amount authority = int-cents safe integer.
- All targeted, prior Gate A, and full-backend tests pass; only pre-existing unrelated `kyc-local` skip remains.
- DB / migrations / financial / B0 untouched; Gate B not started.
- Worktree attribution: PASS (single Gate A WIP tree, no cross-task changes).

```yaml
IMPLEMENTATION: COMPLETE
TRAE: HOLD AFTER COMPLETION
GATE B: HOLD
NEXT: CODEX — FINAL GATE A ACCEPTANCE
```