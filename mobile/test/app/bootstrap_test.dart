import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:khmerx_app/app/bootstrap/bootstrap.dart';
import 'package:khmerx_app/app/bootstrap/providers.dart';
import 'package:khmerx_app/app/config/app_config.dart';
import 'package:khmerx_app/core/storage/secure_kv.dart';

class _MemKv implements SecureKv {
  final Map<String, String> _s = <String, String>{};
  @override Future<String?> read(String k) async => _s[k];
  @override Future<void> write(String k, String v) async => _s[k] = v;
  @override Future<void> delete(String k) async => _s.remove(k);
  @override Future<void> deleteAll() async => _s.clear();
  @override Future<bool> containsKey(String k) async => _s.containsKey(k);
  @override Future<void> deleteAllWithPrefix(String p) async =>
      _s.removeWhere((k, _) => k.startsWith(p));
  @override Future<List<String>> readAllKeysWithPrefix(String p) async =>
      _s.keys.where((k) => k.startsWith(p)).toList();
  @override Future<Map<String, String>> readAllWithPrefix(String p) async =>
      Map.fromEntries(_s.entries.where((e) => e.key.startsWith(p)));
}

void main() {
  group('P1-05 — bootstrap wiring', () {
    test('bootstrap(overrides) returns ProviderContainer with required providers bound', () async {
      final container = await bootstrap(overrides: [
        appConfigProvider.overrideWithValue(AppConfig.dev()),
        secureKvProvider.overrideWithValue(_MemKv()),
      ],);
      addTearDown(container.dispose);
      expect(container.read(appConfigProvider), isA<AppConfig>());
      expect(container.read(secureKvProvider), isA<SecureKv>());
      expect(container.read(featureFlagsProvider), isNotNull);
      expect(container.read(activeCompanyIdProvider), isNull);
    });

    test('no appConfig override throws; no silent fallback', () async {
      final c = ProviderContainer(
        overrides: [
          secureKvProvider.overrideWithValue(_MemKv()),
        ],
      );
      addTearDown(c.dispose);
      Object? caught;
      try {
        c.read(appConfigProvider);
      } catch (e) {
        caught = e;
      }
      final errStr = caught?.toString() ?? '';
      expect(caught, isNotNull, reason: 'Must throw when appConfigProvider not overridden.');
      expect(errStr, contains('UnimplementedError'),
          reason: 'Error should mention UnimplementedError (Must be overridden at bootstrap). Got: $errStr',);
    });
  });
}
