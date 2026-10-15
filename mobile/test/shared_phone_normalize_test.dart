import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/features/kyc/domain/kyc_schema.dart';
import 'package:khmerx_app/shared/utils/regexp.dart';

void main() {
  group('Cambodian local phone numbers', () {
    test('a leading 0 means +855', () {
      expect(KhmerXRegexp.normalizePhone('087654321'), '+85587654321');
      expect(KhmerXRegexp.normalizePhone('087 654 321'), '+85587654321');
      expect(KhmerXRegexp.normalizePhone('012-345-678'), '+85512345678');
    });

    test('international forms are kept or completed', () {
      expect(KhmerXRegexp.normalizePhone('+85587654321'), '+85587654321');
      expect(KhmerXRegexp.normalizePhone('0085587654321'), '+85587654321');
      expect(KhmerXRegexp.normalizePhone('85587654321'), '+85587654321');
      expect(KhmerXRegexp.normalizePhone('+1 (202) 555-0125'), '+12025550125');
    });

    test('junk stays invalid', () {
      expect(KhmerXRegexp.phoneInternational.hasMatch(KhmerXRegexp.normalizePhone('12345')), isFalse);
      expect(KhmerXRegexp.phoneInternational.hasMatch(KhmerXRegexp.normalizePhone('0123')), isFalse);
      expect(KhmerXRegexp.normalizePhone(''), '');
    });

    test('KYC treats 0xx and +855xx as the same number', () {
      final values = {'contact1Phone': '087654321', 'contact2Phone': '+85587654321'};
      expect(kycFieldIssue(values, 'contact1Phone'), isNull);
      expect(kycFieldIssue(values, 'contact2Phone'), KycProblemKind.duplicatePhone);
      expect(kycFieldIssue({'contact1Phone': '087654321'}, 'contact1Phone'), isNull);
    });
  });
}
