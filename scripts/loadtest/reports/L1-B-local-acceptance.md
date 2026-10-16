本地 harness，非灰度、非 600 客户实测

# L1-B local acceptance — HOLD

- Script HEAD: `8343051` (full SHA is in both JSON reports).
- Application/worker source baseline: `05ef4fa`; no lib/app/drizzle/deploy changes through script HEAD.
- Fresh compiled worker copied from the successful `node scripts/run-framework.mjs build` output; entry SHA256 archived.
- This direct build does not imply package build/client-boundary passed: the Windows boundary script fails before building.
- Environment: Windows, Node 25.9.0, k6 2.3.0, local Miniflare D1, loopback direct HTTP; no gateway, gray or VPS execution.
- Runtime: PAYEASE_ENV=local, PAYEASE_AUTH_MODE=demo, KHMERX_TEST_MODE=true, LIMIT_SCALE=GATEWAY_RATE_SCALE=1.
- Existing synthetic signed-session fixture only; no Telegram/OTP, new auth bypass or authentication-performance claim.

## Independent runs

| Check | off | on |
|---|---:|---:|
| Planned clients / VUs / final classifications | 50 / 50 / 50 | 50 / 50 / 50 |
| completed / create_ok_after_replay | 42 / 8 | 50 / 0 |
| Final loan mismatches | 0 | 0 |
| Observed maximum in-flight writes | 50 | 50 |
| customer_workspaces / loan_index | 0 / 0 | 50 / 50 |
| Legacy JSON loans | 50 | 0 |
| Ops assignments / immutable audit | 50 / 50 | 50 / 50 |
| Invalid sessions / cross-client / wrong owner | PASS | PASS |
| create replay (409, no extra loan/revision) | PASS | PASS |
| confirm_bill replay (200, unchanged revision/time) | PASS: 100 → 100 | **FAIL: 2 → 3**, time unchanged |
| Immediate disconnect then <=10s commit polling / replay (3 separate clients) | PASS | PASS |
| Overall strict verification | PASS | **FAIL** |

Each mode used separate smoke/main/timeout/aux/wrong-owner tenants. Smoke passed
before main was consumed. Main/timeout have separate denominators. A1/A2 cleanup
ran dry-run/apply for all datasets: smoke/main/timeout retain only disabled tenants
and assignment audit (3/50/3 rows); unused aux/wrong-owner delete completely.
Per-table unrelated-record counts and hashes before/after are archived and equal.
Manifest files removed; no foreign keys or audit triggers disabled.

## Blocking finding: existing on-mode replay defect

Real HTTP same-requestId confirm_bill returns 200 but increments shard revision.
`lib/domain.ts::customerAction` prefixes requestId with the customer identity;
`lib/store.ts::mutate` passes raw p.requestId to `writeCustomerShard`, whose
`lib/customer-shards.ts` digest lookup then does not preserve that prefixed key.
This connected source inspection explains the observed lost replay recognition.
Do not relax the contract assertion. Business source changes need a separate task.

## Checks

- Focused A1/A2/rows: 14 PASS, including 600 distinct manifest preflight (not 600-client execution).
- npm test: 230 total; 228 PASS, 1 FAIL, 1 SKIP. Existing notification retry test: `audit is not defined`.
- typecheck: FAIL, existing `lib/notifications/server.ts:80` undefined audit.
- full lint: FAIL, two existing React refs errors in auth-locale.tsx/mini-shell.tsx.
- changed-files ESLint, shellcheck and git diff --check: PASS.
- check:client-boundary: FAIL, existing Windows doubled-drive ENOENT (`E:\E:\...\app`).

## Evidence / limits

JSON files retain latency, per-second throughput, barrier offsets, real interval
concurrency, write/readback windows, error codes, first-write denominator and retry
reasons. Optimistic conflicts use message text (OPEN-1); server internal retries
are **unavailable**. Windows workerd reported socket disconnects; off had eight
network retries whose already-committed creates were verified by GET, not hidden.
CSV SHA256 and absolute local archive paths are in JSON; raw CSV/logs are not in
Git. These local measurements cannot authorize Gate E or replace gray resources.

**L1-B ACCEPTANCE: HOLD. L2/Q12: BLOCKED. Gray/VPS remain HOLD.**
Required next action: review the harness/evidence, then authorize a separate
business fix for shard confirm_bill replay and rerun unchanged strict acceptance.
