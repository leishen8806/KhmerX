import 'dart:async';
import 'dart:math';

import 'package:dio/dio.dart';

import '../endpoints.dart';
import '../retry_policy.dart';

final class RetryInterceptor extends Interceptor {
  final Dio _dio;
  final Random _random = Random();

  RetryInterceptor(this._dio);

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final endpoint = err.requestOptions.extra['endpoint'] as Endpoint?;
    final policy = endpoint?.retry ?? const RetryPolicy.none();
    final attempt = err.requestOptions.extra['_retry_attempt'] as int? ?? 0;

    final Object cause = err.error ?? err;
    final int? status = err.response?.statusCode;

    if (policy is! BoundedGetRetryPolicy) {
      return handler.next(err);
    }

    if (err.requestOptions.method.toUpperCase() != 'GET') {
      return handler.next(err);
    }

    if (!policy.shouldRetry(attempt, status, cause)) {
      return handler.next(err);
    }

    if (attempt + 1 >= policy.maxAttempts) {
      return handler.next(err);
    }

    final base = policy.initialDelay.inMilliseconds;
    final delayMs = base + _random.nextInt(200);
    await Future<void>.delayed(Duration(milliseconds: delayMs));

    final retryHeaders = Map<String, dynamic>.of(err.requestOptions.headers)
      ..removeWhere((k, _) => k.toLowerCase() == 'cookie');
    final opts = Options(
      method: err.requestOptions.method,
      sendTimeout: err.requestOptions.sendTimeout,
      receiveTimeout: err.requestOptions.receiveTimeout,
      headers: retryHeaders,
      responseType: err.requestOptions.responseType,
      extra: Map<String, dynamic>.of(err.requestOptions.extra)
        ..['_retry_attempt'] = attempt + 1,
    );

    try {
      final request = err.requestOptions;
      final response = await _dio.request<Object?>(
        request.path,
        cancelToken: request.cancelToken,
        options: opts,
        data: request.data,
        queryParameters: request.queryParameters,
        onSendProgress: request.onSendProgress,
        onReceiveProgress: request.onReceiveProgress,
      );
      return handler.resolve(response);
    } on DioException catch (e) {
      return handler.next(e);
    }
  }
}
