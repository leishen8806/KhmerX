# Complete Product Roadmap Review

**Review date:** 2026-10-09  
**Reviewed:** `55-complete-product-roadmap.md` against the three owner decisions supplied in this turn, plus `54` public-auth evidence  
**Scope:** Stage order, CR registration, and DEC-1/DEC-2/DEC-3 consistency. No code or CR interface design.

## Result

**ROADMAP REVIEW: CONDITIONAL PASS**

The P0–P10 order is coherent and the three decisions fit the intended product direction. The roadmap is not yet a clean frozen record because its decision table and several stage statuses still say “待决策”. Synchronize those records before Claude drafts the CR documents.

## DEC-1 — Single Operating Institution

**Accepted: A.** This matches `54`:

- public customer registration/login;
- one configured public customer workspace operated by the current institution;
- no CompanyId, institution selector, QR, invitation, or `defaultCompanyId` in the customer app;
- dormant tenant, cookie, candidate, link, and QR infrastructure retained for a future P10 path.

Required roadmap synchronization:

1. Change the DEC-1 row from “待决策” to **APPROVED — A**.
2. Set `P10 = HOLD / CONDITIONAL`; it must not enter the active delivery sequence.
3. Mark `CR-003` as the single-public-workspace implementation. B1 (explicit public workspace configuration) and B2 (public-workspace rate-limit dimensions) are required before public production, while development can use the current gateway fallback only as temporary integration scaffolding.
4. Add a nonblocking architecture note: avoid expanding new `(owner, phone)` coupling and leave a migration seam for a future global CustomerId; do not refactor the current model now.

## DEC-2 — Hybrid Repayment

**Accepted: C.** The roadmap’s P6 placement is correct, but its current “待决策 / A-B-C” language is stale.

Required P6 order:

1. **P6-A:** line transfer fallback, customer payment instructions, optional receipt submission, staff verification, and customer-visible confirmation.
2. **P6-B:** KHQR/Bakong payment initiation, provider callback, automatic reconciliation, idempotent posting, remaining-balance update, and receipt.
3. Final product priority: in-app KHQR/Bakong automatic payment; fallback: line transfer plus manual confirmation.

`CR-004` must cover both entry paths and one shared repayment ledger/fact source. It must not create separate balances for manual and automatic repayment. The current backend 403 customer settlement block remains unchanged until CR-004 is implemented and accepted.

## DEC-3 — Direct Disbursement, No Wallet

**Accepted.** The P7 direction in 55 already points toward direct disbursement, so there is no phase-order conflict.

Required clarification for `CR-005`:

- `withdraw` never enters the customer app.
- `wallet` is not a customer product concept; internal wallet/settlement ledgers may remain internal accounting only.
- P7 must define receiving account, disbursement instruction, pending/confirmed/failed/returned states, receipt/reference, and customer-visible status.
- The receiving account is editable only before the disbursement instruction is created. Once the instruction is created, it is locked; changes require an explicit controlled change flow.

## Phase Order

The proposed order remains valid:

`P1 public entry/read-only → P2 KYC → P3 application → P4 lifecycle detail → P5 release hardening → P6 repayment → P7 direct disbursement → P8 notifications/overdue → P9 support/compliance`.

P10 remains conditional and outside the active path. P6-A must precede P6-B; P7 may proceed after the receiving-account and funding contract is ready. P8 cannot invent overdue or penalty semantics before CR-007.

## CR Registration

| CR | Required status after decision sync | Review |
|---|---|---|
| CR-001 | PROPOSED | Still blocks P3 quote-before-create flow. |
| CR-002 | Dormant / P1 not enabled | App Link infrastructure remains dormant under DEC-1. |
| CR-003 | **APPROVED FOR DRAFTING — single public workspace** | B1+B2 required before public production. |
| CR-004 | **READY FOR DRAFTING — DEC-2 = C** | Must include P6-A manual fallback, P6-B automatic payment, callbacks, idempotency, reconciliation, and one ledger. |
| CR-005 | **READY FOR DRAFTING — DEC-3 approved** | Must exclude wallet/withdraw and include receiving-account lock plus disbursement state machine. |
| CR-006 | Deferred to P8 | No conflict. |
| CR-007 | Deferred to P8 | No client-side overdue invention. |
| CR-008/009 | Deferred to P9 | No conflict. |
| CR-012 | Ready to draft with P3 dependency | Error-code/`REQUEST_FAILED` refinement remains a later API hardening item. |

## Blocking Items

No new product or architecture blocker was found. The only required work before CR drafting is documentary synchronization of 55:

- replace DEC-1/2/3 “待决策” statuses with the approved decisions;
- update P6 from alternatives to the staged hybrid sequence;
- update CR-004 and CR-005 scope summaries;
- mark CR-003 as the production prerequisite for the public workspace;
- mark P10 HOLD / CONDITIONAL.

## Final Decision

**CONDITIONAL PASS.** The owner decisions do not conflict with the roadmap’s intended phase order. After the small roadmap synchronization above, proceed to draft `CR-004`, `CR-005`, `CR-006`, `CR-007`, and `CR-012`. Do not start P10 or reintroduce company selection into the customer app.

