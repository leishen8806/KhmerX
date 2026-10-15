# Gate A Targeted Fix Implementation Report

```yaml
Document:   79-Gate-A-targeted-fix-implementation-report.md
Date:       2026-10-09
Executor:   TRAE
Role:       Implementation Fixer
Status:     IMPLEMENTATION COMPLETE — ready for CODEX Gate A Acceptance Re-review
Source:     78-Gate-A-error-foundation-acceptance-review.md
Contract:   61-CR-012-state-error-registry.md v3.1
Plan:       70-Gate-A-CR012-error-foundation-plan.md
Gate:       B · CR-004/005/006/007 · NOT STARTED. no self-acceptance.
```

## Project Identity

```yaml
Project: KhmerX
Root: E:\KhmerX\KhmerX
Remote: git@github.com:leishen8806/KhmerX.git
Starting HEAD: d916b4515a93057d7dd2a0673ebbca39a7bfd242
Worktree: single working tree (B0 + Gate A changes present; no B0 behavior touched here)
DATABASE CHANGES: 0
```

## Source Acceptance Review

Source: `78-Gate-A-error-foundation-acceptance-review.md`

```yaml
P0: 0
P1: 3   (P1-A1 standard exits, P1-A2 code validation, P1-A3 safe-message boundary)
P2: 2   (details value validation, semantic test strengthening)
GATE A: REJECTED → targeted fix authorized
```

## P1-A1 — Standard Error Exits (CLOSED)

Every migrated primary error exit now returns the standard envelope:

```json
{ "error": "<customer-safe fallback>", "code": "<stable public code>", "traceId": "<trusted server trace>" }
```
and HTTP header `X-Request-Id == traceId`.

### Changes

- `lib/h5-auth.ts` — `failure(e, traceId?)` rewritten to delegate to `classify` + `toEnvelope`,
  so the auth-route family (`/api/h5/auth/*`) emits the full envelope on every error exit and
  no longer echoes an arbitrary AuthError code. `failure()` now generates a trusted traceId if
  none was threaded (fallback), but routes always establish one at entry.
- `app/api/h5/state/route.ts` — one trusted `t = serverTraceIdFor(request)` established at the
  top of GET and POST; the previously-unwrapped **outer** `catch(e){ failure(e) }` (which caught
  errors from `customer()` / `input()`) is now routed through `classify`+`toEnvelope` with `t`
  on every branch (GET catch, POST inner catch, POST outer catch). Confirmed envelope for
  cross-site, oversized, invalid-JSON, known ApiError, legacy error, and unexpected bare Error.
- `app/api/state/route.ts` — one `t = serverTraceIdFor(request)` per handler; the **early
  pre-catch exits** (cross-origin rejection, oversized-request rejection) that previously
  returned raw `json({error:...})` now return the standard envelope via an `envelope(e, t)`
  helper using `CROSS_SITE_REQUEST` (403) and `PAYLOAD_TOO_LARGE` (413). GET success/error and
  POST success/error all thread the same `t`.

No new error registry was created; route files do not duplicate registry semantics.

### Primary Error Exit Matrix

| Exit | envelope code | envelope traceId | X-Request-Id == traceId | status |
|---|---|---|---|---|
| `/api/h5/state` GET outer catch | ✓ classify | ✓ | ✓ | registry/classified |
| `/api/h5/state` POST inner catch (domain/Kyc) | ✓ classify | ✓ | ✓ | registry/classified |
| `/api/h5/state` POST outer catch (customer/input) | ✓ classify | ✓ | ✓ | registry/classified |
| `/api/state` GET catch | ✓ classify | ✓ | ✓ | registry/classified |
| `/api/state` POST cross-origin reject | CROSS_SITE_REQUEST | ✓ | ✓ | 403 |
| `/api/state` POST oversized reject | PAYLOAD_TOO_LARGE | ✓ | ✓ | 413 |
| `/api/state` POST catch | ✓ classify | ✓ | ✓ | registry/classified |
| `/api/h5/auth/*` failure() | ✓ classify | ✓ | ✓ | registry/classified |

```yaml
PRIMARY ERROR EXITS WITHOUT code: 0
PRIMARY ERROR EXITS WITHOUT traceId: 0
PRIMARY ERROR EXITS WITHOUT X-Request-Id: 0
```

## P1-A2 — Public Code Validation (CLOSED)

### Rule

Before any code is emitted publicly it must be one of:
- **A.** a canonical `ERROR_REGISTRY` code, or
- **B.** an explicitly approved legacy alias from the frozen `APPROVED_LEGACY_ALIAS_SET`.

Anything else is **unregistered** and is never exposed: the classifier records it via the
`unregisteredCode` metric sink and fails closed to `500 INTERNAL_ERROR` with a trusted traceId.
No third category exists.

### Canonical → Legacy → Unknown decision

| Input | Public result |
|---|---|
| `code ∈ ERROR_REGISTRY` (e.g. `CUSTOMER_SETTLEMENT_FORBIDDEN`, `REVISION_CONFLICT`, `NAME_INVALID`) | canonical code emitted using registered status semantics |
| `code ∈ APPROVED_LEGACY_ALIAS_SET` (frozen §6.1 coarse codes: `CONFLICT`, `INVALID_VERIFICATION_CODE`, `INVALID_FILE`, `INVALID_KYC`, `INVALID_ARGUMENT`, `REQUEST_FAILED`) | legacy-compatible code emitted (OD-12.1-governed) |
| any other explicit `code` (e.g. `PRIVATE_DATABASE_FAILURE`, `TELEGRAM_INITDATA_REPLAY`, `PASSWORD_ADMIN_ISSUE_FORBIDDEN`, `PAYMENT_RECEIPT_UNVERIFIED`, `INVITE_TOKEN_REQUIRED`, `KYC_SCAN_REQUIRED`) | **never public** → `unregisteredCode` metric + `500 INTERNAL_ERROR` same-trace |

### Changes

- `lib/errors/legacy-alias.ts` — added a frozen, finite `APPROVED_LEGACY_ALIAS_SET` sourced from
  the CR-012 §6.1 recognized legacy-inference outputs that are NOT canonical registry codes.
- `lib/errors/envelope.ts` (`classify`) — the duck-typed AuthError/KycError branch now resolves
  `candidate = explicit ?? codeForError(...)` and validates it against `ERROR_REGISTRY` OR
  `APPROVED_LEGACY_ALIAS_SET`. Unregistered values fail closed to `500 INTERNAL_ERROR` and are
  counted; they are never emitted.

```yaml
UNREGISTERED PUBLIC CODE EXPOSURE: 0
CANONICAL CODE: PASS
LEGACY ALIAS: PASS
UNKNOWN CODE: PASS
```

## P1-A3 — Safe Message Validation (CLOSED)

### Rule

ApiError public `error` text is **authoritative from the registry**. Caller-supplied
`safeMessage` is honored ONLY if it is an explicitly approved per-code variant from the frozen
`LEGACY_SAFE_MESSAGE_VARIANTS` allow-list. Any other override (SQL, stack, provider raw,
staff-only, internal lifecycle, exception.message) is ignored — the canonical registry message
is used and the attempted string is never leaked.

### Changes

- `lib/errors/api-error.ts` — added `LEGACY_SAFE_MESSAGE_VARIANTS` (frozen). Registered the
  exact historical customer-safe fallback for `CUSTOMER_SETTLEMENT_FORBIDDEN`
  (`'还款或提现需通过机构审核及受支持的支付渠道处理'`), matching what `lib/domain.ts` supplies and
  what `lib/h5-auth-core.ts`/store tests assert.
- `ApiError` constructor now resolves `safe = canonical`; only an approved variant may set a
  different exact text; any unapproved `safeMessage` is dropped (metric `detailsStripped`).

```yaml
UNVALIDATED SAFE MESSAGE EXPOSURE: 0
CANONICAL SAFE MESSAGE: PASS
APPROVED LEGACY SAFE VARIANT: PASS
```

## P2 — Details Value Validation (PASS)

`api-error.ts` `hardenDetailValue` now validates **both key and value shape** per CR-012 §5:

| key | accepted value | rejected examples |
|---|---|---|
| `field` | controlled field-key string `^[a-zA-Z][a-zA-Z0-9]*$` | `0xdeadbeef internal` |
| `missing` | array of controlled field-key strings | array-of-objects |
| `limitCents`/`minCents`/`maxCents` | safe integer `0..1e11` | `Number.MAX_SAFE_INTEGER`, `-5`, `NaN` |
| `retryAfter` | finite `0..86400` | `999999999`, negative |
| `expiresAt` | finite `>= 0` timestamp | `-1`, `Infinity` |
| `currentStatus` | controlled enum-style string | `; DROP TABLE` |
| `reason` | per-code enum whitelist (registry `reasons`) | cross-code `FUNDING_EXCEPTION` on `REVERSAL_NOT_ALLOWED` |

Invalid values are stripped (never leaked); the `reason` whitelist continues to reject cross-code
values.

## P2 — Semantic Test Strengthening (PASS)

`tests/error-coverage.test.mjs` now asserts the frozen status/retry/ui/log (+ reasons) semantics
for the critical public codes: `EXTERNAL_REFERENCE_CONFLICT`, `REVERSAL_NOT_ALLOWED`,
`RECEIVING_ACCOUNT_STALE`, `DISBURSEMENT_NOT_AVAILABLE`, `ALLOCATION_POLICY_MISSING`,
`STAFF_DUAL_CONTROL_REQUIRED`, `MFA_STEP_UP_REQUIRED`, `REVISION_CONFLICT`, `INTERNAL_ERROR`,
`CROSS_SITE_REQUEST`, `PAYLOAD_TOO_LARGE`, `INVALID_REQUEST` — plus a cross-check that every
declared `reasons` enum is uppercase. Expectations come from CR-012, not runtime output.

## Canonical Code vs Legacy Alias vs Unknown Code

| Category | Value | Public emitted? |
|---|---|---|
| Canonical registry | `CUSTOMER_SETTLEMENT_FORBIDDEN`, `REVISION_CONFLICT`, `NAME_INVALID`, `CROSS_SITE_REQUEST`, ... | YES (canonical code) |
| Frozen legacy alias | `CONFLICT`, `INVALID_VERIFICATION_CODE`, `INVALID_FILE`, `INVALID_KYC`, `INVALID_ARGUMENT`, `REQUEST_FAILED` | YES (temporary, OD-12.1) |
| Unregistered/arbitrary | `PRIVATE_DATABASE_FAILURE`, `SOME_STAFF_ONLY_REASON`, `TELEGRAM_INITDATA_REPLAY`, `PASSWORD_ADMIN_ISSUE_FORBIDDEN`, `PAYMENT_RECEIPT_UNVERIFIED`, `INVITE_TOKEN_REQUIRED`, `KYC_SCAN_REQUIRED` | NO → `500 INTERNAL_ERROR` (+ metric) |

## Safe Message Rules

- Default public text = `safeMessageByCode[code]` (authoritative registry).
- Approved variant = exact string in `LEGACY_SAFE_MESSAGE_VARIANTS[code]` → allowed.
- Anything else → ignored; canonical text emitted; no leak. Deterministic across code/tests.

## Details Validation Rules

See `## P2 — Details Value Validation` above. Whitelist key-set is exactly CR-012 §5.

## Files Changed (this targeted fix, Gate A only)

```text
lib/errors/envelope.ts                      (P1-A2 classify validation; doc)
lib/errors/api-error.ts                     (P1-A3 safe message variants; P2 value shapes)
lib/errors/legacy-alias.ts                  (P1-A2 APPROVED_LEGACY_ALIAS_SET)
lib/h5-auth.ts                              (P1-A1 failure → classify/envelope)
app/api/h5/state/route.ts                   (P1-A1 one trace + outer catch envelope)
app/api/state/route.ts                      (P1-A1 early rejects → envelope; one trace)
tests/gate-a-fix.test.mjs                   (NEW · A-FIX-01..18 + compatibility)
tests/error-coverage.test.mjs               (P2 semantic fixtures)
```

B0 files (`deploy/standalone/Dockerfile`, `deploy/standalone/server.mjs`, `scripts/b0/*`,
`scripts/lib/*`, `tests/migrations-replay.test.mjs`) were NOT modified by this targeted fix.

## Tests

Targeted matrix `tests/gate-a-fix.test.mjs` (A-FIX-01..18) + strengthened `error-coverage.test.mjs`:

```text
A-FIX-01..04  migrated primary early exits: code + traceId + X-Request-Id == traceId   PASS
A-FIX-05      canonical AuthError/KycError code emitted                                PASS
A-FIX-06      approved legacy alias emitted                                            PASS
A-FIX-07      random AuthError code blocked → INTERNAL_ERROR                           PASS
A-FIX-08      random KycError code blocked; repo unregistered codes never public       PASS
A-FIX-09      canonical safeMessage used                                               PASS
A-FIX-10      approved legacy safe variant allowed                                     PASS
A-FIX-11      arbitrary safeMessage cannot leak                                        PASS
A-FIX-12      SQL/internal/provider/stack safeMessage cannot leak                      PASS
A-FIX-13      details invalid value type stripped safely                               PASS
A-FIX-14      reason whitelist enforced per code                                       PASS
A-FIX-15      critical code semantic metadata matches CR-012 (error-coverage, 12 codes) PASS
A-FIX-16      REQUEST_FAILED absent from migrated primary paths (static + fixtures)    PASS
A-FIX-17      UNCLASSIFIED never public                                               PASS
A-FIX-18      external X-Request-Id still untrusted                                    PASS
```

## Full Regression

```text
Command: node --experimental-vm-modules --test tests/*.test.mjs
Result:  186 passed / 0 failed / 1 skipped
Skip:    kyc-local (pre-existing, unrelated)
```

Prior accepted baseline was 160 pass / 0 fail / 1 skip; the delta (+26) is the new
`gate-a-fix` + semantic tests. 0 previously-passing tests were removed or weakened.

## Static Checks

```text
Syntax:  node --experimental-strip-types --check on all changed TS modules  → PASS
         node --check on new/changed .mjs tests                              → PASS
ESLint:  eslint on changed/new files (envelope, api-error, legacy-alias, h5/state, state,
         gate-a-fix, error-coverage) → 0 errors, 0 warnings
         (the single `no-explicit-any` in lib/h5-auth.ts is pre-existing baseline, not new)
```

## Database Changes

```text
DATABASE CHANGES: 0
Migration files added: 0
Schema changes: 0
```

No migrations, D1 schema, or SQL files were added or modified by this fix.

## Worktree Attribution

```text
Gate A (this fix):  lib/errors/envelope.ts, api-error.ts, legacy-alias.ts, lib/h5-auth.ts,
                    app/api/h5/state/route.ts, app/api/state/route.ts,
                    tests/gate-a-fix.test.mjs, tests/error-coverage.test.mjs
B0 (pre-existing, untouched):  deploy/standalone/Dockerfile, server.mjs, scripts/b0/*,
                    scripts/lib/*, tests/migrations-replay.test.mjs
Pre-existing/unrelated: docs/audit files, lib/error-codes.ts, lib/domain.ts, lib/store.ts,
                    auth route files, tests/*.mjs from prior Gate A deliverable
```

The B0 changes remain present in the working tree but were not touched or relied upon for this
Gate A targeted fix. No B0 behavior was altered.

WORKTREE ATTRIBUTION: PASS

## Contract Gap

```yaml
CONTRACT GAP: 0
```

No new codes were invented. The 5 unregistered repo codes are neutralized (not registered), which
is the required fail-closed behavior under P1-A2/78 §2.4. No product/API semantics were invented.

## P0

```yaml
count: 0
```

## P1

```yaml
count: 0
P1-A1 Standard Error Exits: CLOSED
P1-A2 Public Code Validation: CLOSED
P1-A3 Safe Message Validation: CLOSED
```

## P2

```yaml
count: 0 (both prior P2 items closed by this fix)
```

Deferred breadth (unchanged, not a release blocker, tracked separately):
- remaining ~100 unmapped plain `throw Error` points on non-primary paths
- broad explicit-code rollout across remaining AuthError/KycError call sites
- institution-callback legacy `requestId` alias retirement (OD-12.1)

## Readiness for Codex Re-acceptance

```yaml
PRIMARY ERROR EXITS WITHOUT code: 0
PRIMARY ERROR EXITS WITHOUT traceId: 0
PRIMARY ERROR EXITS WITHOUT X-Request-Id: 0
UNREGISTERED PUBLIC CODE EXPOSURE: 0
UNVALIDATED SAFE MESSAGE EXPOSURE: 0
UNCLASSIFIED PUBLIC EXPOSURE: 0
REQUEST_FAILED PRIMARY PATH REGRESSION: 0
DB CHANGES: 0
P0: 0
P1: 0
FULL REGRESSION: PASS (186 passed / 0 failed / 1 pre-existing skip)
GATE A TARGETED FIX: COMPLETE → CODEX GATE A ACCEPTANCE RE-REVIEW
```

## Final

```yaml
PROJECT IDENTITY CHECK: PASS
Starting HEAD: d916b4515a93057d7dd2a0673ebbca39a7bfd242
Final HEAD: d916b4515a93057d7dd2a0673ebbca39a7bfd242 (working-tree changes, UNCOMMITTED per §31)
DATABASE CHANGES: 0
IMPLEMENTATION: COMPLETE
NEXT: CODEX GATE A ACCEPTANCE RE-REVIEW
```

Do NOT start Gate B. Do NOT modify financial schema. Do NOT self-accept Gate A.