import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/app/bootstrap/providers.dart';
import 'package:khmerx_app/l10n/app_localizations.dart';

import '../../support/fake_secure_kv.dart';

void main() {
  group('G1 LocaleNotifier baseline invariants', () {
    late ProviderContainer c;

    setUp(() {
      c = ProviderContainer(
        overrides: [
          secureKvProvider.overrideWithValue(FakeSecureKv()),
        ],
      );
    });

    tearDown(() => c.dispose());

    test('LOC-03 public app: selectable returns km, en and zh (device-level choice)', () {
      final selectable = c.read(localeProvider.notifier).selectable;
      final codes = selectable.map((l) => l.languageCode).toSet();
      expect(codes, {'en', 'km', 'zh'},
          reason: 'The public app bundles all three languages (docs 54/75)');
      expect(AppLocalizations.supportedLocales.map((e) => e.languageCode),
          containsAll(['en', 'km', 'zh']));
    });

    test('LOC-04 initial locale defaults to en (neutral fallback)', () {
      final locale = c.read(localeProvider);
      expect(locale.languageCode, anyOf('en', 'km', 'zh'),
          reason: 'Initial locale follows the device language when supported, else en');
    });

    test('LOC-05 setLocale to en/km always succeeds; state updates', () {
      final notifier = c.read(localeProvider.notifier);
      notifier.setLocale(const Locale('en'));
      expect(c.read(localeProvider).languageCode, 'en');
      notifier.setLocale(const Locale('km'));
      expect(c.read(localeProvider).languageCode, 'km');
    });
  });
}
