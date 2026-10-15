# Gate A/B Implementation Plan Review

**Date:** 2026-10-09  
**HEAD:** `d916b4515a93057d7dd2a0673ebbca39a7bfd242`  
**Scope:** 69 master plan, 70 Gate A plan, 71 Gate B plan. No code, database, contracts, or 69–71 files modified.

## Result

**IMPLEMENTATION PLAN REVIEW: FAIL**

The plan has a good overall gate structure, but it is not ready for implementation authorization. There is one P0 planning defect in the concrete CAS batch example and several P1 planning mismatches with frozen GPT decisions.

## P0

1. **Gate B CAS pseudocode can permit stale financial inserts.** The batch shows the version-claim `UPDATE` first, then unguarded `INSERT INTO external_source_bindings`, `financial_idempotency`, and `loan_financial_events` statements. The prose says every statement is guarded by `last_txn_id`, but the concrete plan does not show that guard for these financial writes. If implemented literally, a stale writer could append facts after its CAS failed. Every financial insert, binding, event, and ledger row must be conditioned on the successful transaction claim, or the batch must be generated only after an explicit claim guard is present.

## P1

1. **B1 legacy isolation is inconsistent.** The frozen decision says pre-Gate-B loans are legacy/read-only and new financial mutations fail closed. 71 also says legacy test loans retain old mutation behavior. That permits mutation of loans that the frozen plan classifies as read-only.
2. **B2 source normalization is still open.** 71 leaves `sourceRefNormalized` rules as OD-B2, but GPT froze raw/normalized storage, normalization version, manual uppercase/charset rules, and provider-adapter-owned opaque reference handling. This must be part of the plan, not a later owner decision.
3. **B4 original CREDIT target is not enforced in the Gate B plan.** The plan has `reverses_entry_id`, but the service/test definition does not explicitly reject REVERSAL entries, charge entries, or unrelated ledger types as ordinary reversal targets.
4. **A1 trace decision remains incorrectly open in Gate A.** 70 still lists hosted trace-header trust as OD-A1, while the planning input closed it: trusted gateway ingress generates the server traceId; external `X-Request-Id` is never trusted. This is plan cleanup, not product ambiguity.
5. **B0 is described but lacks an owned execution/rollback package.** 71 defines useful tasks and tests, but does not freeze the B0 owner, rollback/recovery behavior, or a separate reviewable DoD artifact. B0 must be a separate execution plan before B0 authorization.

## P2

- F1 is correctly limited to device/preferences/per-installation foundation; F2 waits for stable business events.
- D1 remote parity, MFA rebinding automation, ARB copy, and naming remain implementation evidence work.
- The plan should clarify that “A ∥ F1” means design/preparation can overlap; F1 execution depends on Gate A exit.

## MASTER PLAN: CHANGE REQUIRED

The DAG and high-level order are sound, but the frozen B1/B2/B4 decisions and the CAS safety defect must be corrected before approval.

## DEPENDENCY DAG: PASS

The proposed dependencies are structurally correct:

`Gate A + B0 → Gate B → C1/D/E → C2/F2`, with F1 isolated from financial business events. C1/D/E parallelism is acceptable only after Gate B Exit, with one migration coordinator and no uncoordinated edits to shared B tables.

## MIGRATION COORDINATION: PASS

69 assigns migration numbers to a single migration负责人, reserves 0042+, and requires serialized allocation. This is sufficient at planning level.

## SECURITY GATE OWNERSHIP: COMPLETE

Owners and closure tests exist for:

- paymentVerified → C1
- callback replay insertion → B
- callback consumers → B framework, C2/D activation
- MFA rebinding → B
- Admin financial dual control → B decision, C1/D enforcement
- emergency authorization → B
- fresh-volume migration and trigger regressions → B0

Real-money Gates remain blocked until all relevant gates close.

## B0: SEPARATE PLAN REQUIRED

The 71 appendix is useful but is not a complete independently reviewable execution package. It needs an owner, exact change boundary, rollback/recovery procedure, hosted migration-path decision, and signed DoD before B0 authorization.

## B0 PLAN SUFFICIENCY: SEPARATE PLAN REQUIRED

Scope and tests are present; ownership and rollback/recovery are not sufficiently frozen.

## GATE A: CHANGE REQUIRED

Gate A scope is correct and contains no financial implementation, but the trace trust decision is still presented as open in 70.

## GATE A ROLLOUT SAFETY: PASS

A1–A6 stages preserve legacy behavior while errors are explicitly migrated, and only A5 changes untyped exceptions to 500 `INTERNAL_ERROR` after explicit migration and zero-candidate evidence.

## TRACE MODEL: CHANGE REQUIRED

The implementation model mostly matches A1, but 70 must remove OD-A1 and state one final rule: gateway/outermost trusted ingress owns server traceId; external `X-Request-Id` and request-body `requestId` are never traceId.

## LEGACY COMPATIBILITY: PASS

70 includes the H5/Web/Android-style compatibility inventory, legacy alias fixtures, HTTP-status review, and unknown-code fallback. OD-A2 is correctly treated as discovery work, not product ambiguity.

## RETRY BOUNDARY: PASS

GET/HEAD retry metadata is separated from mutation replay. Mutations require endpoint idempotency and the same key/payload; no blind retry engine is proposed.

## GATE A TEST PLAN: COMPLETE

The T1–T15 set covers registry parity, envelopes, trace separation, internal-only `UNCLASSIFIED_ERROR`, aliases, details whitelist, retry rules, and CR coverage.

## GATE A DB: NONE

No Gate A database migration is proposed.

## GATE B: CHANGE REQUIRED

The foundation scope is correct, but Gate B cannot be approved until the CAS plan, B1 legacy isolation, B2 normalization, and B4 reversal-target enforcement are corrected.

## B1 LEGACY LOANS: CHANGE REQUIRED

`financial_legacy_loans` is defined, but 71 also preserves old mutating behavior for those rows. Frozen B1 requires legacy/read-only behavior and fail-closed new financial mutations. Old test compatibility must be read-only or explicitly isolated to a test-only fixture path that cannot be used by product financial services.

## B2 SOURCE NORMALIZATION: CHANGE REQUIRED

Add the frozen normalization contract:

- store raw and normalized references;
- store normalization version/source;
- trim and reject empty/control characters;
- MANUAL_TRANSFER: trim, uppercase ASCII letters, then validate approved charset/length;
- provider adapters own canonicalization for opaque/case-sensitive references;
- uniqueness excludes loanId.

## B3 REMOTE D1: PASS

The plan correctly classifies dedicated non-production remote D1 as an implementation environment dependency and requires parity tests without production data.

## B4 REVERSAL TARGET: CHANGE REQUIRED

The financial foundation must enforce ordinary reversal target = original repayment CREDIT. REVERSAL rows, charge rows, and unrelated entries must be rejected or routed to a future explicit accounting-correction contract.

## FINANCIAL INITIALIZATION SCOPE: PASS

Gate B defines the initialization primitive and test-only calls, while external customer/staff funding routes remain excluded. Gate D owns production invocation.

## IMMUTABLE TERMS: PASS

Terms come from accepted immutable contract/quote snapshots, with policy version and hash; workspace JSON is excluded.

## FINANCIAL AUTHORITY: PASS

The authority chain is coherent:

immutable contract/funding facts + repayment ledger + charge ledger → canonical calculation → financial state → compatibility projection → API read model.

## CANONICAL POSITION: PASS

`calculateFinancialPosition(loanId, asOf)` is the single planned financial calculation and includes settlement eligibility.

## FINANCIAL CAS: CHANGE REQUIRED

The conceptual CAS model is sound, but the concrete batch must guard every financial insert and ledger/event/binding write on the successful version claim. The current pseudocode leaves several inserts unguarded.

## WORKSPACE PROJECTION: PASS

Projection is outside the financial transaction, rebuildable, and read-time SQL authority overlays stale JSON. Financial correctness does not depend on the global workspace revision CAS.

## EXTERNAL SOURCE RACE TEST: PRESENT

D1-10 covers two different loans concurrently using the same external reference and requires exactly one binding/posting.

## SETTLEMENT AUTHORITY: PASS

Only the shared financial service performs active→settled and controlled settled→active transitions while preserving immutable events.

## FUNDING AUTHORITY FOUNDATION: PASS

Gate B defines funding activation primitives without exposing a production funding route.

## PHASE MODEL: PASS

Only `ACTIVE`, `FUNDING_EXCEPTION`, `SETTLED`, and `VOIDED` are used. No hidden fifth phase is introduced.

## GATE B MIGRATION PLAN: CHANGE REQUIRED

The schema and replay tests are detailed, but B0 ownership/rollback must be separated and Gate B must not submit 0042+ until B0 is independently closed.

## D1 TEST MATRIX: COMPLETE

D1-1 through D1-10 cover rollback, stale CAS, UNIQUE rollback, financial interleavings, external-source race, triggers, and batch limits. Outbox atomicity remains a later F2/converted-path gate because Gate B explicitly does not write business outbox events.

## FINANCIAL FOUNDATION ONLY: PASS

Gate B explicitly excludes customer repayment endpoints, real disbursement, penalty accrual, providers, push, production switches, and Android.

## GATE B SECURITY OWNERSHIP: PASS

Callback replay hardening, fail-closed consumer framework, MFA tests, dual-control decision, and emergency authorization hardening have assigned owners and closure tests. Provider-specific business consumers remain in C2/D.

## GATE B DOD: COMPLETE

The listed DoD covers schema, append-only protection, CAS, canonical position, rebuildable projection, migration replay, no product enablement, security items, and Codex acceptance. It becomes usable after the P0/P1 plan corrections.

## A → B DEPENDENCY: VALID

Gate B depends on Gate A's stable error semantics but does not couple financial calculations to UI presentation.

## F1 PARALLELISM: PASS

F1 contains only device registration, preferences, and per-installation lifecycle. It has no repayment, funding, delinquency, or business notification semantics.

## OPEN IMPLEMENTATION DEPENDENCIES

- Separate B0 execution plan and owner approval.
- Correct all CAS batch statements to be claim-guarded.
- Enforce B1 legacy read-only behavior.
- Freeze B2 normalization in the plan.
- Enforce B4 original CREDIT reversal target.
- Remove OD-A1 from Gate A plan and align it with the frozen trace model.
- Obtain dedicated non-production remote D1 access before Gate B Exit.

## IMPLEMENTATION

**NOT AUTHORIZED**

## TRAE

**HOLD**

## NEXT

**CLAUDE PLAN FIXES**

