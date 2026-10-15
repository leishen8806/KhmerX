# HELIX Multimodal G0 Review

## Result

**FAIL**. Independent verification still has P1 blockers. G1 remains HOLD.

## Evidence Sources

- Current source under `mobile/lib`, `mobile/test`, `mobile/android`, `pubspec.yaml`, and `pubspec.lock`.
- `05-flutter-technical-architecture.md`, `08-G0-implementation-report.md`, `10-G0-implementation-contract.md`.
- Historical reviews 11 and 12.
- Round 2 report 13, treated as a claim set and checked against current files and commands.
- Fresh commands run from `E:\KhmerX\KhmerX\mobile` on 2026-10-07.

## Previous P1 Closure

### P1-01 Tests

**OPEN.** The current `flutter test` cannot compile `app.dart` and `localization_test.dart` because `package:flutter_gen/gen_l10n/app_localizations.dart` is not resolvable. The run ends with `+78 -2`, not the Round 2 report's `+90` pass.

### P1-02 APK/Gradle

**OPEN.** The wrapper is now Gradle 8.14.1, but the build still fails because AGP 8.7.0 is below Flutter 3.47's required 8.11.1. Flutter also reports Java 25.0.3 as incompatible with Gradle 8.14.1. No independent APK build passed.

### P1-03 Retry

**CLOSED by source and test coverage.** `RetryInterceptor` now receives the configured Dio and only retries bounded GET requests; POST retry tests and Provider invocation-count tests exist. These tests are not executable in the full suite while localization compilation is broken.

### P1-04 Cookie Isolation

**CLOSED by source and test coverage.** `clearSession()` is used instead of `deleteAll()`, the four-name whitelist and company-scoped jars remain, and CI/ISO tests are present. Full-suite execution is still blocked by unrelated compile errors.

### P1-05 Contract Tests

**OPEN.** The new test files exist for bootstrap, retry, endpoint, origin, cookie, logout, logging, error mapping, feature flags, Khmer rendering, and App Links, but the required complete test command fails at localization compilation.

### P1-06 Redaction

**CLOSED by source inspection.** Case-insensitive key, header, and raw key-value redaction now covers the required secret classes, and direct SafeLogging tests exist. Independent full-suite PASS is not established because of the compile failure.

### P1-07 Evidence

**OPEN.** Round 2 claims all tests and APK build passed, but current commands show test compilation errors and an AGP/JDK build failure. This is an evidence mismatch.

## Previous P2 Closure

### P2-01 Duplicate App

**CLOSED.** The duplicate `app/bootstrap/app.dart` is absent; one `KhmerXApp` and one `MaterialApp.router` remain.

### P2-02 Khmer Rendering

**CLOSED in source/test presence.** `khmer_rendering_smoke_test.dart` renders `សូមស្វាគមន៍`; it is present, but the entire test suite is not green.

### P2-03 Dependency Drift

**OPEN as documented drift.** `pub get` resolves intl 0.20.3 and the required packages without overrides, but versions remain below the architecture snapshot for Riverpod, go_router, secure storage, and app_links. Round 2 records Expected/Actual/Reason/Impact, so this is nonblocking unless compatibility is not repaired.

## P0 Findings

None confirmed.

## P1 Findings

1. `flutter analyze` fails with 10 issues because `flutter_gen` localization imports are unresolved.
2. `flutter test` fails to compile two localization-related test/app units (`+78 -2`).
3. `flutter build apk --debug` fails: AGP 8.7.0 is below Flutter 3.47's minimum 8.11.1, and Java 25.0.3 is incompatible with Gradle 8.14.1.
4. Round 2 report 13 claims PASS for tests/build that current independent evidence disproves.

## P2 Findings

- Dependency versions remain below the architecture target snapshot, though `pub get` resolves and no `dependency_overrides` exists.
- `pub get` reports 24 untranslated messages in both km and zh.

## P3 Findings

None material to the gate.

## Dependency

`flutter --version`: Flutter 3.47.0 stable, Dart 3.13.0. `flutter pub get`: **PASS**. `intl` resolves to 0.20.3. Required dependencies are present in the lockfile and no dependency override was found.

## Analyze

**FAIL, independently reproduced.** Ten issues are reported, led by the unresolved `package:flutter_gen/gen_l10n/app_localizations.dart` import and its dependent undefined symbols.

## Tests

**FAIL, independently reproduced.** The suite contains the new contract tests and no `skip`/`@Skip` markers were found, but two test units fail during compilation because of the same localization import problem. The run reaches 78 passing tests and ends `+78 -2`.

## Build

**FAIL, independently reproduced.** Gradle wrapper 8.14.1 is present, but AGP 8.7.0 is rejected by Flutter 3.47, and the build reports Java 25.0.3 incompatibility. No current APK output is accepted as fresh build evidence.

## Runtime

`flutter devices` reports Windows, Chrome, and Edge only. **RUNTIME DEVICE VALIDATION PENDING.** This is not the independent decision reason because analyze, test, and build already fail.

## Retry

Source and tests now satisfy Provider retry OFF, single-attempt writes, and bounded GET-only retry. No P1 defect found in the revised retry path itself.

## Endpoint

Endpoint tests are present for exact `/api/h5/...` assembly and double-prefix rejection. They could not be counted as a complete green suite because the global test command fails elsewhere.

## Origin

Tests cover `https://api.khmerx.org` and `http://10.0.0.2:8787` style non-default ports, with GET excluded. No current source defect found.

## Cookie

Whitelist, secure persistence, company partitioning, and session-only clearing are implemented and covered by tests. No global authenticated jar or invented value-prefix validation was found.

## Company Isolation

CI-1/CI-3/CI-4/CI-5 and ISO tests are present; source uses per-company jars and key prefixes. Full green execution remains pending the localization fix.

## Secure Storage

Cookie persistence routes through `flutter_secure_storage` via `SecureKv`; no plaintext cookie file, SharedPreferences cookie, or cookie logging was found.

## Logging

Redaction now covers case variations and raw key-value/header forms, and SafeLogging tests assert no body logging. This is source/test evidence, not a full-suite PASS.

## Router

Bootstrap, company, auth, home placeholder, and feature-disabled routes exist. One app root remains.

## Theme

Light/dark KhmerX themes are wired to the app and include `#1677FF`, `#172033`, and `#667085`.

## Localization

en/km/zh ARBs and generated files exist, and Khmer smoke test source exists. The current import path to `package:flutter_gen` is not generated/resolvable under the present Flutter setup, which breaks analyze and test.

## Error Mapping

Tests and source cover 401, 403, 409, 429, 503, and SocketException to OfflineFailure; 409 is distinct from UnknownFailure. Full execution is blocked by the localization compile failure.

## Feature Flags

Withdraw and repay default to false and tests are present.

## Scope

CR-001 remains `PROPOSED`; no `/api/loan/quote`, LoanQuoteRepository, or full KYC/loan/repayment/withdraw implementation was found. G1 code was not started.

## Evidence Consistency

Round 2 report 13 is not current proof: it states Flutter 3.29/JDK17 and successful tests/build, while this environment reports Flutter 3.47, unresolved localization imports, AGP 8.7 rejection, and Java 25/Gradle incompatibility. Current commands and source are authoritative.

## Required Trae Fixes

1. Repair localization generation/imports so `flutter analyze` and every test compile under Flutter 3.47.
2. Upgrade AGP to at least 8.11.1 and configure a Flutter-compatible JDK/Gradle combination; rerun the APK build.
3. Regenerate report 13 from the same current checkout and replace stale command/version claims.
4. Re-run the full test suite and retain output proving all required contract tests pass.

## Claude Architecture Follow-up

Keep CR-001 `PROPOSED`, keep G3 blocked, and do not implement quote or other G1 business flows. Dependency drift may be reconciled after the toolchain is green.

## G0 Decision

**FAIL**. P1 findings remain: analyze, test, and APK build are not independently passing, and the implementation report is inconsistent with current evidence.

## G1 Recommendation

**HOLD** until the localization/toolchain fixes are applied and all four independent commands pass.
