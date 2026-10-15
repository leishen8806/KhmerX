import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/core/network/dio_factory.dart';
import 'package:khmerx_app/core/network/endpoints.dart';
import 'package:khmerx_app/core/network/interceptors/retry_interceptor.dart';
import 'package:khmerx_app/core/network/network_config.dart';
import 'package:khmerx_app/core/network/retry_policy.dart';

void main() {
  group('P1-03B — Dio: failing POST request count = 1 (NO auto retry)', () {
    late NetworkConfig cfg;
    late int requestCount;
    late List<RequestOptions> seen;
    late Interceptor dummy500;

    setUp(() {
      cfg = NetworkConfig(
        baseUrl: Uri.parse('https://api.khmerx.org'),
        connectTimeout: const Duration(seconds: 2),
        sendTimeout: const Duration(seconds: 2),
        receiveTimeout: const Duration(seconds: 2),
        logoutTimeout: const Duration(seconds: 2),
      );
      requestCount = 0;
      seen = <RequestOptions>[];
      dummy500 = InterceptorsWrapper(
        onRequest: (options, handler) {
          requestCount += 1;
          seen.add(options);
          handler.reject(DioException(
            requestOptions: options,
            response: Response(
              requestOptions: options,
              statusCode: 500,
            ),
            type: DioExceptionType.badResponse,
          ),);
        },
      );
    });

    test('POST logout (RetryPolicy.none): exactly 1 request', () async {
      final dio = DioFactory.create(cfg);
      dio.interceptors.addAll([
        dummy500,
        RetryInterceptor(dio),
      ]);
      try {
        await dio.post(Endpoints.postH5AuthLogout.path,
            options: Options(extra: const {
              'endpoint': Endpoints.postH5AuthLogout,
            },),);
      } catch (_) {}
      expect(requestCount, equals(1),
          reason: 'Financial write POST must NEVER be retried. '
              'RetryPolicy.none + POST = 1 request max.',);
    });

    test('POST w/ explicit RetryPolicy.none path = exactly 1', () async {
      final dio = DioFactory.create(cfg);
      const ep = Endpoint(
        path: '/api/test/post-write',
        method: HttpMethod.post,
        retry: RetryPolicy.none(),
      );
      dio.interceptors.addAll([
        dummy500,
        RetryInterceptor(dio),
      ]);
      try {
        await dio.post(ep.path,
            options: Options(extra: {'endpoint': ep}),);
      } catch (_) {}
      expect(requestCount, equals(1));
    });
  });
}
