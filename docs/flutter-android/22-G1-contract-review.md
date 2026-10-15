# G1 Contract Review

## Result

**CONDITIONAL PASS for contract preparation; implementation HOLD.** The contract is detailed enough for non-UI support, repository, controller, and fake-server work, but it is not ready to hand to Trae for full Company/Auth page implementation.

## Evidence Reviewed

- `01-requirements.md`, `02-api-contract.md`, `04-ux-architecture.md`, `05-flutter-technical-architecture.md`
- `20-helix-g0-corrected-final-review.md`
- `21-G1-company-auth-contract.md`
- Current `mobile/lib`, `mobile/test`, `mobile/pubspec.*`, and Android manifests/configuration

## Product

The scope is correctly limited to company selection, preflight, Telegram OTP, password login/setup, recovery, logout, session restore, company switching, and a minimal home/me shell. KYC, loans, quote, signature, repayment, withdrawal, and Telegram deep-link authentication remain excluded. CR-001 remains G3-blocked.

## API Consistency

The G1 endpoints and payloads align with `02`: `GET /api/h5/auth`, OTP send/verify, account password actions, recovery send/reset, and logout. The contract correctly requires preflight before every auth flow, Telegram consent, 6-digit OTP, 60-second resend, 5-minute expiry, five failed attempts, 24-hour absolute sessions, and no SMS fallback.

The contract also correctly requires sensitive endpoints to use no retry, bounded GET only, `retryAfter` parsing, and server-message mapping. These are implementation tasks, not permission to invent endpoints.

## UX Completeness

The route and state tables are strong, but the document itself records unresolved blockers:

- **R-3:** company switch copy conflicts with the keep-session technical rule.
- **R-5:** `/auth/recover/reset` remains in 04 while 21 defines the two-page recovery flow without that route.
- **R-12:** consent checkbox default was not settled in 04; 21 proposes unchecked, but the UX source is not reconciled.
- **U-4:** minimal home placeholder and `/me` entry are not defined.
- **U-5:** deep link received while another company is signed in lacks the confirmation UI.
- **U-6:** offline startup, invalid/disabled company, OTP error states, undeliverable Telegram guidance, and pending recovery screens lack final designs.

These block final page implementation even though non-page work can proceed.

## Security

The contract correctly forbids deep-link authentication, password/OTP/cookie/challenge logging, local password storage, automatic replay of sensitive POSTs, and cross-company cookies. However, the current G0 code still has the documented CF-0 risk: production code does not yet preseed `payease_company` on outbound requests. That is a P0 implementation prerequisite for G1 exit.

## State

The proposed per-company `AuthStatus`, pending challenge, incomplete registration, expiry, return intent, and 24-hour absolute session model is coherent. Pending OTP recovery after process death is explicitly covered. Return intent validation and sensitive POST no-replay rules are specified.

## Navigation

The redirect matrix and `refreshListenable` requirement are adequate. Current G0 code still lacks the persistence/recovery and deep-link registration needed by the contract; `DeepLinkHandler.register` has no current caller. Final route names remain dependent on R-5 and U-4.

## Error

The required 400/401/403/409/429/503/offline/timeout branches are enumerated, including 429 countdown and 403 registration-incomplete/company-unavailable distinctions. Current G0 `ErrorMapper` does not yet implement the message-specific mapping or `retryAfter` behavior; CF-7 must be closed during implementation.

## Localization

The contract correctly gates available languages by preflight `languages`, keeps pre-company selection to device km/en, and requires en/km/zh UI paths. Existing ARB infrastructure is ready, but all new G1 copy must be added consistently and linguistic review remains a P2 debt.

## Testing

The contract has a useful unit/integration/security matrix, including CF-0 outbound Cookie assertions, pending OTP recovery, return intent validation, no-secret logs, and fake-server isolation. It must retain all 90 G0 tests. No real Telegram or production mutation is allowed in automation.

## Android Runtime

G1 correctly makes L1/L2′ Android validation an exit requirement. The current environment has no Android device in `flutter devices` and two SDK roots are documented. This does not prevent contract preparation, but Trae cannot claim G1 exit without emulator installation, route rendering, fake-server flow, screenshots/logcat, and App Link intent evidence.

## Prototype Contract

Most routes define entry, API, states, loading, errors, primary/secondary actions, navigation, offline behavior, and acceptance. The prototype contract is incomplete for U-4/U-5/U-6 and the R-3/R-5/R-12 reconciliation. Those route specs must be closed before page implementation.

## Current G0 Foundation Findings

### P0

- **CF-0 open:** no production path currently guarantees `payease_company` is sent for every outbound request; the documented proxy fallback can route a request to the first company. G1 must close this before any auth flow is accepted.

### P1

- **CF-6:** logout can miss a persisted session when the jar is not loaded, and cookie loading is hard-coded to production hosts.
- **CF-7:** current error mapping lacks message-specific 400/403 branches and `retryAfter` parsing.
- **CF-8:** locale state is global/not wired into `MaterialApp` and lacks company/server-language integration.
- **CF-10:** main Android manifest lacks INTERNET permission and debug-only cleartext configuration for the planned `10.0.2.2` fake server; camera permission is absent for scanning.
- The UX blockers R-3, R-5, R-12, U-4, U-5, and U-6 prevent final page implementation.

### P2

- CF-5 in-memory `SessionManager` is unused and must not become the G1 session source.
- CF-9 placeholder hard-coded English and the `Skip to Home` escape must be removed.
- CF-11 duplicated test support and internal Riverpod inspection should not be expanded.
- CF-12 development base URL needs an injected port for the fake server.
- CF-13 deep-link registration is not wired.
- CF-14 reset-on-error behavior needs first-run handling.
- Android runtime, dependency drift, and linguistic review remain tracked debts.

## Required Contract Corrections Before Trae Implementation

1. Codex must reconcile R-3, R-5, R-12 and define U-4, U-5, U-6 page states and copy in 04 or an approved UX addendum.
2. Three-party Architecture + UX + API Gate Review must complete; 21 must move from `PROPOSED` to `APPROVED`.
3. Confirm the CF-0/CF-6/CF-7/CF-8/CF-10 implementation acceptance tests and fake-server boundaries exactly as written.
4. Keep G1 implementation restricted to Company/Auth; do not add KYC, loan, quote, signature, repayment, withdrawal, or production Telegram flows.

## Decision

**G1 Contract: CONDITIONAL PASS.** The non-page technical contract is actionable. Full implementation handoff is blocked by unresolved UX contract items and current P0/P1 foundation prerequisites.

**Trae implementation: HOLD.** Proceed only after the contract is approved, the three-party review is complete, and the UX reconciliation is recorded.
