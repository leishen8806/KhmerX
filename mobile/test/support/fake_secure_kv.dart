import 'package:khmerx_app/core/storage/secure_kv.dart';

final class FakeSecureKv implements SecureKv {
  FakeSecureKv([Map<String, String>? seed]) : _store = <String, String>{...?seed};

  final Map<String, String> _store;
  final List<({String op, String? key, String? value})> _log =
      <({String op, String? key, String? value})>[];

  List<({String op, String? key, String? value})> get opLog =>
      List.unmodifiable(_log);

  void clearLog() => _log.clear();

  @override
  Future<String?> read(String k) async {
    _log.add((op: 'read', key: k, value: null));
    return _store[k];
  }

  @override
  Future<void> write(String k, String v) async {
    _log.add((op: 'write', key: k, value: v));
    _store[k] = v;
  }

  @override
  Future<void> delete(String k) async {
    _log.add((op: 'delete', key: k, value: null));
    _store.remove(k);
  }

  @override
  Future<void> deleteAll() async {
    _log.add((op: 'deleteAll', key: null, value: null));
    _store.clear();
  }

  @override
  Future<bool> containsKey(String k) async {
    _log.add((op: 'containsKey', key: k, value: null));
    return _store.containsKey(k);
  }

  @override
  Future<void> deleteAllWithPrefix(String p) async {
    _log.add((op: 'deleteAllWithPrefix', key: p, value: null));
    _store.removeWhere((k, _) => k.startsWith(p));
  }

  @override
  Future<List<String>> readAllKeysWithPrefix(String p) async {
    _log.add((op: 'readAllKeysWithPrefix', key: p, value: null));
    return _store.keys.where((k) => k.startsWith(p)).toList();
  }

  @override
  Future<Map<String, String>> readAllWithPrefix(String p) async {
    _log.add((op: 'readAllWithPrefix', key: p, value: null));
    return Map.fromEntries(_store.entries.where((e) => e.key.startsWith(p)));
  }
}
