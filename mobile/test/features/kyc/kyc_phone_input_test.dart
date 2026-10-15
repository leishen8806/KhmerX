import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/features/kyc/presentation/kyc_pages.dart';

TextEditingValue _run(String text) => const KycPhoneInputFormatter()
    .formatEditUpdate(TextEditingValue.empty, TextEditingValue(text: text));

void main() {
  group('P2 KYC phone input', () {
    test('KYC-P-01 digits and + pass through unchanged', () {
      expect(_run('+85512345678').text, '+85512345678');
    });

    test('KYC-P-02 full-width characters from CJK input methods become ASCII', () {
      // U+FF0B (full-width plus), U+FF18 U+FF15 U+FF15 (full-width 8 5 5).
      expect(_run('＋８５５').text, '+855');
    });

    test('KYC-P-03 letters and symbols are dropped, length is capped at 20', () {
      expect(_run('ab+85 5-1x').text, '+85 5-1');
      expect(_run('1' * 40).text.length, 20);
    });
  });
}
