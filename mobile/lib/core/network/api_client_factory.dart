import '../../app/config/app_config.dart';
import '../../core/storage/secure_kv.dart';
import '../session/company_cookie_store.dart';
import '../session/company_id.dart';
import '../session/whitelist_cookie_jar.dart';
import 'api_client.dart';

final class ApiClientFactory {
  ApiClientFactory({
    required this.config,
    required this.store,
    required this.secureKv,
    this.onSessionExpired,
  });

  final AppConfig config;
  final CompanyCookieStore store;
  final SecureKv secureKv;

  /// Called with the context whose session the server rejected (401).
  final void Function(CompanyId id)? onSessionExpired;
  final Map<CompanyId, ApiClient> _clients = {};

  Future<ApiClient> get(CompanyId id) async {
    final existing = _clients[id];
    if (existing != null) return existing;
    final WhitelistCookieJar jar = await store.jarFor(
      id,
      secureKv,
      networkConfig: config.networkConfig,
    );
    final c = ApiClient.forCompany(
      id,
      config,
      jar,
      onSessionExpired: onSessionExpired == null
          ? null
          : () => onSessionExpired!(id),
    );
    _clients[id] = c;
    return c;
  }

  ApiClient? operator [](CompanyId id) => _clients[id];

  void release(CompanyId id) {
    _clients.remove(id);
  }

  void releaseAll() => _clients.clear();
}
