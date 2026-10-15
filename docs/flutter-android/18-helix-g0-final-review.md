# HELIX G0 Final Independent Review

## Final Result

**FAIL**. The clean project commands pass, but the Flutter-selected JDK is still Java 25.0.3 and the Round 4 report claims a persisted JDK 17 setting that is not present in the independent configuration output.

## Previous Blocking Findings

### Flutter JDK

**OPEN.** `E:\Dev\flutter\bin\flutter.bat config --list` has no `jdk-dir`. `flutter doctor -v` reports:

`Java binary at: C:\Program Files\Android\Android Studio\jbr\bin\java` and Java 25.0.3.

The JDK 17 binary itself exists and reports OpenJDK 17.0.2. `mobile/android/gradle.properties` points Gradle to `C:\Java\jdk-17.0.2`, so the build can pass, but Flutter's selected tool JDK is not 17 as required.

### Evidence Consistency

**OPEN.** Report 17 says `flutter config --jdk-dir=C:\Java\jdk-17.0.2` was persisted and that Flutter doctor used JDK 17. Current `config --list` and `doctor -v` contradict both claims. This is a current P1 evidence mismatch.

## Authoritative Environment

| Item | Independent result |
|---|---|
| Flutter | 3.47.0 stable |
| Dart | 3.13.0 |
| Flutter SDK Path | `E:\Dev\flutter` |
| System JAVA_HOME | `C:\Program Files\Android\Android Studio\jbr` |
| PATH Java | no `java.exe` found by `where.exe java` |
| Flutter Selected JDK | Android Studio JBR, Java 25.0.3 |
| Gradle JDK | `C:\Java\jdk-17.0.2` via `org.gradle.java.home` |
| AGP | 8.11.1 |
| Gradle | 8.14.1 |
| Kotlin | 2.4.0 |

## Independent Final Gate

| Command | Result |
|---|---|
| `flutter clean` | PASS |
| `flutter pub get` | PASS |
| `flutter gen-l10n` | PASS |
| `flutter analyze` | PASS, 0 issues |
| `flutter test` | PASS, 90 tests |
| `flutter build apk --debug` | PASS |

All commands were independently run with `E:\Dev\flutter\bin\flutter.bat` after a clean. No skip markers, `@Skip`, or disabled critical tests were found.

## APK Artifact

- Path: `E:\KhmerX\KhmerX\mobile\build\app\outputs\flutter-apk\app-debug.apk`
- Size: 160,566,662 bytes
- LastWriteTime: 2026-10-07 15:08:39

## Contract Regression

| Contract | Result |
|---|---|
| Retry | PASS: Provider invocation count 1 and POST request count 1 |
| Cookie Isolation | PASS: A/B jars, logout isolation, A→B→A restore, unknown-cookie rejection |
| Logout Isolation | PASS |
| Redaction | PASS: required case-insensitive secret fields and interceptor coverage |
| Endpoint | PASS: exact `/api/h5/...` URLs and no duplicate prefix |
| Origin | PASS: non-default port preserved; GET excluded |
| Error Mapping | PASS: required status and OfflineFailure tests |
| Feature Flags | PASS: withdraw and repay default false |
| Localization | PASS: gen-l10n and en/km widget tests; ARB key sets equal |
| Router | PASS: bootstrap, gates, theme, and MaterialApp.router tests |

## P0 Findings

None.

## P1 Findings

1. Flutter selected JDK remains Java 25.0.3; `jdk-dir` is absent from `flutter config --list`.
2. Report 17's claim that Flutter is configured and verified on JDK 17 is contradicted by independent `config --list` and `doctor -v` output.

## P2 Findings

- Dependency versions differ from historical architecture targets but behavior tests pass.
- Khmer/Chinese copy still has a pending linguistic review.
- Flutter warns that Gradle 8.14.1 and AGP 8.11.1 will be dropped in a future baseline.
- No Android runtime device is connected; `flutter devices` shows Windows, Chrome, and Edge.

## P3 Findings

None material to G0.

## Evidence Consistency

The source, clean command results, test suite, localization generation, and APK artifact are consistent. The Round 4 JDK evidence is not: it claims a persisted Flutter JDK 17, while the current authoritative Flutter command still selects Android Studio Java 25. This prevents closure of the final evidence P1.

## Technical Debt Accepted For G1

The dependency drift, linguistic review, future toolchain warnings, and pending Android device validation can remain as G1 debt. They do not block this decision once the JDK selection and evidence mismatch are corrected.

## G0 Decision

**FAIL**. The contract requires Flutter Tool JDK 17 and P1=0. Gradle's project-local JDK setting does not satisfy the separate Flutter JDK verification requirement.

## G1 Recommendation

**HOLD**. Persist `jdk-dir` for the same Flutter SDK, verify `config --list` and `doctor -v` both show `C:\Java\jdk-17.0.2\bin\java`, then rerun the final clean gate and update report 17 from that evidence.
