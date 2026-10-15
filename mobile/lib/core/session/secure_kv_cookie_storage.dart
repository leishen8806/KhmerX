import 'package:cookie_jar/cookie_jar.dart';

import '../network/network_config.dart';
import '../storage/key_schema.dart';
import '../storage/secure_kv.dart';
import 'company_id.dart';
import 'whitelist_cookie_jar.dart';

final class SecureKvCookieStorage implements Storage {
  final CompanyId companyId;
  final SecureKv secureKv;

  SecureKvCookieStorage({
    required this.companyId,
    required this.secureKv,
  });

  @override
  Future<void> init([bool persistSession = true, bool ignoreExpires = false]) async {}

  @override
  Future<String?> read(String key) async {
    final storeKey = KeySchema.cookieStorageKey(companyId.raw, key);
    return secureKv.read(storeKey);
  }

  @override
  Future<void> write(String key, String value) async {
    final storeKey = KeySchema.cookieStorageKey(companyId.raw, key);
    await secureKv.write(storeKey, value);
  }

  @override
  Future<void> delete(String key) async {
    final storeKey = KeySchema.cookieStorageKey(companyId.raw, key);
    await secureKv.delete(storeKey);
  }

  @override
  Future<void> deleteAll(List<String> keys) async {
    for (final k in keys) {
      await delete(k);
    }
  }
}

Future<WhitelistCookieJar> buildWhitelistJar(
  CompanyId companyId,
  SecureKv secureKv, {
  bool persistSession = true,
  NetworkConfig? networkConfig,
}) {
  final storage = SecureKvCookieStorage(companyId: companyId, secureKv: secureKv);
  final inner = PersistCookieJar(
    persistSession: persistSession,
    ignoreExpires: false,
    storage: storage,
  );
  return Future.value(WhitelistCookieJar(
    companyId: companyId,
    inner: inner,
    config: networkConfig,
  ),
  );
}
