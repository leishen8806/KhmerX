import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/core/error/error_mapper.dart';
import 'package:khmerx_app/core/error/failure.dart';
import 'package:khmerx_app/core/error/failure_text.dart';
import 'package:khmerx_app/l10n/app_localizations.dart';

DioException rejected(
  int status,
  Map<String, Object?> body, {
  Map<String, List<String>> headers = const {},
  bool encoded = false,
}) {
  final options = RequestOptions(
    path: '/synthetic',
    headers: {'X-Trace-Id': 'local-only'},
  );
  return DioException(
    requestOptions: options,
    type: DioExceptionType.badResponse,
    response: Response<Object?>(
      requestOptions: options,
      statusCode: status,
      headers: Headers.fromMap(headers),
      data: encoded ? jsonEncode(body) : body,
    ),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final locale in ['en', 'km', 'zh']) {
    test('ARC-00 codes and server-only reference in $locale', () async {
      final l = await AppLocalizations.delegate.load(Locale(locale));
      for (final item in [
        (500, 'INTERNAL_ERROR', 'error.internal_error'),
        (400, 'VALIDATION_FAILED', 'error.validation_failed'),
        (409, 'ACCOUNT_ALREADY_REGISTERED', 'error.account_registered'),
        (413, 'PAYLOAD_TOO_LARGE', 'error.payload_too_large'),
        (503, 'SERVICE_UNAVAILABLE', 'error.service_unavailable'),
        (409, 'CONFLICT', 'error.conflict.data_changed'),
      ]) {
        final failure = ErrorMapper.fromDioException(
          rejected(item.$1, {
            'code': item.$2,
            'error': '\u79c1\u5bc6\u670d\u52a1\u5668\u539f\u6587',
            'requestId': 'server-reference',
          }, encoded: true),
        );
        expect(failure.messageKey, item.$3);
        final message = describeFailure(l, failure);
        expect(
          message,
          isNot(contains('\u79c1\u5bc6\u670d\u52a1\u5668\u539f\u6587')),
        );
        if ([500, 503].contains(item.$1)) {
          expect(message, contains('server-reference'));
        }
      }
      for (final status in [500, 503]) {
        final code = status == 500 ? 'INTERNAL_ERROR' : 'SERVICE_UNAVAILABLE';
        final absent = ErrorMapper.fromDioException(
          rejected(status, {'code': code}),
        );
        expect(absent.requestId, isNull);
        expect(describeFailure(l, absent), isNot(contains('local-only')));
        final header = ErrorMapper.fromDioException(
          rejected(
            status,
            {'code': code},
            headers: {
              'X-Request-Id': ['header-reference'],
            },
          ),
        );
        expect(describeFailure(l, header), contains('header-reference'));
      }
      final unknown = ErrorMapper.fromDioException(
        rejected(500, {'code': 'SYNTHETIC_UNKNOWN'}),
      );
      expect(describeFailure(l, unknown), l.errGeneric);
    });
  }
  test(
    'ARC-00 retry priority, boundary clamp and malformed selected value',
    () {
      for (final status in [429, 503]) {
        for (final sample in [
          (null, 60),
          ('invalid', 60),
          (0, 60),
          (-1, 60),
          (1, 1),
          (60, 60),
          (3600, 3600),
          (3601, 3600),
          (999999999, 3600),
          (1.5, 60),
        ]) {
          final failure = ErrorMapper.fromDioException(
            rejected(status, {
              'params': {'retryAfterSeconds': sample.$1},
            }),
          );
          final duration =
              failure is RateLimitFailure
                  ? failure.retryAfter
                  : (failure as ServiceUnavailableFailure).retryAfter;
          expect(duration?.inSeconds, sample.$2);
        }
        final response =
            rejected(
              status,
              {
                'params': {'retryAfterSeconds': 4},
                'retryAfter': 2,
              },
              headers: {
                'Retry-After': ['7'],
              },
            ).response;
        expect(ErrorMapper.retryAfterSeconds(response), 7);
        expect(
          ErrorMapper.retryAfterSeconds(
            rejected(status, {
              'params': {'retryAfterSeconds': 4},
              'retryAfter': 2,
            }).response,
          ),
          4,
        );
        expect(
          ErrorMapper.retryAfterSeconds(
            rejected(status, {'retry_after': 2}).response,
          ),
          2,
        );
        expect(
          ErrorMapper.retryAfterSeconds(
            rejected(
              status,
              {'retryAfter': 2},
              headers: {
                'Retry-After': ['invalid'],
              },
            ).response,
          ),
          60,
        );
      }
    },
  );
}
