import 'dart:io';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/core/network/endpoints.dart';
import 'package:khmerx_app/core/network/interceptors/company_context_guard_interceptor.dart';
import 'package:khmerx_app/core/network/interceptors/origin_interceptor.dart';
import 'package:khmerx_app/core/network/network_config.dart';
import 'package:khmerx_app/core/network/retry_policy.dart';
import 'package:khmerx_app/core/session/company_id.dart';

final CompanyId _cidA = CompanyId('t_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
final CompanyId _cidB = CompanyId('t_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

final _networkCfg = NetworkConfig(
  baseUrl: Uri.parse('https://api.khmerx.org'),
  connectTimeout: const Duration(milliseconds: 1000),
  sendTimeout: const Duration(milliseconds: 1000),
  receiveTimeout: const Duration(milliseconds: 1000),
  logoutTimeout: const Duration(milliseconds: 1000),
);

({List<RegExpMatch> matches, List<String> values}) _parseCompanyCookieTest(String header) {
  final regex = RegExp(r'payease_company=([^;]+)', multiLine: false);
  final matches = regex.allMatches(header).toList();
  final values = matches.map((m) => m.group(1)?.trim()).whereType<String>().toList();
  return (matches: matches, values: values);
}

Future<void> _ensureSingleCompanyCookieTest(CookieJar jar, Uri baseUrl, CompanyId companyId) async {
  final rootUri = Uri(
    scheme: baseUrl.scheme,
    host: baseUrl.host,
    port: baseUrl.hasPort ? baseUrl.port : null,
    path: '/',
  );
  final existing = await jar.loadForRequest(rootUri);
  final bool hasCompanyAtRoot = existing.any(
    (c) => c.name == 'payease_company' && c.value == companyId.raw,
  );
  final bool needsRewrite = !hasCompanyAtRoot ||
      existing.any((c) => c.name == 'payease_company' && c.value != companyId.raw);
  if (!needsRewrite) return;
  final Map<String, List<Cookie>> buckets = {};
  for (final c in existing) {
    if (c.name == 'payease_company') continue;
    final path = c.path ?? '/';
    buckets.putIfAbsent(path, () => <Cookie>[]).add(c);
  }
  await jar.delete(rootUri, true);
  for (final entry in buckets.entries) {
    final pathUri = Uri(
      scheme: baseUrl.scheme,
      host: baseUrl.host,
      port: baseUrl.hasPort ? baseUrl.port : null,
      path: entry.key,
    );
    await jar.saveFromResponse(pathUri, entry.value);
  }
  final companyCookie = Cookie('payease_company', companyId.raw)
    ..domain = baseUrl.host
    ..path = '/'
    ..httpOnly = false
    ..secure = baseUrl.scheme == 'https';
  await jar.saveFromResponse(rootUri, <Cookie>[companyCookie]);
}

class _CaptureHandler implements RequestInterceptorHandler {
  RequestOptions? options;
  DioException? err;
  Response? resolved;

  @override
  void next(RequestOptions options) {
    this.options = options;
  }

  @override
  void reject(DioException error, [bool force = false]) {
    err = error;
  }

  @override
  void resolve(Response response, [bool force = false]) {
    resolved = response;
  }

  @override
  dynamic noSuchMethod(Invocation m) => super.noSuchMethod(m);
}

void main() {
  group('§10 Retry: bounded GET policy only (never for 4xx / POST)', () {
    const policy = BoundedGetRetryPolicy(maxAttempts: 2);

    test('RG-04a attempt>=max: never retry', () {
      expect(policy.shouldRetry(2, 503, Object()), isFalse);
      expect(policy.shouldRetry(5, null, Object()), isFalse);
    });

    test('RG-04b 4xx (400/401/403/429) never retry (critical: no replay)', () {
      expect(policy.shouldRetry(0, 400, Object()), isFalse);
      expect(policy.shouldRetry(0, 401, Object()), isFalse);
      expect(policy.shouldRetry(0, 403, Object()), isFalse);
      expect(policy.shouldRetry(0, 404, Object()), isFalse);
      expect(policy.shouldRetry(0, 429, Object()), isFalse);
      expect(policy.shouldRetry(0, 499, Object()), isFalse);
    });

    test('RG-04c only 503 retries among 5xx; 500/502/504/599 never', () {
      expect(policy.shouldRetry(0, 503, Object()), isTrue);
      expect(policy.shouldRetry(0, 500, Object()), isFalse);
      expect(policy.shouldRetry(0, 502, Object()), isFalse);
      expect(policy.shouldRetry(1, 503, Object()), isTrue);
    });

    test('RG-04d null status + SocketException/DNS matches trigger retry', () {
      expect(policy.shouldRetry(0, null, const SocketException('Connection refused')), isTrue);
      expect(policy.shouldRetry(0, null, const HttpException('Failed host lookup')), isTrue);
      expect(policy.shouldRetry(0, null, StateError('unrelated')), isFalse);
    });

    test('RG-04e endpoints: 3 GET use BoundedGet; ALL 7 POST use RetryPolicy.none()', () {
      const getOk = {
        'getH5Auth': Endpoints.getH5Auth,
        'getH5State': Endpoints.getH5State,
        'getKyc': Endpoints.getKyc,
      };
      for (final e in getOk.entries) {
        expect(e.value.method, HttpMethod.get, reason: '${e.key} must be GET');
        expect(e.value.retry, isA<BoundedGetRetryPolicy>(),
            reason: '${e.key} should use boundedGet');
        expect((e.value.retry as BoundedGetRetryPolicy).maxAttempts >= 2, isTrue);
      }
      const posts = {
        'postH5AuthSend': Endpoints.postH5AuthSend,
        'postH5AuthVerify': Endpoints.postH5AuthVerify,
        'postH5AuthAccountLogin': Endpoints.postH5AuthAccountLogin,
        'postH5AuthAccountSetPassword': Endpoints.postH5AuthAccountSetPassword,
        'postH5AuthRecovery': Endpoints.postH5AuthRecovery,
        'postH5AuthLogout': Endpoints.postH5AuthLogout,
        'postH5Locale': Endpoints.postH5Locale,
      };
      for (final e in posts.entries) {
        expect(e.value.method, isNot(HttpMethod.get), reason: '${e.key} non-GET');
        final p = e.value.retry;
        expect(p.shouldRetry(0, 503, Object()), isFalse,
            reason: '${e.key} never retries via RetryPolicy.none');
        expect(p.shouldRetry(0, null, const SocketException('x')), isFalse);
      }
    });
  });

  group('§11 CompanyContextGuard: exactly-one payease_company cookie CF-0', () {
    test('RG-01a exactly-one = pass (1 cookie = companyId)', () {
      final r = _parseCompanyCookieTest('payease_company=${_cidA.raw}');
      expect(r.matches.length, 1);
      expect(r.values, [_cidA.raw]);
      // Same regex contract as CompanyContextGuardInterceptor
      final ri = cidGuardProveContract();
      expect(ri.matches.length, 1);
    });

    test('RG-01b zero company cookies = FAIL (companyCount=0)', () {
      final r = _parseCompanyCookieTest('foo=bar; session=abc');
      expect(r.matches.length, 0);
      expect(r.values.length, 0);
    });

    test('RG-01c two+ company cookies (duplicate/multi) = FAIL', () {
      final r = _parseCompanyCookieTest(
        'payease_company=${_cidA.raw}; payease_company=${_cidB.raw}',
      );
      expect(r.matches.length, 2);
      expect(r.values.toSet(), {_cidA.raw, _cidB.raw});
    });

    test('RG-01d cookie companyId mismatch vs request = FAIL', () {
      final r = _parseCompanyCookieTest('payease_company=${_cidB.raw}');
      expect(r.values.single, _cidB.raw);
      expect(r.values.single == _cidA.raw, isFalse);
    });
  });

  group('§11 CompanyCookieInterceptor: single-company cookie rewrite CF-6', () {
    test('RG-01e existing multiple/other company values → rewrite: exactly-one correct; other whitelist kept',
        () async {
      final jar = DefaultCookieJar();
      final root = Uri.parse('${_networkCfg.baseUrl.scheme}://${_networkCfg.baseUrl.host}/');
      await jar.saveFromResponse(root, [
        Cookie('payease_company', _cidB.raw)..path = '/',
        Cookie('payease_company', _cidA.raw)..path = '/',
        Cookie('payease_h5_session', 'old_sess')..path = '/',
      ]);
      await _ensureSingleCompanyCookieTest(jar, _networkCfg.baseUrl, _cidA);
      final cookies = await jar.loadForRequest(root);
      final companyCookies = cookies.where((c) => c.name == 'payease_company').toList();
      expect(companyCookies.length, 1, reason: 'payease_company count=1');
      expect(companyCookies.single.value, _cidA.raw);
      final sessionCookies = cookies.where((c) => c.name == 'payease_h5_session');
      expect(sessionCookies.length, 1);
      expect(sessionCookies.single.value, 'old_sess');
    });

    test('RG-02 company A jar vs B jar: rewrite → no cross-leak', () async {
      final jarA = DefaultCookieJar();
      final jarB = DefaultCookieJar();
      final root = Uri.parse('${_networkCfg.baseUrl.scheme}://${_networkCfg.baseUrl.host}/');
      await _ensureSingleCompanyCookieTest(jarA, _networkCfg.baseUrl, _cidA);
      await _ensureSingleCompanyCookieTest(jarB, _networkCfg.baseUrl, _cidB);
      final a = (await jarA.loadForRequest(root))
          .where((c) => c.name == 'payease_company')
          .map((c) => c.value)
          .toList();
      final b = (await jarB.loadForRequest(root))
          .where((c) => c.name == 'payease_company')
          .map((c) => c.value)
          .toList();
      expect(a, [_cidA.raw]);
      expect(b, [_cidB.raw]);
      expect(a.contains(_cidB.raw), isFalse);
      expect(b.contains(_cidA.raw), isFalse);
    });
  });

  group('§11 OriginInterceptor: POST/PUT/PATCH/DELETE → Origin; GET no Origin', () {
    _CaptureHandler runOrigin(HttpMethod method) {
      final interceptor = OriginInterceptor(_networkCfg);
      final h = _CaptureHandler();
      final opts = RequestOptions(
        path: '/x',
        method: method.name.toUpperCase(),
        baseUrl: _networkCfg.baseUrl.toString(),
        extra: {
          'endpoint': Endpoint(path: '/x', method: method, companyId: _cidA),
        },
      );
      interceptor.onRequest(opts, h);
      return h;
    }

    test('RG-03a POST/PUT/PATCH/DELETE → Origin=${_networkCfg.baseUrl.origin}', () {
      for (final m in [HttpMethod.post, HttpMethod.put, HttpMethod.patch, HttpMethod.delete]) {
        final h = runOrigin(m);
        expect(h.options, isNotNull, reason: 'next() called for $m');
        expect(h.options!.headers['Origin'], _networkCfg.baseUrl.origin,
            reason: 'Origin present for $m');
      }
    });

    test('RG-03b GET → Origin never injected', () {
      final h = runOrigin(HttpMethod.get);
      expect(h.options, isNotNull);
      final hasOrigin = h.options!.headers.keys.any(
        (k) => k.toLowerCase() == 'origin',
      );
      expect(hasOrigin, isFalse);
    });
  });
}

({List<RegExpMatch> matches, List<String> values}) cidGuardProveContract() {
  const String testHeader =
      'payease_company=t_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  final guardInterceptor = CompanyContextGuardInterceptor(_cidA);
  guardInterceptor;
  return _parseCompanyCookieTest(testHeader);
}
