// ignore_for_file: avoid_escaping_inner_quotes
final class RedactionPolicy {
  RedactionPolicy._();

  static final _blacklistKeys = <String>{
    'password',
    'confirmpassword',
    'confirm_password',
    'passwd',
    'pwd',
    'otp',
    'code',
    'sms',
    'smscode',
    'challenge',
    'challengeid',
    'token',
    'accesstoken',
    'accesstokenkey',
    'refreshtoken',
    'secret',
    'cookie',
    'setcookie',
    'authorization',
    'authenticate',
    'proxyauthorization',
    'phone',
    'phonenumber',
    'mobile',
    'mobilenumber',
    'contactnumber',
    'idnumber',
    'nationalid',
    'idcard',
    'passportnumber',
    'passportno',
    'idfront',
    'idback',
    'selfie',
    'sign',
    'signature',
    'bankaccount',
    'bankaccountno',
    'cardno',
    'cardnumber',
    'accountno',
    'accountnumber',
  };

  static final _hex64 = RegExp(r'[a-f0-9]{64}');
  static final _phoneNumber = RegExp(r'(\d{7,})(\d{4})');
  static final _bankNumber = RegExp(r'(\d{8,})(\d{4})');
  static final _kvPattern = RegExp(
    r'(authorization|cookie|set-cookie|password|confirm[_ -]?password|otp|code|challenge[_ -]?id|phone|phone[_ -]?number|bank[_ -]?account|id[_ -]?number|token|secret)\s*[:=]\s*(\S+)',
    caseSensitive: false,
  );
  static final _headerPair = RegExp(
    r'(authorization|cookie|set-cookie)\s*:\s*([^\r\n]+)',
    caseSensitive: false,
  );

  static String _normalizeKey(String key) =>
      key.toLowerCase().replaceAll('_', '').replaceAll('-', '').replaceAll(' ', '');

  static bool _isBlacklisted(String key) {
    final norm = _normalizeKey(key);
    if (_blacklistKeys.contains(norm)) return true;
    return _blacklistKeys.any((k) => norm.contains(k));
  }

  static String _redactValue(String value) {
    if (value.isEmpty) return value;
    if (_hex64.hasMatch(value)) {
      return value.replaceAll(_hex64, '[hex64]');
    }
    if (_phoneNumber.hasMatch(value)) {
      return value.replaceAllMapped(
        _phoneNumber,
        (m) => '***${m.group(2)}',
      );
    }
    if (_bankNumber.hasMatch(value)) {
      return value.replaceAllMapped(
        _bankNumber,
        (m) => '***${m.group(2)}',
      );
    }
    return value;
  }

  static Map<String, dynamic> redactMap(Map<String, dynamic> input) {
    final out = <String, dynamic>{};
    input.forEach((key, value) {
      if (_isBlacklisted(key)) {
        out[key] = '[REDACTED]';
      } else if (value is Map<String, dynamic>) {
        out[key] = redactMap(value);
      } else if (value is List) {
        out[key] = value.map((v) {
          if (v is Map<String, dynamic>) return redactMap(v);
          if (v is String) return redactMessage(v);
          return v;
        }).toList();
      } else if (value is String) {
        out[key] = _redactValue(value);
      } else {
        out[key] = value;
      }
    });
    return out;
  }

  static Map<String, List<String>> redactHeaders(Map<String, List<String>> headers) {
    final out = <String, List<String>>{};
    headers.forEach((key, value) {
      if (_isBlacklisted(key)) {
        out[key] = const ['[REDACTED]'];
      } else {
        out[key] = value.map((v) => _redactValue(v)).toList();
      }
    });
    return out;
  }

  static String redactMessage(String raw) {
    String out = raw;
    out = out.replaceAllMapped(_headerPair, (m) => '${m.group(1)}: [REDACTED]');
    out = out.replaceAllMapped(_kvPattern, (m) => '${m.group(1)}=[REDACTED]');
    out = out.replaceAllMapped(_hex64, (_) => '[hex64]');
    out = out.replaceAllMapped(_phoneNumber, (m) => '***${m.group(2)}');
    out = out.replaceAllMapped(_bankNumber, (m) => '***${m.group(2)}');
    return out;
  }
}
