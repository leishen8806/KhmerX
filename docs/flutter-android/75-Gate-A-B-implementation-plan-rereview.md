# Gate A/B Implementation Plan Re-Review

```yaml
Project: KhmerX
Root: E:/KhmerX/KhmerX
Remote: git@github.com:leishen8806/KhmerX.git
HEAD: d916b4515a93057d7dd2a0673ebbca39a7bfd242
Review basis:
  - 69-backend-implementation-master-plan.md
  - 70-Gate-A-CR012-error-foundation-plan.md
  - 71-Gate-B-financial-foundation-plan.md
  - 72-Gate-A-B-implementation-plan-review.md
  - 73-B0-fresh-volume-migration-recovery-plan.md
  - 74-Gate-A-B-implementation-plan-repair-summary.md
Scope: independent plan re-review only; no code, database, or contract changes
```

## Review Result

```yaml
CODEX PLAN RE-REVIEW: PASS
GATE A: GO
B0: READY
GATE B: GO WITH PRECONDITIONS
GPT IMPLEMENTATION AUTHORIZATION: REQUIRED
```

## P0

```yaml
count: 0
status: CLOSED
```

- The former CAS defect is closed in the plan. The concrete Gate B batch now shows the ownership claim first, and every authoritative ledger, allocation, charge, external binding, idempotency, funding/terms, event, and assertion write is conditioned on the successful claim guard.
- A failed/stale claim is required to produce zero authoritative facts, zero events, zero bindings, zero lifecycle changes, and zero projection changes. The D1-11…D1-19 matrix and mutation coverage make this measurable.
- `financial_txn_assertions` converts a fact-count mismatch into a batch rollback instead of a successful partial result.
- Gate A keeps external `X-Request-Id` untrusted and separates server-generated `traceId` from body `requestId`.

## P1

```yaml
count: 0
status: CLOSED
```

- B1 is now fail-closed: all pre-Gate-B loans are `LEGACY / READ-ONLY`; eligibility additionally requires a `loan_policy_bindings` row. The eleven old mutation paths are inventoried and have L1–L8 rejection/static-scan tests.
- B2 is frozen with raw/normalized references, version and context, deterministic rules, manual-transfer v1 rules, provider-owned opaque references, and uniqueness that never includes `loanId`.
- B4 restricts ordinary reversal to an original repayment `CREDIT`, with application and database-trigger enforcement plus cross-loan, cross-currency, overage, and invalid-target tests.
- B0 is a separate executable plan with owner, executor, acceptance owner, parser boundary, fresh-volume and upgrade replay, rollback/recovery, hosted-path discovery, and M1–M14 evidence requirements.
- F1 execution is correctly ordered after Gate A exit; only preparation may overlap.

## P2

```yaml
count: 2
status: NONBLOCKING
```

1. The implementation checklist should make the first-funding `INSERT loan_financial_state` branch explicit beside the generic CAS batch pseudocode. The module contract already defines it, and this is an implementation-clarity item rather than a missing product or API decision.
2. Existing “CONFIRMED OPEN” rows in the master plan describe current baseline defects and their assigned gates; they are not unresolved plan defects. They must be updated only when the corresponding execution gate is independently accepted.

## Gate A Review

- Scope remains limited to typed `ApiError`, registry, envelope, trace propagation, details allow-list, retry metadata, legacy aliases, `REQUEST_FAILED` retirement, and internal-only `UNCLASSIFIED_ERROR`.
- Trace policy is now closed: the trusted outer gateway/entry creates `traceId`; external tracing headers are ignored or bounded as non-authoritative hints; request-body `requestId` remains an idempotency identity and is never copied to response headers.
- A1–A6 rollout preserves compatibility until explicit migration evidence exists. The A5 fallback switch is independently reversible and cannot be enabled before candidate-zero evidence.
- The remaining legacy-code consumer inventory is an engineering task, not an unresolved product contract.

## Gate B Review

- The financial foundation stays infrastructure-only. Gate B does not enable customer repayment, real disbursement, or penalty accrual.
- Financial authority is separated from the JSON compatibility projection. Projection rebuild is post-commit, SQL-authoritative, idempotent, and version-monotonic.
- State phases and settlement transitions remain bounded; no unapproved new financial phase is introduced.
- The normalizer stores raw and canonical forms with version/context and preserves old binding versions. The uniqueness key is tenant + channel/provider context + normalized reference, never loan ID.
- Legacy behavior is intentionally fail-closed, including signed-but-not-funded legacy loans; conversion is a separate Migration/Backfill/Reconciliation gate.
- Callback replay hardening, fail-closed consumer shell, MFA rebinding tests, emergency binding hardening, and admin dual-control checks have owners and exit tests. Business consumers remain deferred to C2/D.

## B0 Review

- B0 is correctly separated from Gate B and is a hard precondition before any 0042+ migration.
- The preferred repair fixes the parser rather than mutating published migration SQL, and requires one testable parser implementation used by the standalone server and packaged runtime.
- Fresh replay, representative existing-volume upgrade, trigger/audit regression, failure/rollback behavior, migration hash protection, and hosted migration-path documentation are explicit acceptance evidence.
- Production database experimentation is excluded; rollback is code rollback plus forward repair, with no down-migration claim.

## Dependency and Authorization Review

```yaml
DAG: PASS
migration_coordination: PASS
Gate_A_to_F1_order: PASS
Gate_A_to_B_dependency: PASS
B0_to_Gate_B_dependency: PASS
product_enablement_boundary: PASS
```

The plans are technically feasible, but the gate conditions remain real exit conditions: Gate A PASS, B0 PASS, remote D1 evidence before Gate B exit, and owner/GPT authorization. This review does not grant implementation authorization.

## Required Follow-up

- At implementation start, add the explicit first-funding insert branch to the code task checklist and test fixture names.
- Do not submit Gate B migrations before the independent B0 PASS.
- Do not enable product financial routes from the Gate B foundation work.
- Preserve the single migration coordinator for shared financial tables.

## Final Decision

```yaml
P0: 0
P1: 0
P2: 2 nonblocking
CONTRACT_BASELINE: VALID
IMPLEMENTATION_PLAN: READY
GATE_A: GO
B0: READY
GATE_B: GO WITH PRECONDITIONS
IMPLEMENTATION_AUTHORIZATION: NOT GRANTED BY THIS REVIEW
```
