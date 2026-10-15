# G1 Final Acceptance Review

Date: 2026-10-08  
Reviewer: Codex independent acceptance review. No code changes made.

## Result

```text
G1 ACCEPTANCE REVIEW: FAIL
G1: FAIL
G2 RECOMMENDATION: HOLD
```

The implementation report does not match the current source. Foundation tests pass, but the G1 Company/Auth product flow is still placeholder code, Auth payloads do not match the approved API contract, and the current APK build cannot be independently reproduced.

## Snapshot

```text
HEAD: ea3a4d0e38bb336398dbd7ae2be77ee100931625
WORKTREE: dirty; docs/flutter-android/, docs/security-audit-20261006.md, mobile/ untracked
```

`30-G1-implementation-report.md` records HEAD `4bceda189160669c5cea6de896c003cb7f41ddd8`; it is stale for this workspace.

## Scope Review

No G2/G3 business implementation was found in `mobile/lib` (`/api/h5/state`, `/api/kyc`, `/api/loan`, signature, repayment, withdraw, and KESS calls are absent). Scope is therefore not the failure; required G1 implementation is missing.

## CF-0 Tenant Context

**PASS at tested foundation level.** The real pipeline is `BaseHeaders → Origin → CompanyCookieInterceptor → CookieManager → CompanyContextGuardInterceptor → TraceId → SafeLogging → Retry → ErrorMapping`. Fake-server tests cover A/B context, exactly-one company cookie, duplicate/missing/mismatch rejection, candidate context, and logout context. No production manual Cookie header construction was found.

## CF-6 Session Clearing

**PASS at tested foundation level.** `clearSessionFor` builds/loads an uncached jar, clears only `payease_h5_session`, and tests cover a non-production host. The actual logout behavior fails the UX contract below.

## Company Selection / Candidate / Switch

**FAIL.** `company_pages.dart` is only a placeholder. The “Continue to Auth” button routes to `/auth/login` without selecting a company. There is no recent-company, paste, scan, candidate confirmation, ActiveCompany activation, `/me/company`, or A→B→A user flow.

`mobile_scanner 7.4.2` is resolved in `pubspec.lock`, but no production `package:mobile_scanner` import exists. Camera-denied paste fallback is not implemented.

## Deep Link

**FAIL.** `DeepLinkHandler.register` exists but has no call site. The manifest and parser tests do not create the required logged-in-A → confirm-B → candidate-preflight → switch flow.

## Auth Preflight

**FAIL — P1.** `AuthRepository.preflight` treats every 200/204 response as `AuthGateUnauthenticated`; it does not parse `authenticated`, `session`, `pending`, `policy`, `company`, or `languages`. Session restore, pending OTP restore, and registration-completion routing therefore cannot work.

## OTP / Password / Recovery

**FAIL — P1.** No OTP, password, or recovery pages are registered. The router only registers `/auth/login` and `/auth/set-password`, both placeholders. The repository payloads also violate `02`/`21`:

- send/verify use `identity` and `channel`, not the frozen `phone`/`consent` and `challengeId`/`code` contracts;
- password login uses `account`/`password`, without `action=password_login`/`phone`;
- set password omits the required action;
- recovery omits `action=send|reset`, consent, password, and confirmation fields.

The login page has a “Skip to Home” button, not an authentication flow.

## Logout

**FAIL — P1.** `AuthRepository.logout` ignores every POST error, clears local state, and returns success unconditionally. This is false-success behavior and prevents the required retry/cancel path. No `/me` logout UI exists.

## Session Restore / 401 Return Intent

**FAIL.** Startup restores an id but does not perform the required preflight decision table. No wired Return Intent implementation distinguishes safe GET/navigation restoration from sensitive POST commands.

## Error Mapping / 429

429 clamp unit coverage is **PASS**: `retryAfter` is a single `Duration?` field with 60/1..3600/3600 behavior. The OTP countdown UI and no-auto-resend behavior are not implemented. Error mapping remains incomplete for the required 403 meanings; the fallback still maps unmapped 403 to `crossSite`.

## Locale

**PARTIAL/FAIL.** `MaterialApp.locale` is state-driven and locale tests pass, but the notifier does not consume `auth.languages`, enforce the company-scoped intersection, or expose `/me/language`.

## Minimal Home

**FAIL.** The placeholder shows company/auth text and logout only. Switch company and language entry are absent. It correctly avoids business APIs.

## Android Manifest / Scanner / App Links

- Main manifest: INTERNET, CAMERA, optional camera features, and `https://khmerx.org/app` filter present.
- Release merged manifest: no cleartext flag observed.
- Debug manifest: cleartext is enabled, but the debug XML uses permissive `base-config cleartextTrafficPermitted=true`, broader than the host-scoped contract.
- Scanner dependency exists but is unused.
- App Link registration is not wired at runtime.

## Security / Logging

**Foundation PASS.** Cookie allowlist/guards, secure storage foundation, redaction, and no-production-print tests pass. They do not establish the missing G1 flow.

## Tests

```text
flutter test: PASS — 133 tests, 0 failed, 0 skipped
```

The suite is primarily foundation/repository tests; it has no real G1 route/widget acceptance for the missing pages and CTAs.

## G0 Regression

**PASS in the executed 133-test suite.**

## Analyze

```text
flutter analyze: EXIT 1
1 info: test/support/fake_khmerx_server.dart:78:29
```

`21` X-17 requires analyze PASS with zero issues; the report’s “≤1 info” interpretation does not match that exit criterion.

## Debug Build

```text
flutter build apk --debug: FAIL
```

The Flutter command used JDK 25 and failed at `:mobile_scanner:compileDebugKotlin`. A direct Gradle retry with the available JDK 17 also failed while closing Kotlin incremental caches, including cross-drive pub-cache path errors. The existing APK is historical and not an independently reproduced build for this snapshot.

## Release Build

An existing `app-release.apk` is present (50,861,093 bytes, 2026-10-07 17:58:58), but no independent release build was reproduced.

## Android Runtime X-18

**FAIL / not independently accepted.** Current `adb devices` lists no device. Historical logcat has a Dart VM service line, but the supplied PNG artifacts begin with invalid prefix bytes and cannot be opened as screenshot evidence. The report also provides no Company/Auth/OTP/Recovery/Switch/Logout route evidence, and those routes are absent from the current router.

## Accessibility

**FAIL — P1 evidence missing.** No widget/golden/layout tests or runtime evidence were found for 320dp, 360dp, 412dp, 130% font scale, 200% font scale, long Khmer text, or CTA reachability.

## Evidence Consistency

**MISMATCH.** Report HEAD differs from current HEAD; report claims completed routes while the router has only startup, company/select, auth/login, auth/set-password, home, and feature-disabled routes; report claims scanner use while production code has no scanner import; report claims APK/build evidence that current commands do not reproduce.

## Architecture Deviations

No replacement of Riverpod, Dio, CookieJar, Router, or SafeLogger was found. The deviation is incomplete implementation against the approved contract.

## P0

None proven by this review. CF-0 wire tests and redaction tests pass.

## P1

1. G1 Company/Auth/Recovery/Switch/Locale routes are missing or placeholders; required CTAs are dead or bypass guards.
2. Auth preflight and request DTOs violate the approved API contract.
3. Logout returns success and clears state after server failure.
4. Deep-link registration and scanner/company flow are absent.
5. Current debug build fails; analyze violates X-17 zero-issue evidence.
6. X-18 route evidence and required accessibility evidence are absent/unusable.
7. Implementation report snapshot and completion claims mismatch the current workspace.

## P2

- One analyzer info after P1 blockers are fixed.
- Debug cleartext scope is broader than the host-scoped contract.
- Historical release APK is not independently reproduced.

## P3

- Future toolchain warnings and scanner visual polish.

## G1 Decision

```text
G1 ACCEPTANCE REVIEW: FAIL
G1: FAIL
```

## G2 Recommendation

```text
G2 RECOMMENDATION: HOLD
```

## Final Summary

```text
G1 ACCEPTANCE REVIEW: FAIL
G1: FAIL
G2 RECOMMENDATION: HOLD

REVIEW_FILE:
E:/KhmerX/KhmerX/docs/flutter-android/33-G1-acceptance-review.md

SNAPSHOT:
HEAD: ea3a4d0e38bb336398dbd7ae2be77ee100931625
WORKTREE: dirty; docs/flutter-android/, docs/security-audit-20261006.md, mobile/ untracked

P0: none proven
P1: route/auth implementation; API mismatch; logout false success; deep-link/scanner absence; build/analyze failure; runtime/accessibility evidence; report mismatch
P2: analyzer info; broad debug cleartext; historical release artifact

IMPLEMENTATION:
CF-0: foundation PASS
CF-6: foundation PASS
Company: FAIL
Auth: FAIL
Recovery: FAIL
Session: FAIL
Logout: FAIL
Locale: PARTIAL/FAIL
Minimal Home: FAIL

QUALITY:
tests: PASS (133/133)
analyze: FAIL (1 info, exit 1)
debug apk: FAIL
release apk: not independently reproduced
G0 regression: PASS in executed suite

RUNTIME:
Android X-18: FAIL / not independently accepted
Accessibility: FAIL / no required evidence

EVIDENCE: mismatch
```
