import 'package:dio/dio.dart';

import 'network_config.dart';

final class DioFactory {
  DioFactory._();

  static Dio create(NetworkConfig config) {
    final dio = Dio(BaseOptions(
      baseUrl: config.baseUrl.toString(),
      connectTimeout: config.connectTimeout,
      sendTimeout: config.sendTimeout,
      receiveTimeout: config.receiveTimeout,
      headers: {
        'Accept': 'application/json',
      },
    ),
    );
    return dio;
  }
}
