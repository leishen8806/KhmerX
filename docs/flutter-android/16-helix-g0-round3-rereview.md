# HELIX G0 Round 3 Independent Re-Review

## Final Result

**FAIL**. The clean Flutter commands and APK build pass, but the authoritative Flutter environment still resolves Java 25.0.3 and has no configured `jdk-dir` pointing to JDK 17. The Round 3 toolchain is therefore not reproducibly controlled under the review contract.

## Authoritative Environment

| Item | Independent result |
|---|---|
| Flutter | 3.47.0 stable |
| Dart | 3.13.0 |
| Flutter path | `E:\Dev\flutter` (`where flutter` returned only this installation) |
| Java | `flutter doctor -v`: Android Studio JBR OpenJDK 25.0.3 |
| AGP | 8.11.1 |
| Gradle | 8.14.1-all |
| Kotlin | 2.4.0 |
| Java source/target | 17 |
| Kotlin jvmTarget | JVM_17 |

`flutter config --list` has no `jdk-dir` setting. `gradle.properties` contains a project-local JDK 17 path, and the build passed, but Flutter's own selected JDK remains 25.0.3. The contract explicitly requires the Flutter JDK selection to be verified and treats continued Java 25 selection as P1.

## Round 3 P1 Verification

### P1-01 Localization / Analyze

**VERIFIED CLOSED.** `l10n.yaml` uses one `lib/l10n` output scheme; app imports no synthetic `package:flutter_gen` path; `flutter gen-l10n` passed; `flutter analyze` passed with 0 issues.

### P1-02 Tests

**VERIFIED CLOSED.** Clean `flutter test` passed with `+90` and no compile or failed tests. No `skip`, `@Skip`, or disabled-test markers were found. Required retry, POST, cookie, endpoint, origin, error, feature flag, localization, router/bootstrap, App Link, and logging tests are present and executed.

### P1-03 Android Build

**NOT VERIFIED / OPEN.** `flutter build apk --debug` passed and produced an APK, but `flutter doctor -v` still selects Java 25.0.3 and `flutter config --list` does not show the claimed JDK 17 configuration. This violates the required reproducible JDK verification even though `org.gradle.java.home` lets this build complete.

### P1-04 Evidence

**OPEN.** Report 15 claims `flutter config --jdk-dir=C:\Java\jdk-17.0.2` and says Flutter no longer uses Java 25. The independent `flutter doctor -v` and `flutter config --list` contradict that claim. The report is materially inconsistent with the current environment.

## Round 3 P2 Verification

### P2-01 Dependency Drift

**VERIFIED NON-BLOCKING.** `pub get` passed without overrides. Resolved versions are Riverpod 3.3.2, go_router 17.0.0, Dio 5.11.1, cookie_jar 4.0.9, secure storage 9.2.4, app_links 6.4.1, and intl 0.20.3. The version differences from 05 are documented with impact and did not break the independent tests.

### P2-02 Localization Completeness

**VERIFIED CLOSED for G0 scope.** Programmatic comparison found 64 keys in each of `app_en.arb`, `app_km.arb`, and `app_zh.arb`, with identical key sets. `gen-l10n` reported no untranslated messages. Final linguistic review remains outside this gate.

## Regression Verification

| Regression | Result |
|---|---|
| Provider retry OFF / POST no retry | VERIFIED CLOSED |
| Cookie A/B isolation and logout | VERIFIED CLOSED |
| Redaction | VERIFIED CLOSED |
| Endpoint `/api` assembly | VERIFIED CLOSED |
| Origin port preservation | VERIFIED CLOSED |

## Independent Commands

| Command | Result |
|---|---|
| `flutter clean` | PASS, independently reproduced |
| `flutter pub get` | PASS, independently reproduced |
| `flutter gen-l10n` | PASS, independently reproduced |
| `flutter analyze` | PASS, 0 issues, independently reproduced |
| `flutter test` | PASS, 90 tests, independently reproduced |
| `flutter build apk --debug` | PASS, independently reproduced |

## APK Artifact

- Path: `E:\KhmerX\KhmerX\mobile\build\app\outputs\flutter-apk\app-debug.apk`
- Size: 160,566,662 bytes
- Last modified: 2026-10-07 14:40:17

## P0 Findings

None confirmed.

## P1 Findings

1. Flutter's authoritative `doctor -v` still selects Java 25.0.3; no user-level `jdk-dir` is configured to force JDK 17 as required.
2. Report 15 explicitly claims the JDK 17 Flutter configuration is active, but independent configuration and doctor output contradict it. This is an evidence mismatch.

## P2 Findings

- Package versions remain below several 05 targets, with no observed semantic regression.
- Khmer and Chinese copy is technically complete for G0 but still needs linguistic review.
- `flutter build` emits future-support warnings for Gradle 8.14.1 and AGP 8.11.1; these are not current failures.

## P3 Findings

None material to the gate.

## Evidence Consistency

Source, clean commands, generated localization, tests, and APK artifact are current and consistent except for the claimed JDK selection. Report 15's final snapshot is not independently reproducible because it states JDK 17 while Flutter doctor reports JDK 25 and config has no `jdk-dir` setting.

## G0 Decision

**FAIL**. The gate requires P1=0 and an explicitly verified Flutter-compatible JDK. The current clean build passing through a project Gradle property does not close the Flutter-level Java selection mismatch.

## G1 Recommendation

**HOLD**. Set and verify the Flutter JDK with `E:\Dev\flutter\bin\flutter.bat config --jdk-dir=C:\Java\jdk-17.0.2`, then rerun doctor, clean, gen-l10n, analyze, test, and APK build from the same SDK.
