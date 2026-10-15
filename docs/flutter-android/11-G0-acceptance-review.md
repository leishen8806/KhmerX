# G0 Acceptance Review

Review date: 2026-10-07  
Reviewer: Codex independent acceptance review  
Scope: `mobile/` only. No G1 implementation started.

Result: **FAIL**

Evidence sources:

- `04-ux-architecture.md` v2
- `05-flutter-technical-architecture.md` v2
- `07-CR-001-quote-contract.md` (`Status: PROPOSED`, `G3 STATUS: BLOCKED`)
- `10-G0-implementation-contract.md`: **missing**
- `08-G0-implementation-report.md`: **missing**
- `mobile/lib/`, `mobile/test/`, `mobile/pubspec.yaml`, `mobile/pubspec.lock`
- Independent commands run from `mobile/`: `flutter analyze`, `flutter test`, `flutter build apk --debug`

## P0

No independently confirmed secret leak or cross-company session leak was found. The absence of a working client means these controls are not yet proven.

## P1

1. **Counter template remains.** `mobile/lib/main.dart:3-119` still contains `MyApp`, `MyHomePage`, `_counter`, `_incrementCounter`, `Flutter Demo`, `Colors.deepPurple`, and the increment button. `mobile/test/widget_test.dart:14-29` is still the default Counter test. This alone is a G0 FAIL.
2. **Bootstrap and Router are absent.** `main.dart` calls `runApp(const MyApp())`; there is no `ProviderScope`, `KhmerXApp`, bootstrap coordinator, `GoRouter`, company route, auth route, or home placeholder.
3. **Network foundation is not wired.** `dio` is declared in `pubspec.yaml`, but there is no centralized `Dio` client, repository, cookie manager, secure cookie store, or API execution path in `mobile/lib/`.
4. **Riverpod retry OFF is not implemented or tested.** `flutter_riverpod` is declared, but no `ProviderScope` or retry configuration exists. There is no test proving POST retry is disabled.
5. **Cookie and company isolation are absent.** No implementation was found for `cookie_jar`, `PersistCookieJar`, secure persistence, `payease_visitor`, `payease_company`, `payease_h5_browser`, or `payease_h5_session`. No Company A/B isolation test or logout-A-preserves-B test exists.
6. **Required G0 test set is absent.** Only the Counter smoke test exists. Missing: bootstrap, router, company isolation, cookie, origin, redaction, and feature-flag tests.
7. **Build evidence fails independently.** All three commands stop during dependency resolution because `flutter_localizations` requires `intl ^0.20.3`, while `pubspec.yaml:28` pins `intl ^0.19.0`. `pubspec.lock` contains no resolved entries for the declared direct packages, including `dio`, `cookie_jar`, `flutter_riverpod`, `go_router`, `flutter_secure_storage`, `app_links`, and `intl`.
8. **G0 reports/contracts are unavailable.** `08-G0-implementation-report.md` and `10-G0-implementation-contract.md` are not present, so Trae's completion claim cannot be independently reconciled.

## P2

1. Brand foundation is not connected: `main.dart:31` uses the default purple seed instead of KhmerX `#1677FF`, `#172033`, and `#667085`; no Logo asset is registered.
2. Localization assets exist at `mobile/lib/l10n/app_{en,km,zh}.arb`, and a `LocaleStore` exists, but `main.dart` does not configure localization and there is no Khmer rendering test or runtime evidence.
3. `RedactionPolicy` and `SafeLogger` exist, but there is no redaction test and the safe logger is not wired into a centralized Dio client. There are duplicate failure models (`core/error/failure.dart`, `core/types/app_failure.dart`, and `shared/models/result.dart`).
4. Feature flags default to false in `app/config/app_config.dart`, but no app shell consumes them and no feature flag test exists.

## P3

1. `mobile/README.md` still describes a new Flutter starter project.
2. No runtime device validation evidence was supplied. This is secondary because APK build did not succeed.

## Architecture

- **FAIL.** The directory contains partial foundation files, but no valid `main → bootstrap → ProviderScope → KhmerXApp → Router` chain.
- `Endpoints` and retry policy declarations are not reachable from an API client.
- CR-001 remains `PROPOSED`; no `/api/loan/quote` call was found, which is correct for G0. G3 must remain blocked.

## Security

- No plaintext cookie file or SharedPreferences cookie store was found because cookie storage is not implemented.
- No secret values were found in the existing logging call sites, but the required redaction proof is missing.
- No security acceptance is possible until the actual client, secure storage, and tests exist.

## Cookie

**FAIL / P1.** The required whitelist and secure persistence are absent. Dependency declarations alone do not prove cookie behavior.

Expected evidence still missing:

- Four-cookie whitelist: `payease_visitor`, `payease_company`, `payease_h5_browser`, `payease_h5_session`
- Secure persistence per `companyId`
- Session-only clearing versus full company deletion
- Rejection of unknown cookies
- No plaintext serialization

## Company Isolation

**FAIL / P1.** There is no `CompanyId`-scoped client, cookie jar, storage namespace, or automated A/B isolation test.

## Network

**FAIL / P1.** `BaseHeadersInterceptor`, `OriginInterceptor`, and retry policy files exist, but no Dio instance wires them together. `pubspec.lock` is stale, so even the declared dependency graph is not currently reproducible.

## Router

**FAIL / P1.** No router exists. G0 requires at minimum bootstrap, company, auth, and home-placeholder routes.

## Localization

**CONDITIONAL P2.** `en`, `km`, and `zh` ARB files are present. The app does not wire `localizationsDelegates` / supported locales, and no Khmer rendering test or screenshot evidence exists.

## Tests

**FAIL / P1.** The only test is the default Counter test. Required G0 tests are absent, and the test command cannot resolve dependencies.

## Build

**FAIL / P1.** Independent reproduction:

```text
flutter analyze                 FAIL
flutter test                    FAIL
flutter build apk --debug      FAIL
```

All fail before compilation with the same dependency conflict:

```text
flutter_localizations from sdk depends on intl ^0.20.3
khmerx_app depends on intl ^0.19.0
version solving failed
```

## Runtime

Runtime device validation pending. No APK was produced independently, so runtime acceptance cannot begin.

## Required Trae Fixes

1. Remove the Counter template and replace it with a small, testable bootstrap chain.
2. Fix the `intl` constraint, regenerate `pubspec.lock`, and provide reproducible dependency evidence.
3. Wire `ProviderScope` with automatic retry explicitly OFF.
4. Add a centralized Dio client with Origin handling, safe logging, typed error mapping, and no Widget-level Dio construction.
5. Implement secure, company-scoped cookie storage with the four-cookie whitelist and logout semantics.
6. Add minimum Router routes: bootstrap, company, auth, home-placeholder.
7. Wire `en`/`km`/`zh` localization and add Khmer rendering coverage.
8. Add the seven required G0 test groups, including A/B company isolation, cookie whitelist, Origin, redaction, and feature flags.
9. Keep `withdraw=false`, `repay=false` by default.
10. Do not implement or call CR-001 until its contract leaves `PROPOSED` and backend implementation is verified.
11. Add `08-G0-implementation-report.md` and `10-G0-implementation-contract.md` with command output and file-level evidence.

## Claude Architecture Follow-up

1. `07-CR-001-quote-contract.md` is now present and `PROPOSED`; `04` should remain explicit that CR-001 is a dependency and G3 is blocked.
2. The architecture contract is compatible with G0 being foundational only; no Loan/KYC implementation is required for G0.
3. After Trae supplies a working G0, re-check `04` against Option B (`create` with `quoteId` + `billConfirmed:true`) and AF-6 recovery behavior before G1.

## G0 Decision

**FAIL.** G0 is not accepted. The Counter template remains, core infrastructure is not wired, required tests are absent, and independent analyze/test/build commands fail.

## G1 Recommendation

**HOLD.** G1 may start only after G0 is independently re-run and reaches PASS with no P0/P1 findings.

Runtime device validation remains pending after a reproducible debug APK is built.
