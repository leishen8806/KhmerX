import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';

import '../../error/failure.dart';
import '../../session/company_id.dart';
import '../network_config.dart';
import '../endpoints.dart';

final class CompanyCookieInterceptor extends Interceptor {
  final CompanyId companyId;
  final NetworkConfig config;
  final CookieJar cookieJar;

  CompanyCookieInterceptor({
    required this.companyId,
    required this.config,
    required this.cookieJar,
  });

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final requestCompanyId = _resolveCompanyId(options);
    final baseUrl = config.baseUrl;

    if (requestCompanyId == null) {
      handler.reject(
        DioException(
          requestOptions: options,
          error: TenantContextFailure(
            clientCompanyId: companyId,
            reason: 'missing companyId on outgoing request',
          ),
        ),
      );
      return;
    }

    if (requestCompanyId.isPublic) {
      await _ensureNoCompanyCookie(cookieJar, baseUrl);
    } else {
      await _ensureSingleCompanyCookie(
        cookieJar,
        baseUrl,
        requestCompanyId,
      );
    }

    options.extra['_companyId'] = requestCompanyId.raw;
    super.onRequest(options, handler);
  }

  CompanyId? _resolveCompanyId(RequestOptions options) {
    final extra = options.extra['companyId'];
    if (extra is String) {
      final parsed = CompanyId.tryParse(extra);
      if (parsed != null) return parsed;
    }
    if (extra is CompanyId) return extra;
    final endpoint = options.extra['endpoint'] as Endpoint?;
    return endpoint?.companyId;
  }

  /// Public context: the request must carry zero `payease_company` cookies.
  static Future<void> _ensureNoCompanyCookie(CookieJar jar, Uri baseUrl) async {
    final rootUri = Uri(
      scheme: baseUrl.scheme,
      host: baseUrl.host,
      port: baseUrl.hasPort ? baseUrl.port : null,
      path: '/',
    );
    final existing = await jar.loadForRequest(rootUri);
    if (!existing.any((c) => c.name == 'payease_company')) return;
    final keep = existing.where((c) => c.name != 'payease_company').toList();
    await jar.delete(rootUri, true);
    if (keep.isNotEmpty) await jar.saveFromResponse(rootUri, keep);
  }

  static Future<void> _ensureSingleCompanyCookie(
    CookieJar jar,
    Uri baseUrl,
    CompanyId companyId,
  ) async {
    final rootUri = Uri(
      scheme: baseUrl.scheme,
      host: baseUrl.host,
      port: baseUrl.hasPort ? baseUrl.port : null,
      path: '/',
    );
    final requestUri = rootUri;
    final existing = await jar.loadForRequest(requestUri);

    final bool hasCompanyAtRoot = existing.any(
      (c) => c.name == 'payease_company' && c.value == companyId.raw,
    );
    final bool needsRewrite = !hasCompanyAtRoot ||
        existing.any(
          (c) =>
              c.name == 'payease_company' && c.value != companyId.raw,
        );

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
}
