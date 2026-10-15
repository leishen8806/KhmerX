import '../../l10n/app_localizations.dart';
import 'failure.dart';

/// User-facing, localized text for a failure. Never returns a message key.
String describeFailure(AppLocalizations l, AppFailure f) {
  final k = f.messageKey;
  if (f is NetworkFailure) return l.errNetwork;
  if (f is OfflineFailure) return l.errOffline;
  if (f is ServiceUnavailableFailure) return l.errServiceUnavailable;
  if (f is AuthFailure) {
    if (k.contains('session_expired') || k.contains('unauthenticated')) {
      return l.errSessionExpired;
    }
    if (k.contains('invalid_credentials')) return l.errInvalidCredentials;
    if (k.contains('login_page_expired') || k.contains('browser')) {
      return l.errLoginPageExpired;
    }
    if (k.contains('wrong_code') || k.contains('otp')) return l.errCodeIncorrect;
    if (k.contains('code_expired')) return l.errCodeExpired;
    if (k.contains('attempts')) return l.errTooManyAttempts;
    return l.errSignInFailed;
  }
  if (f is ForbiddenFailure) {
    if (k.contains('registration_incomplete')) return l.errFinishPassword;
    if (k.contains('cross_site') || k.contains('csrf')) return l.errSecurity;
    return l.errForbidden;
  }
  if (f is ConflictFailure) {
    if (k.contains('data_changed')) return l.errStatusChanged;
    if (k.contains('phone') || k.contains('bound')) return l.errPhoneInUse;
    return l.errConflict;
  }
  if (f is ValidationFailure) {
    if (k.contains('otp') || k.contains('invalid_otp')) return l.errCodeIncorrect;
    if (k.contains('expired')) return l.errCodeExpired;
    if (k.contains('exhausted') || k.contains('attempts')) return l.errTooManyAttempts;
    if (k.contains('password') && k.contains('length')) return l.errPasswordLength;
    if (k.contains('body_too_large')) return l.errRequestTooLarge;
    return l.errInvalidInput;
  }
  if (f is RateLimitFailure) {
    return l.errTooManyRequests(f.retryAfter?.inSeconds ?? 60);
  }
  // Unknown failure kinds: a generic sentence, never the internal key.
  return l.errGeneric;
}
