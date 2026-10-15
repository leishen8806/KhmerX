import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureKv {
  final FlutterSecureStorage _storage;
  static const _androidOptions = AndroidOptions(
    resetOnError: true,
  );

  SecureKv(this._storage);

  Future<String?> read(String key) => _storage.read(
        key: key,
        aOptions: _androidOptions,
      );

  Future<void> write(String key, String value) => _storage.write(
        key: key,
        value: value,
        aOptions: _androidOptions,
      );

  Future<void> delete(String key) => _storage.delete(
        key: key,
        aOptions: _androidOptions,
      );

  Future<void> deleteAll() => _storage.deleteAll(
        aOptions: _androidOptions,
      );

  Future<bool> containsKey(String key) => _storage.containsKey(
        key: key,
        aOptions: _androidOptions,
      );

  Future<void> deleteAllWithPrefix(String prefix) async {
    final all = await _storage.readAll(aOptions: _androidOptions);
    final matching = all.keys.where((k) => k.startsWith(prefix)).toList();
    for (final k in matching) {
      await _storage.delete(key: k, aOptions: _androidOptions);
    }
  }

  Future<List<String>> readAllKeysWithPrefix(String prefix) async {
    final all = await _storage.readAll(aOptions: _androidOptions);
    return all.keys.where((k) => k.startsWith(prefix)).toList(growable: false);
  }

  Future<Map<String, String>> readAllWithPrefix(String prefix) async {
    final all = await _storage.readAll(aOptions: _androidOptions);
    return Map.fromEntries(all.entries.where((e) => e.key.startsWith(prefix)));
  }
}
