本地 harness，非灰度、非 600 客户实测

# Customer bill replay fix — local acceptance PASS

Code commit: `442250f75c52f151259c988d4eac6b1bd4db5afd`; based on main `6c612a3`.
Fresh worker built from this exact source. Runtime: Windows / Node 25.9.0 /
k6 2.3.0 / local Miniflare D1, loopback direct HTTP, existing synthetic sessions.
Runtime flags, worker checksum, timing, error/retry counts and CSV checksums are
preserved in the two accompanying JSON files. No gateway or Telegram calls.

## Change and regression

- Store now passes customerAction's actual canonical key to on/shadow persistence.
- Shard history evicts request IDs and digests together after 500 entries.
- Before fix: off PASS; on replay revision 3 != 2; shadow canonical key missing;
  502 digests remained despite the 500-key limit.
- After fix: all four regression tests PASS. Changed-payload replay and cross-client
  writes remain rejected; existing create replay remains 409 with no new write.
- No schema, API, migration, flag-default or authentication changes. No historical
  data backfill: keys already lost before this fix cannot be reconstructed.

## Real HTTP acceptance

| Check | off | on |
|---|---:|---:|
| Independent main customers / VUs / classified | 50 / 50 / 50 | 50 / 50 / 50 |
| completed / create_ok_after_replay | 43 / 7 | 50 / 0 |
| Final loan mismatches | 0 | 0 |
| Maximum in-flight writes | 50 | 50 |
| customer_workspaces / loan_index / legacy loans | 0 / 0 / 50 | 50 / 50 / 0 |
| Ops assignments / audit rows | 50 / 50 | 50 / 50 |
| confirm_bill replay status / revision / bill time | 200 / 100→100 / unchanged | 200 / 2→2 / unchanged |
| Six verification classes and complete denominator | PASS | PASS |

Each mode used independent smoke/main/timeout/aux/wrong-owner fixtures. Invalid
sessions, wrong owner, cross-client access, create replay, immediate disconnect
with <=10s committed-write polling, and independent SQLite checks all passed.
A1/A2 cleanup preserved immutable audit/tombstones; unused datasets removed fully.
Unrelated-table counts/hashes match before/after. Manifests removed. Raw CSV/logs
remain in the local ignored archive, with verifiable paths and SHA256 in JSON.
Seven off-mode network retries are disclosed; server internal retries unavailable.

## Validation and limits

- Focused: 23/23 PASS (includes 600 unique manifest preflight, not a 600-client run).
- Full npm test: 234 total; 232 PASS, 1 FAIL, 1 SKIP. Existing audit undefined in notification retry.
- typecheck: same existing audit error in lib/notifications/server.ts:80.
- full lint: existing auth-locale/mini-shell React refs errors; changed-file ESLint PASS.
- check:client-boundary: existing Windows doubled-drive ENOENT; no successful package-build claim.
- Direct fresh Worker build and git diff --check PASS. Strict HTTP assertions unchanged.

The specific shard replay blocker is closed for new operations. Full repository
checks still fail for unrelated baseline defects. Historical HOLD reports remain
unchanged as evidence of the earlier failure. L2/Q12, gray and VPS remain HOLD;
this local result does not authorize Gate E, production, or historical data repair.
