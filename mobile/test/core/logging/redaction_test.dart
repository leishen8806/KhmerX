import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/core/logging/redaction_policy.dart';

void main() {
  group('Secrets redacted', () {
    test('password field becomes [REDACTED]', () {
      final out = RedactionPolicy.redactMap({'password': 'Secret123'});
      expect(out['password'], equals('[REDACTED]'));
    });

    test('otp/code field becomes [REDACTED]', () {
      final out = RedactionPolicy.redactMap({'otp': '123456', 'code': '654321'});
      expect(out['otp'], equals('[REDACTED]'));
      expect(out['code'], equals('[REDACTED]'));
    });

    test('cookie/header becomes [REDACTED]', () {
      final out = RedactionPolicy.redactMap({
        'Cookie': 'session=abc',
        'Authorization': 'Bearer xyz',
      });
      expect(out['Cookie'], equals('[REDACTED]'));
      expect(out['Authorization'], equals('[REDACTED]'));
    });

    test('full phone number is masked as ***last4', () {
      const raw = 'contact my admin at 85512345678 thank you';
      final out = RedactionPolicy.redactMessage(raw);
      expect(out, contains('***5678'));
      expect(out, isNot(contains('85512345678')));
    });

    test('hex64 token is masked as [hex64] or [REDACTED]', () {
      final token = 'a' * 64;
      final out = RedactionPolicy.redactMessage('token=$token');
      expect(out, anyOf(contains('[hex64]'), contains('[REDACTED]')));
      expect(out, isNot(contains(token)));
    });

    test('signature/id fields become [REDACTED]', () {
      final out = RedactionPolicy.redactMap({
        'signature': 'SGVsbG8=',
        'idFront': 'image bytes',
        'idBack': 'more bytes',
        'selfie': 'face bytes',
      });
      expect(out['signature'], equals('[REDACTED]'));
      expect(out['idFront'], equals('[REDACTED]'));
      expect(out['idBack'], equals('[REDACTED]'));
      expect(out['selfie'], equals('[REDACTED]'));
    });

    test('nested map recursively redacts', () {
      final out = RedactionPolicy.redactMap({
        'outer': <String, dynamic>{'password': 'DeepSecret'},
      });
      final nested = out['outer'] as Map<String, dynamic>;
      expect(nested['password'], equals('[REDACTED]'));
    });

    test('non-blacklisted plain fields retained', () {
      final out = RedactionPolicy.redactMap({
        'companyId': 't_1234',
        'pageSize': 10,
      });
      expect(out['companyId'], equals('t_1234'));
      expect(out['pageSize'], equals(10));
    });
  });
}
