import 'dart:io';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/app/config/app_config.dart';
import 'package:khmerx_app/core/error/failure.dart';
import 'package:khmerx_app/core/network/api_client.dart';
import 'package:khmerx_app/core/network/endpoints.dart';
import 'package:khmerx_app/core/network/network_config.dart';
import 'package:khmerx_app/core/network/interceptors/company_context_guard_interceptor.dart';
import 'package:khmerx_app/core/session/company_cookie_store.dart';
import 'package:khmerx_app/core/session/company_id.dart';
import 'package:khmerx_app/core/session/secure_kv_cookie_storage.dart';
import 'package:khmerx_app/core/storage/secure_kv.dart';

import '../../support/fake_khmerx_server.dart';
import '../../support/fake_secure_kv.dart';

NetworkConfig _networkConfigFrom(Uri baseUrl) => NetworkConfig(
      baseUrl: baseUrl,
      connectTimeout: const Duration(milliseconds: 3000),
      sendTimeout: const Duration(milliseconds: 3000),
      receiveTimeout: const Duration(milliseconds: 3000),
      logoutTimeout: const Duration(milliseconds: 1500),
    );

AppConfig _appConfigFor(NetworkConfig netCfg) {
  return AppConfig.production().copyWith(networkConfig: netCfg);
}

void main() {
  group('G1-CF0 (P0): exactly-one payease_company tenant isolation', () {
    late CompanyId idA;
    late CompanyId idB;
    late FakeKhmerxServer server;
    late SecureKv kv;
    late CompanyCookieStore store;
    late AppConfig config;
    late Uri root;

    setUp(() async {
      idA = CompanyId('t_aaaaaaaa-1234-1234-1234-123456789012');
      idB = CompanyId('t_bbbbbbbb-1234-1234-1234-123456789012');
      server = await FakeKhmerxServer.bind();
      kv = FakeSecureKv();
      store = CompanyCookieStore();
      final baseUrl = Uri.parse(server.baseUrl);
      root = Uri(
        scheme: baseUrl.scheme,
        host: baseUrl.host,
        port: baseUrl.port,
        path: '/',
      );
      config = _appConfigFor(_networkConfigFrom(baseUrl));
      server.register(
        'GET /api/h5/auth',
        (r) => HttpResponseData.ok({
          'status': 'unauthenticated',
          'languages': ['km', 'en', 'zh'],
          'company': {'id': 't_ok'},
        }),
      );
    });

    tearDown(() => server.close());

    Future<ApiClient> buildClientFor(CompanyId id) async {
      final jar = await store.jarFor(
        id,
        kv,
        networkConfig: config.networkConfig,
      );
      return ApiClient.forCompany(id, config, jar);
    }

    Future<void> setSessionCookies(ApiClient client, {
      required String session,
      String? visitor,
      String? browser,
    }) async {
      final rootUri = root;
      await client.cookieJar.saveFromResponse(rootUri, [
        Cookie('payease_company', client.companyId.raw),
        if (visitor != null) Cookie('payease_visitor', visitor),
        if (browser != null) Cookie('payease_h5_browser', browser),
        Cookie('payease_h5_session', session),
      ],);
    }

    List<({String name, String value})> parseCookie(String? header) {
      if (header == null || header.isEmpty) return const [];
      final out = <({String name, String value})>[];
      for (final part in header.split(';')) {
        final p = part.trim();
        if (p.isEmpty) continue;
        final i = p.indexOf('=');
        if (i < 0) {
          out.add((name: p, value: ''));
          continue;
        }
        out.add((name: p.substring(0, i).trim(), value: p.substring(i + 1).trim()));
      }
      return out;
    }

    int countCompanyCookies(String? header) =>
        parseCookie(header).where((c) => c.name == 'payease_company').length;

    String? firstCompany(String? header) {
      for (final c in parseCookie(header)) {
        if (c.name == 'payease_company') return c.value;
      }
      return null;
    }

    test('CF0-T1: A→GET h5/auth → exactly one payease_company=A', () async {
      final a = await buildClientFor(idA);
      await a.request(Endpoints.getH5Auth);
      final last = server.requests.last;
      expect(countCompanyCookies(last.cookie), equals(1),
          reason: 'Outbound Cookie must contain exactly one payease_company.',);
      expect(firstCompany(last.cookie), equals(idA.raw));
    });

    test('CF0-T2: B→GET h5/auth → exactly one payease_company=B', () async {
      final b = await buildClientFor(idB);
      await b.request(Endpoints.getH5Auth);
      final last = server.requests.last;
      expect(countCompanyCookies(last.cookie), equals(1));
      expect(firstCompany(last.cookie), equals(idB.raw));
    });

    test('CF0-T3: A→B → first B request has zero A session cookies and B context', () async {
      final a = await buildClientFor(idA);
      final b = await buildClientFor(idB);
      await setSessionCookies(a, session: 'sA', visitor: 'vA', browser: 'bA');
      await setSessionCookies(b, session: 'sB', visitor: 'vB', browser: 'bB');
      server.requests.clear();
      await b.request(Endpoints.getH5Auth);
      final req = server.requests.single;
      expect(firstCompany(req.cookie), equals(idB.raw));
      final cookies = parseCookie(req.cookie);
      final byName = <String, List<String>>{};
      for (final c in cookies) {
        byName.putIfAbsent(c.name, () => <String>[]).add(c.value);
      }
      expect(byName['payease_h5_session'], equals(['sB']),
          reason: 'A session must not leak to first B request.',);
      expect(byName['payease_visitor'], equals(['vB']));
      expect(byName['payease_h5_browser'], equals(['bB']));
    });

    test('CF0-T4: B→A → A context restored with A session intact', () async {
      final a = await buildClientFor(idA);
      final b = await buildClientFor(idB);
      await setSessionCookies(a, session: 'sA-restore', visitor: 'vA');
      await setSessionCookies(b, session: 'sB', visitor: 'vB');
      await b.request(Endpoints.getH5Auth);
      server.requests.clear();
      await a.request(Endpoints.getH5Auth);
      final req = server.requests.single;
      expect(firstCompany(req.cookie), equals(idA.raw));
      final byName = <String, String>{};
      for (final c in parseCookie(req.cookie)) {
        byName[c.name] = c.value;
      }
      expect(byName['payease_h5_session'], equals('sA-restore'));
      expect(byName['payease_visitor'], equals('vA'));
    });

    test('CF0-T5: duplicate payease_company in jar (path trick) → rewritten to exactly one',
        () async {
      final a = await buildClientFor(idA);
      final jar = a.cookieJar;
      final sub = Uri(
        scheme: root.scheme,
        host: root.host,
        port: root.port,
        path: '/a/b',
      );
      await jar.saveFromResponse(root, [
        Cookie('payease_company', idA.raw)
          ..path = '/'
          ..domain = root.host,
      ],);
      await jar.saveFromResponse(sub, [
        Cookie('payease_company', 't_INJECTED_WRONG')
          ..path = '/a/b'
          ..domain = root.host,
      ],);
      final before = await jar.loadForRequest(
        Uri.parse('${server.baseUrl}/a/b/c'),
      );
      final beforeCompany = before.where((c) => c.name == 'payease_company').toList();
      expect(beforeCompany.length, greaterThanOrEqualTo(1),
          reason: 'Test setup: inject duplicate via path trick.',);
      server.requests.clear();
      await a.request(Endpoints.getH5Auth);
      final req = server.requests.single;
      expect(countCompanyCookies(req.cookie), equals(1),
          reason: 'Interceptor must collapse duplicate payease_company into 1.',);
      expect(firstCompany(req.cookie), equals(idA.raw));
    });

    test('CF0-T6: Client bound to A cannot send B; Guard rejects before leaving the device',
        () async {
      final a = await buildClientFor(idA);
      Object? caught;
      try {
        await a.request(Endpoints.getH5Auth.withCompanyId(idB));
      } on DioException catch (e) {
        caught = e.error;
      }
      expect(caught, isA<TenantContextFailure>(),
          reason: 'Cross-tenant payload must be fail-closed inside device.',);
      final f = caught as TenantContextFailure;
      expect(f.clientCompanyId, equals(idA));
      expect(f.reason, contains('ApiClient bound'));
    });

    test('CF0-T7: double company header injection → Guard rejects', () async {
      final a = await buildClientFor(idA);
      final guardIndex = a.dio.interceptors.indexWhere(
        (i) => i is CompanyContextGuardInterceptor,
      );
      expect(guardIndex, greaterThanOrEqualTo(0),
          reason: 'Guard interceptor must be installed.',);
      final interceptor = InterceptorsWrapper(
        onRequest: (opts, h) {
          opts.headers['Cookie'] = 'payease_company=t_POISON1; payease_company=t_POISON2';
          h.next(opts);
        },
      );
      a.dio.interceptors.insert(guardIndex, interceptor);
      Object? caught;
      try {
        await a.request(Endpoints.getH5Auth);
      } on DioException catch (e) {
        caught = e.error;
      }
      expect(caught, isA<TenantContextFailure>(),
          reason: 'Guard must reject 2+ payease_company occurrences.',);
      final f = caught as TenantContextFailure;
      expect(f.companyCount, greaterThanOrEqualTo(2),
          reason: 'At least two payease_company tokens must be observed by Guard.',);
    });

    test('CF0-T8: NO payease_company → Guard rejects', () async {
      final a = await buildClientFor(idA);
      final guardIndex = a.dio.interceptors.indexWhere(
        (i) => i is CompanyContextGuardInterceptor,
      );
      final killer = InterceptorsWrapper(
        onRequest: (opts, h) {
          opts.headers.remove('Cookie');
          h.next(opts);
        },
      );
      a.dio.interceptors.insert(guardIndex, killer);
      Object? caught;
      try {
        await a.request(Endpoints.getH5Auth);
      } on DioException catch (e) {
        caught = e.error;
      }
      expect(caught, isA<TenantContextFailure>());
      final f = caught as TenantContextFailure;
      expect(f.reason, contains('count!=1'));
    });

    test('CF0-T9: Wrong company in cookie → Guard rejects', () async {
      final a = await buildClientFor(idA);
      final guardIndex = a.dio.interceptors.indexWhere(
        (i) => i is CompanyContextGuardInterceptor,
      );
      final tamper = InterceptorsWrapper(
        onRequest: (opts, h) {
          opts.headers['Cookie'] = 'payease_company=t_wrongvalue';
          h.next(opts);
        },
      );
      a.dio.interceptors.insert(guardIndex, tamper);
      Object? caught;
      try {
        await a.request(Endpoints.getH5Auth);
      } on DioException catch (e) {
        caught = e.error;
      }
      expect(caught, isA<TenantContextFailure>());
      final f = caught as TenantContextFailure;
      expect(f.transportCompanyId, equals('t_wrongvalue'));
    });

    test('CF0-T10: Reject request with no companyId in extra', () async {
      final a = await buildClientFor(idA);
      const rawEndpoint = Endpoint(
        path: '/api/h5/auth',
        method: HttpMethod.get,
        requiresSession: false,
      );
      Object? caught;
      try {
        await a.dio.requestUri<dynamic>(
          a.config.baseUrl.resolve(rawEndpoint.path),
          options: Options(
            method: rawEndpoint.method.name.toUpperCase(),
            extra: <String, Object?>{
              'endpoint': rawEndpoint,
            },
          ),
        ).timeout(const Duration(seconds: 5));
      } on DioException catch (e) {
        caught = e.error;
      } catch (e) {
        if (e is DioException) {
          caught = e.error;
        } else {
          caught = e;
        }
      }
      expect(caught, isA<TenantContextFailure>(),
          reason: 'Request without companyId extra must be fail-closed.',);
    });

    test('CF0-T11: logout uses correct tenant cookie (A logout = company=A)',
        () async {
      final a = await buildClientFor(idA);
      await setSessionCookies(a, session: 'sA');
      server.register('POST /api/h5/auth/logout', (r) {
        return HttpResponseData.ok({'ok': true});
      });
      server.requests.clear();
      try {
        await a.request(Endpoints.postH5AuthLogout);
      } catch (_) {}
      final req = server.requests.single;
      expect(countCompanyCookies(req.cookie), equals(1));
      expect(firstCompany(req.cookie), equals(idA.raw));
    });
  });

  group('G1-CF6: clearSessionFor + config.host removal of hardcoded hosts',
      () {
    test('clearSessionFor loads un-cached jar from persistence then clears h5_session',
        () async {
      final idA = CompanyId('t_aaaaaaaa-1234-1234-1234-123456789012');
      final server = await FakeKhmerxServer.bind();
      addTearDown(server.close);
      final baseUrl = Uri.parse(server.baseUrl);
      final root = Uri(
        scheme: baseUrl.scheme,
        host: baseUrl.host,
        port: baseUrl.port,
        path: '/',
      );
      final cfg = _networkConfigFrom(baseUrl);
      final kv = FakeSecureKv();
      final jar1 = await buildWhitelistJar(
        idA,
        kv,
        networkConfig: cfg,
      );
      await jar1.saveFromResponse(root, [
        Cookie('payease_company', idA.raw),
        Cookie('payease_visitor', 'vA'),
        Cookie('payease_h5_browser', 'bA'),
        Cookie('payease_h5_session', 'sA'),
      ],);
      final store = CompanyCookieStore();
      final jarCached = await store.jarFor(idA, kv, networkConfig: cfg);
      await store.clearSessionFor(idA, kv, networkConfig: cfg);
      final loaded = await jarCached.loadForRequest(root);
      final names = loaded.map((c) => c.name).toSet();
      expect(names.contains('payease_h5_session'), isFalse);
      expect(names, contains('payease_company'));
      expect(names, contains('payease_visitor'));
      expect(names, contains('payease_h5_browser'));

      final store2 = CompanyCookieStore();
      await store2.clearSessionFor(idA, kv, networkConfig: cfg);
      final jarFresh = await buildWhitelistJar(idA, kv, networkConfig: cfg);
      final names2 = (await jarFresh.loadForRequest(root)).map((c) => c.name).toSet();
      expect(names2.contains('payease_h5_session'), isFalse,
          reason: 'Reload from persistence must show session cleared even with new jar instance.',);
    });

    test('WhitelistCookieJar.clearSession on non-production host (127.0.0.1) works',
        () async {
      final idA = CompanyId('t_aaaaaaaa-1234-1234-1234-123456789012');
      final server = await FakeKhmerxServer.bind();
      addTearDown(server.close);
      final baseUrl = Uri.parse(server.baseUrl);
      final root = Uri(
        scheme: baseUrl.scheme,
        host: baseUrl.host,
        port: baseUrl.port,
        path: '/',
      );
      final cfg = _networkConfigFrom(baseUrl);
      final kv = FakeSecureKv();
      final jar = await buildWhitelistJar(idA, kv, networkConfig: cfg);
      await jar.saveFromResponse(root, [
        Cookie('payease_company', idA.raw),
        Cookie('payease_h5_session', 'to-delete'),
      ],);
      await jar.clearSession();
      final names = (await jar.loadForRequest(root)).map((c) => c.name).toSet();
      expect(names.contains('payease_h5_session'), isFalse,
          reason: 'clearSession must work on 127.0.0.1 fake server, not only api.khmerx.org.',);
      expect(names, contains('payease_company'));
    });
  });
}
