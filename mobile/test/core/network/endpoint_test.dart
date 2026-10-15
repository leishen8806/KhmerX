import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/core/network/dio_factory.dart';
import 'package:khmerx_app/core/network/endpoints.dart';
import 'package:khmerx_app/core/network/network_config.dart';

void main() {
  group('P1-05 / Finding-5 — Endpoint final URL assembly', () {
    late NetworkConfig prodCfg;
    late List<RequestOptions> captured;
    late Interceptor capture;

    setUp(() {
      prodCfg = NetworkConfig(
        baseUrl: Uri.parse('https://api.khmerx.org'),
        connectTimeout: const Duration(seconds: 5),
        sendTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 5),
        logoutTimeout: const Duration(seconds: 5),
      );
      captured = <RequestOptions>[];
      capture = InterceptorsWrapper(onRequest: (o, h) {
        captured.add(o);
        h.reject(DioException(requestOptions: o));
      },);
    });

    Dio buildDio() {
      final d = DioFactory.create(prodCfg);
      d.interceptors.add(capture);
      return d;
    }

    test('baseUrl + /api/h5/auth => final URL exactly '
        'https://api.khmerx.org/api/h5/auth (no duplicate /api, no missing /api)', () async {
      final dio = buildDio();
      try {
        await dio.get(
          Endpoints.getH5Auth.path,
          options: Options(extra: const {'endpoint': Endpoints.getH5Auth}),
        );
      } catch (_) {}
      expect(captured, isNotEmpty);
      final ro = captured.single;
      final finalUri = ro.uri;
      expect(finalUri.toString(),
          equals('https://api.khmerx.org/api/h5/auth'),
          reason: 'Finding 5: Endpoint path must start with /api '
              '(not /h5/auth which becomes /api/api/h5/auth '
              'nor a missing /api prefix).',);
      expect(ro.path, equals('/api/h5/auth'));
    });

    test('getH5State => https://api.khmerx.org/api/h5/state', () async {
      final dio = buildDio();
      try {
        await dio.get(Endpoints.getH5State.path,
            options: Options(extra: const {'endpoint': Endpoints.getH5State}),);
      } catch (_) {}
      expect(captured.single.uri.toString(),
          equals('https://api.khmerx.org/api/h5/state'),);
    });

    test('getKyc => https://api.khmerx.org/api/kyc', () async {
      final dio = buildDio();
      try {
        await dio.get(Endpoints.getKyc.path,
            options: Options(extra: const {'endpoint': Endpoints.getKyc}),);
      } catch (_) {}
      expect(captured.single.uri.toString(),
          equals('https://api.khmerx.org/api/kyc'),);
    });

    test('postH5AuthLogout => https://api.khmerx.org/api/h5/auth/logout', () async {
      final dio = buildDio();
      try {
        await dio.post(Endpoints.postH5AuthLogout.path,
            options: Options(extra: const {
              'endpoint': Endpoints.postH5AuthLogout,
            },),);
      } catch (_) {}
      expect(captured.single.uri.toString(),
          equals('https://api.khmerx.org/api/h5/auth/logout'),);
    });

    test('NO path resolves to /api/api/... (double /api forbidden)', () async {
      for (final ep in const [
        Endpoints.getH5Auth,
        Endpoints.getH5State,
        Endpoints.getKyc,
        Endpoints.postH5AuthLogout,
      ]) {
        expect(ep.path, startsWith('/api/'),
            reason: '${ep.path} must be prefixed with /api/ so '
                'baseUrl + ep.path != /api/api/...',);
        expect(ep.path, isNot(startsWith('/api/api/')));
      }
    });
  });
}
