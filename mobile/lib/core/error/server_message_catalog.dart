import 'failure.dart';

typedef _FailureBuilder = AppFailure Function({
  String? traceId,
  int? statusCode,
  String? serverText,
});

final class ServerMessageCatalog {
  ServerMessageCatalog._();

  static Map<int, Map<String, _FailureBuilder>> _catalog() => {
        401: {
          'auth_required': _build(
            (traceId, statusCode, serverText) => AuthFailure.sessionExpired(
              traceId: traceId,
              statusCode: statusCode,
            ),
          ),
          'session_expired': _build(
            (traceId, statusCode, serverText) => AuthFailure.sessionExpired(
              traceId: traceId,
              statusCode: statusCode,
            ),
          ),
          'login_page_expired': _build(
            (traceId, statusCode, serverText) => AuthFailure.loginPageExpired(
              traceId: traceId,
              statusCode: statusCode,
            ),
          ),
          'invalid_credentials': _build(
            (traceId, statusCode, serverText) => AuthFailure.invalidCredentials(
              traceId: traceId,
              statusCode: statusCode,
            ),
          ),
          'identity_unavailable': _build(
            (traceId, statusCode, serverText) => AuthFailure.identityUnavailable(
              traceId: traceId,
              statusCode: statusCode,
            ),
          ),
        },
        403: {
          'cross_site': _build(
            (traceId, statusCode, serverText) => ForbiddenFailure.crossSite(
              traceId: traceId,
              statusCode: statusCode,
            ),
          ),
          'invalid_company': _build(
            (traceId, statusCode, serverText) => ForbiddenFailure.invalidCompany(
              traceId: traceId,
              statusCode: statusCode,
            ),
          ),
          'registration_incomplete': _build(
            (traceId, statusCode, serverText) =>
                ForbiddenFailure.registrationIncomplete(
                  traceId: traceId,
                  statusCode: statusCode,
                ),
          ),
          'company_unavailable': _build(
            (traceId, statusCode, serverText) => ForbiddenFailure.companyUnavailable(
              traceId: traceId,
              statusCode: statusCode,
            ),
          ),
        },
        409: {
          'data_changed': _build(
            (traceId, statusCode, serverText) => ConflictFailure.dataChanged(
              traceId: traceId,
              statusCode: statusCode,
            ),
          ),
          'version_mismatch': _build(
            (traceId, statusCode, serverText) => ConflictFailure.versionMismatch(
              traceId: traceId,
              statusCode: statusCode,
            ),
          ),
          'status_changed': _build(
            (traceId, statusCode, serverText) => ConflictFailure.statusChanged(
              traceId: traceId,
              statusCode: statusCode,
            ),
          ),
          'challenge_pending': _build(
            (traceId, statusCode, serverText) => ConflictFailure.challengePending(
              traceId: traceId,
              statusCode: statusCode,
            ),
          ),
        },
        422: {
          'password_invalid': _build(
            (traceId, statusCode, serverText) => ValidationFailure.passwordInvalid(
              traceId: traceId,
              statusCode: statusCode,
              reason: serverText,
            ),
          ),
          'phone_invalid': _build(
            (traceId, statusCode, serverText) => ValidationFailure.phoneInvalid(
              traceId: traceId,
              statusCode: statusCode,
              reason: serverText,
            ),
          ),
          'company_link_invalid': _build(
            (traceId, statusCode, serverText) =>
                ValidationFailure.companyLinkInvalid(
                  traceId: traceId,
                  statusCode: statusCode,
                  reason: serverText,
                ),
          ),
        },
        400: {
          'wrong_code': _build(
            (traceId, statusCode, serverText) => AuthFailure.wrongCode(
              traceId: traceId,
              statusCode: statusCode,
            ),
          ),
          'code_expired': _build(
            (traceId, statusCode, serverText) => AuthFailure.codeExpired(
              traceId: traceId,
              statusCode: statusCode,
            ),
          ),
          'attempts_exhausted': _build(
            (traceId, statusCode, serverText) => AuthFailure.attemptsExhausted(
              traceId: traceId,
              statusCode: statusCode,
            ),
          ),
          'otp_undeliverable': _build(
            (traceId, statusCode, serverText) => AuthFailure.otpUndeliverable(
              traceId: traceId,
              statusCode: statusCode,
            ),
          ),
          'phone_bound_to_another_account': _build(
            (traceId, statusCode, serverText) =>
                AuthFailure.phoneBoundToAnotherAccount(
                  traceId: traceId,
                  statusCode: statusCode,
                ),
          ),
          'account_not_found': _build(
            (traceId, statusCode, serverText) => AuthFailure.accountNotFound(
              traceId: traceId,
              statusCode: statusCode,
            ),
          ),
          'recovery_conflict': _build(
            (traceId, statusCode, serverText) => AuthFailure.recoveryConflict(
              traceId: traceId,
              statusCode: statusCode,
            ),
          ),
        },
      };

  static _FailureBuilder _build(
    AppFailure Function(
      String? traceId,
      int? statusCode,
      String? serverText,
    ) builder,
  ) {
    return ({traceId, statusCode, serverText}) =>
        builder(traceId, statusCode, serverText);
  }

  static AppFailure from(
    int statusCode, {
    String? code,
    String? message,
    String? traceId,
    required AppFailure Function({String? traceId, int? statusCode}) fallback,
  }) {
    final catalog = _catalog();
    final c = _normalise(code ?? message ?? '');
    final byStatus = catalog[statusCode];
    if (byStatus != null && c.isNotEmpty) {
      for (final entry in byStatus.entries) {
        if (c == _normalise(entry.key)) {
          return entry.value(
            traceId: traceId,
            statusCode: statusCode,
            serverText: message,
          );
        }
      }
    }
    for (final entry in catalog.entries) {
      if (entry.key == statusCode) continue;
      for (final sub in entry.value.entries) {
        if (c == _normalise(sub.key)) {
          return sub.value(
            traceId: traceId,
            statusCode: statusCode,
            serverText: message,
          );
        }
      }
    }
    return fallback(traceId: traceId, statusCode: statusCode);
  }

  static String _normalise(String s) =>
      s.trim().replaceAll(RegExp(r'\s+'), '_').toLowerCase();
}

final class LocalizedLabel {
  LocalizedLabel._();

  static const String zhNative = '中文 (Chinese)';
}
