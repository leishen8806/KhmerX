# B0 — Hosted Cloudflare D1 Migration Path Targeted Fix Report

```yaml
Project: KhmerX
Root: E:/KhmerX/KhmerX
Remote: git@github.com:leishen8806/KhmerX.git
HEAD: d916b4515a93057d7dd2a0673ebbca39a7bfd242
Fix package: B0 — Hosted Cloudflare D1 Migration Path Targeted Fix
Authorization: GPT TARGETED FIX AUTHORIZATION = GRANTED
Role: Deployment / Migration Infrastructure Implementer
GATE A: ACCEPTED / CLOSED
GATE B: HOLD
NEXT OWNER: CODEX — B0 FINAL ACCEPTANCE RE-REVIEW
```

## Project Identity

| Check | Result |
|---|---|
| `git rev-parse HEAD` | `d916b4515a93057d7dd2a0673ebbca39a7bfd242` |
| `git remote -v` | `origin git@github.com:leishen8806/KhmerX.git` |
| root | `E:/KhmerX/KhmerX` (worktree for KhmerX P1/B0) |
| working tree | modified (uncommitted B0 hosted fixes + prior Gate A) |

Document basis verified: `73-B0-fresh-volume-migration-recovery-plan.md`,
`77-B0-fresh-volume-migration-implementation-report.md`,
`83-B0-fresh-volume-migration-acceptance-review.md`.

## Source Review (83)

Read `83-B0-fresh-volume-migration-acceptance-review.md` first, per §2.

- **B0 FINAL ACCEPTANCE: REJECTED**; single blocker `P1-B0-1`.
- **P0 = 0, P2 = 0**.
- **P1-B0-1 — HOSTED MIGRATION PATH = MISSING**: built `wrangler.json` has
  `migrations: []`; no `wrangler d1 migrations apply`; no invoker; no hosted
  migration-state table; environment/database selection unresolved.
- All other B0 areas (SQL splitter, replays, trigger guards, controlled failure,
  0030/0031, rollback model, audit immutability) are **ACCEPTED** and are NOT
  reopened by this fix.
- GATE A: ACCEPTED; GATE B: HOLD.

## Original Gap

The accepted B0 runner (`scripts/lib/migration-runner.mjs`) and the standalone
deployment boot-path migration existed, but there was **no explicit, executable,
environment-safe operator command** to drive the hosted D1 migration path.
`npm run migrate:hosted` did not exist; `wrangler.json migrations: []` was inert;
no helper answered (A) apply command, (B) invoker, (C) target database,
(D) environment, (E) migration state, (F) credentials.

## Deployment Inventory

Real deployment path audited (no assumptions):

| Artifact | Finding |
|---|---|
| `package.json` scripts | `migrate:hosted` added (this fix). No `wrangler d1 migrations apply`. |
| `deploy/standalone/server.mjs` | boot-time `applyStandaloneMigrations(db,{drizzleDir})` **before** `server.listen`; Miniflare `d1Databases:{DB:'payease'}`, `d1Persist:'/data/d1'`. |
| `deploy/standalone/Dockerfile` + `compose.yaml` | standalone Node/Miniflare image; volume `/opt/payease/data:/data`. No wrangler binary in image. |
| `.github/workflows/postloan-daily.yml` | daily post-loan job only; **no** deploy/migration/CI step. |
| `deploy/standalone/package.json` | depends on `miniflare` only (no wrangler). |
| `dist/server/wrangler.json` | generated, `migrations: []` — inert for this model. |
| `.openai/hosting.json` | `"d1": "DB"` → binding confirmed `DB`, database id `payease`. |
| `.env.example`, `next.config.ts`, `scripts/sites-env.mjs` | no hosted migration wiring. |
| `tests/migrations-replay.test.mjs`, `migrations-integrity.test.mjs`, `service-migration.test.mjs` | accepted B0/migration tests. |

### Deployment model decision (§9)

The project is **Model B** — custom accepted runner against the standalone
**Miniflare/workerd D1**, NOT Wrangler-native `wrangler d1 migrations apply`.
Therefore `wrangler.json migrations: []` is deliberately **not** filled; doing so
would create a second, half-active migration system. One authoritative runner +
one explicit wrapper is used.

## Authoritative Hosted Path

**Authoritative runner (unchanged, accepted):**
`applyStandaloneMigrations(db, {drizzleDir})` from
`scripts/lib/migration-runner.mjs`, applied by the standalone container at boot
(`deploy/standalone/server.mjs`) AND exposed as the explicit operator wrapper in
`scripts/b0/migrate-hosted.mjs`.

**Wrapper:** `scripts/b0/migrate-hosted.mjs` (`npm run migrate:hosted`) reuses the
exact accepted runner — no second migration engine.

Runner guarantees (preserved): migration identified by filename or numeric
prefix; unknown already-applied migration is a hard boot error; each migration is
one atomic `db.batch` (SQL + `INSERT INTO standalone_migrations`), failure rolls
back and is never recorded; ascending order; failure throws → caller stops;
comment-only migrations recorded as applied (idempotent). Lexical splitting via
`scripts/lib/split-sql.mjs` preserves the 0015 fix.

## Apply Command

```bash
npm run migrate:hosted -- --env <env> [--status|--list-pending|--apply] [--confirm <env>]
```

- `node scripts/b0/migrate-hosted.mjs` is the script entry (package.json
  `migrate:hosted`).
- `--env` is **required**; running without it exits non-zero (never silently
  targets production).

## Invoker

| Environment | Invoker | Production gate |
|---|---|---|
| `dev` | `npm run migrate:hosted -- --env dev --apply` | none (disposable temp D1, auto-cleaned) |
| `standalone` (hosted/production) | `npm run migrate:hosted -- --env standalone --apply --confirm standalone` | explicit `--confirm standalone` required |
| container boot | `deploy/standalone/server.mjs` applies the SAME runner before `server.listen` | n/a |

No CI migration is added; the existing workflow (`postloan-daily.yml`) has no
deploy/migrate step. Deployments are operator/release-controlled
(`docker compose up -d`), so migration ordering is deterministic.

## Environment Resolution

- **No `--env` → fail** (exit code 2). Preferred safety default.
- `dev` → disposable temporary D1 (non-production); `--status` prints
  `environment: dev (temporary, non-production)`.
- `standalone` → hosted persistent D1; `--status`/`--list-pending` are read-only
  and allowed; **apply** requires explicit `--confirm standalone`, otherwise
  refused (exit 2).
- Unknown env → exit 2.
- No separately-configured `staging` exists; none is faked. Operator may set an
  explicit `D1_PERSIST_DIR` to a non-production volume for staging-style preflight
  using the same single path.

## D1 Target Resolution

- **Binding:** `DB`.
- **Database id / name source:** `payease` (matches `deploy/standalone/server.mjs`
  `d1Databases` and `.openai/hosting.json` `"d1":"DB"`).
- **Persist path:**
  - `dev` → temporary directory (created/removed by wrapper);
  - `standalone` → `D1_PERSIST_DIR` if set, else `/data/d1` (standalone container
    volume, mounted from `/opt/payease/data`).
- No hardcoded production database id lives in source; target resolved from
  explicit environment + optional override.

## Migration State Tracking

- Table: `standalone_migrations (name TEXT PRIMARY KEY)`.
- Already-applied → skipped (by filename or numeric prefix).
- New migrating → applied in ascending order, then recorded.
- Failed → atomic rollback, **not** recorded as applied, later migrations not
  executed, process exits non-zero.
- Idempotent: re-run on an up-to-date volume applies nothing.

## Credential Source

- The migration wrapper requires **no remote/Cloudflare credentials**: it runs
  against the local Miniflare/workerd D1 volume.
- Runtime bindings/secrets for the standalone app load from the external
  `/data/config.json` mount (root-only) per `deploy/standalone/README.md`; no
  secret embedded in source.
- Cloudflare account credentials are **not** part of this path.

## Failure Propagation

- A failed migration prints `MIGRATION FAILURE` with the failed migration
  identity; for `standalone` it also prints the deployment must stop and the
  failed migration is not recorded.
- Exit code is non-zero → a deployment step that depends on a successful
  migration cannot proceed.
- Atomic batch → no partial schema state, no false applied record. Verified by
  HOSTED-07/08/09 (failed migration exits non-zero, stops later migrations, does
  not advance applied state).

## Production Safety

- No `--env` = fail; never a silent default to production.
- `standalone` apply requires explicit `--confirm standalone`.
- No hardcoded production database id in source.
- This task only proves/configures the path; **no production database was used
  and no migration was executed against production data**.

## Files Changed

| File | Change |
|---|---|
| `scripts/b0/migrate-hosted.mjs` | **NEW** — explicit environment-safe hosted D1 migration wrapper (reuses accepted B0 runner). |
| `tests/migrate-hosted.test.mjs` | **NEW** — HOSTED-01..12 + parseArgs sanity. |
| `package.json` | **MODIFIED** — add `"migrate:hosted": "node scripts/b0/migrate-hosted.mjs"`. |
| `docs/flutter-android/84-hosted-cloudflare-d1-migration-runbook.md` | **NEW** — operator runbook (all mandated sections). |
| `docs/flutter-android/85-B0-hosted-migration-path-fix-report.md` | **NEW** — this report. |

No `drizzle/*.sql` migration file is modified. No financial migration/table is
introduced.

## Tests

Hosted-path tests (`tests/migrate-hosted.test.mjs`):

```
✔ HOSTED-01 hosted command exists + wraps shared runner + --env dev --status exits 0, prints binding: DB
✔ HOSTED-02 no --env fails non-zero + stderr mentions --env
✔ HOSTED-03 --env standalone --apply without --confirm -> exit 2 + stderr mentions --confirm
✔ HOSTED-04 binding DB / database payease / resolvePersistDir(dev)==null / standalone==/data/d1 / override works
✔ HOSTED-04b --env dev --status prints "environment: dev (temporary, non-production)"
✔ HOSTED-05 no secret/credential literals in hosted path sources
✔ HOSTED-06 --env standalone --apply --confirm standalone (+ D1_PERSIST_DIR) applies all 42, standalone_migrations populated
✔ HOSTED-07/08/09 failed migration stops, exits non-zero, does not advance applied state (atomic rollback)
✔ HOSTED-10 --env standalone --status read-only: applied 0 / pending 42, no state advance
✔ HOSTED-11 no financial/Gate-B migration introduced (42 numbered files only)
✔ HOSTED-12 migration runs before server.listen; runbook documents Deployment Ordering
✔ HOSTED-extra parseArgs resolves env/mode/confirm (env dev explicit; bogus env -> undefined; no flag -> explicit false)
```

Result: **12/12 pass, 0 failed, 0 skipped.**

## Full Regression

### B0 / migration regression

- `tests/migrations-replay.test.mjs` — replay/comment/trigger/atomic-failure/audit
  guard suite (accepted B0 base): **PASS**.
- `tests/migrations-integrity.test.mjs` — continuous unique numbering: **PASS**.
- `tests/service-migration.test.mjs` — service routing defaults/backfill: **PASS**.
- `tests/migrate-hosted.test.mjs` (this fix): **12/12 PASS**.

### Full backend regression

Command: `node --experimental-vm-modules --test tests/*.test.mjs`

Pre-fix baseline: **213 pass / 0 fail / 1 pre-existing `kyc-local` skip.**

After this fix (adds the 12 HOSTED tests under the `tests/*.test.mjs` glob):
**225 pass / 0 fail / 1 pre-existing `kyc-local` skip.** This is the **0-net-failure
baseline plus exactly the 12 new hosted-path tests**, confirming **0 failures,
0 new skips, and no test removed**.

## Static Checks

Repo-supported static checks (ESLint / Node syntax) run on changed files
(`scripts/b0/migrate-hosted.mjs`, `tests/migrate-hosted.test.mjs`, `package.json`):

- `NEW STATIC ERRORS`: **0**
- `NEW STATIC WARNINGS`: **0**
- Pre-existing repo warnings are not masked.

## Scope Check

```yaml
financial migrations added: 0
financial tables added: 0
application financial behavior changed: NO
Gate B started: NO
production database used: NO
production secrets written: NO
```

## Production DB Usage

**NO** production database was used. All `--env dev` and test executions used
disposable local Miniflare/D1 state only. No hosted/production D1 was contacted.

## Financial Migration Count

**0** — only existing non-financial `drizzle` migrations are referenced; the
HOSTED-11 test asserts the `drizzle` dir contains exactly 42 numbered files with
no `financial_version` / `repayment_ledger` / `charge_ledger`.

## Contract / Plan Gap

**0.** The hosted path now: identifies an authoritative command/invoker, target
D1 binding (`DB`) + database (`payease`), environment selection (explicit, no
silent production), migration-state tracking (`standalone_migrations`), and
credential source (none required / external root-only config) — closing
P1-B0-1 without altering the accepted B0 runner or schema.

## P0 / P1 / P2 (by self-assessment)

```yaml
P0: 0
P1: 0
P2: 0
```

## Codex Re-review Readiness

- HOSTED MIGRATION PATH: **DOCUMENTED AND IMPLEMENTED**.
- Apply command / invoker / target / environment / state / credentials /
  production gate: all explicit.
- Failure propagation verified; failed migration **never** advances applied state.
- 0 production DB, 0 Gate-B/financial migration.
- B0 tests PASS; hosted-path tests (12/12) PASS; full backend regression PASS.
- Runbook: `docs/flutter-android/84-hosted-cloudflare-d1-migration-runbook.md`.

## Final Decision

```yaml
B0 HOSTED MIGRATION TARGETED FIX: COMPLETE
P0: 0
P1: 0
P2: 0
CONTRACT/PLAN GAP: 0
B0: READY FOR CODEX RE-ACCEPTANCE
GATE A: ACCEPTED
GATE B: HOLD
TRAE: HOLD AFTER COMPLETION
NEXT: CODEX B0 FINAL ACCEPTANCE RE-REVIEW
```