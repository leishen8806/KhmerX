import '../network/network_config.dart';
import '../storage/key_schema.dart';
import '../storage/secure_kv.dart';
import 'company_id.dart';
import 'secure_kv_cookie_storage.dart';
import 'whitelist_cookie_jar.dart';

final class CompanyCookieStore {
  final Map<CompanyId, WhitelistCookieJar> _jars = {};

  Future<WhitelistCookieJar> jarFor(CompanyId companyId, SecureKv secureKv, {
    bool persistSession = true,
    NetworkConfig? networkConfig,
  }) async {
    final existing = _jars[companyId];
    if (existing != null) return existing;
    final jar = await buildWhitelistJar(
      companyId,
      secureKv,
      persistSession: persistSession,
      networkConfig: networkConfig,
    );
    _jars[companyId] = jar;
    return jar;
  }

  WhitelistCookieJar? operator [](CompanyId id) => _jars[id];

  Future<void> clearSessionFor(CompanyId id, SecureKv secureKv, {
    NetworkConfig? networkConfig,
  }) async {
    final jar = _jars[id] ?? await buildWhitelistJar(
      id,
      secureKv,
      networkConfig: networkConfig,
    );
    await jar.clearSession();
  }

  Future<void> removeCompany(CompanyId id, SecureKv secureKv) async {
    _jars.remove(id);
    await secureKv.deleteAllWithPrefix(KeySchema.companyPrefix(id.raw));
  }
}
