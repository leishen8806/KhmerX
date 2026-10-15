final class PasswordValidation {
  const PasswordValidation.valid()
      : tooShort = false,
        tooLong = false,
        matchesConfirm = true;

  const PasswordValidation.invalid({
    required this.tooShort,
    required this.tooLong,
    required this.matchesConfirm,
  });

  final bool tooShort;
  final bool tooLong;
  final bool matchesConfirm;

  bool get isValid => !tooShort && !tooLong && matchesConfirm;
}

final class PasswordRules {
  static const int minLength = 12;
  static const int maxLength = 128;

  static int length(String input) {
    if (input.isEmpty) return 0;
    return input.codeUnits.length;
  }

  static PasswordValidation validate(String password, {String? confirm}) {
    final n = length(password);
    final tooShort = n < minLength;
    final tooLong = n > maxLength;
    final matchesConfirm = confirm == null || password == confirm;
    if (!tooShort && !tooLong && matchesConfirm) {
      return const PasswordValidation.valid();
    }
    return PasswordValidation.invalid(
      tooShort: tooShort,
      tooLong: tooLong,
      matchesConfirm: matchesConfirm,
    );
  }
}
