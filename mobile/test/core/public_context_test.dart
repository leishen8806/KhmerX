import 'dart:io';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/app/config/app_config.dart';
import 'package:khmerx_app/core/error/error_mapper.dart';
import 'package:khmerx_app/core/error/failure.dart';
import 'package:khmerx_app/core/error/failure_text.dart';
import 'package:khmerx_app/core/network/api_client.dart';
import 'package:khmerx_app/core/network/endpoints.dart';
import 'package:khmerx_app/core/network/network_config.dart';
import 'package:khmerx_app/core/session/company_cookie_store.dart';
import 'package:khmerx_app/core/session/company_id.dart';
import 'package:khmerx_app/core/storage/secure_kv.dart';
import 'package:khmerx_app/l10n/app_localizations_en.dart';
import 'package:khmerx_app/l10n/app_localizations_km.dart';
import 'package:khmerx_app/l10n/app_localizations_zh.dart';

import '../support/fake_khmerx_server.dart';
import '../support/fake_secure_kv.dart';

NetworkConfig _net(Uri baseUrl) => NetworkConfig(
      baseUrl: baseUrl,
      connectTimeout: const Duration(milliseconds: 3000),
      sendTimeout: const Duration(milliseconds: 3000),
      receiveTimeout: const Duration(milliseconds: 3000),
      logoutTimeout: const Duration(milliseconds: 1500),
    );

void main() {
  group('P1 public context (docs 54): the client never sends a company', () {
    late FakeKhmerxServer server;
    late SecureKv kv;
    late CompanyCookieStore store;
    late AppConfig config;
    late Uri root;

    setUp(() async {
      server = await FakeKhmerxServer.bind();
      kv = FakeSecureKv();
      store = CompanyCookieStore();
      final base = Uri.parse(server.baseUrl);
      root = Uri(scheme: base.scheme, host: base.host, port: base.port, path: '/');
      config = AppConfig.production().copyWith(networkConfig: _net(base));
      server.register(
        'GET /api/h5/auth',
        (r) => HttpResponseData.ok({'authenticated': false}),
      );
      server.register(
        'GET /api/h5/state',
        (r) => HttpResponseData.fromJson(
          401,
          {'error': 'x', 'code': 'AUTH_REQUIRED', 'traceId': 'req_abc'},
        ),
      );
    });

    tearDown(() => server.close());

    Future<ApiClient> publicClient({void Function()? onSessionExpired}) async {
      final jar = await store.jarFor(
        CompanyId.publicWorkspace,
        kv,
        networkConfig: config.networkConfig,
      );
      return ApiClient.forCompany(
        CompanyId.publicWorkspace,
        config,
        jar,
        onSessionExpired: onSessionExpired,
      );
    }

    test('P1-N-PUB-01: no request carries a payease_company cookie', () async {
      final c = await publicClient();
      await c.request(Endpoints.getH5Auth);
      await c.request(Endpoints.getH5Auth);
      expect(server.requests, isNotEmpty);
      for (final r in server.requests) {
        expect(r.cookie ?? '', isNot(contains('payease_company')));
      }
    });

    test('P1-N-PUB-02: a stray payease_company cookie is removed, not sent', () async {
      final c = await publicClient();
      await c.cookieJar.inner.saveFromResponse(root, [
        Cookie('payease_company', 't_aaaaaaaa-1234-1234-1234-123456789012'),
        Cookie('payease_h5_session', 's1'),
      ]);
      await c.request(Endpoints.getH5Auth);
      final cookie = server.requests.last.cookie ?? '';
      expect(cookie, isNot(contains('payease_company')));
      expect(cookie, contains('payease_h5_session=s1'));
    });

    test('P1-N-PUB-03: a server-set payease_company is never persisted', () async {
      server.register(
        'GET /api/h5/auth',
        (r) => HttpResponseData.fromJson(
          200,
          {'authenticated': false},
          headers: {'set-cookie': 'payease_company=t_aaaaaaaa-1234-1234-1234-123456789012; Path=/'},
        ),
      );
      final c = await publicClient();
      await c.request(Endpoints.getH5Auth);
      await c.request(Endpoints.getH5Auth);
      expect(server.requests.last.cookie ?? '', isNot(contains('payease_company')));
    });

    test('P1-N-PUB-04: 401 AUTH_REQUIRED on a session endpoint = session expired + callback', () async {
      var expired = 0;
      final c = await publicClient(onSessionExpired: () => expired++);
      Object? caught;
      try {
        await c.request(Endpoints.getH5State);
      } on DioException catch (e) {
        caught = e.error;
      }
      expect(caught, isA<AuthFailure>());
      expect((caught as AuthFailure).messageKey, 'error.auth.session_expired');
      expect(caught.traceId, 'req_abc', reason: 'server traceId from the error envelope');
      expect(expired, 1);
    });

    test('P1-N-PUB-05: 401 on a login endpoint does not fire the session-expired callback', () async {
      server.register(
        'POST /api/h5/auth/account',
        (r) => HttpResponseData.fromJson(401, {'error': 'x', 'code': 'AUTH_REQUIRED'}),
      );
      var expired = 0;
      final c = await publicClient(onSessionExpired: () => expired++);
      try {
        await c.request(Endpoints.postH5AuthAccountLogin, data: {'action': 'password_login'});
      } on DioException {
        // expected
      }
      expect(expired, 0);
    });
  });

  group('P1 error handling: users never see internal keys', () {
    test('P1-W-ERR-01: every failure kind maps to a sentence in en / km / zh', () {
      final failures = <AppFailure>[
        AuthFailure.unauthenticated(),
        AuthFailure.sessionExpired(),
        AuthFailure.invalidCredentials(),
        AuthFailure.loginPageExpired(),
        OfflineFailure(),
        NetworkFailure.connectionTimeout(),
        ServiceUnavailableFailure(),
        ForbiddenFailure.server(),
        ForbiddenFailure.companyUnavailable(),
        ConflictFailure.dataChanged(),
        ValidationFailure.passwordInvalid(),
        RateLimitFailure(retryAfter: const Duration(seconds: 30)),
        UnknownFailure(),
      ];
      for (final l in [AppLocalizationsEn(), AppLocalizationsKm(), AppLocalizationsZh()]) {
        for (final f in failures) {
          final text = describeFailure(l, f);
          expect(text, isNotEmpty);
          // An internal key looks like `error.auth.session_expired`.
          expect(text, isNot(matches(RegExp(r'error\.[a-z_]+\.[a-z_]+'))),
              reason: f.messageKey);
        }
      }
    });

    test('P1-W-ERR-02: error envelope parsing — code null falls through, traceId from body/header', () {
      final e = DioException(
        requestOptions: RequestOptions(path: '/x'),
        response: Response(
          requestOptions: RequestOptions(path: '/x'),
          statusCode: 401,
          data: <String, Object?>{'code': null, 'error': 'AUTH_REQUIRED', 'traceId': 'req_body'},
          headers: Headers.fromMap({
            'x-request-id': ['req_header'],
          }),
        ),
        type: DioExceptionType.badResponse,
      );
      final f = ErrorMapper.fromDioException(e);
      expect(f, isA<AuthFailure>());
      expect(f.traceId, 'req_body');

      final e2 = DioException(
        requestOptions: RequestOptions(path: '/x'),
        response: Response(
          requestOptions: RequestOptions(path: '/x'),
          statusCode: 503,
          data: <String, Object?>{'code': 'SERVICE_UNAVAILABLE'},
          headers: Headers.fromMap({
            'x-request-id': ['req_header'],
          }),
        ),
        type: DioExceptionType.badResponse,
      );
      expect(ErrorMapper.fromDioException(e2).traceId, 'req_header');
    });

    test('P1-W-ERR-03: public id is valid locally but never a real company id', () {
      expect(CompanyId.publicWorkspace.isPublic, isTrue);
      expect(CompanyId.tryParse('public'), CompanyId.publicWorkspace);
      expect(() => CompanyId('public'), throwsFormatException,
          reason: 'only the sentinel constant may be public; the factory stays strict');
      expect(CompanyId('t_aaaaaaaa-1234-1234-1234-123456789012').isPublic, isFalse);
    });
  });
}
