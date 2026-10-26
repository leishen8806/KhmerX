import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:dio/dio.dart';

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
import 'package:khmerx_app/features/kyc/domain/kyc_requests.dart';
import 'package:khmerx_app/features/kyc/presentation/kyc_labels.dart';
import 'package:khmerx_app/features/kyc/domain/kyc_options.dart';
import 'package:khmerx_app/features/kyc/domain/kyc_schema.dart';
import 'package:khmerx_app/features/kyc/presentation/kyc_controller.dart';
import 'package:khmerx_app/features/kyc/presentation/kyc_pages.dart';
import 'package:khmerx_app/l10n/app_localizations.dart';

import '../../support/fake_secure_kv.dart';
import 'upload_retry_test.dart' as wire;

class _FakeRepo implements KycRepository {
  _FakeRepo(this.kycCase);
  final KycCase kycCase;
  bool retryUploads = false;
  int uploadCalls = 0;
  AppFailure? uploadFailure;
  KycRepository? network;
  CancelToken? token;

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
    CancelToken? cancelToken,
    void Function(int attempt, Duration delay)? onRetry,
  }) async {
    uploadCalls++;
    token = cancelToken;
    if (network != null) return network!.upload(id, slot: slot, bytes: bytes, cancelToken: cancelToken, onRetry: onRetry);
    if (uploadFailure != null) {return Left(uploadFailure!);}
    if (retryUploads) {
      onRetry?.call(1, const Duration(seconds: 1));
      await cancelToken!.whenCancel;
      return Left(UnknownFailure());
    }
    return Right(KycFileRef(id: 'f', slot: slot));
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Images implements KycImageSource {
  Completer<Uint8List?>? pending;
  int calls = 0;
  @override
  Future<Uint8List?> pick({required bool camera}) async {
    calls++;
    return pending == null ? Uint8List(16) : pending!.future;
  }
}

KycCase _case(KycCaseStatus status, {String? reason, Map<String, String>? values, List<KycRequest>? requests}) => KycCase(
      id: 'c',
      revision: 1,
      status: status,
      values: values ?? const {'surname': 'SOK'},
      files: const {},
      consent: false,
      declarationVersion: kKycConsentVersion,
      phoneVerified: true,
      ruleVersion: kKycRuleVersion,
      reviewReason: reason,
      requests: requests,
    );

Future<void> _pump(
  WidgetTester tester, {
  required Widget page,
  required Locale locale,
  required KycCase kycCase,
  KycRepository? repo,
}) async {
  final container = ProviderContainer(overrides: [
    secureKvProvider.overrideWithValue(FakeSecureKv()),
    kycRepositoryProvider.overrideWithValue(repo ?? _FakeRepo(kycCase)),
    kycImageSourceProvider.overrideWithValue(_Images()),
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
  for (final lang in ['zh','en','km']) {
    testWidgets('K4 exact material entry and safe localized reasons $lang', (tester) async {
      await _pump(tester, page: const KycSectionPage(sectionId: 'identity'), locale: Locale(lang),
          kycCase: _case(KycCaseStatus.needsInfo, requests: const [KycRequest('slot:idFront', 'blurred', 'ORIGINAL NOTE')]));
      final l = AppLocalizations.of(tester.element(find.byType(KycSectionPage)));
      expect(find.textContaining(kycRequestReason(l, 'blurred')), findsOneWidget);
      expect(find.textContaining('ORIGINAL NOTE'), findsOneWidget);
      expect(find.textContaining('slot:idFront'), findsNothing);
      expect(kycRequestReason(l, 'UNKNOWN_SECRET_KEY'), l.kycReasonOther);
      expect(find.byType(TextFormField), findsNothing);
    });
  }
  testWidgets('C3R T1 / C3R T3: pick reservation, cancellation and disposal', (tester) async {
    final adapter = wire.UploadAdapter(503), repo = _FakeRepo(_case(KycCaseStatus.draft));
    repo.network = await wire.repository(adapter);
    final images = _Images()..pending = Completer<Uint8List?>();
    final container = ProviderContainer(overrides: [
      kycRepositoryProvider.overrideWithValue(repo),
      kycImageSourceProvider.overrideWithValue(images),
    ]);
    final controller = container.read(kycControllerProvider.notifier);
    await controller.load();
    final first = controller.uploadSlot('idFront', camera: false);
    final second = controller.uploadSlot('idFront', camera: false);
    expect(images.calls, 1);
    images.pending!.complete(Uint8List(16));
    await wire.flush(tester);
    expect(adapter.bodies.length, 1);
    controller.cancelUpload('idFront');
    await first;await second;
    images.pending = Completer<Uint8List?>()..complete(null);
    await controller.uploadSlot('idFront', camera: false);
    images.pending = Completer<Uint8List?>();
    final failedPick = controller.uploadSlot('idFront', camera: false);
    images.pending!.completeError(StateError('synthetic picker failure'));
    await failedPick;
    images.pending = null;
    final next = controller.uploadSlot('idFront', camera: false);
    await wire.flush(tester);
    expect(container.read(kycControllerProvider).retrying, {'idFront'});
    container.dispose();
    expect(repo.token!.isCancelled, isTrue);
    await wire.flush(tester);
    await tester.pump(const Duration(minutes: 1));
    await wire.flush(tester);
    await next;
    expect(adapter.bodies.length, 2);
    expect(tester.takeException(), isNull);
  });
  for (final lang in ['en', 'km', 'zh']) {
    group('P2 KYC pages · $lang', () {
      testWidgets('C3 retry state and cancellation are localized', (tester) async {
        final c = _case(KycCaseStatus.draft, values: {for (final f in kKycFields.where((f) => f.section == KycSection.identity)) f.id: 'Synthetic'});
        final repo = _FakeRepo(c)..retryUploads = true;
        await _pump(tester, page: const KycSectionPage(sectionId: 'identity'), locale: Locale(lang), kycCase: c, repo: repo);
        final l = await AppLocalizations.delegate.load(Locale(lang));
        await tester.ensureVisible(find.text(l.kycChooseGallery).first);
        await tester.tap(find.text(l.kycChooseGallery).first);
        await tester.pump(const Duration(milliseconds: 100));
        expect(find.text(l.kycUploadRetrying), findsOneWidget);
        expect(find.text(l.kycUploadCancel), findsOneWidget);
        expect(repo.uploadCalls, 1);
        await tester.tap(find.text(l.kycUploadCancel));
        await tester.pump(const Duration(milliseconds: 100));
        expect(find.text(l.kycUploadRetrying), findsNothing);
        expect(find.text(l.kycUploadCancel), findsNothing);
        expect(find.text(l.kycUploaded), findsNothing);
        expect(repo.uploadCalls, 1);
        final state = ProviderScope.containerOf(tester.element(find.byType(KycSectionPage))).read(kycControllerProvider);
        expect(state.uploadFailures, isEmpty);
        expect(state.notice, isNull);
        expect(state.uploading, isEmpty);expect(state.retrying, isEmpty);expect(state.files, isEmpty);
        expect(find.text(l.errGeneric), findsNothing);
        expect(tester.takeException(), isNull);
        repo.uploadFailure = ServiceUnavailableFailure(statusCode: 503, requestId: 'synthetic-server-id');
        await tester.tap(find.text(l.kycChooseGallery).first);
        await tester.pump(const Duration(milliseconds: 100));
        expect(find.textContaining('synthetic-server-id'), findsOneWidget);
        expect(find.text(l.kycUploadRetrying), findsNothing);
        await tester.pump(const Duration(seconds: 5));
      });
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
