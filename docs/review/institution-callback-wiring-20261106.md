# Institution callback wiring review — 2026-11-06

## Scope

This is a read-only review of the local implementation at `origin/main` (`2ab483a`). No VPS or production endpoint was contacted or modified.

## Receive → verify → queue path

1. `app/api/institution/callback/route.ts:21-30` receives JSON, validates the institution/idempotency headers, parses the envelope, and normalizes the supported event type with `normalizeInstitutionEvent`.
2. `app/api/institution/callback/route.ts:31-36` resolves an active `team_units.kind='institution'`, loads the configured secret, and verifies signature, timestamp, nonce, and idempotency key.
3. `app/api/institution/callback/route.ts:37-53` removes expired nonces, rejects payload/idempotency or event-id mismatches, inserts the nonce, inserts `institution_callback_events` with status `received`, and inserts the first retry attempt. It returns HTTP 202 with `status: received`.
4. `app/api/team/institution-callbacks/route.ts:13-34` is an admin/audit read view plus a manual dead-letter retry action. It does not consume or apply business events.

## Consumer and state transition findings

`rg` over the application found no queue worker, scheduled consumer, or route that reads `institution_callback_events`/`institution_callback_attempts` and calls `buildInstitutionActionPlan` or a state mutation. `lib/institution-event-plans.ts:6-22` only builds and validates an in-memory plan; it is not imported by a consumer. Therefore `received` events stay stored/retryable and do not advance a loan.

The gap is confirmed for both `loan.approved` and `loan.rejected`: the callback path never records `approvalActor`, never changes `decision_pending`, and never creates the corresponding approval audit event. The existing staff path in `lib/team/workflow.ts:45-46` requires the lender `approve` action and then a distinct checker `approval_check`; `lib/team/policy.ts:45-47` assigns those roles separately.

## Downstream guards

- `approval_check` cannot be skipped: `lib/team/workflow.ts:46` requires `decision_pending`, calls `requireDifferent(..., l.approvalActor)`, then marks the independent checker and changes the state to `signed`.
- `disburse_request` cannot be reached without `signed` and `approvalCheckedBy`: `lib/team/workflow.ts:47` rejects missing approval state.
- `disburse` additionally requires a funding actor and a different approval actor, and checks funding capacity before calling the domain mutation: `lib/team/workflow.ts:48`.
- `lib/domain.ts:68-72` keeps the domain `approve`/`reject`/`disburse` transitions fail-closed on their expected statuses. No callback currently reaches them.

The missing callback consumer is therefore a P0 functional gap (institution decisions are accepted and persisted but never applied). It does not currently cause an approval or funding bypass because the downstream staff workflow is fail-closed, but it prevents legitimate institution approval/rejection from progressing and leaves the callback retry queue without an executor.

## Planned repair boundary

The repair PR consumes approval/rejection and `funding.confirmed` only after the existing signature and nonce gates. Approval callbacks set `approvalActor` to `institution:<institution id>` and preserve the checker second-person gate. A funding callback is accepted only for a `signed` loan with `approvalCheckedBy`, a matching funding institution assignment, and no existing `fundingActor`; it sets the institution actor and external funding reference, writes an audit event, and leaves wallet, balance and ledger entries unchanged. The existing finance `disburse_request` action remains for compatibility but is not needed by the current finance-disabled portal flow. The handler is idempotent and fails closed for status mismatch, duplicate, and late events.

Any VPS or production deployment/runbook action remains deferred until local standalone/dev-harness acceptance and owner evaluation.

## Local acceptance evidence

- `tests/team-integration.test.mjs` now drives a synthetic local flow through the signed callback route, verifies `applied`/`completed`, confirms the loan remains `decision_pending` with `approvalActor=institution:<id>`, then completes the independent checker and funding guards. The test passed with 63/63 cases.
- `docs/review/institution-callback-h5-local.png` is a local standalone H5 shell capture at 390×844; it confirms the same local test server renders the native locale labels (`中文`, `English`, `ភាសាខ្មែរ`). The callback acceptance itself is API/integration evidence, not a production screenshot.
