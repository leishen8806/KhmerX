import 'dart:math';

import 'package:dio/dio.dart';

final class TraceIdInterceptor extends Interceptor {
  static const _chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  static final Random _random = Random.secure();

  static String _newId() {
    final out = StringBuffer();
    for (var i = 0; i < 16; i++) {
      out.write(_chars[_random.nextInt(_chars.length)]);
    }
    return out.toString();
  }

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final existing = options.headers['X-Trace-Id']?.toString();
    options.headers['X-Trace-Id'] = (existing != null && existing.isNotEmpty)
        ? existing
        : _newId();
    handler.next(options);
  }
}
