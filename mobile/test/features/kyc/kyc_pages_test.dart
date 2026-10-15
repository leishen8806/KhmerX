import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/app/bootstrap/providers.dart';
import 'package:khmerx_app/core/error/failure.dart';
import 'package:khmerx_app/core/session/company_id.dart';
import 'package:khmerx_app/core/util/either.dart';
import 'package:khmerx_app/features/kyc/data/kyc_repository.dart';
import 'package:khmerx_app/features/kyc/domain/kyc_case.dart';
import 'package:khmerx_app/features/kyc/domain/kyc_options.dart';
import 'package:khmerx_app/features/kyc/domain/kyc_schema.dart';
import 'package:khmerx_app/features/kyc/presentation/kyc_controller.dart';
import 'package:khmerx_app/features/kyc/presentation/kyc_pages.dart';
import 'package:khmerx_app/l10n/app_localizations.dart';

import '../../support/fake_secure_kv.dart';

class _FakeRepo implements KycRepository {
  _FakeRepo(this.kycCase);
  final KycCase kycCase;

  @override
  Future<Either<AppFailure, KycCase>> fetch(CompanyId id) async => Right(kycCase);

  @override
  Future<Either<AppFailure, KycCase>> save(
    CompanyId id, {
    required int revision,
    required Map<String, String> values,
    required Map<String, KycFileRef> files,
    required bool consent,
    required bool submit,
  }) async =>
      Right(kycCase);

  @override
  Future<Either<AppFailure, KycFileRef>> upload(
    CompanyId id, {
    required String slot,
    required Uint8List bytes,
  }) async =>
      Right(KycFileRef(id: 'f', slot: slot));

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

KycCase _case(KycCaseStatus status, {String? reason}) => KycCase(
      id: 'c',
      revision: 1,
      status: status,
      values: const {'surname': 'SOK'},
      files: const {},
      consent: false,
      declarationVersion: kKycConsentVersion,
      phoneVerified: true,
      ruleVersion: kKycRuleVersion,
      reviewReason: reason,
    );

Future<void> _pump(
  WidgetTester tester, {
  required Widget page,
  required Locale locale,
  required KycCase kycCase,
}) async {
  final container = ProviderContainer(overrides: [
    secureKvProvider.overrideWithValue(FakeSecureKv()),
    kycRepositoryProvider.overrideWithValue(_FakeRepo(kycCase)),
    // Read the bundled options from disk: deterministic in widget tests.
    kycOptionsProvider.overrideWith(
      (ref) => KycOptions.parse(File('assets/kyc/options.json').readAsStringSync()),
    ),
  ]);
  addTearDown(container.dispose);
  tester.view.physicalSize = const Size(1080, 6000);
  tester.view.devicePixelRatio = 2.5;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(UncontrolledProviderScope(
    container: container,
    child: MaterialApp(
      locale: locale,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      home: page,
    ),
  ));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 100));
  await tester.pump(const Duration(milliseconds: 200));
}

final _internalKey = RegExp(r'kyc[A-Z][A-Za-z]+_|error\.[a-z_]+\.[a-z_]+');

List<String> _texts(WidgetTester tester) => find
    .byType(Text)
    .evaluate()
    .map((e) => (e.widget as Text).data ?? '')
    .where((t) => t.isNotEmpty)
    .toList();

void main() {
  for (final lang in ['en', 'km', 'zh']) {
    group('P2 KYC pages · $lang', () {
      testWidgets('KYC-W-01 overview: status, reviewer note, 5 sections, no internal keys',
          (tester) async {
        await _pump(
          tester,
          page: const KycOverviewPage(),
          locale: Locale(lang),
          kycCase: _case(KycCaseStatus.needsInfo, reason: 'Photo is blurry'),
        );
        final l = await AppLocalizations.delegate.load(Locale(lang));
        expect(find.text(l.kycStatusNeedsInfo), findsOneWidget);
        expect(find.text('Photo is blurry'), findsOneWidget);
        for (final s in KycSection.values) {
          expect(find.textContaining(_sectionTitle(l, s)), findsWidgets, reason: s.name);
        }
        for (final t in _texts(tester)) {
          expect(_internalKey.hasMatch(t), isFalse, reason: t);
        }
        expect(tester.takeException(), isNull);
      });

      testWidgets('KYC-W-02 identity section renders localized labels and upload tiles',
          (tester) async {
        await _pump(
          tester,
          page: const KycSectionPage(sectionId: 'identity'),
          locale: Locale(lang),
          kycCase: _case(KycCaseStatus.draft),
        );
        final l = await AppLocalizations.delegate.load(Locale(lang));
        // Floating input labels can be reported as offstage by the finder.
        expect(find.textContaining(l.kycField_surname, skipOffstage: false), findsWidgets);
        // One short step at a time: the ID photos are on the last step.
        expect(find.text(l.kycStepProgress('1', '4')), findsOneWidget);
        expect(find.text(l.kycSlot_idFront), findsNothing);
        expect(find.text(l.kycNext), findsOneWidget);
        await tester.tap(find.text(l.kycNext));
        await tester.pump();
        // Required answers are missing: stay on the step and say so.
        expect(find.text(l.kycStepProgress('1', '4')), findsOneWidget);
        expect(find.text(l.kycFieldRequired, skipOffstage: false), findsWidgets);
        for (final t in _texts(tester)) {
          expect(_internalKey.hasMatch(t), isFalse, reason: t);
          expect(kKycFields.any((f) => f.id == t), isFalse, reason: 'raw field id shown: $t');
        }
        expect(tester.takeException(), isNull);
      });

      testWidgets('KYC-W-05 contact phone: number keypad by default, one tap to the full keyboard',
          (tester) async {
        await _pump(
          tester,
          page: const KycSectionPage(sectionId: 'contacts'),
          locale: Locale(lang),
          kycCase: _case(KycCaseStatus.draft),
        );
        final l = await AppLocalizations.delegate.load(Locale(lang));
        TextInputType phoneType() {
          final f = tester
              .widgetList<TextField>(find.byType(TextField, skipOffstage: false))
              .where((t) => t.keyboardType == TextInputType.phone || t.keyboardType == TextInputType.text)
              .toList();
          return f.firstWhere((t) => t.decoration?.suffixIcon != null).keyboardType;
        }

        expect(phoneType(), TextInputType.phone);
        await tester.tap(find.byTooltip(l.kycSwitchKeyboard).first);
        await tester.pump();
        expect(phoneType(), TextInputType.text);
      });

      testWidgets('KYC-W-03 locked (submitted) case shows the lock note and no save button',
          (tester) async {
        await _pump(
          tester,
          page: const KycSectionPage(sectionId: 'bank'),
          locale: Locale(lang),
          kycCase: _case(KycCaseStatus.submitted),
        );
        final l = await AppLocalizations.delegate.load(Locale(lang));
        expect(find.text(l.kycLockedNote), findsWidgets);
        expect(find.text(l.kycSaveDraft), findsNothing);
      });

      testWidgets('KYC-W-04 consent section shows the placeholder-legal notice', (tester) async {
        await _pump(
          tester,
          page: const KycSectionPage(sectionId: 'consent'),
          locale: Locale(lang),
          kycCase: _case(KycCaseStatus.draft),
        );
        final l = await AppLocalizations.delegate.load(Locale(lang));
        expect(find.text(l.kycConsentBody), findsOneWidget);
        expect(find.text(l.kycConsentNotice), findsOneWidget);
      });
    });
  }
}

String _sectionTitle(AppLocalizations l, KycSection s) => switch (s) {
      KycSection.identity => l.kycSection_identity,
      KycSection.contacts => l.kycSection_contacts,
      KycSection.employment => l.kycSection_employment,
      KycSection.bank => l.kycSection_bank,
      KycSection.consent => l.kycSection_consent,
    };
