# HELIX G0 Corrected Final Review

## Final Result

**PASS**. Under corrected contract 19, Flutter selecting Java 25 is a P2 environment issue when the actual Gradle build JVM is an approved JDK 17 and the clean APK build passes. Both conditions are independently verified.

## Review Snapshot

- Git HEAD: `4bceda189160669c5cea6de896c003cb7f41ddd8`
- Working Tree: `REVIEWED_WORKTREE_HAS_UNCOMMITTED_CHANGES` (`docs/`, `mobile/`, and security audit are untracked in this checkout)

## Authoritative Flutter

- Flutter: 3.47.0 stable
- Dart: 3.13.0
- SDK Path: `E:\Dev\flutter`

## Java Environment

- System JAVA_HOME: `C:\Program Files\Android\Android Studio\jbr`
- PATH Java: no `java.exe` returned by `where.exe java`
- Flutter Tool Selected JDK: Android Studio JBR, Java 25.0.3
- Gradle Launcher JVM: 25.0.3
- Gradle Daemon JVM: `C:\Java\jdk-17.0.2` (from `org.gradle.java.home`)
- `org.gradle.java.home`: `C:\Java\jdk-17.0.2`

The direct `android\gradlew.bat --version` output proves the daemon JVM used by the build is JDK 17. The corrected contract makes Flutter Tool Java 25 nonblocking in this situation.

## Android Toolchain

- AGP: 8.11.1
- Gradle: 8.14.1
- Kotlin: 2.4.0
- compileSdk: Flutter SDK compile SDK (36 in this environment)
- targetSdk: 34
- minSdk: Flutter secure-storage-compatible project minimum
- Java sourceCompatibility: 17
- Java targetCompatibility: 17
- Kotlin jvmTarget: JVM_17

## Independent Gate

All commands were run from the current worktree with `E:\Dev\flutter\bin\flutter.bat` after a clean:

- clean: PASS
- pub get: PASS
- gen-l10n: PASS
- analyze: PASS (`No issues found`)
- test: PASS (`+90`, 0 failures)
- build apk: PASS

No `dependency_overrides`, `skip`, `@Skip`, or disabled critical contract tests were found.

## APK

- Path: `E:\KhmerX\KhmerX\mobile\build\app\outputs\flutter-apk\app-debug.apk`
- Size: 160,566,662 bytes
- LastWriteTime: 2026-10-07 15:22:47

## Contract Regression

- Retry: PASS — Provider failure invokes once; failing POST sends once.
- Cookie: PASS — company A/B isolation, whitelist, persistence, unknown-cookie rejection.
- Logout: PASS — clearing A session retains B and restores A after switching back.
- Redaction: PASS — required secret fields and headers are redacted without request-body dumping.
- Endpoint: PASS — exact `/api/h5/...` assembly and no duplicate `/api`.
- Origin: PASS — POST Origin preserves non-default ports; GET does not add it.
- Error Mapping: PASS — status failures and OfflineFailure tests execute.
- Feature Flags: PASS — withdraw and repay default false.
- Localization: PASS — en/km/zh generation and widget tests pass.
- Router: PASS — bootstrap, gates, theme, and MaterialApp.router tests pass.

## P0

None.

## P1

None. The earlier JDK and evidence findings are closed under corrected contract 19: the Gradle daemon is independently proven on JDK 17, the clean build passes, and this review records the environment distinction explicitly.

## P2

- Flutter Tool selected JDK 25 remains a developer-environment portability issue.
- `org.gradle.java.home` is a machine-specific absolute path.
- Dependency versions differ from historical architecture targets without observed contract behavior regressions.
- Khmer/Chinese copy awaits final linguistic review.
- Flutter warns that Gradle 8.14.1 and AGP 8.11.1 will be dropped in a future baseline.
- No Android runtime device is connected; validation is pending.

## P3

None material to G0.

## Evidence Reproducibility

The current review is reproducible: the same specified Flutter SDK, clean gate, direct Gradle JVM report, passing tests, and APK artifact were observed in this worktree. Report 17's prior JDK17 Flutter-tool claim was environment-specific and is retained as historical context; it does not block the corrected G0 contract because the actual Gradle build JVM is verified as JDK 17.

## Accepted Technical Debt

Carry the P2 environment, hard-coded JDK path, dependency drift, linguistic review, future toolchain warning, and Android runtime validation into G1 planning. Do not implement G1 business features in this review.

## G0 Decision

**PASS**.

## G1 Recommendation

**GO** for the next contract/reconciliation step. Do not begin G1 coding until the required three-party Gate Review and UX readiness reconciliation are completed.
