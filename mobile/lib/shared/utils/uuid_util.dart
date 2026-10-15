import 'dart:math';

class UuidUtil {
  static final Random _random = Random.secure();

  static String v4() {
    try {
      final bytes = List<int>.generate(16, (_) => _random.nextInt(256));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;

      final buffer = StringBuffer();
      for (var i = 0; i < 16; i++) {
        if (i == 4 || i == 6 || i == 8 || i == 10) {
          buffer.write('-');
        }
        buffer.write(bytes[i].toRadixString(16).padLeft(2, '0'));
      }
      return buffer.toString();
    } catch (_) {
      final epoch = DateTime.now().microsecondsSinceEpoch;
      final rand1 = _random.nextInt(0xFFFFFFFF).toRadixString(16).padLeft(8, '0');
      final rand2 = _random.nextInt(0xFFFFFFFF).toRadixString(16).padLeft(8, '0');
      final epochHex = epoch.toRadixString(16).padLeft(12, '0');
      return '${rand1.substring(0, 8)}-${rand1.substring(8, 12)}-4${rand2.substring(1, 4)}-${rand2.substring(4, 8)}${epochHex.substring(0, 12)}';
    }
  }
}
