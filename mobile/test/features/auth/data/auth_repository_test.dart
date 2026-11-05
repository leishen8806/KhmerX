import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/app/config/app_config.dart';
import 'package:khmerx_app/core/error/failure.dart';
import 'package:khmerx_app/core/network/api_client_factory.dart';
import 'package:khmerx_app/core/network/network_config.dart';
import 'package:khmerx_app/core/session/company_cookie_store.dart';
import 'package:khmerx_app/core/session/company_id.dart';
import 'package:khmerx_app/core/session/session_manager.dart';
import 'package:khmerx_app/core/util/either.dart';
import 'package:khmerx_app/features/auth/data/auth_repository.dart';
import 'package:khmerx_app/features/auth/domain/auth_gate_state.dart';

import '../../../support/fake_khmerx_server.dart';
import '../../../support/fake_secure_kv.dart';

NetworkConfig _net(Uri baseUrl) => NetworkConfig(
  baseUrl: baseUrl,
  connectTimeout: const Duration(milliseconds: 2500),
  sendTimeout: const Duration(milliseconds: 2500),
  receiveTimeout: const Duration(milliseconds: 2500),
  logoutTimeout: const Duration(milliseconds: 1500),
);

void main() {
  group('G1 AUTH repository (FakeKhmerxServer driven)', () {
    late CompanyId idA;
    late FakeKhmerxServer server;
    late FakeSecureKv kv;
    late CompanyCookieStore store;
    late SessionManager sm;
    late ApiClientFactory factory;
    late AuthRepository repo;

    setUp(() async {
      idA = CompanyId('t_aaaaaaaa-1234-1234-1234-123456789012');
      server = await FakeKhmerxServer.bind();
      kv = FakeSecureKv();
      store = CompanyCookieStore();
      sm = SessionManager();
      final baseUrl = Uri.parse(server.baseUrl);
      final cfg = AppConfig.production().copyWith(networkConfig: _net(baseUrl));
      factory = ApiClientFactory(config: cfg, store: store, secureKv: kv);
      repo = AuthRepository(factory: factory, sessionManager: sm);
    });

    tearDown(() => server.close());

    Either<L, R> pick<L, R>(Either<L, R> e) => e;

    test('AUTH-01 preflight 200 -> Right Unauthenticated', () async {
      server.register('GET /api/h5/auth', (_) => HttpResponseData.ok({}));
      final r = await repo.preflight(idA);
      expect(r.isRight, isTrue);
      expect(r, isA<Right<AppFailure, AuthGateState>>());
      final v = pick(r);
      v.when(
        left: (_) => fail('expected Right'),
        right: (state) => expect(state, isA<AuthGateUnauthenticated>()),
      );
    });

    test(
      'AUTH-02 preflight 401 session_expired -> Right Unauthenticated',
      () async {
        server.register(
          'GET /api/h5/auth',
          (_) => HttpResponseData.fromJson(401, {
            'code': 'session_expired',
            'message': 'Session expired',
            'trace_id': 'tr-sess',
          }),
        );
        final r = await repo.preflight(idA);
        final v = pick(r);
        v.when(
          left: (_) => fail('expected Right (401 maps to unauth)'),
          right: (state) => expect(state, isA<AuthGateUnauthenticated>()),
        );
      },
    );

    test(
      'AUTH-03 preflight 403 registration_incomplete -> Right Incomplete',
      () async {
        server.register(
          'GET /api/h5/auth',
          (_) => HttpResponseData.fromJson(403, {
            'code': 'registration_incomplete',
            'message': 'Setup missing',
          }),
        );
        final r = await repo.preflight(idA);
        final v = pick(r);
        v.when(
          left: (_) => fail('expected Right'),
          right:
              (state) => expect(state, isA<AuthGateRegistrationIncomplete>()),
        );
      },
    );

    test('AUTH-04 otpSend 409 data_changed -> Left ConflictFailure', () async {
      server.register(
        'POST /api/h5/auth/send',
        (_) => HttpResponseData.fromJson(409, {
          'code': 'data_changed',
          'message': 'Race',
        }),
      );
      final r = await repo.otpSend(
        idA,
        identity: '+85512345678',
        channel: 'sms',
      );
      final v = pick(r);
      v.when(
        left: (f) => expect(f, isA<ConflictFailure>()),
        right: (_) => fail('expected Left ConflictFailure'),
      );
    });

    test(
      'AUTH-05 otpVerify 422 invalid_otp -> Left ValidationFailure',
      () async {
        server.register(
          'POST /api/h5/auth/verify',
          (_) => HttpResponseData.fromJson(422, {
            'code': 'invalid_otp',
            'message': 'Wrong OTP',
            'trace_id': 'tr-otp',
          }),
        );
        final r = await repo.otpVerify(
          idA,
          code: '000000',
          challengeId: 'chal-test-05',
        );
        final v = pick(r);
        v.when(
          left: (f) => expect(f, isA<ValidationFailure>()),
          right: (_) => fail('expected Left ValidationFailure'),
        );
      },
    );

    test('AUTH-06 passwordLogin 200 -> markSessionPresent + Right', () async {
      server.register(
        'POST /api/h5/auth/account',
        (_) => HttpResponseData.ok({
          'authenticated': true,
          'session': {
            'customerId': 'acc_1',
            'phoneMasked': '+855 •••• 1234',
            'mode': 'telegram',
            'expiresAt': 1700086400000,
            'phoneVerified': true,
            'verificationCompleted': true,
            'hasPassword': true,
          },
          'policy': {'passwordSetup': false, 'phoneVerification': true},
        }),
      );
      final r = await repo.passwordLogin(idA, account: 'u', password: 'p');
      expect(r.isRight, isTrue);
      expect(sm.hasSession(idA.raw), isTrue);
    });

    test(
      'AUTH-07 passwordLogin 401 invalid_credentials -> Left AuthFailure',
      () async {
        server.register(
          'POST /api/h5/auth/account',
          (_) => HttpResponseData.fromJson(401, {
            'code': 'invalid_credentials',
            'message': 'Bad password',
          }),
        );
        final r = await repo.passwordLogin(
          idA,
          account: 'u',
          password: 'wrong',
        );
        final v = pick(r);
        v.when(
          left: (f) => expect(f, isA<AuthFailure>()),
          right: (_) => fail('expected Left AuthFailure'),
        );
      },
    );

    test('AUTH-08 setPassword 200 -> markSessionPresent + Right', () async {
      server.register(
        'POST /api/h5/auth/account',
        (_) => HttpResponseData.ok({}),
      );
      final r = await repo.setPassword(idA, password: 'FreshPass1!');
      expect(r.isRight, isTrue);
      expect(sm.hasSession(idA.raw), isTrue);
    });

    test(
      'AUTH-09 recoverySend 429 + Retry-After 9999 clamped to 3600 (ERR RA-7)',
      () async {
        server.register(
          'POST /api/h5/auth/recovery',
          (req) {
            final b = req.bodyAsJson;
            expect(b['action'], 'send');
            expect(b['phone'], '+855');
            expect(b['consent'], true);
            return HttpResponseData(
              statusCode: 429,
              headers: const {
                'Retry-After': '9999',
                'Content-Type': 'application/json; charset=utf-8',
              },
              body:
                  HttpResponseData.fromJson(429, {
                    'code': 'rate_limited',
                    'message': 'Slow down',
                    'retry_after': 9999,
                  }).body,
            );
          },
        );
        final r = await repo.recoverySend(
          idA,
          identity: '+855',
          consent: true,
        );
        final v = pick(r);
        v.when(
          left: (f) {
            expect(f, isA<RateLimitFailure>());
            final RateLimitFailure rlf = f as RateLimitFailure;
            expect(rlf.retryAfter, isNotNull);
            final secs = rlf.retryAfter!.inSeconds;
            expect(secs, lessThanOrEqualTo(3600));
            expect(secs, greaterThanOrEqualTo(1));
          },
          right: (_) => fail('expected Left RateLimitFailure'),
        );
      },
    );

    test(
      'AUTH-10 logout: network-failure preserves session and returns failure',
      () async {
        sm.markSessionPresent(idA.raw);
        server.register(
          'POST /api/h5/auth/logout',
          (_) => HttpResponseData.fromJson(502, {'code': 'bad_gateway'}),
        );
        final r = await repo.logout(idA);
        expect(r.isLeft, isTrue);
        expect(sm.hasSession(idA.raw), isTrue);
      },
    );

    test(
      'AUTH-11 otpSend body includes identity+channel; sensitiveBody <= 4096 bytes clamped',
      () async {
        server.register('POST /api/h5/auth/send', (req) {
          final b = req.bodyAsJson;
          expect(b['phone'], '+85512345678');
          expect(b['consent'], false);
          expect(b['mode'], isNull, 'the server, not the client, selects the auth channel');
          expect(req.bodyBytes.length, lessThanOrEqualTo(4096));
          return HttpResponseData.ok({});
        });
        final r = await repo.otpSend(
          idA,
          identity: '+85512345678',
          channel: 'sms',
        );
        expect(r.isRight, isTrue);
      },
    );

    test(
      'AUTH-12 403 cross_site generic on otpVerify -> Left ForbiddenFailure',
      () async {
        server.register(
          'POST /api/h5/auth/verify',
          (_) => HttpResponseData.fromJson(403, {
            'code': 'cross_site',
            'message': 'CSRF',
          }),
        );
        final r = await repo.otpVerify(
          idA,
          code: '1',
          challengeId: 'chal-test-12',
        );
        final v = pick(r);
        v.when(
          left: (f) => expect(f, isA<ForbiddenFailure>()),
          right: (_) => fail('expected Left ForbiddenFailure'),
        );
      },
    );

    test(
      'AUTH-13 otpSend preserves challengeId and otpVerify sends it (not phone)',
      () async {
        final expectedChallenge = 'a' * 64;
        late final Map<String, dynamic> verifyBody;
        server.register(
          'POST /api/h5/auth/send',
          (_) => HttpResponseData.ok({
            'challengeId': expectedChallenge,
            'phoneMasked': '+855 •••• 1234',
            'expiresAt': 1700000000000,
            'retryAt': 1700000060000,
            'mode': 'telegram',
          }),
        );
        server.register('POST /api/h5/auth/verify', (req) {
          verifyBody = req.bodyAsJson;
          return HttpResponseData.ok({
            'authenticated': true,
            'session': {
              'customerId': 'cust-1',
              'phoneMasked': '+855 •••• 1234',
              'mode': 'telegram',
              'expiresAt': 1700086400000,
              'phoneVerified': true,
              'verificationCompleted': true,
              'hasPassword': false,
            },
            'policy': {'passwordSetup': true, 'phoneVerification': true},
          });
        });
        final sendRes = await repo.otpSend(
          idA,
          identity: '+85512341234',
        );
        expect(sendRes.isRight, isTrue);
        OtpSendResponse? sent;
        pick(sendRes).when(left: (_) {}, right: (r) => sent = r);
        expect(sent, isNotNull);
        expect(sent!.challengeId, expectedChallenge);
        final lastStored = repo.lastOtpFor(idA);
        expect(lastStored?.challengeId, expectedChallenge);
        final verifyRes = await repo.otpVerify(
          idA,
          code: '123456',
          challengeId: sent!.challengeId,
        );
        expect(verifyRes.isRight, isTrue);
        expect(verifyBody['challengeId'], expectedChallenge);
        expect(verifyBody['code'], '123456');
        expect(verifyBody['phone'], isNull);
      },
    );

    test(
      'AUTH-14 recoveryReset uses challengeId and clears session on success',
      () async {
        final challenge = 'reset-chal-${'0' * 52}';
        late final Map<String, dynamic> resetBody;
        sm.markSessionPresent(idA.raw);
        server.register('POST /api/h5/auth/recovery', (req) {
          resetBody = req.bodyAsJson;
          if (resetBody['action'] == 'reset') {
            return HttpResponseData.ok({'ok': true});
          }
          return HttpResponseData.fromJson(400, {'message': 'bad action'});
        });
        final r = await repo.recoveryReset(
          idA,
          challengeId: challenge,
          code: '000000',
          password: 'FreshPass1!' * 2,
          confirmPassword: 'FreshPass1!' * 2,
        );
        expect(r.isRight, isTrue);
        expect(resetBody['action'], 'reset');
        expect(resetBody['challengeId'], challenge);
        expect(sm.hasSession(idA.raw), isFalse);
      },
    );
  });
}
