# B0 Hosted Migration Path Final Acceptance Re-review

## Scope

This is an independent re-review of the hosted migration-path fix reported in `85-B0-hosted-migration-path-fix-report.md`. It does not modify application code, migrations, deployment configuration, or tests.

## Project identity

- Project: KhmerX
- Root: `E:/KhmerX/KhmerX`
- Remote: `git@github.com:leishen8806/KhmerX.git`
- HEAD: `d916b4515a93057d7dd2a0673ebbca39a7bfd242`
- Required runbook, implementation report, and prior acceptance files are present.

## Evidence executed

- `node --experimental-vm-modules --test tests/migrations-replay.test.mjs`: 15 passed, 0 failed, 0 skipped.
- `node --experimental-vm-modules --test tests/*.test.mjs`: 213 passed, 0 failed, 1 unchanged skip (`kyc-local`), 214 total.
- Targeted B0 syntax/lint checks: 0 errors, 0 warnings.
- `node scripts/b0/repro-bug.mjs`: reproduces the pre-fix defect and exits 1; this is expected and is not an acceptance failure.
- Hosted CLI process checks were run with disposable D1 persistence.

## Findings

### P0

None.

### P1

1. **Standalone confirmation guard is not value-bound.** The command
   `node scripts/b0/migrate-hosted.mjs --env standalone --apply --confirm dev`
   exited 0 and applied all 42 migrations. The runbook and contract require the
   explicit confirmation value `standalone`; any supplied value currently passes.
   This is a production-safety boundary defect.
2. **Hosted coverage does not test the wrong-confirmation case.** Existing hosted
   tests cover missing confirmation, but not a mismatched confirmation value, so
   the defect above escaped the reported 12-test suite.
3. **Report count is not independently reproducible.** Report 85 claims 225
   passing tests; the current full suite produced 213 passing, 0 failing, and 1
   unchanged skip. The lower count may reflect a worktree/report revision
   mismatch, but the report's numerical evidence is not current evidence.

### P2

None beyond the P1 evidence gap.

## Hosted model

- **HOSTED MODEL:** PASS
- **MODEL:** `CUSTOM_RUNNER`
- **AUTHORITATIVE RUNNER:** PASS. `scripts/b0/migrate-hosted.mjs` delegates application to `scripts/lib/migration-runner.mjs` and `applyStandaloneMigrations`.
- **SECOND MIGRATION ENGINE:** NO. `dist/server/wrangler.json` has no active Wrangler migration list; the deployment uses the documented custom Miniflare/workerd-compatible runner.
- **HOSTED APPLY COMMAND:** PASS as an entry point: `npm run migrate:hosted -- --env <env> --apply`.
- **ACTUAL COMMAND:** `node scripts/b0/migrate-hosted.mjs --env standalone --apply --confirm standalone`.

## CLI safety and target resolution

- **MISSING ENVIRONMENT:** FAILS SAFE. No `--env` exits 2.
- **PRODUCTION DEFAULT:** NO. No environment is implicit.
- **STANDALONE APPLY GUARD:** FAIL. Missing confirmation exits 2, but a wrong value is accepted (P1-1).
- **D1 TARGET RESOLUTION:** PASS. Binding is `DB`, database id is `payease`, and persistence is selected from explicit `D1_PERSIST_DIR` or `/data/d1` for standalone; dev uses a temporary directory.
- **ENVIRONMENT COLLISION SAFETY:** PASS with the guard defect isolated above. Dev ignores the standalone persistence override and uses a temporary directory; standalone requires an explicit environment and confirmation.

## Migration state and failure behavior

- **MIGRATION STATE:** PASS. State is stored in `standalone_migrations` through the shared runner.
- **FAILURE PROPAGATION:** PASS. Controlled failure tests show nonzero exit, only the prior migration recorded, later migrations not executed, and atomic rollback.
- **FAILED MIGRATION STATE:** NO.
- **LATER MIGRATIONS AFTER FAILURE:** NO.
- **STATUS/PENDING READ-ONLY:** PASS for application migrations. The command may initialize the metadata table, but it does not execute application migrations.

## Deployment and operations

- **DEPLOYMENT ORDER:** PASS. `deploy/standalone/server.mjs` applies migrations before `server.listen`.
- **INVOKER MODEL:** PASS. The runbook and wrapper agree on the custom runner and D1 binding.
- **CI MIGRATION PATH:** DOCUMENTED. No automated CI migration job is claimed; the runbook identifies the manual/operator path.
- **CREDENTIAL MODEL:** PASS. No credentials are embedded and no production database was used by the acceptance tests.
- **WRANGLER DUAL SYSTEM:** NONE.

## Regression and scope checks

- **B0 REGRESSION:** PASS (15/15 replay tests).
- **FULL BACKEND SUITE:** PASS with one unchanged skip (213/0/1).
- **HOSTED TEST QUALITY:** PARTIAL. Runtime CLI, shared runner, temp persistence, rollback, and state behavior are exercised, but mismatched confirmation is absent (P1-2).
- **HOSTED COVERAGE:** INCOMPLETE for the confirmation contract.
- **FINANCIAL MIGRATIONS:** 0.
- **BUSINESS LOGIC CHANGES:** 0 attributable to this hosted-path fix.
- **TEST INTEGRITY:** PASS; no test deletion or skip manipulation was observed.
- **STATIC CHECKS:** PASS; 0 errors and 0 warnings in targeted B0 files.
- **CONTRACT GAP:** 0 outside the confirmation defect.
- **B0 / GATE B REMOTE D1 SEPARATION:** PASS; this path does not claim to execute the remote Cloudflare D1 Gate B migration.

## Decision

The hosted migration entry point exists and the shared runner, state tracking, rollback, deployment ordering, and B0 replay behavior are sound. The standalone confirmation check is not safe enough for production because it accepts an arbitrary confirmation value, and the implementation report's test count is stale or unreproducible.

**B0 hosted path: REJECTED pending targeted fix.**

Required before re-acceptance:

1. Require `--confirm standalone` exactly for standalone apply; reject missing and mismatched values.
2. Add a process-level test for a mismatched confirmation value.
3. Regenerate the implementation report with the current full-suite count and current evidence.

Gate A remains accepted. Gate B remains HOLD. No business migrations or Gate B remote D1 actions are authorized by this review.
