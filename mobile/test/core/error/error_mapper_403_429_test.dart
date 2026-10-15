import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/core/error/error_mapper.dart';
import 'package:khmerx_app/core/error/failure.dart';
import 'package:khmerx_app/core/session/company_id.dart';

CompanyId cid() => CompanyId('t_00000000-0000-0000-0000-000000000001');

void main() {
  group('§13 ForbiddenFailure (403): unknown code → generic server; NEVER defaults to crossSite',
      () {
    DioException dio403({String? errorCode, String? errorMessage}) {
      final body = <String, Object?>{};
      if (errorCode != null) body['error_code'] = errorCode;
      if (errorMessage != null) body['message'] = errorMessage;
      return DioException(
        requestOptions: RequestOptions(path: '/x'),
        response: Response(
          requestOptions: RequestOptions(path: '/x'),
          statusCode: 403,
          data: body,
        ),
      );
    }

    test('EM-01 403 unknown code (random xyz) → ForbiddenFailure.server generic', () {
      final f = ErrorMapper.fromDioException(dio403(errorCode: 'xyz_something_weird'));
      expect(f, isA<ForbiddenFailure>());
      expect(f.messageKey, 'error.forbidden.server');
      expect((f as ForbiddenFailure).statusCode, 403);
    });

    test('EM-02 403 no code at all (null) → ForbiddenFailure.server fallback', () {
      final f = ErrorMapper.fromDioException(dio403());
      expect(f, isA<ForbiddenFailure>());
      expect(f.messageKey, 'error.forbidden.server');
    });

    test('EM-03 403 code="cross_site" only → ForbiddenFailure.crossSite (exact match only)', () {
      final f = ErrorMapper.fromDioException(dio403(errorCode: 'cross_site'));
      expect(f, isA<ForbiddenFailure>());
      expect(f.messageKey, 'error.forbidden.cross_site');
    });

    test('EM-04 403 code="cross-sites" typo → generic (NOT crossSite, NOT partial match)', () {
      final f = ErrorMapper.fromDioException(dio403(errorCode: 'cross-sites'));
      expect(f.messageKey, 'error.forbidden.server');
    });

    test('EM-05 403 code="company_unavailable" → ForbiddenFailure.companyUnavailable', () {
      final f = ErrorMapper.fromDioException(dio403(errorCode: 'company_unavailable'));
      expect(f.messageKey, 'error.forbidden.company_unavailable');
    });

    test('EM-06 403 code="invalid_company" → ForbiddenFailure.invalidCompany', () {
      final f = ErrorMapper.fromDioException(dio403(errorCode: 'invalid_company'));
      expect(f.messageKey, 'error.forbidden.invalid_company');
    });

    test('EM-07 403 code="registration_incomplete" → ForbiddenFailure.registrationIncomplete',
        () {
      final f = ErrorMapper.fromDioException(dio403(errorCode: 'registration_incomplete'));
      expect(f.messageKey, 'error.forbidden.registration_incomplete');
    });
  });

  group('§15 retryAfter: 3-tier precedence (body>header>60) + crunch 1..59≠60 + clamp≤3600',
      () {
    DioException dio429({
      int? bodyRetryAfter,
      String? headerRetryAfter,
      Map<String, Object?>? extraBody,
    }) {
      final body = <String, Object?>{};
      if (bodyRetryAfter != null) body['retryAfter'] = bodyRetryAfter;
      if (extraBody != null) body.addAll(extraBody);
      final headers = Headers();
      if (headerRetryAfter != null) headers.set('Retry-After', headerRetryAfter);
      return DioException(
        requestOptions: RequestOptions(path: '/x'),
        response: Response(
          requestOptions: RequestOptions(path: '/x'),
          statusCode: 429,
          data: body,
          headers: headers,
        ),
      );
    }

    int retrySeconds(DioException e) =>
        (ErrorMapper.fromDioException(e) as RateLimitFailure).retryAfter!.inSeconds;

    test('EM-08 §17 case 1: body=null + header=null → 60 default', () {
      expect(retrySeconds(dio429()), 60);
    });

    test('EM-09 §17 case 2: body=0 → 60', () {
      expect(retrySeconds(dio429(bodyRetryAfter: 0)), 60);
    });

    test('EM-10 §17 case 3: body=-1 → 60', () {
      expect(retrySeconds(dio429(bodyRetryAfter: -1)), 60);
    });

    test('EM-11 §17 case 4: header parse = -100 → 60', () {
      expect(retrySeconds(dio429(headerRetryAfter: '-100')), 60);
    });

    test('EM-12 §17 case 5 CRITICAL: body=1 → 1 (no promotion to 60)', () {
      expect(retrySeconds(dio429(bodyRetryAfter: 1)), 1);
    });

    test('EM-13 §17 case 6: body=5 → 5', () {
      expect(retrySeconds(dio429(bodyRetryAfter: 5)), 5);
    });

    test('EM-14 §17 case 7: header="30" → 30', () {
      expect(retrySeconds(dio429(headerRetryAfter: '30')), 30);
    });

    test('EM-15 §17 case 8 CRITICAL: header="59" → 59 (never promotion to 60!)', () {
      expect(retrySeconds(dio429(headerRetryAfter: '59')), 59);
    });

    test('EM-16 §17 case 9: body=60 → 60', () {
      expect(retrySeconds(dio429(bodyRetryAfter: 60)), 60);
    });

    test('EM-17 §17 case 10: body=120 → 120', () {
      expect(retrySeconds(dio429(bodyRetryAfter: 120)), 120);
    });

    test('EM-18 §17 case 11: header="3600" → 3600 boundary pass', () {
      expect(retrySeconds(dio429(headerRetryAfter: '3600')), 3600);
    });

    test('EM-19 §17 case 12: body=3601 → clamp to 3600', () {
      expect(retrySeconds(dio429(bodyRetryAfter: 3601)), 3600);
    });

    test('EM-20 §17 case 13: header="10000" → clamp 3600', () {
      expect(retrySeconds(dio429(headerRetryAfter: '10000')), 3600);
    });

    test('EM-21 §17 case 14: PRECEDENCE body=30 header=120 → 30 (body wins!)', () {
      expect(retrySeconds(dio429(bodyRetryAfter: 30, headerRetryAfter: '120')), 30);
    });

    test('EM-22 §17 case 15: body=null header="5" → 5', () {
      expect(retrySeconds(dio429(headerRetryAfter: '5')), 5);
    });

    test('EM-23 §17 case 16: body=0 AND header=-1 → both invalid → 60', () {
      expect(retrySeconds(dio429(bodyRetryAfter: 0, headerRetryAfter: '-1')), 60);
    });

    test('EM-24 §17 case 17: body=null header="3601" → clamp to 3600', () {
      expect(retrySeconds(dio429(headerRetryAfter: '3601')), 3600);
    });
  });

  group('§12 ErrorMapper centralize: DioException subtypes mapped to exact Failures', () {
    test('EM-25 DioExceptionType.connectionTimeout → NetworkFailure.connectionTimeout', () {
      final f = ErrorMapper.fromDioException(
        DioException(
          requestOptions: RequestOptions(path: '/x'),
          type: DioExceptionType.connectionTimeout,
        ),
      );
      expect(f, isA<NetworkFailure>());
      expect(f.messageKey, 'error.network.connection_timeout');
    });

    test('EM-26 DioExceptionType.sendTimeout → NetworkFailure.sendTimeout', () {
      final f = ErrorMapper.fromDioException(
        DioException(
          requestOptions: RequestOptions(path: '/x'),
          type: DioExceptionType.sendTimeout,
        ),
      );
      expect(f.messageKey, 'error.network.send_timeout');
    });

    test('EM-27 DioExceptionType.receiveTimeout → NetworkFailure.receiveTimeout', () {
      final f = ErrorMapper.fromDioException(
        DioException(
          requestOptions: RequestOptions(path: '/x'),
          type: DioExceptionType.receiveTimeout,
        ),
      );
      expect(f.messageKey, 'error.network.receive_timeout');
    });

    test('EM-28 status=503 (no body) → ServiceUnavailableFailure', () {
      final f = ErrorMapper.fromDioException(
        DioException(
          requestOptions: RequestOptions(path: '/x'),
          response: Response(
            requestOptions: RequestOptions(path: '/x'),
            statusCode: 503,
          ),
        ),
      );
      expect(f, isA<ServiceUnavailableFailure>());
    });

    test('EM-29 status=401 no code → AuthFailure.unauthenticated (fallback)', () {
      final f = ErrorMapper.fromDioException(
        DioException(
          requestOptions: RequestOptions(path: '/x'),
          response: Response(
            requestOptions: RequestOptions(path: '/x'),
            statusCode: 401,
          ),
        ),
      );
      expect(f, isA<AuthFailure>());
      expect(f.messageKey, 'error.auth.unauthenticated');
    });

    test('EM-30 status=401 code=session_expired → AuthFailure.sessionExpired (catalog match)', () {
      final f = ErrorMapper.fromDioException(
        DioException(
          requestOptions: RequestOptions(path: '/x'),
          response: Response(
            requestOptions: RequestOptions(path: '/x'),
            statusCode: 401,
            data: {'error_code': 'session_expired'},
          ),
        ),
      );
      expect(f.messageKey, 'error.auth.session_expired');
    });

    test('EM-31 AppFailure passthrough: TenantContextFailure in DioException.error → returned untouched',
        () {
      final original = TenantContextFailure(
        clientCompanyId: cid(),
        reason: 'test',
      );
      final f = ErrorMapper.fromDioException(
        DioException(
          requestOptions: RequestOptions(path: '/x'),
          error: original,
        ),
      );
      expect(identical(f, original), isTrue);
    });
  });
}
