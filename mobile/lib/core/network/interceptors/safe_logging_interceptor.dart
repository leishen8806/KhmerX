import 'package:dio/dio.dart';

import '../../logging/redaction_policy.dart';
import '../../logging/safe_logger.dart';

final class SafeLoggingInterceptor extends Interceptor {
  SafeLoggingInterceptor();

  static String _trace() {
    final rnd = DateTime.now().microsecondsSinceEpoch.toRadixString(16);
    return rnd.padRight(12, '0').substring(0, 12);
  }

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final endpoint = options.extra['endpoint']?.toString() ?? 'unknown';
    final companyId = options.extra['companyId']?.toString() ?? 'none';
    final traceId = _trace();
    options.headers['X-Trace-Id'] = traceId;
    SafeLogger.i('REQ  [$traceId] ${options.method} $endpoint company=$companyId');
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    final traceId = response.requestOptions.headers['X-Trace-Id']?.toString() ?? '?';
    final endpoint = response.requestOptions.extra['endpoint']?.toString() ?? 'unknown';
    final status = response.statusCode ?? 0;
    final bytes = response.data?.toString().length ?? 0;
    SafeLogger.i('RESP [$traceId] $endpoint status=$status bytes=$bytes');
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final traceId = err.requestOptions.headers['X-Trace-Id']?.toString() ?? '?';
    final endpoint = err.requestOptions.extra['endpoint']?.toString() ?? 'unknown';
    final sanitized = RedactionPolicy.redactMessage(err.toString());
    SafeLogger.e('ERR  [$traceId] $endpoint $sanitized');
    handler.next(err);
  }
}
