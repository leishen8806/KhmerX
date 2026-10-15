# G1 Recovery Acceptance Re-Review

Date: 2026-10-08
Reviewer: Codex independent review
Scope: Recovery implementation only; no code changes made.

## Final Result

```text
G1 RECOVERY ACCEPTANCE RE-REVIEW: FAIL
G1: FAIL
G2 RECOMMENDATION: HOLD
```

## Snapshot

```text
HEAD: ea3a4d0e38bb336398dbd7ae2be77ee100931625
WORKTREE: dirty/uncommitted; docs/flutter-android/, docs/security-audit-20261006.md, docs/code-audit-20261008.md, mobile/
```

The review covered the current uncommitted worktree. `34-G1-implementation-recovery-report.md` is directionally accurate for analyze/test/debug-build results, but it explicitly records runtime and accessibility as pending; therefore it cannot be treated as a G1 PASS report.

## Previous P1 Closure

| Finding | Result | Evidence |
|---|---|---|
| P1-01 routes/placeholders | OPEN | Pages exist, but several approved behaviors remain fake or incomplete (candidate/preflight, recovery send, recent companies, pending OTP restoration). |
| P1-02 Auth DTO mismatch | VERIFIED CLOSED | Repository sends approved endpoint paths and primary request fields. |
| P1-03 logout false success | VERIFIED CLOSED | Logout clears local state only after successful POST; failure returns `Left`. |
| P1-04 deep link registration | OPEN | `app_links` is registered and parser is wired, but candidate context is not preflighted before switching and no Android runtime proof exists. |
| P1-05 scanner missing | OPEN | Scanner widget exists, but permission-denied/error/fallback behavior is not implemented or tested. |
| P1-06 analyze | VERIFIED CLOSED | Independent command exited 0 with zero issues. |
| P1-07 debug build | VERIFIED CLOSED | Independent debug APK build exited 0. |
| P1-08 Android runtime | OPEN | `adb devices -l` has no attached device/AVD; no install/launch/logcat/route evidence. |
| P1-09 accessibility | OPEN | No 320/360/412dp or 130%/200% text-scale layout/runtime tests or evidence. |
| P1-10 evidence mismatch | OPEN | 34 accurately states runtime/accessibility are pending, which itself prevents G1 exit; 30 remains historical and conflicts with current HEAD. |

## Scope

No calls to KYC, loan, quote, signature, repayment, withdraw, KESS, or CR-001 backend were added to the current product flow. The scope remains G1-only.

## Route Inventory

The current router contains the approved route paths plus a candidate-confirmation path: startup, company select, scan, paste-link, auth login, Telegram consent/code, password, set-password, recovery, recovery code, home, me, company, and language. However, route presence is not sufficient for acceptance because several CTAs do not execute the contracted API/state behavior.

## CF-0

**PASS at foundation level.** Existing interceptor order and FakeKhmerxServer cookie guard tests still cover exactly-one company cookie, A/B isolation, duplicate/missing/mismatch rejection, and logout tenant context.

## CF-6

**PASS at foundation level.** Persisted jars are reloaded and only the target session cookie is cleared.

## Company Flow / Candidate / Switch

**OPEN P1.** `CompanySelectPage.choose()` activates the selected company before candidate confirmation. That violates the required `Active=A, Candidate=B` invariant. Candidate confirmation also does not call `GET /api/h5/auth` in B context before switching. Recent-company UI is absent. The paste-link page only navigates with a query parameter; the select page does not consume that parameter.

## Deep Link

**OPEN P1.** Startup registers `app_links`, parses a company, and shows a candidate page, but no independent test proves Android intent → parser → candidate preflight → confirmation → switch. The candidate flow does not perform the required candidate preflight.

## Scanner

**OPEN P1.** `mobile_scanner` is used in the approved presentation directory. The widget parses a QR result, but there is no explicit camera permission-denied state, scan error state, or in-page paste fallback. No scanner widget test exists.

## Auth Preflight

**PARTIAL.** Repository parsing covers `company`, `authenticated`, `session`, `pending`, `policy`, and `languages`, and maps mandatory password setup. The login page does not automatically restore the pending OTP route; it only displays a resume button.

## OTP

**OPEN P1.** Consent is unchecked and the send CTA is disabled until consent. The DTOs are correct. The UI does not retain the server `challengeId`/`retryAt` response; verification currently uses the phone value as the challenge ID. Recovery send has no repository call. OTP state coverage is not implemented for all contracted states (expired, attempts exhausted, 429 countdown, timeout/offline, Telegram unavailable), and no widget/state acceptance tests cover them.

## Password

**PARTIAL.** Password login and set-password calls use the approved actions. Password show/hide is absent, and the OTP alternative is only a navigation button without a complete state contract.

## Recovery

**OPEN P1.** The recovery send page only navigates to the code page; it does not call `POST /api/h5/auth/recovery` with `action=send`. The reset page calls the reset action. The required recovery send → reset → password login loop is therefore incomplete.

## Session Restore

**OPEN P1.** Active company restoration and preflight are wired for startup, but pending OTP restoration is not automatic and candidate company preflight is missing.

## Logout

**VERIFIED CLOSED.** Server failure returns an error and keeps the session. Success then clears only the current company session.

## 401 Return Intent

**OPEN P1.** No independent Return Intent controller/test was found for `401 → reauth → safe GET restoration`, and no proof exists that sensitive POST actions cannot be replayed.

## Error Mapping / 429

429 clamp is implemented as a single `Duration? retryAfter` with the required 60/1..3600/3600 behavior and tests. Catalog mappings exist for known 400/401/403/409 cases. No UI acceptance evidence proves all required error CTAs and countdown behavior.

## Locale

**PARTIAL.** `MaterialApp.locale` is state-bound and language choices are filtered by the latest preflight snapshot when available. There is no test proving company-scoped locale isolation or the server-disabled `zh=false` interaction in the real page.

## Minimal Home

**PARTIAL.** Home exposes company, switch, language and logout and does not call business APIs. Masked identity is not shown; runtime proof is absent.

## Manifest

INTERNET, optional CAMERA feature, and App Link intent filter are present. Debug cleartext configuration still uses a permissive `base-config cleartextTrafficPermitted="true"` and includes `127.0.0.1`; this is broader than the host-scoped debug contract and remains P2.

## Security / Logging

Foundation redaction and cookie isolation tests pass. No new production manual Cookie header construction or secret logging was found in the recovery diff.

## Tests

Independent `flutter test` passed: 133 tests, 0 failures, 0 compile errors. The suite lacks required route inventory, Return Intent, scanner, accessibility, and runtime acceptance tests.

## G0 Regression

Existing G0 retry, cookie, origin, redaction, endpoint, feature-flag, and localization foundation tests pass within the 133-test run.

## Analyze

Independent `E:\Dev\flutter\bin\flutter.bat analyze` exited 0 with zero issues.

## Debug Build

Independent `E:\Dev\flutter\bin\flutter.bat build apk --debug` exited 0.

```text
APK: E:\KhmerX\KhmerX\mobile\build\app\outputs\flutter-apk\app-debug.apk
Size: 204452241 bytes
LastWriteTime: 2026-10-08 10:20:10 (latest observed artifact)
```

## Release Build

No independent release build was executed in this review. A historical release APK must not be used as current evidence.

## Android X-18

**FAIL P1.** `adb devices -l` returned no device or emulator. There is no independent evidence of install, launch, process survival, fatal-crash scan, or Android G1 route rendering.

## Accessibility

**FAIL P1.** No independent evidence or automated layout tests cover 320dp, 360dp, 412dp, 130% font scale, 200% font scale, CTA reachability, or long Khmer text on Company/Auth/OTP/Recovery/Home routes.

## Evidence Consistency

The current 34 report is consistent about analyze/test/debug build and explicitly discloses missing runtime/accessibility evidence. It does not support a completed G1 gate. The historical 30 report remains stale and is not used as acceptance evidence.

## P0

None proven in this review. CF-0 and secret-redaction foundations remain passing.

## P1

1. Candidate company is activated before confirmation and candidate preflight is missing.
2. Recovery send does not call the recovery API; OTP challenge ID/response state is not retained.
3. Pending OTP, Return Intent, scanner error/permission fallback, and required error-state UX are not implemented/tested end-to-end.
4. Android X-18 runtime evidence is absent because no device/AVD is attached.
5. Accessibility evidence and automated checks for all required sizes/text scales are absent.
6. Critical route/runtime acceptance tests are missing.

## P2

1. Debug cleartext base configuration is broader than the host-scoped requirement.
2. Password show/hide and masked identity are incomplete polish/accessibility details.
3. Release APK was not independently rebuilt.

## P3

1. Copy and visual polish.
2. Real Telegram delivery and camera hardware acceptance after runtime setup.

## G1 Decision

```text
G1 RECOVERY ACCEPTANCE RE-REVIEW: FAIL
G1: FAIL
```

## G2 Recommendation

```text
G2 RECOMMENDATION: HOLD
```

The implementation is not authorized to move to G2.
