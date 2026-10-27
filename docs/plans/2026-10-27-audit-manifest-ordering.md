# Audit manifest ordering risk and remediation plan

Status: docs-only plan for Claude review. No implementation, schema change, migration, deployment, or algorithm change is included.

## Scope and observed risk

`lib/team/audit-integrity.ts:6` snapshots `team_audit` with `ORDER BY created_at ASC,id ASC`; `:9` verifies a v2 manifest by replaying the bounded predicate `(created_at < last_created_at OR (created_at = last_created_at AND id <= last_id))`, then hashing the first `row_count` rows. A row written after manifest creation with `created_at <= last_created_at` can alter that prefix and report `tampered=true`, even when the append is legitimate. This affects every writer, not only `kyc_material_read`.

## Read-only inventory of write points

All timestamps below are generated in application code immediately before the insert/batch is executed, except where noted. None use a database default.

- `lib/bot-credentials.ts:55` — `at` is request-operation time; conditional audit insert.
- `lib/notifications/server.ts:80` — `now` is retry-operation time; conditional insert.
- `lib/team/auth.ts:35,78,91,96` — `new Date().toISOString()` at login/MFA/logout operation; MFA batch inserts session and audit together.
- `app/api/team/auth/route.ts:37,56` — route `now`, operation time.
- `lib/team/server.ts:28,31,75,95,98,101,104,136,176,199,212,224` — helper `audit()` and direct inserts use operation-time `new Date()`/`now`; `ensureAssignment` can write system events during reads that initialize assignment.
- `lib/team/admin-funds.ts:65` — caller `now` passed into funding audit batch; funding operation time.
- `lib/team/servicing.ts:15,23` — routing save/auto-assign operation time.
- `lib/team/funding-settings.ts:37` — caller `now`, operation time.
- `lib/team/workflow.ts:39,50` — assignment/workflow operation time; conditional on mutation success.
- `lib/team/risk-rules.ts:20` and `app/api/team/*` routes using shared `audit()` — route/request `now` passed to helper; operation time.
- `lib/kyc/server.ts:137` — field amend uses `new Date()` immediately before insert.
- `lib/kyc/followups.ts:16` — deterministic id with operation-time insert; duplicate is ignored.
- `lib/kyc/material-read-audit.ts:18` — explicit caller `nowMs` converted to ISO; Task1b must pass `Date.now()` at write time.
- `lib/customer-cleanup.ts:40` — cleanup operation time; conditional on active tenant.
- `lib/team/audit-integrity.ts:8` — `createManifest` first writes `audit_manifest_created`, then snapshots; both use operation-time timestamps, but the audit row is not separately modeled by the existing v2 boundary.

The shared `lib/team/server.ts:audit()` helper is the main abstraction; route-level `now` values are not guaranteed to be transaction commit time. Concurrent batches can therefore commit in an order different from their application timestamps.

## Candidate designs

### A. Monotonic sequence boundary (rowid/seq)

`team_audit` has a TEXT primary key but is not `WITHOUT ROWID`, so SQLite already exposes an implicit rowid. It is not a safe durable boundary: without `INTEGER PRIMARY KEY`, VACUUM or export/import may renumber it, and D1 backup/restore preservation must be verified rather than assumed. Therefore prefer an explicit `seq INTEGER` with a unique index (or a separately transactional counter table), assigned by SQLite at insert/commit. Manifests store the last explicit sequence and verify by sequence prefix. Correct for late commits and same-millisecond writes; O(1) boundary and preserves append-only semantics. Existing v2 manifests lack the sequence and need a compatibility path (continue old verification or backfill/recreate). Requires schema migration/index and changes to every writer/read path; migration and production rollout require technical-lead approval.

On D1/SQLite's single-writer transaction, a database-assigned sequence allocated in the write transaction tracks commit serialization; a `db.batch()` containing multiple audit statements receives consecutive sequence values in that transaction order. `created_at` remains display metadata only and no longer participates in the manifest boundary. The exact D1 behavior must be confirmed in a staging/backup restore test before rollout.

### B. Manifest included-id set digest

At creation, persist a digest of the exact included id set (or a separately stored immutable set), then verify membership/content by id rather than timestamp boundary. Compatible with existing v2 only by retaining old verification for old manifests; new manifests need extra storage and potentially O(N) id materialization. Correctness is strong but write/read and storage costs grow with history; schema/storage migration is likely.

### C. Server-time plus safety lag window

Generate timestamps at the write boundary and have manifests snapshot only rows older than `now - Δ`; verification repeats the same lagged boundary. This reduces late-arrival false positives but cannot prove correctness for rows delayed beyond Δ and introduces an availability/ freshness tradeoff. Existing v2 manifests can remain on legacy verification; no migration is required if only new manifests opt in, but a new manifest version and explicit operational Δ are needed. Still requires careful transaction-time tests and does not eliminate all risk.

### D. Transaction/DB commit timestamp (reference alternative)

Derive an ordering value in the database transaction itself (sequence or commit marker) while retaining `created_at` for display. This has A's correctness with clearer commit semantics but still requires schema and writer changes; treat as migration/high-risk work.

### E. No-migration temporary mitigation

If v2 verification sees a row-count increase plus a suspicious bounded-prefix mismatch, classify it as `needs_manual_review` / `suspected_late_write` instead of immediately `tampered`. This avoids false tamper alarms but is unsafe as a correctness result: a delete+insert attack can also increase count while changing the prefix, so it could mask real deletion/replacement. **Not adopted** except as an explicitly non-authoritative alert state; never convert it to a successful integrity result.

## Recommendation and compatibility

Do not change `lib/team/audit-integrity.ts` in Task1a. Prefer A or D for a new manifest version after a migration review; use C only as a documented interim mitigation if freshness trade-offs are accepted. Keep v2 verification unchanged for existing manifests and expose a versioned verifier for any new format. No backfill should silently relabel old manifests. Any schema/index/migration or production rollout needs the technical lead's direct approval.

### Historical row backfill and v2 invariance

If an explicit `seq` column is approved, assign historical rows deterministically by `(created_at ASC, id ASC)` only as a new-version bootstrap. Never rewrite v2 digest, `row_count`, `last_created_at`, or `last_id`; v2 verification must run before and after backfill against a frozen fixture and produce identical `match`, `tampered`, `prefixMatches`, `currentRows`, and `appendedRows`. A separate test must include same-time ids on both sides of `last_id`, a late earlier timestamp, and an `audit_manifest_created` row to prove the backfill cannot change any v2 result.

## Decisions required from technical lead

1. Select A (explicit `seq`) or D (transaction commit marker), or reject both.
2. Approve or reject any schema migration/index/counter-table change.
3. Decide whether a read-only query against a gray/staging database may check existing manifests for suspected false positives; this is not executed by this plan.

## RED test design (future implementation PR)

Use real SQLite with two independent fixtures per scenario: (1) create manifest at T, append later timestamp and assert match/`appendedRows=1`; (2) create manifest with last row at T, then same-time helper writes until an id `< last_id` is found and assert current legacy verifier reports tampered; (3) create manifest then write at T−1ms and assert legacy verifier reports tampered; (4) model `createManifest`'s own `audit_manifest_created` insert immediately before the snapshot, including same-millisecond id ordering, and verify the documented boundary. Include concurrent transaction ordering and `audit_manifest_created` modeling. Add a future design-specific test showing the selected sequence/lag verifier accepts legitimate late commits and still detects content edits/deletes. Tests must log measured canonical bytes, row_count, latency and heap deltas without threshold assertions.

## PR split (each <=400 lines)

1. Docs-only risk inventory and this plan (current Draft PR; no code changes).
2. Schema/sequence or manifest-version implementation, with migration and compatibility tests (separate high-risk PR; requires lead approval before implementation).
3. Writer/read-path rollout and operational metrics (separate PR; no deployment included).
4. Legacy-v2 verification and UI/reporting adjustments, if needed, after the algorithm PR is reviewed.
