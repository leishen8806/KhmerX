import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/features/auth/domain/auth_gate_state.dart';

void main() {
  group('AuthPreflightSnapshot.enabledLanguageCodes (zh=false guard)', () {
    test('LANG-01 zh=false filtered out; en/km kept when enabled', () {
      const snap = AuthPreflightSnapshot(
        company: 'PayEase',
        authenticated: false,
        languages: {'en': true, 'km': true, 'zh': false},
      );
      final codes = snap.enabledLanguageCodes();
      expect(codes, contains('en'));
      expect(codes, contains('km'));
      expect(codes, isNot(contains('zh')));
    });

    test('LANG-02 zh=true included when server enables it', () {
      const snap = AuthPreflightSnapshot(
        languages: {'en': true, 'km': true, 'zh': true},
      );
      final codes = snap.enabledLanguageCodes();
      expect(codes, containsAll(['en', 'km', 'zh']));
    });

    test('LANG-03 empty languages map falls back to en+km default', () {
      expect(
        const AuthPreflightSnapshot().enabledLanguageCodes(),
        ['en', 'km'],
      );
    });

    test('LANG-04 all false values fall back to en+km default', () {
      const snap = AuthPreflightSnapshot(languages: {'zh': false});
      expect(snap.enabledLanguageCodes(), ['en', 'km']);
    });

    test('LANG-05 only zh=true → includes zh (also en/km default fallback not used when non-empty true set)',
        () {
      const snap = AuthPreflightSnapshot(
        languages: {'en': false, 'km': false, 'zh': true},
      );
      final codes = snap.enabledLanguageCodes();
      expect(codes, contains('zh'));
    });

    test('LANG-06 additional unknown language tag preserved when true', () {
      const snap = AuthPreflightSnapshot(
        languages: {'en': true, 'km': true, 'fr': true, 'zh': false},
      );
      final codes = snap.enabledLanguageCodes();
      expect(codes, containsAll(['en', 'km', 'fr']));
      expect(codes, isNot(contains('zh')));
    });
  });
}
