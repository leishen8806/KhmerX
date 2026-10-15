import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/l10n/app_localizations.dart';
import 'package:khmerx_app/app/theme/khmerx_theme.dart';

void main() {
  group('P1-05 — Localization (l10n)', () {
    Widget buildFor(Locale l) {
    return MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: l,
        theme: KhmerXTheme.light(),
        home: const LocalizationsTestHome(),
    );
  }

    testWidgets('en locale: AppLocalizations loads without crash', (tester) async {
      await tester.pumpWidget(buildFor(const Locale('en')));
      await tester.pumpAndSettle();
      expect(find.textContaining('KhmerX'), findsWidgets);
    });

    testWidgets('km locale: AppLocalizations loads without crash (Khmer enabled)', (tester) async {
      await tester.pumpWidget(buildFor(const Locale('km')));
      await tester.pumpAndSettle();
      expect(Localizations.localeOf(tester.element(find.byType(LocalizationsTestHome))),
          equals(const Locale('km')),);
    });

    test('supportedLocales contains at least en + km', () {
      final codes = AppLocalizations.supportedLocales.map((e) => e.languageCode).toSet();
      expect(codes, containsAll(<String>['en', 'km']));
    });
  });
}

class LocalizationsTestHome extends StatelessWidget {
  const LocalizationsTestHome({super.key});
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('KhmerX')),
      body: Text(l10n.appName),
    );
  }
}
