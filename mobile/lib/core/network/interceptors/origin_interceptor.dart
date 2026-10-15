import 'package:dio/dio.dart';

import '../network_config.dart';
import '../endpoints.dart';

final class OriginInterceptor extends Interceptor {
  final NetworkConfig config;

  OriginInterceptor(this.config);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final endpoint = options.extra['endpoint'] as Endpoint?;
    final method = endpoint?.method ?? _methodFromString(options.method);

    if (method case HttpMethod.post ||
        HttpMethod.put ||
        HttpMethod.patch ||
        HttpMethod.delete) {
      options.headers['Origin'] = config.origin;
    }

    super.onRequest(options, handler);
  }

  static HttpMethod _methodFromString(String method) {
    return switch (method.toUpperCase()) {
      'GET' => HttpMethod.get,
      'POST' => HttpMethod.post,
      'PUT' => HttpMethod.put,
      'PATCH' => HttpMethod.patch,
      'DELETE' => HttpMethod.delete,
      _ => HttpMethod.get,
    };
  }
}
