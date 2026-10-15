# Backend CR Bundle Independent Review

**Review date:** 2026-10-09  
**Repository HEAD:** `d916b4515a93057d7dd2a0673ebbca39a7bfd242`  
**Scope:** CR-004 / CR-005 / CR-006 / CR-007 / CR-012 only. No backend, Flutter, 02, 45, or Product Remap changes were made.

## Executive decision

**BACKEND CR BUNDLE REVIEW: FAIL**

The bundle has no newly confirmed P0 caused by the proposed documents alone, but it has blocking P1 contract ambiguities. The five drafts are not yet deterministic enough for implementation planning.

## P0

- None newly confirmed from the contract text.
- Real-money enablement remains prohibited while the historical callback, MFA, dual-control, migration, and payment-verification findings remain unresolved or unreverified.

## P1

1. **CR-004 DR-1 is not sufficient as written.** The current authority/projection split is SQL ledger versus `demo_workspaces.payload` JSON. A D1 batch cannot atomically commit an SQL ledger row and a JSON projection unless both are in the same transactional store. Without a rebuild/reconciliation protocol, a crash can leave ledger and projection divergent. Minimal fix: make the read projection SQL-backed in the same transaction, or make ledger-only posting followed by an idempotent rebuild worker with a versioned projection and a documented stale-read/recovery rule. Also forbid all direct legacy `paid/status/entries` writes by code/test guard.
2. **CR-004 to CR-007 allocation is unresolved.** `allocationOrder` is still OD-7.3 while CR-004 and CR-007 use it to calculate outstanding, closure, and repayment bounds. This blocks deterministic repayment implementation.
3. **CR-005 lifecycle is unresolved.** `signed → active` on funding confirmation is a deliberate lifecycle change, but `dueAt` is still OD-5.4 and `confirmed → returned` says “roll back accounting and resend” without defining loan status, dueAt, repayment eligibility, and reversal ordering.
4. **CR-005 account confirmation is under-specified.** The confirmation command should bind `requestId + loanId + accountRefId + account version + KYC revision + confirmation timestamp`; the draft does not freeze all of these or define expiry behavior beyond OD-5.2.
5. **CR-006 ordinary logout revocation is unsafe for multi-device use.** “Server invalidates the customer device tokens on logout” conflicts with per-installation DELETE and the stated multi-device model. Logout of one session/device must not disable all customer devices; password reset/account deletion can revoke all, while ordinary logout must be installation/session scoped.
6. **CR-006 event atomicity is not implementable against the current storage split.** Business transitions currently update workspace JSON while the proposed `notification_events` is a new SQL source. “Same transaction” needs a single-store transaction or an outbox/reconciliation contract.
7. **CR-007 grace boundary is ambiguous.** The prose uses `dayGap < 0` and “exceeds graceDays” but does not define the exact first grace day, last grace day, and first overdue day with a formula and examples in Asia/Phnom_Penh.
8. **CR-007 delinquency recovery is semantically contradictory.** It allows overdue partial repayment to return to `CURRENT`, even though the contractual due date has passed. Define: after due date, partial repayment stays `IN_GRACE/OVERDUE`; only pre-due settlement may become `CURRENT`; zero balance closes the loan.
9. **CR-007 charge-ledger idempotency is too restrictive and ambiguous.** `UNIQUE(loanId, chargeType, accrualDate)` prevents multiple legitimate adjustments/reversals on one day. Signed `amountCents` plus `WAIVER/ADJUSTMENT` also leaves direction unclear. Use a separate unique idempotency key and explicit entry direction/sign rules.
10. **CR-007 policy binding is not frozen.** Storing `policyVersion` is not enough; the contract must state whether the version is bound at funding, contract signing, first overdue day, or each accrual date. A mutable “current effective policy” could change existing loans.
11. **CR-007 money races are not closed.** Repayment posting, penalty accrual, waiver, reversal, and closure need one serialized transaction/CAS/row-lock rule. Otherwise closure and charge accrual can race.
12. **CR-012 retry semantics are unsafe.** `INTERNAL_ERROR = SAFE` is not valid for arbitrary mutations. Retryability must be action/request specific; safe replay requires an idempotency key and matching payload. Default unknown mutation errors to no automatic retry.
13. **CR-012 exposes implementation fallback semantics.** `UNCLASSIFIED_ERROR` should be an internal observability classification; the customer contract should return `INTERNAL_ERROR` with no implementation-fault code. `REQUEST_FAILED` may remain a legacy alias.
14. **CR-012 requestId ownership remains open.** Gateway/API ownership can be left to implementation only if one layer is explicitly authoritative and the other preserves it. The current open wording is insufficient for deterministic tracing and response-header/body consistency.
15. **Missing cross-contract error registrations.** At minimum, device registration/provider delivery errors introduced by CR-006 need stable customer/API codes or an explicit non-customer/internal classification (for example rate-limited registration and provider unavailable). They cannot be left implicit.

## P2

- CR-004 reversal/overpayment policy, CR-005 external-reference display, CR-006 provider choice/device cap/quiet hours, and CR-007 legal fee values are valid external inputs only when the safe disabled/default behavior remains explicit.
- Naming and status vocabulary should be normalized after the P1 fixes.

## CR-004: CHANGE REQUIRED

**DR-1:** CHANGE REQUIRED. A SQL ledger plus a JSON projection is not atomically covered by a D1 batch. Adopt a single transactional store for ledger and projection, or ledger-first plus an idempotent, versioned projection rebuild/reconciliation contract.

**SINGLE REPAYMENT LEDGER:** FAIL until the projection boundary and all legacy write paths are technically prevented. The manual and KHQR/Bakong flows do converge on one proposed posting function, which is directionally correct.

**IDEMPOTENCY:** CHANGE REQUIRED. The four-layer model is good, but ledger keys need tenant/provider/loan-safe scope and a complete same-key/different-payload rule for every layer. Callback nonce insertion must be conditional and atomic.

**OVERPAYMENT:** PASS as a safe pre-policy default: no posting, exception queue, no silent credit. OD-4.1 may remain a product/finance input for later resolution.

Additional separation review:
- Repayment, Attempt, PaymentIntent, ProviderCallback, ReconciliationRecord, LedgerEntry, and Receipt are non-redundant and should remain distinct.
- Client payment authority is **ZERO**.
- Manual confirmation must never write `paid` directly; maker/checker and audit requirements are directionally sufficient but threshold/exception rules remain OD-4.3.

## CR-005: CHANGE REQUIRED

**WALLET REMOVAL:** PASS. Customer wallet/withdraw are excluded and the legacy route remains blocked.

**ACCOUNT DATA EXPOSURE:** SAFE in the read-model design (masked account, encrypted server storage, no full account in logs/responses), subject to enforcing the rule for audit/callback/external-reference paths.

**ACCOUNT LOCK:** CHANGE REQUIRED. Freeze the confirmation binding fields, KYC revision, expiry, and the cancellation/returned-funds accounting path before implementation.

**SIGNED→ACTIVE:** CHANGE REQUIRED. This is a lifecycle contract change and must be reconciled with P4, CR-004, CR-007, postloan, dueAt, and returned funding. It cannot be implemented while OD-5.4 and the returned-funds semantics remain open.

**INTEREST START:** IMPLEMENTATION BLOCKER for P7, not a harmless later product detail. The selected dueAt rule must be frozen before funding confirmation and repayment eligibility are implemented.

## CR-006: CHANGE REQUIRED

**CR-006 ARCHITECTURE:** CHANGE REQUIRED. Provider abstraction, encrypted tokens, dedupe, outbox, and multi-device concepts are sound; logout scope and JSON/SQL event atomicity are not.

**DEVICE LIFECYCLE:** CHANGE REQUIRED. Ordinary logout must revoke only the current installation/session; password reset, account deletion, or explicit global revoke may invalidate all devices.

**LOCKSCREEN PRIVACY:** PASS. Payload has enum target/objectId and excludes amount, PII, account, token, OTP, and session data.

**PUSH NAVIGATION:** PASS with the existing 401 Return Intent restriction: only safe GET/navigation restoration, never mutation replay.

## CR-007: CHANGE REQUIRED

**DELINQUENCY MODEL:** PASS in principle. Orthogonal delinquency state while `Loan.status=active` is compatible with P4/P6/P7.

**GRACE BOUNDARY:** CHANGE REQUIRED. Add a mathematical definition and boundary table for due date, grace days, and first overdue day in Asia/Phnom_Penh.

**CHARGE LEDGER:** CHANGE REQUIRED. Replace the per-day uniqueness rule with a unique idempotency key and explicit signed/direction semantics.

**CR-004 INTEGRATION:** CHANGE REQUIRED. Freeze allocation order, outstanding components, closure formula, reversal behavior, and concurrency before implementation.

**POLICY VERSION BINDING:** CHANGE REQUIRED. Bind the policy version at a named lifecycle event and prohibit silent policy changes for an existing loan.

**NONE policy:** Safe default and acceptable external/legal dependency: delinquency state may exist with zero penalty until policy is approved.

## CR-012: CHANGE REQUIRED

**ERROR ENVELOPE:** PASS in shape. `{error, code, requestId, retryAfter, details}` and no `ok:false` are compatible with the existing baseline.

**HTTP STATUS MODEL:** CONDITIONAL. Same code across 403/503 or 400/415 is acceptable only when the semantic code remains identical and clients branch by code plus status class for presentation. The contract should document the permitted combinations explicitly.

**RETRY MODEL:** CHANGE REQUIRED. Remove blanket `INTERNAL_ERROR = SAFE`; define retryability by operation and idempotency guarantees.

**REQUEST_FAILED:** PASS as a compatibility alias; new implementation must not emit it.

**UNCLASSIFIED_ERROR:** CHANGE REQUIRED. Keep it internal-only; expose `INTERNAL_ERROR` to clients.

**FAILURE CODE SEPARATION:** PASS. Read-model `failureCode` is correctly separated from HTTP transport errors.

## CROSS-CONTRACT MATRIX

| Pair | Verdict | Reason |
|---|---|---|
| CR-004 ↔ CR-005 | CHANGE REQUIRED | Shared callback/idempotency/ledger rules, plus funding confirmation and returned-funds accounting are not fully bound. |
| CR-004 ↔ CR-007 | CHANGE REQUIRED | Allocation order, outstanding components, closure and race ordering are open. |
| CR-004 ↔ CR-012 | CHANGE REQUIRED | Repayment error codes are present, but retry semantics and callback/reconciliation error mapping need freezing. |
| CR-005 ↔ CR-007 | CHANGE REQUIRED | Funding-confirmed activation and dueAt/policy binding affect delinquency and interest start. |
| CR-005 ↔ CR-012 | COMPATIBLE WITH FIXES | Customer-safe failure codes exist; account-stale/returned/cancelled transitions need complete mapping. |
| CR-006 ↔ CR-012 | CHANGE REQUIRED | Device/provider errors are not fully registered and session-revocation errors need stable handling. |
| CR-007 ↔ CR-012 | COMPATIBLE WITH FIXES | State/charge errors can use the registry, but policy/waiver/accrual failures need explicit customer/API classification before exposure. |

## MONEY SOURCE OF TRUTH

Required hierarchy:

`contract/pricing facts + loan_charge_ledger + repayment_ledger`
→ one server-side calculation/closure function
→ SQL read projection
→ Android read model.

`demo_workspaces.payload.paid/status/entries` may remain a compatibility projection only. It must never be independently mutated, and it must be rebuildable from authoritative facts.

## CLOSING A LOAN

One shared transaction must determine:

`remaining = principal + normal fee + active charges - credits + reversals - waivers`

with explicit allocation order and signed-entry rules. Close only when remaining is zero and no unresolved funding/reconciliation state blocks settlement. No CR may implement an independent close formula.

## MONEY RACES

Before implementation, freeze a single serialization rule covering:
repayment callback, manual confirmation, penalty accrual, waiver, reversal, funding callback, and close. Required evidence is a transaction/CAS/row-lock test proving no double posting and no wrong closure.

## MISSING ERROR CODES

Minimum candidates to add or explicitly classify before implementation:
- `DEVICE_REGISTRATION_RATE_LIMITED` (or map to the existing generic `RATE_LIMITED` with documented semantics).
- `PUSH_PROVIDER_UNAVAILABLE` (or map to existing `SERVICE_UNAVAILABLE` for internal/outbox use).
- `NOTIFICATION_PREFERENCE_INVALID` only if the preference endpoint exposes customer validation errors.
- `DISBURSEMENT_RETURNED` / `DISBURSEMENT_CANCELLED` only if these are exposed as HTTP errors rather than read-model state/failure codes.

Do not add codes for purely internal queue states.

## OPEN DECISIONS CLASSIFICATION

| Decision | Classification |
|---|---|
| OD-4.1 overpayment policy | Can remain open for contract approval; blocks production policy only because safe default is no posting. |
| OD-4.2 proof requirement/retention | Can remain open until P6-A product/operations input; optional-proof default is implementable. |
| OD-4.3 checker threshold/void approval | Blocks manual-confirmation implementation; baseline checker must be frozen. |
| OD-4.4 KHQR/Bakong provider/spec | Blocks P6-B implementation and production; generic adapter contract may be drafted. |
| OD-4.5 receipt/expiry rules | Blocks deterministic P6-B implementation; P6-A can use a documented default. |
| OD-5.1 bank validation | Blocks account-validation implementation; may remain external input before P7. |
| OD-5.2 account-confirmation expiry | Blocks P7 implementation until default/expiry behavior is frozen. |
| OD-5.3 returned-funds accounting/reissue | Blocks returned transition implementation and production funding. |
| OD-5.4 interest start | Blocks P7 and CR-007/P6 integration. |
| OD-5.5 external reference display | Can remain open with a safe masked/hidden default. |
| OD-6.1 provider and credentials | Blocks production provider activation; abstraction work may proceed. |
| OD-6.2 device cap/cleanup | Blocks production capacity policy; a conservative temporary cap can be specified. |
| OD-6.3 quiet hours/frequency | Can remain open if reminders default on and the endpoint has a documented disabled/neutral default. |
| OD-6.4 notification inbox | Nonblocking; explicitly out of scope. |
| OD-7.1 penalty model/rate | Can remain open with `NONE`; blocks real penalty production. |
| OD-7.2 grace days/buckets | Blocks production delinquency policy and exact boundary implementation. |
| OD-7.3 allocation order | Blocks CR-004/CR-007 implementation. |
| OD-7.4 accrual calendar/rounding | Blocks penalty accrual implementation; state-only mode may proceed. |
| OD-7.5 waiver/write-off rules | Blocks waiver/write-off paths; base NONE mode may proceed. |
| OD-12.1 REQUEST_FAILED alias lifetime | Can remain open; compatibility alias is safe. |
| OD-12.2 requestId ownership | Blocks deterministic error-envelope implementation until one authority is named. |

## CONTRACT FINALIZATION ORDER

1. CR-012: fix retry model, internal `UNCLASSIFIED_ERROR`, requestId ownership, and missing code mappings.
2. CR-007: freeze boundary math, policy binding, allocation order, charge direction/idempotency, and race rules.
3. CR-004: freeze single-store/projection strategy, ledger key scope, reversal, closure, and shared posting function.
4. CR-005: freeze account confirmation fields/expiry, funding-confirmed activation, dueAt, returned-funds accounting, and lifecycle/error mappings.
5. CR-006: freeze per-session/device logout, event outbox transaction boundary, and provider/device limits.

## IMPLEMENTATION ORDER

1. CR-012 foundation and tests.
2. CR-004 ledger/posting infrastructure only after CR-007 allocation and closure rules are frozen.
3. CR-005 receiving-account and disbursement state machine.
4. CR-007 delinquency calculation/charge worker integrated with the shared posting/closure function.
5. CR-006 push registration/outbox and event consumers.

## SECURITY GATES

| Gate | Current classification |
|---|---|
| `paymentVerified` self-report | **CONFIRMED OPEN** in current backend facts; CR-004 proposes removal but has not implemented it. |
| Callback replay insertion | **CONFIRMED OPEN** in current audit/CR-004 F9; fix and re-test required. |
| Callback consumer absence | **CONFIRMED OPEN**; existing events have no financial consumer. |
| MFA rebinding | **CONFIRMED OPEN** (H-1 in 2026-10-08 audit). |
| Admin funds dual control | **REQUIRES RE-VERIFICATION**; CR-004 claims a bound one-time emergency authorization, while the current audit records single-admin/emergency gaps. |
| Emergency authorization | **REQUIRES RE-VERIFICATION** against current code and migration state; do not treat the CR statement as closure evidence. |
| Migration trigger splitting / migration conflicts | **CONFIRMED OPEN** (H-3/H-4). |
| Real repayment/disbursement activation | **BLOCKED** until the above gates have independent re-verification and the new CRs pass acceptance. |

## IMPLEMENTATION

**NOT AUTHORIZED**

## TRAE

**HOLD**

## NEXT

**CLAUDE CONTRACT FIXES**, followed by a new independent CR bundle review. No backend or Flutter implementation is authorized by this review.


