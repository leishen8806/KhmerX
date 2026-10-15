# G1 Implementation Recovery Report

Date: 2026-10-08
Scope: G1 implementation recovery only. G2/G3 and product Contracts were not modified.

## Result

```text
G1 IMPLEMENTATION RECOVERY COMPLETE
READY FOR CODEX G1 RE-REVIEW
```

## Implemented P1 Fixes

- Replaced Company/Auth placeholders with real navigable flows:
  - company select, paste link, QR scan, candidate confirmation;
  - auth preflight, Telegram consent/code, password login, set password;
  - password recovery send/code;
  - minimal authenticated home, company switch, language and logout.
- Registered all G1 routes in the GoRouter graph.
- Wired App Links processing into startup. A deep link stores a pending company and requires explicit candidate confirmation before switching; it never authenticates a customer.
- Added production `mobile_scanner` usage only in the company presentation layer.
- Corrected Auth DTOs to the approved API contract:
  - `phone + consent` send;
  - `challengeId + code` verify;
  - `action=password_login` / `action=set_password` account calls;
  - recovery `send` / `reset` actions with password confirmation.
- Parsed `/api/h5/auth` response fields (`authenticated`, `session`, `pending`, `policy`, `languages`) and routed registration-incomplete sessions to password setup.
- Logout now reports transport/server failures and preserves the local session on failure; local cookies/session state are cleared only after a successful server logout.
- Company switching now changes active context without clearing either company session.
- Language choices are filtered by the server-provided language map when available.
- Fixed the analyzer issue and disabled Kotlin incremental compilation to avoid the cross-drive cache failure in `mobile_scanner` builds.

## Independent Evidence

| Check | Result |
|---|---|
| `flutter analyze` | PASS, zero issues |
| `flutter test` | PASS, 133 tests, 0 failed, 0 skipped |
| `flutter build apk --debug` | PASS, APK produced after clean build |
| APK | `mobile/build/app/outputs/flutter-apk/app-debug.apk` |
| Android device/emulator | Not connected in this environment; runtime acceptance remains pending device execution |

The existing repository tests were updated where their assertions described the superseded placeholder DTOs or false-success logout behavior. The new assertions verify the approved request shape and failure semantics.

## Files Changed

- `mobile/lib/features/auth/data/auth_repository.dart`
- `mobile/lib/features/auth/domain/auth_gate_state.dart`
- `mobile/lib/features/auth/presentation/auth_placeholder.dart`
- `mobile/lib/features/company/presentation/company_pages.dart`
- `mobile/lib/features/home/presentation/home_placeholder.dart`
- `mobile/lib/features/startup/presentation/startup_page.dart`
- `mobile/lib/app/router/router.dart`
- `mobile/lib/app/router/deep_link_handler.dart`
- `mobile/lib/app/bootstrap/providers.dart`
- `mobile/android/gradle.properties`
- `mobile/test/features/auth/data/auth_repository_test.dart`
- `mobile/test/support/fake_khmerx_server.dart`

## Known Validation Limit

No Android emulator or physical device was attached during this recovery run, so Telegram delivery, camera permission UX, Android App Link dispatch, and 320/360/412dp plus 130%/200% font-scale screenshots still require the Codex G1 runtime pass.

## Gate

```text
G1 implementation: ready for Codex re-review
G2/G3: remain HOLD/BLOCKED until G1 acceptance closes
```
