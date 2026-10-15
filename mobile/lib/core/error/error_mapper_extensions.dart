extension CaseInsensitiveMap on Map<String, Object?> {
  String? caseInsensitiveString(List<String> keys) {
    for (final key in keys) {
      final keyLower = key.toLowerCase();
      for (final entry in entries) {
        if (entry.key.toLowerCase() == keyLower) {
          final v = entry.value;
          if (v == null) continue;
          if (v is String) {
            if (v.isEmpty) continue;
            return v;
          }
          return v.toString();
        }
      }
    }
    return null;
  }

  int? caseInsensitiveInt(List<String> keys) {
    for (final key in keys) {
      final keyLower = key.toLowerCase();
      for (final entry in entries) {
        if (entry.key.toLowerCase() == keyLower) {
          final v = entry.value;
          if (v is int) return v;
          if (v is num) return v.toInt();
          if (v is String) {
            final parsed = int.tryParse(v.trim());
            if (parsed != null) return parsed;
          }
        }
      }
    }
    return null;
  }
}
