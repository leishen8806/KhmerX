# Gate B Financial Foundation Acceptance Review

## Scope and identity

Independent review of the local Gate B implementation and exit gate. No code,
database, migration, test, contract, or prior report was modified.

- Project: KhmerX
- Root: `E:/KhmerX/KhmerX`
- Remote: `git@github.com:leishen8806/KhmerX.git`
- HEAD: `d916b4515a93057d7dd2a0673ebbca39a7bfd242`

## Local evidence executed

- Finance subset (`finance-migration`, `finance-d1-cas`, `finance-legacy-block`,
  `finance-positions`, `feature-flag`): **42 passed, 0 failed**.
- `institution-callback` + `team-integration`: **40 passed, 0 failed**.
- `migrations-replay` + hosted migration suite: **36 passed, 0 failed**.
- `node --experimental-vm-modules --test tests/*.test.mjs`: **277 total, 276
  passed, 0 failed, 1 unchanged pre-existing skip** (`kyc-local`).
- Type check: one existing error at `lib/errors/envelope.ts:85`; no Gate B
  source error was reported.
- Targeted Gate B ESLint: **0 errors** and **0 warnings**.
- Migration 0042 and existing-volume/fresh-volume replay passed in the local
  tests; hosted migration tests passed.

## Findings

### P0

None observed. CAS guarded writes, final binding indexes, rollback assertions,
and stale-writer zero-side-effect tests passed.

### P1

1. **Emergency prebinding is incomplete.** The approved plan requires request-time
   binding of `loanId + action + cents + currency`. `lib/team/emergency.ts`
   stores only `currency` at request time; `loanId`, `action`, and `cents` are
   first supplied to `assertEmergencyAccess` at consumption. This contradicts
   the Gate B hardening contract and the implementation report.
2. **Required local concurrency scenarios are absent:** D1-5 (repayment vs
   accrual), D1-6 (reversal vs repayment), and D1-7 (funding vs settlement).
   Existing D1 tests cover stale writers and parallel repayments, not these
   interleavings.
3. **D1-8 batch/parameter-limit behavior is absent.** No construction-time
   limit or rejection test was found.
4. **D1-17 guard mutation coverage is absent.** There is no mutation test proving
   that removing any authority guard makes an existing stale-writer test fail.
5. **MFA rebinding evidence is incomplete.** The current team integration test
   covers enrollment/login/replay, but does not exercise re-enrollment while MFA
   is already enabled and prove step-up authorization plus pending-secret
   preservation. The plan marks this test as required.

### P2

None beyond the documented CR-012 follow-up below.

## Acceptance matrix

- **FINANCIAL SCHEMA:** PASS.
- **MIGRATION 0042:** PASS; one forward migration, no historical rewrite, no
  later-Gate product tables.
- **LEGACY LOAN ISOLATION:** PASS.
- **OLD PATH BYPASS:** 0 observed in the legacy regression suite.
- **POLICY BINDING:** PASS.
- **DEFAULT DENY:** PASS.
- **IMMUTABLE FINANCIAL TERMS:** PASS; terms are built from contract snapshot
  inputs, not workspace JSON.
- **FINANCIAL_VERSION:** PASS; CAS advances monotonically.
- **CAS OWNERSHIP:** PASS.
- **OWNERSHIP GUARD PARAMETER BINDING:** PASS; guards reference the final bound
  transaction id in audited constructors.
- **AUTHORITATIVE WRITE GUARD COVERAGE:** COMPLETE for the Gate B finance
  service constructors.
- **COMMIT ASSERTION:** PASS; fact counts are asserted in the same batch.
- **STALE WRITER AUTHORITATIVE SIDE EFFECTS:** 0.
- **FIRST FINANCIAL STATE INITIALIZATION:** PASS.
- **FIRST INITIALIZATION RACE:** PASS for the tested first-activation race.
- **EXTERNAL SOURCE UNIQUENESS:** PASS.
- **LOANID IN SOURCE UNIQUENESS:** NO.
- **SOURCE NORMALIZATION:** PASS.
- **EXTERNAL SOURCE RACE:** PASS; genuine concurrent D1 test.
- **REPAYMENT LEDGER FOUNDATION:** PASS.
- **REVERSAL TARGET:** PASS.
- **REVERSAL-OF-REVERSAL:** BLOCKED.
- **REVERSAL POSITION ACCOUNTING:** PASS for partial/full reversal position
  tests.
- **CHARGE LEDGER FOUNDATION:** PASS.
- **PENALTY CHARGING ENABLED:** NO.
- **FINANCIAL EVENTS:** PASS.
- **CANONICAL FINANCIAL POSITION:** PASS.
- **CANONICAL REBUILD:** PASS by projection/rebuild tests.
- **WORKSPACE JSON AUTHORITY:** NO.
- **SETTLEMENT AUTHORITY:** PASS; centralized in `settlement.ts`.
- **CONTROLLED REOPEN:** PASS.
- **VOIDED TERMINAL:** PASS.
- **FUNDING_EXCEPTION REVERSAL:** PASS.
- **FUNDING FOUNDATION:** PASS.
- **REAL FUNDING ENABLED:** NO.
- **CALLBACK REPLAY SAFETY:** PASS.
- **PROVIDER BUSINESS CONSUMERS:** 0.
- **CALLBACK REGRESSION:** PASS.
- **MFA REBINDING:** FAIL — required scenario is not automated.
- **EMERGENCY AUTHORIZATION:** PASS for consume-time exact matching and
  non-consumption on mismatch.
- **EMERGENCY PREBINDING:** CHANGE REQUIRED.
  Rationale: only currency is persisted at request time; loan/action/cents are
  not request-bound as required by plan 71 §8.
- **ADMIN DUAL CONTROL:** PASS as Gate B architecture; C1/D enforcement remains
  deferred.
- **paymentVerified NEW TRUST PATH:** NO; the Gate B diff does not introduce a
  new trust path.
- **BACKFILL IDEMPOTENCY:** PASS.
- **LEGACY PATH REGRESSION:** PASS.

## D1 coverage gaps

- **D1-5:** MISSING — P1 local evidence gap.
- **D1-6:** MISSING — P1 local evidence gap.
- **D1-7:** MISSING — P1 local evidence gap.
- **D1-8:** MISSING — P1 implementation/test gap; no limit guard or test.
- **D1-17:** MISSING — P1 guard-coverage evidence gap.

These are distinct from the remote-only parity gate. The plan explicitly marks
the D1 test gate as P1 when required execution/evidence is absent.

## Migration and static checks

- **FRESH MIGRATION REPLAY:** PASS.
- **EXISTING MIGRATION REPLAY:** PASS.
- **HOSTED MIGRATION:** PASS.
- **FULL BACKEND REGRESSION:** PASS — 277 total / 276 passed / 0 failed / 1
  unchanged skip.
- **TEST INTEGRITY:** PASS for observed tests; no deleted test or skip substitution
  was found. The missing scenarios remain a coverage gap.
- **GATE B NEW TYPE ERRORS:** 0.
- **GATE B NEW ESLINT ERRORS:** 0.
- **PRE-EXISTING TYPE ERROR ATTRIBUTION:** PASS; the only compiler error is in
  the pre-existing Gate A error-envelope file, outside Gate B changes.
- **DATABASE CHANGES:** 1 new migration only (`0042`); no historical migration
  changed.
- **MIGRATION SQL CHANGES:** 1 new Gate B migration; 0 historical rewrites.
- **FINANCIAL MIGRATIONS:** 0 beyond the approved foundation migration.
- **FINANCIAL BUSINESS CHANGES:** 0 product activation.

## Contract and deferred item

- **CR-012 DEFERRED ITEM:** P2.
  The deferred item is whether legacy-freeze or invalid reversal-target cases
  need a dedicated public reason/code. The current frozen compatibility codes
  are sufficient for Gate B and the plan explicitly assigns this to a later
  CR-012 increment.
- **CONTRACT GAP:** 0 for the frozen Gate B API/product boundary.

## Remote exit gate

- **REMOTE NON-PRODUCTION D1:** BLOCKED.
- **REMOTE ENVIRONMENT:** unavailable; no dedicated non-production Workers D1
  was provided.
- Required remote parity evidence (rollback, stale CAS, unique conflict,
  external-source race, financial interleavings, append-only triggers,
  parameter limits, and same-commit/rollback behavior) was not run. Local
  Miniflare evidence is not substituted for remote D1 evidence.

## Decision

Because local P1 gaps remain, the local implementation is not accepted. The
remote exit gate is also blocked, but that is not the only blocker.

- **LOCAL IMPLEMENTATION:** FAIL.
- **GATE B:** REJECTED pending targeted fixes.
- Gate A remains accepted; B0 remains accepted.
- Gate C1/C2/D/E/F remain HOLD.
