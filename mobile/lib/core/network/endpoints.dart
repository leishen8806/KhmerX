import 'package:equatable/equatable.dart';

import '../session/company_id.dart';
import 'retry_policy.dart';

enum HttpMethod { get, post, put, patch, delete }

final class Endpoint extends Equatable {
  final String path;
  final HttpMethod method;
  final CompanyId? companyId;
  final bool requiresSession;
  final bool sensitiveBody;
  final int? bodyLimitBytes;
  final Duration? timeoutOverride;
  final RetryPolicy retry;

  const Endpoint({
    required this.path,
    required this.method,
    this.companyId,
    this.requiresSession = false,
    this.sensitiveBody = false,
    this.bodyLimitBytes,
    this.timeoutOverride,
    this.retry = const RetryPolicy.none(),
  });

  Endpoint withCompanyId(CompanyId c) {
    return Endpoint(
      path: path,
      method: method,
      companyId: c,
      requiresSession: requiresSession,
      sensitiveBody: sensitiveBody,
      bodyLimitBytes: bodyLimitBytes,
      timeoutOverride: timeoutOverride,
      retry: retry,
    );
  }

  @override
  List<Object?> get props => [
        path,
        method,
        companyId,
        requiresSession,
        sensitiveBody,
        bodyLimitBytes,
        timeoutOverride,
        retry,
      ];
}

final class Endpoints {
  Endpoints._();

  static const _boundedGet = RetryPolicy.boundedGet(maxAttempts: 2);
  static const _none = RetryPolicy.none();

  static const getH5Auth = Endpoint(
    path: '/api/h5/auth',
    method: HttpMethod.get,
    requiresSession: false,
    retry: _boundedGet,
  );

  static const postH5AuthSend = Endpoint(
    path: '/api/h5/auth/send',
    method: HttpMethod.post,
    requiresSession: false,
    sensitiveBody: true,
    bodyLimitBytes: 4096,
    retry: _none,
  );

  static const postH5AuthVerify = Endpoint(
    path: '/api/h5/auth/verify',
    method: HttpMethod.post,
    requiresSession: false,
    sensitiveBody: true,
    bodyLimitBytes: 4096,
    retry: _none,
  );

  static const postH5AuthAccountLogin = Endpoint(
    path: '/api/h5/auth/account',
    method: HttpMethod.post,
    requiresSession: false,
    sensitiveBody: true,
    bodyLimitBytes: 4096,
    retry: _none,
  );

  static const postH5AuthAccountSetPassword = Endpoint(
    path: '/api/h5/auth/account',
    method: HttpMethod.post,
    requiresSession: true,
    sensitiveBody: true,
    bodyLimitBytes: 4096,
    retry: _none,
  );

  static const postH5AuthRecovery = Endpoint(
    path: '/api/h5/auth/recovery',
    method: HttpMethod.post,
    requiresSession: false,
    sensitiveBody: true,
    bodyLimitBytes: 4096,
    retry: _none,
  );

  static const getH5State = Endpoint(
    path: '/api/h5/state',
    method: HttpMethod.get,
    requiresSession: true,
    retry: _boundedGet,
  );

  static const getKyc = Endpoint(
    path: '/api/kyc',
    method: HttpMethod.get,
    requiresSession: true,
    retry: _boundedGet,
  );

  /// Save draft / submit the KYC case (JSON <= 50000 bytes on the server).
  static const postKyc = Endpoint(
    path: '/api/kyc',
    method: HttpMethod.post,
    requiresSession: true,
    sensitiveBody: true,
    bodyLimitBytes: 50000,
    retry: _none,
  );

  /// Upload one KYC material: raw file bytes, slot in `x-kyc-slot`
  /// (<= 10 MB on the server; identical bytes are de-duplicated there, so a
  /// retry by the user is safe).
  static const postKycFile = Endpoint(
    path: '/api/kyc/files',
    method: HttpMethod.post,
    requiresSession: true,
    sensitiveBody: true,
    bodyLimitBytes: 10 * 1024 * 1024,
    timeoutOverride: Duration(seconds: 60),
    retry: _none,
  );

  static const postH5AuthLogout = Endpoint(
    path: '/api/h5/auth/logout',
    method: HttpMethod.post,
    requiresSession: true,
    timeoutOverride: Duration(seconds: 5),
    retry: _none,
  );

  static const postH5Locale = Endpoint(
    path: '/api/h5/locale',
    method: HttpMethod.post,
    requiresSession: true,
    retry: _none,
    sensitiveBody: true,
    bodyLimitBytes: 512,
  );
}
