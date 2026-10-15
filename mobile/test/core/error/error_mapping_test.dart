import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/core/error/error_mapper.dart';
import 'package:khmerx_app/core/error/failure.dart';

void main() {
  group('P1-05 — ErrorMapper mapping (Finding-8 Offline + 409)', () {
    RequestOptions makeRequestOptions({String path = '/api/test'}) =>
        RequestOptions(path: path, method: 'GET');

    test('SocketException => OfflineFailure (not UnknownFailure)', () {
      final e = DioException(
        requestOptions: makeRequestOptions(),
        type: DioExceptionType.connectionError,
        error: const SocketException('failed host lookup'),
      );
      final f = ErrorMapper.fromDioException(e);
      expect(f, isA<OfflineFailure>(),
          reason: 'Finding 8: connectionError/SocketException -> OfflineFailure '
              '(NOT UnknownFailure).',);
    });

    test('DioExceptionType.connectionError (no inner) => OfflineFailure', () {
      final e = DioException(
        requestOptions: makeRequestOptions(),
        type: DioExceptionType.connectionError,
      );
      final f = ErrorMapper.fromDioException(e);
      expect(f, isA<OfflineFailure>());
    });

    test('statusCode=null + unknown type + SocketException message => OfflineFailure', () {
      final e = DioException(
        requestOptions: makeRequestOptions(),
        type: DioExceptionType.unknown,
        error: const SocketException('Connection failed'),
      );
      final f = ErrorMapper.fromDioException(e);
      expect(f, isA<OfflineFailure>());
    });

    test('401 => AuthFailure.unauthenticated', () {
      final ro = makeRequestOptions();
      final e = DioException(
        requestOptions: ro,
        response: Response(requestOptions: ro, statusCode: 401),
        type: DioExceptionType.badResponse,
      );
      final f = ErrorMapper.fromDioException(e);
      expect(f, isA<AuthFailure>());
    });

    test('403 => ForbiddenFailure', () {
      final ro = makeRequestOptions();
      final e = DioException(
        requestOptions: ro,
        response: Response(requestOptions: ro, statusCode: 403),
      );
      final f = ErrorMapper.fromDioException(e);
      expect(f, isA<ForbiddenFailure>());
    });

    test('409 => ConflictFailure (not UnknownFailure — FR-11)', () {
      final ro = makeRequestOptions();
      final e = DioException(
        requestOptions: ro,
        response: Response(requestOptions: ro, statusCode: 409),
      );
      final f = ErrorMapper.fromDioException(e);
      expect(f, isA<ConflictFailure>(),
          reason: 'FR-11: 409 = ConflictFailure (force refresh in UI, not generic unknown).',);
    });

    test('429 => RateLimitFailure', () {
      final ro = makeRequestOptions();
      final e = DioException(
        requestOptions: ro,
        response: Response(requestOptions: ro, statusCode: 429),
      );
      final f = ErrorMapper.fromDioException(e);
      expect(f, isA<RateLimitFailure>());
    });

    test('503 => ServiceUnavailableFailure', () {
      final ro = makeRequestOptions();
      final e = DioException(
        requestOptions: ro,
        response: Response(requestOptions: ro, statusCode: 503),
      );
      final f = ErrorMapper.fromDioException(e);
      expect(f, isA<ServiceUnavailableFailure>());
    });

    test('499 random status => UnknownFailure', () {
      final ro = makeRequestOptions();
      final e = DioException(
        requestOptions: ro,
        response: Response(requestOptions: ro, statusCode: 499),
      );
      final f = ErrorMapper.fromDioException(e);
      expect(f, isA<UnknownFailure>());
    });

    test('timeout subtypes map correctly', () {
      for (final t in const [
        DioExceptionType.connectionTimeout,
        DioExceptionType.sendTimeout,
        DioExceptionType.receiveTimeout,
      ]) {
        final e = DioException(requestOptions: makeRequestOptions(), type: t);
        final f = ErrorMapper.fromDioException(e);
        expect(f, isA<NetworkFailure>(), reason: '$t should be NetworkFailure');
      }
    });
  });
}
