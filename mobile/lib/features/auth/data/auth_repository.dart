import 'package:dio/dio.dart';

import '../../../core/error/error_mapper.dart';
import '../../../core/error/failure.dart';
import '../../../core/network/api_client_factory.dart';
import '../../../core/network/endpoints.dart';
import '../../../core/session/company_id.dart';
import '../../../core/session/session_manager.dart';
import '../../../core/util/either.dart';
import '../domain/auth_gate_state.dart';

final class AuthRepository {
  AuthRepository({required this.factory, required this.sessionManager});

  final ApiClientFactory factory;
  final SessionManager sessionManager;
  final Map<String, AuthPreflightSnapshot> _preflight = {};
  final Map<String, OtpSendResponse> _lastOtpSend = {};
  final Map<String, String> _lastCanonicalPhone = {};

  AuthPreflightSnapshot? snapshotFor(CompanyId id) => _preflight[id.raw];

  OtpSendResponse? lastOtpFor(CompanyId id) => _lastOtpSend[id.raw];

  String? lastCanonicalPhoneFor(CompanyId id) => _lastCanonicalPhone[id.raw];

  void setLastCanonicalPhone(CompanyId id, String phone) {
    _lastCanonicalPhone[id.raw] = phone;
  }

  void invalidateFor(CompanyId id) {
    _preflight.remove(id.raw);
    _lastOtpSend.remove(id.raw);
    _lastCanonicalPhone.remove(id.raw);
  }

  void seedPreflightForTesting(CompanyId id, AuthPreflightSnapshot snapshot) {
    _preflight[id.raw] = snapshot;
  }

  Future<Either<AppFailure, AuthGateState>> preflight(CompanyId id) async {
    final client = await factory.get(id);
    try {
      final resp = await client.request<Object?>(Endpoints.getH5Auth);
      if (resp.statusCode == 200 || resp.statusCode == 204) {
        final body =
            resp.data is Map
                ? Map<String, dynamic>.from(resp.data! as Map)
                : <String, dynamic>{};
        final session =
            body['session'] is Map
                ? Map<String, dynamic>.from(body['session'] as Map)
                : null;
        final snapshot = AuthPreflightSnapshot(
          company: body['company'] as String?,
          authenticated: body['authenticated'] == true,
          session: session,
          pending:
              body['pending'] is Map
                  ? Map<String, dynamic>.from(body['pending'] as Map)
                  : null,
          policy:
              body['policy'] is Map
                  ? Map<String, dynamic>.from(body['policy'] as Map)
                  : const {},
          languages:
              body['languages'] is Map
                  ? (body['languages'] as Map).map(
                    (k, v) => MapEntry(k.toString(), v == true),
                  )
                  : const {},
        );
        _preflight[id.raw] = snapshot;
        if (snapshot.authenticated) {
          sessionManager.markSessionPresent(id.raw);
          final account = session?['customerId']?.toString() ?? '';
          if (snapshot.needsPassword) {
            return const Right(AuthGateRegistrationIncomplete());
          }
          return Right(AuthGateAuthenticated(accountId: account));
        }
        return const Right(AuthGateUnauthenticated());
      }
      return Right(
        sessionManager.hasSession(id.raw)
            ? const AuthGateAuthenticated(accountId: '')
            : const AuthGateUnauthenticated(),
      );
    } on Object catch (e, st) {
      final mapped = _map(e, st);
      if (mapped is AuthFailure &&
          mapped.messageKey == 'error.auth.session_expired') {
        return const Right(AuthGateUnauthenticated());
      }
      if (mapped is ForbiddenFailure &&
          mapped.messageKey == 'error.forbidden.registration_incomplete') {
        return const Right(AuthGateRegistrationIncomplete());
      }
      return Left(mapped);
    }
  }

  Map<String, dynamic>? _asMap(Object? data) =>
      data is Map ? Map<String, dynamic>.from(data) : null;

  DateTime? _ms(dynamic value) {
    if (value is int) return DateTime.fromMillisecondsSinceEpoch(value);
    if (value is num) {
      return DateTime.fromMillisecondsSinceEpoch(value.toInt());
    }
    return null;
  }

  Future<Either<AppFailure, OtpSendResponse>> otpSend(
    CompanyId id, {
    required String identity,
    String? channel,
    bool consent = false,
  }) async {
    final client = await factory.get(id);
    try {
      final resp = await client.request<Object?>(
        Endpoints.postH5AuthSend,
        data: {'phone': identity, 'consent': consent},
      );
      final body = _asMap(resp.data) ?? {};
      final challengeId = body['challengeId']?.toString() ?? '';
      final phoneMasked = body['phoneMasked']?.toString() ?? identity;
      final expiresAt =
          _ms(body['expiresAt']) ??
          DateTime.now().add(const Duration(minutes: 5));
      final retryAt =
          _ms(body['retryAt']) ??
          DateTime.now().add(const Duration(seconds: 60));
      final out = OtpSendResponse(
        challengeId: challengeId,
        phoneMasked: phoneMasked,
        expiresAt: expiresAt,
        retryAt: retryAt,
        mode: body['mode']?.toString() ?? 'telegram',
        message: body['message']?.toString(),
      );
      _lastOtpSend[id.raw] = out;
      return Right(out);
    } on Object catch (e, st) {
      return Left(_map(e, st));
    }
  }

  Future<Either<AppFailure, OtpVerifyResponse>> otpVerify(
    CompanyId id, {
    required String code,
    required String challengeId,
    String? identity,
    String? channel,
  }) async {
    final client = await factory.get(id);
    try {
      final resp = await client.request<Object?>(
        Endpoints.postH5AuthVerify,
        data: {'challengeId': challengeId, 'code': code},
      );
      final body = _asMap(resp.data) ?? {};
      final authenticated = body['authenticated'] == true;
      final session = _asMap(body['session']);
      final policy = _asMap(body['policy']);
      if (authenticated) {
        sessionManager.markSessionPresent(id.raw);
        if (session != null) {
          _preflight[id.raw] = AuthPreflightSnapshot(
            company: _preflight[id.raw]?.company,
            authenticated: true,
            session: session,
            pending: null,
            policy: policy ?? _preflight[id.raw]?.policy ?? const {},
            languages: _preflight[id.raw]?.languages ?? const {},
          );
        }
      }
      return Right(
        OtpVerifyResponse(
          authenticated: authenticated,
          session: session,
          policy: policy,
        ),
      );
    } on Object catch (e, st) {
      return Left(_map(e, st));
    }
  }

  Future<Either<AppFailure, void>> passwordLogin(
    CompanyId id, {
    required String account,
    required String password,
  }) async {
    final client = await factory.get(id);
    try {
      final resp = await client.request<Object?>(
        Endpoints.postH5AuthAccountLogin,
        data: {
          'action': 'password_login',
          'phone': account,
          'password': password,
        },
      );
      if (resp.statusCode == 200 || resp.statusCode == 204) {
        final body = _asMap(resp.data);
        if (body != null) {
          final authenticated = body['authenticated'] == true;
          final session = _asMap(body['session']);
          final policy = _asMap(body['policy']);
          if (authenticated || session != null) {
            sessionManager.markSessionPresent(id.raw);
            _preflight[id.raw] = AuthPreflightSnapshot(
              company: _preflight[id.raw]?.company,
              authenticated: authenticated || session != null,
              session: session ?? _preflight[id.raw]?.session,
              pending: null,
              policy: policy ?? _preflight[id.raw]?.policy ?? const {},
              languages: _preflight[id.raw]?.languages ?? const {},
            );
          }
        } else {
          sessionManager.markSessionPresent(id.raw);
        }
      }
      return const Right(null);
    } on Object catch (e, st) {
      final mapped = _map(e, st);
      if (mapped is ForbiddenFailure &&
          mapped.messageKey == 'error.forbidden.registration_incomplete') {
        return const Right(null);
      }
      return Left(mapped);
    }
  }

  Future<Either<AppFailure, void>> setPassword(
    CompanyId id, {
    required String password,
    String? currentPassword,
  }) async {
    final client = await factory.get(id);
    try {
      await client.request<void>(
        Endpoints.postH5AuthAccountSetPassword,
        data: {
          'action': 'set_password',
          'password': password,
          if (currentPassword != null) 'currentPassword': currentPassword,
        },
      );
      sessionManager.markSessionPresent(id.raw);
      return const Right(null);
    } on Object catch (e, st) {
      return Left(_map(e, st));
    }
  }

  Future<Either<AppFailure, OtpSendResponse>> recoverySend(
    CompanyId id, {
    required String identity,
    bool consent = false,
  }) async {
    final client = await factory.get(id);
    try {
      final resp = await client.request<Object?>(
        Endpoints.postH5AuthRecovery,
        data: {
          'action': 'send',
          'phone': identity,
          'consent': consent,
        },
      );
      final body = _asMap(resp.data) ?? {};
      final challengeId = body['challengeId']?.toString() ?? '';
      final phoneMasked = body['phoneMasked']?.toString() ?? identity;
      final expiresAt =
          _ms(body['expiresAt']) ??
          DateTime.now().add(const Duration(minutes: 5));
      final retryAt =
          _ms(body['retryAt']) ??
          DateTime.now().add(const Duration(seconds: 60));
      final out = OtpSendResponse(
        challengeId: challengeId,
        phoneMasked: phoneMasked,
        expiresAt: expiresAt,
        retryAt: retryAt,
        mode: body['mode']?.toString() ?? 'telegram',
        message: body['message']?.toString(),
      );
      _lastOtpSend[id.raw] = out;
      return Right(out);
    } on Object catch (e, st) {
      return Left(_map(e, st));
    }
  }

  Future<Either<AppFailure, void>> recoveryReset(
    CompanyId id, {
    required String challengeId,
    required String code,
    required String password,
    required String confirmPassword,
  }) async {
    final client = await factory.get(id);
    try {
      await client.request<void>(
        Endpoints.postH5AuthRecovery,
        data: {
          'action': 'reset',
          'challengeId': challengeId,
          'code': code,
          'password': password,
          'confirmPassword': confirmPassword,
        },
      );
      await client.cookieJar.clearSession();
      sessionManager.clearSessionOnly(id.raw);
      return const Right(null);
    } on Object catch (e, st) {
      return Left(_map(e, st));
    }
  }

  Future<Either<AppFailure, void>> logout(CompanyId id) async {
    final client = await factory.get(id);
    try {
      await client.request<void>(Endpoints.postH5AuthLogout, data: const {});
      await client.cookieJar.clearSession();
      sessionManager.clearSessionOnly(id.raw);
      return const Right(null);
    } on Object catch (e, st) {
      return Left(_map(e, st));
    }
  }

  AppFailure _map(Object e, StackTrace st) {
    if (e is AppFailure) return e;
    if (e is DioException) return ErrorMapper.fromDioException(e);
    return UnknownFailure(originalError: e, stackTrace: st);
  }
}
