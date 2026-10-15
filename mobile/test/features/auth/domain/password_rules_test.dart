// ignore_for_file: prefer_const_constructors
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/features/auth/domain/password_rules.dart';

void main() {
  group('PasswordRules (Contract 12..128 UTF-16)', () {
    test('length uses UTF-16 codeUnits', () {
      expect(PasswordRules.length(''), 0);
      expect(PasswordRules.length('a' * 11), 11);
      expect(PasswordRules.length('a' * 12), 12);
      expect(PasswordRules.length('a' * 128), 128);
      expect(PasswordRules.length('a' * 129), 129);
      expect(PasswordRules.length('😀'), 2);
    });

    test('U-03 boundary: 11 invalid, 12 valid, 128 valid, 129 invalid', () {
      expect(PasswordRules.validate('a' * 11).tooShort, true);
      expect(PasswordRules.validate('a' * 12).isValid, true);
      expect(PasswordRules.validate('a' * 128).isValid, true);
      expect(PasswordRules.validate('a' * 129).tooLong, true);
    });

    test('confirm mismatch: matchesConfirm false, isValid false', () {
      const good = 'Password-1234';
      final v = PasswordRules.validate(good, confirm: 'Other-123456');
      expect(v.matchesConfirm, false);
      expect(v.isValid, false);
    });

    test('confirm match: matchesConfirm true, isValid true', () {
      const good = 'Password-1234';
      final v = PasswordRules.validate(good, confirm: good);
      expect(v.isValid, true);
      expect(v.matchesConfirm, true);
    });

    test('null confirm: only length checked', () {
      expect(PasswordRules.validate('').tooShort, true);
      expect(PasswordRules.validate('a' * 12).isValid, true);
    });

    test('min/max constants match contract', () {
      expect(PasswordRules.minLength, 12);
      expect(PasswordRules.maxLength, 128);
    });
  });
}
