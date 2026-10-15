# P1 Customer Entry Delta Review

**Review date:** 2026-10-09  
**Reviewed:** `52-P1-customer-entry-delta.md` against `45-P1-entry-home-readonly-loan-contract.md`  
**Scope:** Narrow customer-entry UX delta only. No Product Remap, P1 re-review, code, or backend changes.

## Result

**P1 CUSTOMER ENTRY DELTA REVIEW: PASS**

The delta hides tenant mechanics from normal borrowers while retaining explicit company context, cookie isolation, candidate preflight, and session isolation.

## UX Principle

**PASS.** Company Context remains mandatory infrastructure, but normal borrowers see a branded startup/login flow rather than Company ID, Tenant ID, or institution selection mechanics.

## Startup Priority

**PASS.** The deterministic order is valid incoming App Link → persisted ActiveCompany → configured defaultCompanyId → Recovery. Recent companies are never silently selected.

## Persisted-Company Failure Policy

**PASS.** A returning user's unavailable institution leads to Recovery with an explanation; it never silently changes to the default or another recent institution. Offline/timeout/503 remains a retryable startup failure rather than Recovery.

## Invalid App Link Policy

**PASS.** An invalid, unknown, or unavailable explicitly supplied link leads to Recovery with a reason and does not silently fall back to another institution.

## Default Company

- **Implementation:** `defaultCompanyId` may be optional and must be syntactically validated and preflighted before activation. Missing configuration deterministically enters Recovery; it is not treated as implicitly valid.
- **P1 Exit:** **P1 EXIT / RELEASE CONFIG DEPENDENCY.** Production/public builds must provide a valid default company and prove fresh install + no link reaches Login/Home without Recovery. This does not block implementation work.
- **Business dependency:** The owner must provide the production institution ID (`OWN-1`). Debug/test builds may intentionally omit it to exercise Recovery.

## Login First Screen

**PASS.** After resolution, the borrower sees Login with institution display name, phone/password/OTP/recovery choices, and no technical company or tenant fields.

## Login Change-Institution Link

**KEEP.** Keep a low-prominence secondary text action 「更换服务机构」. It must not compete with Login, and must enter explicit Recovery/institution selection without silently switching.

## Recovery UX

**PASS.** `/company/select` remains a compatibility route but presents Company Recovery/Institution Connection, with reason-specific copy, paste/scan, and recent institutions only as explicit choices. No raw IDs or tenant terminology are exposed.

## First-Company App Link

**PASS.** With no ActiveCompany, a valid link is preflighted and then activated directly into Login/Home without an unnecessary confirmation screen. It never authenticates the customer.

## Cross-Company App Link

**PASS.** Active A plus link B produces candidate B preflight and explicit confirmation. Cancel preserves A; no silent switch occurs.

## Same-Company Link UX

**PASS.** A link resolving to the already-active company is ignored or revalidated as needed and does not create a switch-confirmation loop.

## Zero-Company Network Policy

**PASS.** With no candidate company ID, startup sends zero requests and opens Recovery. Android never relies on a proxy-selected first company.

## Default Preflight

**PASS.** A configured default is only a candidate; it must pass `GET /api/h5/auth` preflight before activation and Login/Home routing.

## Startup State Machine

**READY.** R1–R4 and their failure behavior are deterministic: valid link, persisted company, default, or unresolved Recovery; offline/timeout/503 has a separate retry state.

## Scenario Coverage

**PASS.** S1–S14 cover fresh/default, fresh/no-default, valid/invalid links, returning valid/unavailable company, authenticated/unauthenticated restore, same/different-company links, cancellation, default failure, Recovery paste/scan, and explicit Me/Login switching.

## Route Compatibility

**PASS.** Keeping `/company/select` is safe because its product meaning is now Recovery/Institution Selection, not normal startup selection. `/startup` owns silent resolution.

## Me Company Entry

**PASS.** Me → Service Institution is an explicit advanced setting and uses the same candidate confirmation/preflight flow.

## Tenant Safety

**PASS.** The delta preserves CF-0/CF-6, exactly-one `payease_company`, candidate preflight, per-company cookies/sessions, snapshot company tags, and fail-closed isolation. Hiding institution UI does not remove tenant context.

## W5 Runtime Delta

W5 must add these mandatory proofs:

1. Fresh install with a production/default test `defaultCompanyId` and no App Link → silent resolution → preflight → Customer Login/Home; no Recovery screen.
2. No company configured → zero requests → Recovery.
3. Invalid/unavailable App Link → Recovery with reason.
4. Returning unavailable institution → Recovery without default fallback.
5. Me explicit institution switch → Recovery/candidate confirmation with no cross-company data flash.

## P0 / P1 / P2

**P0:** None.  
**P1:** No contract or implementation blocker. Production `defaultCompanyId` remains a P1 Exit/Release Config Dependency.  
**P2:** Copy polish, exact localized wording, and support/debug presentation details.

## Recommendation

**TRAE ENTRY PATCH READY.**  
**W5: HOLD UNTIL ENTRY PATCH** and until the production/default-company runtime proof is captured.

