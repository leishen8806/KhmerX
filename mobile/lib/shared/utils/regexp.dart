class KhmerXRegexp {
  static final RegExp companyId = RegExp(r'^t_[a-f0-9-]{36}$');
  static final RegExp phoneInternational = RegExp(r'^\+[1-9]\d{7,14}$');
  static final RegExp hex64 = RegExp(r'^[a-f0-9]{64}$');
  static final RegExp visitorCookieValue = RegExp(r'^[a-f0-9-]{36}\.[a-f0-9]{64}$');

  /// Cambodian users write a local number with a leading 0 instead of the
  /// country code (087654321 = +85587654321). Cleans separators and turns the
  /// common local / "00" / bare-855 forms into +855... or +...; anything else is
  /// returned cleaned but unchanged so validation can reject it.
  static String normalizePhone(String raw) {
    final v = raw.trim().replaceAll(RegExp(r'[\s()\-.]'), '');
    if (v.isEmpty || v.startsWith('+')) return v;
    if (v.startsWith('00') && v.length > 2) return '+${v.substring(2)}';
    if (v.startsWith('855') && v.length >= 11) return '+$v';
    if (RegExp(r'^0[1-9]\d{7,9}$').hasMatch(v)) return '+855${v.substring(1)}';
    return v;
  }
}
