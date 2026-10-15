import 'package:cookie_jar/cookie_jar.dart';

import '../network/network_config.dart';
import 'company_id.dart';

final class WhitelistCookieJar implements CookieJar {
  static const Set<String> whitelistNames = {
    'payease_visitor',
    'payease_company',
    'payease_h5_browser',
    'payease_h5_session',
  };

  final CompanyId companyId;
  final PersistCookieJar inner;
  final NetworkConfig? config;

  WhitelistCookieJar({
    required this.companyId,
    required this.inner,
    this.config,
  });

  static List<Cookie> filterCookies(List<Cookie> cookies, CompanyId owner) {
    return cookies.where((cookie) {
      if (!whitelistNames.contains(cookie.name)) return false;
      if (cookie.value.isEmpty) return false;
      if (cookie.name == 'payease_company') {
        if (owner.isPublic) return false;
        return cookie.value == owner.raw;
      }
      return true;
    }).toList(growable: false);
  }

  @override
  Future<List<Cookie>> loadForRequest(Uri uri) => inner.loadForRequest(uri);

  @override
  Future<void> saveFromResponse(Uri uri, List<Cookie> cookies) async {
    final filtered = filterCookies(cookies, companyId);
    if (filtered.isEmpty) return;
    await inner.saveFromResponse(uri, filtered);
  }

  Future<void> clearSession() async {
    final all = await _loadAllCookies();
    final uris = all.keys.toList();
    for (final uri in uris) {
      final toKeep = all[uri]!
          .where((c) => c.name != 'payease_h5_session')
          .toList(growable: false);
      await inner.delete(uri, true);
      if (toKeep.isNotEmpty) {
        await inner.saveFromResponse(uri, toKeep);
      }
    }
  }

  Future<Map<Uri, List<Cookie>>> _loadAllCookies() async {
    final out = <Uri, List<Cookie>>{};
    final candidates = <Uri>[];
    if (config != null) {
      candidates.add(Uri(
        scheme: config!.baseUrl.scheme,
        host: config!.baseUrl.host,
        port: config!.baseUrl.hasPort ? config!.baseUrl.port : null,
        path: '/',
      ),);
      candidates.add(Uri.https('payease.khmerx.org', '/'));
    } else {
      candidates.add(Uri.https('api.khmerx.org', '/'));
      candidates.add(Uri.https('payease.khmerx.org', '/'));
    }
    for (final u in candidates) {
      final list = await loadForRequest(u);
      if (list.isNotEmpty) out[u] = list;
    }
    return out;
  }

  @override
  Future<void> delete(Uri uri, [bool withDomainSharedCookie = false]) =>
      inner.delete(uri, withDomainSharedCookie);

  @override
  Future<void> deleteAll() => inner.deleteAll();

  @override
  bool get ignoreExpires => inner.ignoreExpires;
}
