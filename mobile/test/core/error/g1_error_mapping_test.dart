import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/core/error/error_mapper.dart';
import 'package:khmerx_app/core/error/failure.dart';

void main() {
  group('G1 ERR-01 — ErrorMapper G1 Contract (RA-1..11 matrix)', () {
    RequestOptions ro({String path = '/api/h5/auth'}) =>
        RequestOptions(path: path, method: 'GET');

    Response resp({
      int? statusCode,
      Object? data,
      Map<String, List<String>>? headers,
    }) {
      final h = Headers();
      headers?.forEach((k, vs) {
        for (final v in vs) {
          h.add(k, v);
        }
      });
      return Response(
        requestOptions: ro(),
        statusCode: statusCode,
        data: data,
        headers: h,
      );
    }

    DioException ex({
      int? statusCode,
      Object? data,
      Map<String, List<String>>? headers,
    }) =>
        DioException(
          requestOptions: ro(),
          type: DioExceptionType.badResponse,
          response: resp(statusCode: statusCode, data: data, headers: headers),
        );

    AppFailure mapped({
      int? statusCode,
      Object? data,
      Map<String, List<String>>? headers,
    }) =>
        ErrorMapper.fromDioException(
          ex(statusCode: statusCode, data: data, headers: headers),
        );

    test('RA-1: 401 code=session_expired => sessionExpired', () {
      final f = mapped(statusCode: 401, data: {'error_code': 'session_expired'});
      expect(f, isA<AuthFailure>());
      expect((f as AuthFailure).messageKey, equals('error.auth.session_expired'));
    });

    test('RA-2: 401 code=login_page_expired => loginPageExpired', () {
      final f = mapped(statusCode: 401, data: {'code': 'login_page_expired'});
      expect(f, isA<AuthFailure>());
      expect((f as AuthFailure).messageKey, equals('error.auth.login_page_expired'));
    });

    test('RA-3: 401 invalid_credentials', () {
      final f = mapped(statusCode: 401, data: {'code': 'invalid_credentials'});
      expect(f, isA<AuthFailure>());
      expect((f as AuthFailure).messageKey, equals('error.auth.invalid_credentials'));
    });

    test('RA-4: 403 registration_incomplete', () {
      final f = mapped(statusCode: 403, data: {'code': 'registration_incomplete'});
      expect(f, isA<ForbiddenFailure>());
      expect((f as ForbiddenFailure).messageKey,
          equals('error.forbidden.registration_incomplete'));
    });

    test('RA-5: 403 company_unavailable (not crossSite)', () {
      final f = mapped(statusCode: 403, data: {'code': 'company_unavailable'});
      expect(f, isA<ForbiddenFailure>());
      expect((f as ForbiddenFailure).messageKey,
          equals('error.forbidden.company_unavailable'));
    });

    test('RA-6: 400 wrong_code / code_expired / attempts_exhausted / otp_undeliverable', () {
      final f1 = mapped(statusCode: 400, data: {'code': 'wrong_code'});
      final f2 = mapped(statusCode: 400, data: {'code': 'code_expired'});
      final f3 = mapped(statusCode: 400, data: {'code': 'attempts_exhausted'});
      final f4 = mapped(statusCode: 400, data: {'code': 'otp_undeliverable'});
      expect(f1, isA<AuthFailure>());
      expect((f1 as AuthFailure).messageKey, equals('error.auth.wrong_code'));
      expect((f2 as AuthFailure).messageKey, equals('error.auth.code_expired'));
      expect((f3 as AuthFailure).messageKey, equals('error.auth.attempts_exhausted'));
      expect((f4 as AuthFailure).messageKey, equals('error.auth.otp_undeliverable'));
    });

    test('RA-7: 429 default 60 (no Retry-After, no body)', () {
      final f = mapped(statusCode: 429);
      expect(f, isA<RateLimitFailure>());
      expect((f as RateLimitFailure).retryAfter, equals(const Duration(seconds: 60)));
    });

    test('RA-8: 429 clamp 1..3600 raw (Retry-After header)', () {
      final fA = mapped(statusCode: 429, headers: {
        'Retry-After': ['150'],
      });
      final fB = mapped(statusCode: 429, headers: {
        'Retry-After': ['0'],
      });
      final fC = mapped(statusCode: 429, headers: {
        'Retry-After': ['99999'],
      });
      expect((fA as RateLimitFailure).retryAfter,
          equals(const Duration(seconds: 150)));
      expect((fB as RateLimitFailure).retryAfter,
          equals(const Duration(seconds: 60)));
      expect((fC as RateLimitFailure).retryAfter,
          equals(const Duration(seconds: 3600)));
    });

    test('RA-9: 429 negative/invalid => 60 clamp', () {
      final f = mapped(statusCode: 429, headers: {
        'Retry-After': ['not-a-number'],
      });
      expect((f as RateLimitFailure).retryAfter,
          equals(const Duration(seconds: 60)));
    });

    test('RA-10: 503 or socket => ServiceUnavailable / Offline', () {
      final f503 = mapped(statusCode: 503);
      expect(f503, isA<ServiceUnavailableFailure>());
      final offline = DioException(
        requestOptions: ro(),
        type: DioExceptionType.connectionError,
      );
      final fOff = ErrorMapper.fromDioException(offline);
      expect(fOff, isA<OfflineFailure>());
    });

    test('RA-11: 409 challenge_pending', () {
      final f = mapped(statusCode: 409, data: {'code': 'challenge_pending'});
      expect(f, isA<ConflictFailure>());
      expect((f as ConflictFailure).messageKey,
          equals('error.conflict.challenge_pending'));
    });

    test('G0 regression: 401/403 default no-code still maps', () {
      final f1 = mapped(statusCode: 401);
      final f2 = mapped(statusCode: 403);
      expect(f1, isA<AuthFailure>());
      expect(f2, isA<ForbiddenFailure>());
    });
  });
}
