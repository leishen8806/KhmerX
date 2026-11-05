import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:khmerx_app/app/bootstrap/providers.dart';
import 'package:khmerx_app/features/auth/presentation/auth_placeholder.dart';
import 'package:khmerx_app/l10n/app_localizations.dart';

import '../../support/fake_secure_kv.dart';

void main() {
  testWidgets('phone auth copy is localized without Telegram wording', (tester) async {
    const locales = [Locale('en'), Locale('zh'), Locale('km')];
    for (final locale in locales) {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [secureKvProvider.overrideWithValue(FakeSecureKv())],
          child: MaterialApp(
            locale: locale,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: const PhoneConsentPage(),
          ),
        ),
      );
      await tester.pump();
      expect(find.textContaining('Telegram'), findsNothing);
      final l10n = await AppLocalizations.delegate.load(locale);
      expect(find.text(l10n.authPhoneVerificationTitle), findsOneWidget);
      expect(find.text(l10n.authConsentPhoneCode), findsOneWidget);
    }
  });

  testWidgets('UI-FIX-6 groups phone OTP form controls in one FormSection', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [secureKvProvider.overrideWithValue(FakeSecureKv())],
        child: const MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: PhoneConsentPage(),
        ),
      ),
    );
    await tester.pump();

    expect(find.byType(FormSection), findsOneWidget);
    expect(
      find.ancestor(of: find.byType(TextField), matching: find.byType(FormSection)),
      findsOneWidget,
    );
    expect(
      find.ancestor(of: find.byType(CheckboxListTile), matching: find.byType(FormSection)),
      findsOneWidget,
    );
    expect(
      find.ancestor(of: find.byType(FilledButton), matching: find.byType(FormSection)),
      findsOneWidget,
    );
    expect(tester.getSize(find.byType(FilledButton)).height, greaterThanOrEqualTo(48));
  });
}
