# G0 Recovery Acceptance Review

## Result

**FAIL**. Independent recovery validation still has P1 blockers. G1 remains HOLD.

## Previous Blocker Closure

| Blocker | Result | Evidence |
|---|---|---|
| B1 Counter removal | OPEN | `flutter test` fails because `lib/l10n/app_localizations.dart` still contains the template `MyApplicationHome()` comment, and the architecture scan treats it as Counter residue. |
| B2 Bootstrap | CLOSED | `main.dart` calls `bootstrap()`, creates `UncontrolledProviderScope`, then `KhmerXApp`; `MaterialApp.router` and `GoRouter` are present. |
| B3 Network/Cookie/Isolation | OPEN | Centralized Dio and company jars exist, but retry uses a bare Dio, logout deletes all cookies, and final URL/error/retry evidence is incomplete. |
| B4 Tests | OPEN | Independent test run is `+48 -1`; required URL, retry, App Link, error-mapping, and interceptor-redaction tests are absent. |
| B5 Dependency/Build | OPEN | `flutter pub get` and `flutter analyze` pass; debug APK build fails because Gradle 8.10.2 is below Flutter 3.47's minimum 8.14.0. |
| B6 Documents | CLOSED | 08, 09, and 10 exist. This file is the current recovery review; 11 is superseded historical evidence. |

## P0 Findings

None confirmed.

## P1 Findings

1. Counter residue in the generated localization source causes the architecture test to fail.
2. `flutter build apk --debug` fails at the Gradle wrapper requirement (8.10.2 versus 8.14.0 minimum).
3. `RetryInterceptor` creates a new bare `Dio()` for retries, dropping the configured base URL, cookie manager, Origin, safe logging, and error mapping chain.
4. `CompanyCookieStore.clearSessionFor` calls `deleteAll()`, clearing other company and browser cookies instead of only `payease_h5_session`.
5. No test proves the assembled final URL contains `/api/h5/...` (the endpoint constants alone are insufficient).
6. Provider retry-off is not explicitly configured or proven by an invocation-count test; report 08 itself records this gap as CG-001.
7. Required App Link parser, error-mapping/offline, and SafeLoggingInterceptor tests are missing.
8. `ErrorMapper` maps a null status/network failure to `UnknownFailure` rather than the required Offline distinction, with no test.
9. Raw-message redaction does not mask password, OTP, or Cookie key-value text; existing tests cover maps and selected patterns only.
10. Report 08 claims 49 passing tests and a successful APK build, contradicted by the current independent test and build results. This is an evidence mismatch.

## P2 Findings

- Duplicate `KhmerXApp` definitions remain under `app/app.dart` and `app/bootstrap/app.dart`.
- No Khmer rendering smoke test was independently found; `pub get` reports 24 untranslated messages in km/zh.
- Locked package versions differ from the target architecture snapshot (including Riverpod, go_router, secure storage, app_links, and intl).
- Review 11 is stale and must not be used as current acceptance evidence.

## P3 Findings

None material to the gate.

## Dependency Review

`flutter pub get` passed independently. `pubspec.lock` resolves the required Dio, Riverpod, go_router, secure storage, cookie, app_links, localization, and test dependencies. Current intl resolution is 0.20.3. No dependency override was observed.

## Architecture Review

The Counter skeleton has been replaced by a real foundation tree with app, core, feature, session, network, storage, localization, and router code. The foundation is not accepted because the P1 defects above violate the G0 contract.

## Riverpod Review

ProviderContainer and ProviderScope-equivalent bootstrap wiring exist. Automatic retry OFF is not established by explicit configuration plus a concrete invocation-count test, so the financial-write safety contract remains OPEN.

## Router Review

G0 routes for startup, company, auth, and home placeholder exist with redirect handling. Full App Links integration is a later concern, but its parser still requires the contract test.

## Endpoint Review

Endpoint constants use `/api/h5/...` and no `/api/loan/quote` implementation was found. There is no adapter-level test proving the final assembled request URL.

## Origin Review

Origin handling is centralized and tests cover HTTPS plus non-default ports and POST-only behavior. No blocking defect was found here.

## Cookie Review

Secure `cookie_jar` persistence and the four approved `payease_*` names are present, with SPIKE and whitelist tests. Actual logout semantics are unsafe because `clearSessionFor` deletes the entire jar.

## Company Isolation

Company A/B isolation tests and company-scoped jars exist. The actual store logout path is not covered and violates the requirement to retain visitor, browser, and company cookies.

## Secure Storage

`flutter_secure_storage` is used through `SecureKv`; no plaintext cookie JSON or SharedPreferences cookie persistence was found in the reviewed source.

## Logging

Safe logging is centralized, but `redactMessage` does not reliably remove secrets embedded in raw error text. The interceptor needs a direct capture test and stronger masking.

## Error Foundation

Failure types and 409 conflict mapping exist. Offline/network mapping and its tests are incomplete.

## Theme

KhmerX light/dark themes include `#1677FF`, `#172033`, and `#667085`; the app uses `MaterialApp.router` with these themes.

## Localization

English, Khmer, and Chinese ARBs are wired into the app. A Khmer rendering test is missing, and the current dependency resolution reports untranslated-message warnings.

## Feature Flags

Withdraw and repay default to `false`, with tests and disabled-route handling present.

## App Links

The parser and `app_links` dependency exist, but the required parser test is absent.

## Scope Review

CR-001 remains `PROPOSED`; no `/api/loan/quote` call, quote repository, or G1 loan implementation was found. G3 remains blocked.

## Test Review

Independent `flutter test` failed (`+48 -1`) on the generated localization template comment. The required G0 matrix is incomplete for URL assembly, retry-off, App Links, error mapping, and interceptor redaction.

## Build Review

`flutter pub get`: PASS. `flutter analyze`: PASS. `flutter test`: FAIL. `flutter build apk --debug`: FAIL because the Gradle wrapper is 8.10.2 while Flutter 3.47 requires at least 8.14.0. No independent APK build evidence is accepted.

## Runtime Review

`flutter devices` shows Windows, Chrome, and Edge only. **Runtime validation pending: no Android device or emulator.** This is not the standalone decision reason; the test and build gates already fail.

## Evidence Consistency

Report 08 is stale or from a different environment: its 49-test and APK-success claims do not match the current disk, lockfile, Flutter toolchain, test output, or Gradle wrapper. Current independent evidence wins.

## Required Trae Fixes

1. Remove the generated template comment or correctly exclude generated localization output, then make the Counter scan pass.
2. Upgrade the Gradle wrapper to at least 8.14 and align the Flutter/JDK build toolchain; rerun the full build.
3. Add an adapter-level final URL test proving `/api/h5/...`.
4. Retry through the configured client/interceptor chain, not a bare Dio instance.
5. Clear only `payease_h5_session` on logout and test the real `CompanyCookieStore` path.
6. Explicitly configure and test Provider retry OFF with an invocation counter.
7. Add App Links, offline/error mapping, and SafeLoggingInterceptor redaction tests.
8. Fix raw secret redaction for password, OTP, Cookie, and related error text.
9. Regenerate report 08 from the current clean checkout with current versions and outputs.

## Claude Follow-up

Keep CR-001 `PROPOSED`, preserve Option B and AF-6, and do not add quote or other G1 business code. Re-review only after the P1 fixes and fresh evidence are present.

## G0 Decision

**FAIL**. P1 findings remain and both the test and APK build gates fail independently.

## G1 Recommendation

**HOLD** until the P1 findings are closed, the required tests pass, and a fresh debug APK build succeeds.
