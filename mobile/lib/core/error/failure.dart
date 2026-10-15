import 'package:equatable/equatable.dart';

import '../session/company_id.dart';

sealed class AppFailure extends Equatable {
  String get messageKey;
  int? get statusCode;
  String? get traceId;
  Map<String, dynamic> get context => const {};
}

final class NetworkFailure extends AppFailure {
  NetworkFailure.connectionTimeout({this.traceId, this.statusCode})
      : messageKey = 'error.network.connection_timeout',
        _kind = _NetworkKind.connectionTimeout;

  NetworkFailure.sendTimeout({this.traceId, this.statusCode})
      : messageKey = 'error.network.send_timeout',
        _kind = _NetworkKind.sendTimeout;

  NetworkFailure.receiveTimeout({this.traceId, this.statusCode})
      : messageKey = 'error.network.receive_timeout',
        _kind = _NetworkKind.receiveTimeout;

  NetworkFailure.unknown({this.traceId, this.statusCode})
      : messageKey = 'error.network.unknown',
        _kind = _NetworkKind.unknown;

  final _NetworkKind _kind;

  @override
  final String messageKey;

  @override
  final int? statusCode;

  @override
  final String? traceId;

  @override
  List<Object?> get props => [_kind, messageKey, statusCode, traceId];
}

enum _NetworkKind {
  connectionTimeout,
  sendTimeout,
  receiveTimeout,
  unknown,
}

final class TenantContextFailure extends AppFailure {
  TenantContextFailure({
    this.traceId,
    this.statusCode,
    required this.clientCompanyId,
    this.transportCompanyId,
    this.companyCount,
    this.cookieHeader,
    this.reason,
  }) : messageKey = 'error.tenant.context';

  final CompanyId clientCompanyId;
  final String? transportCompanyId;
  final int? companyCount;
  final String? cookieHeader;
  final String? reason;

  @override
  final String messageKey;

  @override
  final int? statusCode;

  @override
  final String? traceId;

  @override
  Map<String, dynamic> get context {
    final map = <String, dynamic>{
      'companyId': clientCompanyId.raw,
    };
    if (transportCompanyId != null) map['transport'] = transportCompanyId!;
    if (companyCount != null) map['count'] = companyCount!;
    if (reason != null) map['reason'] = reason!;
    return map;
  }

  @override
  List<Object?> get props => [
        messageKey,
        statusCode,
        traceId,
        clientCompanyId,
        transportCompanyId,
        companyCount,
        reason,
      ];
}

final class AuthFailure extends AppFailure {
  AuthFailure.unauthenticated({this.traceId, this.statusCode})
      : messageKey = 'error.auth.unauthenticated',
        _kind = _AuthKind.unauthenticated;

  AuthFailure.sessionExpired({this.traceId, this.statusCode})
      : messageKey = 'error.auth.session_expired',
        _kind = _AuthKind.sessionExpired;

  AuthFailure.loginPageExpired({this.traceId, this.statusCode})
      : messageKey = 'error.auth.login_page_expired',
        _kind = _AuthKind.loginPageExpired;

  AuthFailure.invalidCredentials({this.traceId, this.statusCode})
      : messageKey = 'error.auth.invalid_credentials',
        _kind = _AuthKind.invalidCredentials;

  AuthFailure.identityUnavailable({this.traceId, this.statusCode})
      : messageKey = 'error.auth.identity_unavailable',
        _kind = _AuthKind.identityUnavailable;

  AuthFailure.tooManyAttempts({this.traceId, this.statusCode})
      : messageKey = 'error.auth.too_many_attempts',
        _kind = _AuthKind.tooManyAttempts;

  AuthFailure.attemptsExhausted({this.traceId, this.statusCode})
      : messageKey = 'error.auth.attempts_exhausted',
        _kind = _AuthKind.attemptsExhausted;

  AuthFailure.wrongCode({this.traceId, this.statusCode})
      : messageKey = 'error.auth.wrong_code',
        _kind = _AuthKind.wrongCode;

  AuthFailure.codeExpired({this.traceId, this.statusCode})
      : messageKey = 'error.auth.code_expired',
        _kind = _AuthKind.codeExpired;

  AuthFailure.otpUndeliverable({this.traceId, this.statusCode})
      : messageKey = 'error.auth.otp_undeliverable',
        _kind = _AuthKind.otpUndeliverable;

  AuthFailure.phoneBoundToAnotherAccount({this.traceId, this.statusCode})
      : messageKey = 'error.auth.phone_bound_to_another_account',
        _kind = _AuthKind.phoneBoundToAnotherAccount;

  AuthFailure.accountNotFound({this.traceId, this.statusCode})
      : messageKey = 'error.auth.account_not_found',
        _kind = _AuthKind.accountNotFound;

  AuthFailure.recoveryConflict({this.traceId, this.statusCode})
      : messageKey = 'error.auth.recovery_conflict',
        _kind = _AuthKind.recoveryConflict;

  final _AuthKind _kind;

  @override
  final String messageKey;

  @override
  final int? statusCode;

  @override
  final String? traceId;

  @override
  List<Object?> get props => [_kind, messageKey, statusCode, traceId];
}

enum _AuthKind {
  unauthenticated,
  sessionExpired,
  loginPageExpired,
  invalidCredentials,
  identityUnavailable,
  tooManyAttempts,
  attemptsExhausted,
  wrongCode,
  codeExpired,
  otpUndeliverable,
  phoneBoundToAnotherAccount,
  accountNotFound,
  recoveryConflict,
}

final class ForbiddenFailure extends AppFailure {
  ForbiddenFailure.crossSite({this.traceId, this.statusCode})
      : messageKey = 'error.forbidden.cross_site',
        _kind = _ForbiddenKind.crossSite;

  ForbiddenFailure.invalidCompany({this.traceId, this.statusCode})
      : messageKey = 'error.forbidden.invalid_company',
        _kind = _ForbiddenKind.invalidCompany;

  ForbiddenFailure.registrationIncomplete({this.traceId, this.statusCode})
      : messageKey = 'error.forbidden.registration_incomplete',
        _kind = _ForbiddenKind.registrationIncomplete;

  ForbiddenFailure.companyUnavailable({this.traceId, this.statusCode})
      : messageKey = 'error.forbidden.company_unavailable',
        _kind = _ForbiddenKind.companyUnavailable;

  ForbiddenFailure.server({this.traceId, this.statusCode})
      : messageKey = 'error.forbidden.server',
        _kind = _ForbiddenKind.server;

  final _ForbiddenKind _kind;

  @override
  final String messageKey;

  @override
  final int? statusCode;

  @override
  final String? traceId;

  @override
  List<Object?> get props => [_kind, messageKey, statusCode, traceId];
}

enum _ForbiddenKind {
  crossSite,
  invalidCompany,
  registrationIncomplete,
  companyUnavailable,
  server,
}

final class ConflictFailure extends AppFailure {
  ConflictFailure.dataChanged({this.traceId, this.statusCode})
      : messageKey = 'error.conflict.data_changed',
        _kind = _ConflictKind.dataChanged;

  ConflictFailure.versionMismatch({this.traceId, this.statusCode})
      : messageKey = 'error.conflict.version_mismatch',
        _kind = _ConflictKind.versionMismatch;

  ConflictFailure.statusChanged({this.traceId, this.statusCode})
      : messageKey = 'error.conflict.status_changed',
        _kind = _ConflictKind.statusChanged;

  ConflictFailure.challengePending({this.traceId, this.statusCode})
      : messageKey = 'error.conflict.challenge_pending',
        _kind = _ConflictKind.challengePending;

  final _ConflictKind _kind;

  @override
  final String messageKey;

  @override
  final int? statusCode;

  @override
  final String? traceId;

  @override
  List<Object?> get props => [_kind, messageKey, statusCode, traceId];
}

enum _ConflictKind {
  dataChanged,
  versionMismatch,
  statusChanged,
  challengePending,
}

final class ValidationFailure extends AppFailure {
  ValidationFailure.passwordInvalid({this.traceId, this.statusCode, this.reason})
      : messageKey = 'error.validation.password_invalid',
        _kind = _ValidationKind.passwordInvalid;

  ValidationFailure.phoneInvalid({this.traceId, this.statusCode, this.reason})
      : messageKey = 'error.validation.phone_invalid',
        _kind = _ValidationKind.phoneInvalid;

  ValidationFailure.companyLinkInvalid({
    this.traceId,
    this.statusCode,
    this.reason,
  }) : messageKey = 'error.validation.company_link_invalid',
        _kind = _ValidationKind.companyLinkInvalid;

  ValidationFailure.bodyTooLarge({
    this.traceId,
    this.statusCode,
    required int limitBytes,
    required int actualBytes,
  })  : messageKey = 'error.validation.body_too_large',
        _kind = _ValidationKind.bodyTooLarge,
        reason = 'limit_bytes=$limitBytes;actual_bytes=$actualBytes';

  final _ValidationKind _kind;
  final String? reason;

  @override
  final String messageKey;

  @override
  final int? statusCode;

  @override
  final String? traceId;

  @override
  Map<String, dynamic> get context => {
        if (reason != null) 'reason': reason!,
      };

  @override
  List<Object?> get props => [_kind, messageKey, statusCode, traceId, reason];
}

enum _ValidationKind {
  passwordInvalid,
  phoneInvalid,
  companyLinkInvalid,
  bodyTooLarge,
}

final class RateLimitFailure extends AppFailure {
  RateLimitFailure({this.retryAfter, this.traceId, this.statusCode})
      : messageKey = 'error.rate_limit';

  final Duration? retryAfter;

  @override
  final String messageKey;

  @override
  final int? statusCode;

  @override
  final String? traceId;

  @override
  List<Object?> get props => [retryAfter, messageKey, statusCode, traceId];
}

final class ServiceUnavailableFailure extends AppFailure {
  ServiceUnavailableFailure({this.traceId, this.statusCode})
      : messageKey = 'error.service_unavailable';

  @override
  final String messageKey;

  @override
  final int? statusCode;

  @override
  final String? traceId;

  @override
  List<Object?> get props => [messageKey, statusCode, traceId];
}

final class OfflineFailure extends AppFailure {
  OfflineFailure({this.traceId, this.originalError})
      : messageKey = 'error.offline',
        statusCode = null;

  final Object? originalError;

  @override
  final String messageKey;

  @override
  final int? statusCode;

  @override
  final String? traceId;

  @override
  List<Object?> get props => [messageKey, statusCode, traceId, originalError];
}

final class ServerMessageFailure extends AppFailure {
  ServerMessageFailure({
    required this.messageKey,
    this.statusCode,
    this.traceId,
    this.serverText,
  });

  final String? serverText;

  @override
  final String messageKey;

  @override
  final int? statusCode;

  @override
  final String? traceId;

  @override
  Map<String, dynamic> get context => {
        if (serverText != null) 'server': serverText!,
      };

  @override
  List<Object?> get props => [messageKey, statusCode, traceId, serverText];
}

final class UnknownFailure extends AppFailure {
  UnknownFailure({
    this.originalError,
    this.stackTrace,
    this.traceId,
    this.statusCode,
  }) : messageKey = 'error.unknown';

  final Object? originalError;
  final StackTrace? stackTrace;

  @override
  final String messageKey;

  @override
  final int? statusCode;

  @override
  final String? traceId;

  @override
  Map<String, dynamic> get context => {
        if (originalError != null) 'type': originalError.runtimeType.toString(),
        if (originalError != null) 'msg': originalError.toString(),
      };

  @override
  List<Object?> get props => [messageKey, statusCode, traceId, originalError];
}
