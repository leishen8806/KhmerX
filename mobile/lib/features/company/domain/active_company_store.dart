import 'dart:convert';

import '../../../core/session/company_id.dart';
import '../../../core/storage/key_schema.dart';
import '../../../core/storage/secure_kv.dart';

final class ActiveCompanyStore {
  ActiveCompanyStore({required this.secureKv});

  final SecureKv secureKv;

  Future<CompanyId?> loadActive() async {
    final raw = await secureKv.read(KeySchema.activeCompanyId);
    if (raw == null || raw.isEmpty) return null;
    return CompanyId.tryParse(raw);
  }

  Future<void> setActive(CompanyId id) async {
    await secureKv.write(KeySchema.activeCompanyId, id.raw);
  }

  Future<void> clearActive() async {
    await secureKv.delete(KeySchema.activeCompanyId);
  }

  Future<List<CompanyId>> loadCompanies() async {
    final raw = await secureKv.read(KeySchema.companies);
    if (raw == null || raw.isEmpty) return const [];
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      final out = <CompanyId>[];
      for (final item in list) {
        final c = CompanyId.tryParse(item as String?);
        if (c != null) out.add(c);
      }
      return List.unmodifiable(out);
    } catch (_) {
      return const [];
    }
  }

  Future<void> addCompany(CompanyId id) async {
    final existing = await loadCompanies();
    if (existing.contains(id)) return;
    final next = [...existing, id];
    await secureKv.write(
      KeySchema.companies,
      jsonEncode(next.map((e) => e.raw).toList()),
    );
  }

  Future<void> removeCompany(CompanyId id) async {
    final existing = await loadCompanies();
    if (!existing.contains(id)) return;
    final next = existing.where((e) => e != id).toList(growable: false);
    await secureKv.write(
      KeySchema.companies,
      jsonEncode(next.map((e) => e.raw).toList()),
    );
  }

  Future<String?> loadLocalePref(CompanyId id) async {
    return secureKv.read(KeySchema.localePref(id.raw));
  }

  Future<void> setLocalePref(CompanyId id, String languageCode) async {
    await secureKv.write(KeySchema.localePref(id.raw), languageCode);
  }

  Future<void> deleteLocalePref(CompanyId id) async {
    await secureKv.delete(KeySchema.localePref(id.raw));
  }
}
