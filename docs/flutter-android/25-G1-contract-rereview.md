# G1 Contract Re-Review

## Result

**FAIL.** The UX blockers are now closed in the updated UX architecture, and the tenant/session/security contracts are materially precise. One blocking contract ambiguity remains: CF-7 requires an upper clamp for `retryAfter` but defines no numeric maximum. The implementation must not choose this safety value arbitrarily.

## CF Closure

### CF-0

- Previous severity: P0 tenant context integrity.
- Contract correction: **CLOSED at contract level / implementation OPEN**.
- Evidence: ActiveCompany is the source of truth; Cookie is transport only; candidate-company preflight uses a candidate client; CompanyCookie and final Guard ordering is defined; exact-one-cookie and fail-closed tests CF0-T1 through T11 are required.
- Test requirement: actual FakeKhmerXServer received headers, duplicate-cookie rejection, no-active-company zero requests, candidate B preflight, retry, restart, concurrency, and logout context.

### CF-6

- Previous severity: P1.
- Contract correction: **CLOSED at contract level / implementation OPEN**.
- Evidence: load the persistent jar before clearing, derive host from configured baseUrl, clear only the current session cookie, and preserve visitor/company/browser cookies.
- Test requirement: uncached logout, non-production host, A/B isolation, and logout request context.

### CF-7

- Previous severity: P1.
- Contract correction: **PARTIALLY CLOSED / OPEN**.
- Evidence: message-level 400/403 mapping, 429 parsing, default 60 seconds, invalid/negative handling, and an upper clamp are required.
- Test requirement: table-driven branches and malformed/oversized retry values.
- Blocking gap: the contract does not specify the numeric upper-clamp value. This leaves observable behavior under-specified.

### CF-8

- Previous severity: P1.
- Contract correction: **CLOSED at contract/UX level / implementation OPEN**.
- Evidence: `MaterialApp.locale`, company-scoped preference, preflight `languages` intersection, and fallback to English are defined. Updated 04 now specifies local-only G1 language selection; server locale sync remains deferred.
- Test requirement: company A/B locale restoration and disabled-language rejection.

### CF-10

- Previous severity: P1.
- Contract correction: **CLOSED at contract level / implementation OPEN**.
- Evidence: main INTERNET permission, debug-only `10.0.2.2` cleartext, optional CAMERA for scanner, App Link intent filter, and merged-manifest tests are specified.
- Test requirement: release has no cleartext, main has INTERNET, scanner permission fallback is paste-link.

## UX Closure

| Finding | Status | Independent evidence |
|---|---|---|
| R-3 | CLOSED | 04 now states company switching preserves the previous company's session/data and uses “switch service provider” language. |
| R-5 | CLOSED | 04 removes `/auth/recover/reset`; recovery is `/auth/recover` → `/auth/recover/code`. |
| R-12 | CLOSED | 04 requires an unchecked consent box and disables sending until explicit consent. |
| U-4 | CLOSED | 04 defines the G1 minimal home, current company, `/me`, switch, logout, and no business API calls. |
| U-5 | CLOSED | 04 defines cross-company deep-link confirmation, candidate preflight, cancel behavior, and preserved A session. |
| U-6 | CLOSED | 04 defines offline, invalid/disabled company, OTP, rate limit, Telegram unavailable, pending recovery, expiry, and service-unavailable states with CTAs. |

## P0 Findings

None at the contract level. CF-0 remains an implementation P0 and must be closed before G1 exit.

## P1 Findings

1. CF-7 `retryAfter` upper clamp has no numeric value in 21 or 02. Add a frozen maximum before implementation.

## P2 Findings

- 21 still labels UX items and CF-8 as “UX SIDE PENDING CODEX” even though 04 now contains the closure; update the status table during final packet approval.
- CF-0/6/7/8/10 remain implementation-open and require their blocking tests.
- Android runtime L1/L2′ evidence is still a G1 exit requirement.
- Dependency drift, hard-coded local Gradle JDK path, future AGP/Gradle warnings, and linguistic review remain nonblocking debt.

## Company Context Contract

The corrected contract is unambiguous: ActiveCompany is authoritative; every company-scoped request has exactly one matching `payease_company`; no active company means no request; candidate preflight uses candidate context without activating it first.

## Cookie Contract

The interceptor order, duplicate-cookie hazard, fail-closed guard, persistence, host derivation, logout context, and CF0-T1…T11 coverage are sufficient for implementation.

## Auth Contract

Preflight, pending OTP restoration, Telegram-only consent, password login/setup, recovery via `/recovery`, 24-hour absolute sessions, safe return intent, and no sensitive POST replay align with 02 and the revised 04 UX.

## Error Contract

400/403 message mapping and 429 validation are specified, but the missing clamp value prevents a fully deterministic implementation contract.

## Locale Contract

G1 local selection is company-scoped and limited to preflight-enabled bundled locales. The updated 04 no longer requires the deferred `/api/h5/locale` write in G1.

## Android Platform Contract

The required manifest and debug-network rules are explicit; CR-002 `assetlinks.json` remains a later production dependency. Current implementation still needs the specified manifest work.

## UX Contract

The six UX blockers are closed in 04, including route consistency, consent behavior, minimum Home/Me shell, cross-company deep-link confirmation, and exceptional-state CTAs. Core pages must still be checked at 320/360/412dp and 130%/200% text scale during implementation.

## Prototype Contract

G1 routes now have entry, context, API/data, states, loading, offline, error, CTA, navigation, security, and acceptance requirements across 04 and 21. The recovery route no longer has a phantom reset page.

## Security

The contract forbids deep-link authentication, secret logging, password storage, default-tenant fallback, duplicate tenant cookies, and automatic sensitive POST replay. CF-0 implementation evidence remains mandatory.

## Testing

Required tests cover exact outbound tenant headers, candidate preflight, restart/logout isolation, error branches, locale scope, manifest merge, pending OTP, return intent, and G0 regression preservation. Tests must use a fake server and never send real OTPs automatically.

## Runtime

G1 exit still requires Android L1 and L2′ fake-server runtime evidence. No current Android device evidence was supplied in this review.

## Three-party Gate Readiness

**NOT READY.** UX blockers are closed, but CF-7 remains under-specified and 21 is still marked `PROPOSED v2`. Freeze the retry clamp, update the status table, then complete Architecture + UX + API review.

## Trae Implementation Recommendation

**HOLD.** Trae may prepare non-page design notes, but implementation handoff waits for the CF-7 numeric clamp and the three-party Gate Review. No Flutter business code was started by this review.
