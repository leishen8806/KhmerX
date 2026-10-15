import 'package:dio/dio.dart';

import '../network_config.dart';

final class BaseHeadersInterceptor extends Interceptor {
  final NetworkConfig config;

  BaseHeadersInterceptor(this.config);

  static const _userAgent = 'KhmerX-Android/0.1.0+1';
  static const _accept = 'application/json';

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final expectedHost = config.baseUrl.host;
    final actualHost = options.uri.host;

    if (actualHost != expectedHost) {
      throw StateError(
        'Host mismatch: expected $expectedHost, got $actualHost. '
        'Refusing to send request to untrusted origin.',
      );
    }

    options.headers.removeWhere((key, _) => key.toLowerCase().startsWith('oai-'));

    options.headers['User-Agent'] = _userAgent;
    options.headers['Accept'] = _accept;

    super.onRequest(options, handler);
  }
}
