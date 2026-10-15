import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/core/network/endpoints.dart';
import 'package:khmerx_app/core/network/interceptors/origin_interceptor.dart';
import 'package:khmerx_app/core/network/network_config.dart';

void main() {
  group('Origin interceptor', () {
    test('POST gets required Origin from NetworkConfig.origin', () async {
      final config = NetworkConfig(
        baseUrl: Uri.parse('https://api.khmerx.org'),
        connectTimeout: const Duration(seconds: 5),
        sendTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 5),
        logoutTimeout: const Duration(seconds: 5),
      );
      final interceptor = OriginInterceptor(config);
      final captured = <RequestOptions>[];
      interceptor.onRequest(
        RequestOptions(
          method: 'POST',
          path: '/api/h5/auth/logout',
          extra: const {'endpoint': Endpoints.postH5AuthLogout},
        ),
        InterceptorStateHandlerStub(captured.add, onReject: (e) {}),
      );
      expect(captured, isNotEmpty);
      final req = captured.single;
      expect(req.headers['Origin'], equals('https://api.khmerx.org'));
    });

    test('Origin includes non-default port (D-3 fix verified)', () async {
      final config = NetworkConfig(
        baseUrl: Uri.parse('http://10.0.2.2:8787'),
        connectTimeout: const Duration(seconds: 5),
        sendTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 5),
        logoutTimeout: const Duration(seconds: 5),
      );
      final interceptor = OriginInterceptor(config);
      final captured = <RequestOptions>[];
      interceptor.onRequest(
        RequestOptions(
          method: 'POST',
          path: '/api/h5/auth/logout',
          extra: const {'endpoint': Endpoints.postH5AuthLogout},
        ),
        InterceptorStateHandlerStub(captured.add, onReject: (e) {}),
      );
      expect(captured.single.headers['Origin'],
          equals('http://10.0.2.2:8787'),);
    });

    test('GET requests do NOT get Origin header', () async {
      final config = NetworkConfig(
        baseUrl: Uri.parse('https://api.khmerx.org'),
        connectTimeout: const Duration(seconds: 5),
        sendTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 5),
        logoutTimeout: const Duration(seconds: 5),
      );
      final interceptor = OriginInterceptor(config);
      final captured = <RequestOptions>[];
      interceptor.onRequest(
        RequestOptions(
          method: 'GET',
          path: '/api/h5/auth',
          extra: const {'endpoint': Endpoints.getH5Auth},
        ),
        InterceptorStateHandlerStub(captured.add, onReject: (e) {}),
      );
      expect(captured.single.headers, isNot(contains('Origin')));
    });
  });
}

class InterceptorStateHandlerStub<T> extends RequestInterceptorHandler {
  InterceptorStateHandlerStub(this._onNext, {this.onReject});
  final void Function(T) _onNext;
  final void Function(DioException)? onReject;
  @override
  void next(Object? data) => _onNext(data as T);
  @override
  void reject(DioException error, [bool? callFollowingErrorInterceptor]) =>
      onReject?.call(error);
}
