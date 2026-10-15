import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/bootstrap/providers.dart';

final class LocaleStore {
  static const String _k = 'v1/app/locale';

  final Ref _ref;
  LocaleStore(this._ref);

  Future<String?> load() async {
    final kv = _ref.read(secureKvProvider);
    return kv.read(_k);
  }

  Future<void> save(String? tag) async {
    final kv = _ref.read(secureKvProvider);
    if (tag == null) {
      await kv.delete(_k);
    } else {
      await kv.write(_k, tag);
    }
  }
}
