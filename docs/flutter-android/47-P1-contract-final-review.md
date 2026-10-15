# P1 Contract Final Quick Review

**Review date:** 2026-10-08  
**Reviewed:** `45-P1-entry-home-readonly-loan-contract.md` after 46 corrections  
**Scope:** Verify 46 findings only. No code changed.

## 46 Findings

| Finding | Status | Evidence in 45 |
|---|---|---|
| P1-1 `Endpoints.getKyc` boundary | **CLOSED** | Definition is explicitly **KEEP FOR P2**; P1 runtime use is forbidden. Architecture guard preserves the constant, forbids P1 references, and `P1-KYC-GUARD-01` requires every P1 Home/KYC-status state to produce `GET /api/kyc` request count **0**. |
| P2-1 router mechanism overbinding | **CLOSED** | Contract now freezes observable, immediate router reaction to company/auth/password/session changes; it does not require `refreshListenable` as the internal mechanism. |
| P2-2 refresh policy / OQ-1 | **CLOSED** | 30-second refresh is frozen for waiting states only, foreground and visible; manual refresh remains available. OQ-1 is removed from the open table. |
| P2-3 locale lifecycle / OQ-2 | **CLOSED** | P1 is local UI locale only; no `POST /api/h5/locale`. Restart, A→B switch, logout, no-company entry, server-language changes, and language selection have deterministic rules and acceptance assertions. |
| P2-4 report filename / OQ-4 | **CLOSED** | The implementation report is fixed to `docs/flutter-android/50-P1-implementation-report.md`. |

## needs_info

**CLOSED.** P1 reads `kyc.status` only from `GET /api/h5/state`; it does not call `GET /api/kyc`, read `review.reason`, edit, or resubmit. The contract adds `P1-KYC-GUARD-01` with request count zero across none/draft/submitted/needs_info/approved/rejected and Home/Loans/Detail/Me/Auth flows.

## OQ Closure

- OQ-1: **CLOSED**
- OQ-2: **CLOSED**
- OQ-3: **P2 NONBLOCKING**
- OQ-4: **CLOSED**
- OQ-5: **P2 NONBLOCKING**

No blocking open question remains.

## Contract Baseline

P1 scope, routes, Home matrix, read-only loan fields, API exclusions, company isolation, 401 behavior, retry/guard behavior, localization lifecycle, tests, accessibility, and runtime exit criteria are deterministic. The contract remains `PROPOSED` pending the Engineering Gate; this review does not authorize implementation.

