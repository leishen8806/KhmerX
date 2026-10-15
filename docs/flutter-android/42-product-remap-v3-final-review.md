# Product Remap V3 Final Review

**Review date:** 2026-10-08  
**Reviewed:** `41-h5-miniapp-to-flutter-product-remap-v3.md`  
**Compared with:** `40-product-remap-v2-rereview.md`, real H5/API source  
**Scope:** Product remap and P1 planning readiness only. No Flutter implementation was changed or authorized.

## Result

**PRODUCT REMAP V3 FINAL REVIEW: PASS**

V3 closes the three product P1 findings carried by review 40. The remaining observations are implementation or later-phase contract work; they do not require a product decision before writing the P1 Contract.

## 40 Findings Closure Matrix

| Finding | Independent result | Evidence |
|---|---|---|
| 40-P1-1 / OPD-1 future CTA | **CLOSED** | V3 §10.2 freezes disabled CTA + explanation + in-place status bottom sheet; no future route, H5 external link, or P1 `GET /api/kyc`. |
| 40-P1-2 / OPD-2 Home and loan fields | **CLOSED** | V3 §8.2, §10, §18.3–18.4 and Appendix B freeze DTO fields, status mapping, unknown fallback, event count, list/detail boundaries, and remaining formula. |
| 40-P1-3 remap versus implementation evidence | **CLOSED** | V3 explicitly separates product scope from engineering inputs (§1, §15) and does not claim Flutter completion. |
| 40-API-1 100-loan limit | **CLOSED as product fact; API document stale** | Current `create` path has no count/100 check; V3 records this as an API-contract revision item. |
| 40-CRE-1 create state | **CLOSED** | Real path is `registered` domain constructor → customer KYC-approved precondition → `kyc_approved` override → persistence and response. |

## Loan Create State

| Layer | Confirmed result |
|---|---|
| domain | `applyAction('create')` constructs `registered`. |
| customer path | Requires the customer KYC case to be `approved`; unfinished customer loan also blocks a new create. |
| persisted | `lib/store.ts` changes the newly created customer loan to `kyc_approved`, adds KYC case metadata, and persists the workspace payload. |
| response | `POST /api/h5/state` returns the resulting customer state, therefore `kyc_approved`. |
| Android | P1 never calls create. A later P3 client treats `kyc_approved` as the current customer-path result and handles `registered` only as legacy/compatibility input. |

The current source has no active 100-loan limit check. This is an API/documentation staleness item, not a reason to invent a client-side limit.

## Loan Status Compatibility

V3 provides behavior for every current, legacy, and unknown value. Current customer-path values (`kyc_approved`, `decision_pending`, `signed`, `active`, `closed`, `rejected`) are separated from legacy values (`registered`, `kyc_pending`, loan-level `needs_info`, `approved`). Unknown values have a non-crashing, read-only fallback with a generic localized label and redacted logging. No status receives a write action in P1.

## P1 Loan List

The contract is sufficient: one `GET /api/h5/state` response, all loans, stable `createdAt` descending order, missing dates last, required row fields, localized status labels, empty state, in-memory offline snapshot behavior, and tap to `/loans/:id`. No application CTA is shown from an empty P1 list. The short ID presentation is intentionally a small P1 Contract formatting detail, not an unresolved product behavior.

## P1 Loan Detail

The contract is sufficient and read-only: status, principal, term, actual credited amount, total due, paid amount, derived remaining, due date, three-line repayment summary, and the latest five matching events. Unknown actions use a generic localized message. Contract, signature, full timeline, ledger, notifications, employee fields, and all write actions are explicitly P4 or excluded.

## Remaining Repayment

The frozen display rule is `max(0, amount + fee - paid)` in integer cents. The client derives only this arithmetic display value and never recalculates fees, interest, or deductions. The bound is explicit even though the existing H5 expression does not spell out the clamp; the P1 Contract must implement the frozen clamp.

## P1/P4 Boundary

The boundary is clean. P1 owns the first five events and repayment summary. P4 adds the complete event timeline, ledger and line-item billing, contract/signature artifacts, post-loan reminders, lifecycle-specific blocks, and overdue derivation after a separate contract. No P4 field is needed to complete the P1 list or detail.

## Home Future CTA / OPD-1

**CLOSED.** P1 future work is represented by disabled primary controls with an explanation and a usable in-page status panel. The panel has no route side effect, no external H5 navigation, and no KYC GET side effect. H1–H6 and H18 define the resulting behavior, including no raw employee review text.

## KYC needs_info Strategy

**FINAL for P1:** status-only. P1 reads `state.kyc.status`, shows a localized explanation, and does not call `GET /api/kyc`, edit fields, display raw review text, or offer a resubmit action. Editing and resubmission are P2. This is consistent with the real KYC GET side effect and the server-owned review content.

## Memory-only Data Strategy

**FINAL for P1:** state and loan data remain in the current session memory only. A successful snapshot may be shown during a temporary offline/refresh failure; no loan or amount data is persisted locally. Durable offline caching is deferred to P5. This gives the Contract a testable boundary and avoids an accidental storage/security decision.

## Home State Matrix

H1–H22 is implementable: KYC `null`/known/unknown states, no-loan and loan-driven combinations, each current and legacy loan status, unknown status, first load, refresh failure, offline with/without an in-memory snapshot, and 401 return intent are all assigned a card state, CTA behavior, and navigation result. The matrix prohibits competing CTAs and excludes repayment, withdrawal, message-center, and dead-bell behavior.

## Navigation

The frozen P1 graph is:

`Company context → Auth/session restore → Home → Loans → read-only Loan Detail → Me → language/password/company switch/logout`.

The bottom navigation is exactly Home / Loan Records / Me. The existing H5 bell/message URL is a known dead UI and is explicitly excluded. No P1 route is left as a clickable placeholder; disabled future actions terminate in an explanatory panel.

## Existing Flutter Reality

V3 correctly labels Flutter work as engineering input, not evidence of product completion. The current Flutter repository still requires the P1 state repository/DTO, real Home and loan screens, router replacement, error mapping, removal of settlement/minimal-home stubs, safe logging/network fixes, runtime evidence, and accessibility evidence. Those are implementation gates after a separate P1 Contract and are not silently counted as completed here.

## API Staleness

The V3 staleness list is accurate against the reviewed source:

- `create` has no 100-loan count guard; do not add a client-side limit.
- Error responses include `code`, while many business failures still collapse to `REQUEST_FAILED`/400.
- Customer `repay` and `withdraw` are hard-blocked with `CUSTOMER_SETTLEMENT_FORBIDDEN`.
- KYC rejected is terminal in the current path.
- Customer responses contain fields that P1 must ignore, including employee IDs and bot Telegram identifiers.
- `/api/loan/quote` remains outside the P1 scope and CR-001 remains proposed.

These are clearly separated from the P1 product decision and require later API/implementation work where applicable.

## P1 Contract Readiness

**READY.** A P1 Contract can now be written without deciding product behavior later: entry/auth reuse boundary, Home matrix, list/detail data, CTA policy, P1/P4 field boundary, memory-only rule, navigation graph, forbidden API calls, and acceptance evidence are all stated. The few remaining choices are contract-level formatting or engineering details, not open product decisions.

## P0

**None.** No product-level security, cross-company, secret exposure, or irreversible-scope blocker was introduced by V3.

## P1

**None open in the Product Remap.** Product P1 findings 40-P1-1, 40-P1-2, and 40-P1-3 are closed. Flutter implementation gaps remain deliberately outside this product review and must be validated later.

## P2

1. `02-api-contract.md` and other older documents need a superseding API revision for error codes, settlement blocking, the absent 100-loan limit, and response-field hygiene.
2. The existing H5 outstanding expression should be clamped explicitly to the frozen `max(0, …)` display rule when the implementation contract is written.
3. Static amount/term configuration, Chinese legal terms, offline persistence, rejected-KYC resubmission, and Android source attribution remain later-phase decisions already marked in V3.
4. Existing H5 dead UI and response-field leakage remain backend/H5 cleanup items; they are excluded from the Android P1 route graph.

## P3

- P3 polish and release decisions: short-ID visual formatting, final copy polish, and future help/support surfaces.
- No P3 item blocks writing the P1 Contract.

## Final Decision

V3 is a product-remap PASS. It is sufficiently deterministic for a P1 Contract and later objective acceptance. This is not an implementation approval: the next artifact is the P1 Contract, followed by the defined gate and independent implementation review.

**TRAE remains HOLD.**

