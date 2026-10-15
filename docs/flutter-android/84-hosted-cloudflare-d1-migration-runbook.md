# KhmerX Hosted D1 Migration Runbook

```yaml
Project: KhmerX
Authoritative runner: scripts/lib/migration-runner.mjs (applyStandaloneMigrations)
Hosted wrapper: scripts/b0/migrate-hosted.mjs  (npm run migrate:hosted)
D1 binding: DB
D1 database id: payease
Migration state table: standalone_migrations (name TEXT PRIMARY KEY)
```

## Authoritative Migration Runner

The single migration-execution engine is `applyStandaloneMigrations(db, {drizzleDir})`
from `scripts/lib/migration-runner.mjs`, whose behavior was accepted by B0:

- migration identification by filename OR numeric prefix (`appliedNumbers`);
- an unknown already-applied migration is a **hard boot error** (never silently ignored);
- each migration is applied in **one atomic `db.batch`** (all SQL statements + the
  `INSERT INTO standalone_migrations`); a failure rolls the whole batch back and **never** records it;
- migrations are applied in **ascending numeric order**; a failure throws and the caller stops immediately;
- comment-only migrations are recorded as applied and never re-visited (idempotent).

SQL lexical splitting (`scripts/lib/split-sql.mjs`) is comment-aware (line/block
comments, quoted strings, `BEGIN/END` trigger bodies, `--> statement-breakpoint`),
preserving the 0015/cmd-parser fix.

## Hosted Apply Command

```bash
npm run migrate:hosted -- --env <env> [--status|--list-pending|--apply] [--confirm <env>]
```

The `<env>` is **required**. Running `npm run migrate:hosted` with no `--env` exits
non-zero with `ERROR: missing required --env (dev | standalone)` — production is
never selected implicitly.

## Environment Selection

| env | meaning | apply requires | default D1 persist target |
|---|---|---|---|
| `dev` | local, disposable, **non-production** | none (temp dir, auto-cleaned) | temporary directory |
| `standalone` | the hosted standalone deployment's D1 | `--confirm standalone` | `D1_PERSIST_DIR` or `/data/d1` |

- **No `--env` → fail** (exit code 2). This is the preferred safety default (§5).
- **Production apply requires an exact confirmation VALUE of `standalone`.**
  The confirmation is value-bound, not presence-only. A bare
  `--env standalone --apply` as well as `--confirm dev`, `--confirm production`,
  `--confirm prod`, `--confirm Standalone`, `--confirm STANDALONE`, or an empty
  `--confirm` are all **refused with a non-zero exit before the D1 target is
  opened**, so a mismatched confirmation always yields zero migration and zero
  `standalone_migrations` change.
- `dev` always uses a fresh temporary D1 and never touches hosted data.
- There is currently **no separately-configured `staging` environment** in the
  repository. Per B0 scope, it is not faked; operator may point an explicit
  `D1_PERSIST_DIR` at a non-production volume for staging-style preflight.

## D1 Binding / Target Resolution

- Binding name: **`DB`** (matches `deploy/standalone/server.mjs` `d1Databases`,
  `.openai/hosting.json` `"d1": "DB"`).
- Database id: **`payease`**.
- Persist path:
  - `dev` → temporary directory (created and removed by the wrapper);
  - `standalone` → `$D1_PERSIST_DIR` if set, otherwise `/data/d1` (the standalone
    container's volume path mounted from `/opt/payease/data`).
- The hosted store is the **Miniflare/workerd-compatible D1** used by the real
  deployment (`deploy/standalone/README.md`). No hardcoded production DB id lives
  in source; operators opt in via the explicit environment + confirm.

## Migration State Tracking

- Table: `standalone_migrations (name TEXT PRIMARY KEY)`.
- Ordering: ascending numeric prefix of `drizzle/*.sql`.
- Already-applied: skipped (by filename or numeric prefix).
- New migration: applied in order, then recorded.
- Failed migration: batch rolled back, **not** recorded as applied; later
  migrations not executed; process exits non-zero (visible deployment failure).
- Idempotent: re-running on an up-to-date volume applies nothing.

## Credentials Source

- The migration wrapper requires **no Cloudflare/remote credentials**: the hosted
  model runs against the local Miniflare/workerd D1 volume.
- Runtime bindings/secrets for the standalone app are loaded from the **external
  `/data/config.json`** mount (root-only), per `deploy/standalone/README.md`
  ("配置置于镜像外，仅 root 可读"). No secret is embedded in source.
- Cloudflare account credentials are **not** part of this path and are not present
  in the hosted wrapper.

## Staging / Production Differences

- `dev`: temporary local D1, auto-cleanup, no confirm, no data retention.
- `standalone` (hosted/production): persistent `/data/d1` volume; apply requires
  explicit `--confirm standalone`; status/check is read-only.
- There is no separate remote-Cloudflare `staging` config in the repo; if one is
  introduced later it must reuse this same runner + wrapper (one authoritative path).

## Preflight Checks

1. Confirm the target environment explicitly (`--env standalone` for hosted).
2. `--status` (read-only) to see applied/pending counts and the resolved
   binding/database/persist dir before applying.
3. `--list-pending` (read-only) to enumerate the exact migrations to be applied.
4. Verify `D1_PERSIST_DIR` points at the intended volume for `standalone`.
5. Ensure no other migration/apply process holds the volume.

## Migration Status / Pending Check

```bash
npm run migrate:hosted -- --env dev --status
npm run migrate:hosted -- --env standalone --status
npm run migrate:hosted -- --env standalone --list-pending
```

All status/pending modes are **non-mutating**: they only read the
`standalone_migrations` table and never advance migration state.

## Apply Procedure

- **Non-production (dev):**
  ```bash
  npm run migrate:hosted -- --env dev --apply
  ```
  Applies all pending migrations to a disposable D1, prints each applied file,
  exits 0 on success.
- **Hosted / standalone (production):**
  ```bash
  npm run migrate:hosted -- --env standalone --status           # read-only preflight
  npm run migrate:hosted -- --env standalone --apply --confirm standalone
  ```
  The extra `--confirm standalone` is the explicit production gate; without it the
  command is refused.

In the Docker deployment, migrations are also applied automatically at container
boot by `deploy/standalone/server.mjs` (immediately before `server.listen`), using
the exact same `applyStandaloneMigrations` path — so the operator command above and
the boot path are one and the same mechanism.

## Failure Behavior

- A failed migration prints `MIGRATION FAILURE` with the failed migration identity.
- For `standalone` it also prints that the deployment must stop and the failed
  migration is not recorded.
- Exit code is non-zero → a deployment workflow that depends on a successful
  migration is prevented from proceeding.
- The atomic batch ensures no partial schema state and no false applied record.

## Rollback / Recovery

- No generic down-migration is claimed (as accepted by B0).
- Recovery model: failed batches are atomically rolled back locally and never
  recorded, so the next boot/`--apply` re-attempts from the last good applied
  migration.
- For an operator: back up the data volume first (`docker compose stop`, back up
  `/opt/payease/data`, `docker compose start`) — see `deploy/standalone/README.md`.

## Deployment Ordering

- **Migrations run before serving traffic.** `applyStandaloneMigrations` executes
  before `server.listen` in `deploy/standalone/server.mjs`.
- There is **no automated CI migration** for the app; the CI workflow
  (`.github/workflows/postloan-daily.yml`) only runs the daily post-loan job and
  does not deploy or migrate.
- Deployments are operator/explicit-release controlled (`docker compose up -d`),
  so migration timing is deterministic and can be gated on success.
- Financial migrations later (Gate B) must follow the same ordering (apply before
  boot, deterministic, operator-release or explicit job).

## Production Safety

- No `--env` = fail; never a silent default to production.
- `standalone` apply requires an explicit `--confirm standalone`.
- No hardcoded production database id in source; target resolved from explicit
  env + optional `D1_PERSIST_DIR`.
- This task **proves/configures** the path; it never executes a migration against a
  production database or uses production data.

## Example Commands

```bash
# Fail safely on missing env (exit 2)
npm run migrate:hosted

# Read-only status (non-mutating)
npm run migrate:hosted -- --env dev --status
npm run migrate:hosted -- --env standalone --status

# List pending (non-mutating)
npm run migrate:hosted -- --env standalone --list-pending

# Non-production apply (disposable local D1)
npm run migrate:hosted -- --env dev --apply

# Hosted apply — explicit, gated, production
D1_PERSIST_DIR=/data/d1 npm run migrate:hosted -- --env standalone --apply --confirm standalone
```

No example contains a secret.
```