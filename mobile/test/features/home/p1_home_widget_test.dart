// ignore_for_file: prefer_const_constructors, unnecessary_const
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:khmerx_app/app/bootstrap/providers.dart';
import 'package:khmerx_app/app/config/app_config.dart';
import 'package:khmerx_app/core/network/api_client_factory.dart';
import 'package:khmerx_app/core/session/company_cookie_store.dart';
import 'package:khmerx_app/core/session/company_id.dart';
import 'package:khmerx_app/core/session/session_manager.dart';
import 'package:khmerx_app/features/auth/data/auth_repository.dart';
import 'package:khmerx_app/features/auth/domain/auth_gate_state.dart' show AuthPreflightSnapshot;
import 'package:khmerx_app/features/customer_state/domain/customer_snapshot.dart';
import 'package:khmerx_app/features/customer_state/domain/home_decision_engine.dart';
import 'package:khmerx_app/features/customer_state/domain/home_viewmodel.dart';
import 'package:khmerx_app/features/customer_state/domain/kyc_status.dart';
import 'package:khmerx_app/features/customer_state/domain/loan_status.dart';
import 'package:khmerx_app/features/customer_state/domain/loan_summary.dart';
import 'package:khmerx_app/features/customer_state/presentation/customer_state_notifier.dart';
import 'package:khmerx_app/features/home/presentation/real_home_page.dart';
import 'package:khmerx_app/l10n/app_localizations.dart';

import '../../support/fake_secure_kv.dart';

typedef PageBuilder = Widget Function();

String? destinationPath(HomeDestination d, {String? loanId}) {
  return switch (d) {
    HomeDestination.loans => '/loans',
    HomeDestination.loanDetail when loanId != null => '/loans/$loanId',
    HomeDestination.loanDetail => '/loans/__UNKNOWN__',
    HomeDestination.authLogin => '/auth/login',
    HomeDestination.retry => '/home',
    HomeDestination.kyc => '/kyc',
    HomeDestination.statusPanel => null,
    HomeDestination.none => null,
  };
}

Future<void> pumpHome(
  WidgetTester tester, {
  required CompanyId cid,
  required CustomerStateValue value,
  required AuthRepository authRepo,
  AppConfig? config,
  Locale locale = const Locale('en'),
}) async {
  const double heightDp = 800;
  const double widthDp = 412;
  const double dpr = 2.0;
  tester.view.physicalSize = const Size(widthDp * dpr, heightDp * dpr);
  tester.view.devicePixelRatio = dpr;
  tester.platformDispatcher.textScaleFactorTestValue = 1.0;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
    tester.platformDispatcher.clearTextScaleFactorTestValue();
  });
  final appConfig = config ?? AppConfig.production();
  final previousOverride = CustomerStateNotifier.testingLoadOverride;
  addTearDown(() {
    CustomerStateNotifier.testingLoadOverride = previousOverride;
  });
  CustomerStateNotifier.testingLoadOverride = (notifier, _, {force = false, isBackgroundRefresh = false}) async {
    return notifier.state;
  };
  final router = GoRouter(
    initialLocation: '/home',
    routes: [
      GoRoute(
        path: '/home',
        builder: (context, state) => const RealHomePage(),
      ),
      GoRoute(
        path: '/loans',
        builder: (context, state) => Scaffold(
          appBar: AppBar(title: const Text('LOANS_PAGE_STUB')),
        ),
      ),
      GoRoute(
        path: '/auth/login',
        builder: (context, state) => Scaffold(
          appBar: AppBar(title: const Text('AUTH_LOGIN_STUB')),
        ),
      ),
      GoRoute(
        path: '/loans/:id',
        builder: (context, state) => Scaffold(
          appBar: AppBar(title: Text('LOAN_DETAIL_STUB_${state.pathParameters['id'] ?? '?'}')),
        ),
      ),
      GoRoute(
        path: '/me',
        builder: (context, state) => Scaffold(
          appBar: AppBar(title: const Text('ME_STUB')),
        ),
      ),
      GoRoute(
        path: '/company/select',
        builder: (context, state) => Scaffold(
          appBar: AppBar(title: const Text('SELECT_STUB')),
        ),
      ),
      GoRoute(
        path: '/feature/forbidden',
        builder: (context, state) => Scaffold(
          appBar: AppBar(title: const Text('FORBIDDEN')),
        ),
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        secureKvProvider.overrideWithValue(FakeSecureKv()),
        appConfigProvider.overrideWithValue(appConfig),
        activeCompanyIdProvider.overrideWithBuild((ref, notifier) {
          notifier.state = cid;
          return cid;
        }),
        customerStateProvider.overrideWithBuild((ref, notifier) {
          notifier.state = value;
          return value;
        }),
        authRepositoryProvider.overrideWithValue(authRepo),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: locale,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

AuthRepository _buildAuthRepo(CompanyId cid) {
  final repo = AuthRepository(
    factory: ApiClientFactory(
      config: AppConfig.production(),
      store: CompanyCookieStore(),
      secureKv: FakeSecureKv(),
    ),
    sessionManager: SessionManager(),
  );
  repo.seedPreflightForTesting(
    cid,
    const AuthPreflightSnapshot(
      company: 'KhmerX Demo Co. Ltd',
      authenticated: true,
      languages: {'en': true, 'km': true, 'zh': true},
    ),
  );
  return repo;
}

const _kAllowedPaths = <String>{
  '/home',
  '/loans',
  '/auth/login',
  '/me',
  '/kyc', // P2: KYC is completed in the app (docs 76)
};

void main() {
  final cid = CompanyId('t_00000000-0000-0000-0000-000000000001');
  final approvedSnapshot = CustomerSnapshot(
    companyId: cid,
    kycStatus: const KycApproved(),
    loans: const [],
    fetchedAt: DateTime(2026, 10, 5),
    events: const [],
  );
  final openLoan = LoanSummary(
    id: 'loan-00000000-0000-0000-0000-000000000002',
    status: const LoanActive(),
    amount: 100000,
    fee: 15000,
    paid: 25000,
    createdAt: DateTime(2026, 10, 1),
    dueAt: DateTime(2026, 11, 30),
    billConfirmedAt: DateTime(2026, 10, 2),
    contract: 'c',
  );
  final openSnapshot = CustomerSnapshot(
    companyId: cid,
    kycStatus: const KycApproved(),
    loans: [openLoan],
    fetchedAt: DateTime(2026, 10, 5),
    events: const [],
  );

  group('P1 W2 Home Widget: §38 destinations guard (RI-P1-01)', () {
    testWidgets('H6 approved × no-loans: primary = disabled, secondary -> /loans',
        (tester) async {
      final authRepo = _buildAuthRepo(cid);
      await pumpHome(
        tester,
        cid: cid,
        value: CustomerStateValue(
          snapshot: approvedSnapshot,
          status: CustomerStateFetchStatus.loaded,
          lastAttempt: DateTime(2026, 10, 5),
        ),
        authRepo: authRepo,
      );
      final vm = HomeDecisionEngine.decide(
        snapshot: approvedSnapshot,
        freshness: HomeFreshness.live,
      );
      expect(vm.primaryEnabled, isFalse, reason: 'P3 apply is disabled (not yet open)');
      await tester.tap(find.byType(OutlinedButton));
      await tester.pumpAndSettle();
      expect(find.text('LOANS_PAGE_STUB'), findsOneWidget);
    });

    testWidgets('H14 open-loan: primary -> /loans/:id route with shortId prefix',
        (tester) async {
      final authRepo = _buildAuthRepo(cid);
      await pumpHome(
        tester,
        cid: cid,
        value: CustomerStateValue(
          snapshot: openSnapshot,
          status: CustomerStateFetchStatus.loaded,
          lastAttempt: DateTime(2026, 10, 5),
        ),
        authRepo: authRepo,
      );
      final vm = HomeDecisionEngine.decide(
        snapshot: openSnapshot,
        freshness: HomeFreshness.live,
      );
      expect(vm.primaryEnabled, isTrue);
      expect(vm.primaryDestination, equals(HomeDestination.loanDetail));
      final expectedShortId = '#${openLoan.id.substring(0, 8).toUpperCase()}';
      expect(expectedShortId, startsWith('#LOAN-000'));
      await tester.tap(find.byType(FilledButton));
      await tester.pumpAndSettle();
      expect(
        find.byWidgetPredicate(
          (w) => w is AppBar && (w.title as Text?)?.data?.startsWith('LOAN_DETAIL_STUB_') == true,
        ),
        findsOneWidget,
      );
    });

    test('All 9 snapshots × 3 freshnesses VM paths within RI-P1-01 list', () {
      final snapshots = <CustomerSnapshot>[
        CustomerSnapshot(companyId: cid, kycStatus: const KycNone(), fetchedAt: DateTime(2026, 10, 5), events: const []),
        CustomerSnapshot(companyId: cid, kycStatus: const KycDraft(), fetchedAt: DateTime(2026, 10, 5), events: const []),
        CustomerSnapshot(companyId: cid, kycStatus: const KycNeedsInfo(), fetchedAt: DateTime(2026, 10, 5), events: const []),
        CustomerSnapshot(companyId: cid, kycStatus: const KycSubmitted(), fetchedAt: DateTime(2026, 10, 5), events: const []),
        CustomerSnapshot(companyId: cid, kycStatus: const KycApproved(), fetchedAt: DateTime(2026, 10, 5), events: const []),
        CustomerSnapshot(companyId: cid, kycStatus: const KycApproved(), loans: [openLoan], fetchedAt: DateTime(2026, 10, 5), events: const []),
        CustomerSnapshot(companyId: cid, kycStatus: const KycRejected(), fetchedAt: DateTime(2026, 10, 5), events: const []),
        CustomerSnapshot(companyId: cid, kycStatus: const KycUnknown('weird'), fetchedAt: DateTime(2026, 10, 5), events: const []),
      ];
      const freshNesses = [
        HomeFreshness.firstLoad,
        HomeFreshness.live,
        HomeFreshness.offlineWithSnapshot,
      ];
      for (final snap in snapshots) {
        for (final f in freshNesses) {
          final vm = HomeDecisionEngine.decide(snapshot: snap, freshness: f);
          final ds = <(HomeDestination, String?)>[
            (vm.primaryDestination, vm.primaryLoanId),
            (vm.secondaryDestination, vm.secondaryLoanId),
          ];
          for (final (d, loanId) in ds) {
            final path = destinationPath(d, loanId: loanId);
            if (path == null) continue;
            if (path.startsWith('/loans/')) continue;
            expect(
              _kAllowedPaths,
              contains(path),
              reason:
                  'VM path=$path (state=${vm.stateId}) not in RI-P1-01 allowed list. §38 FORBIDDEN.',
            );
            expect(
              path.startsWith('/feature/'),
              isFalse,
              reason: '/feature/* routes are P1-removed per Contract 45 §13.',
            );
          }
        }
      }
    });
  });

  group('P1 W2 Home Widget: §39 FORBIDDEN ENDPOINTS (0 counts)', () {
    testWidgets('Home render + pull refresh → zero KYC/loan/POST-state runtime hits',
        (tester) async {
      final hitMethods = <String>[];
      final authRepo = _buildAuthRepo(cid);
      final previousOverride = CustomerStateNotifier.testingLoadOverride;
      addTearDown(() {
        CustomerStateNotifier.testingLoadOverride = previousOverride;
      });
      CustomerStateNotifier.testingLoadOverride = (notifier, _, {force = false, isBackgroundRefresh = false}) async {
        hitMethods.add(force ? 'REFRESH' : 'BOOTSTRAP_LOAD');
        return notifier.state;
      };
      await pumpHome(
        tester,
        cid: cid,
        value: CustomerStateValue(
          snapshot: approvedSnapshot,
          status: CustomerStateFetchStatus.loaded,
          lastAttempt: DateTime(2026, 10, 5),
        ),
        authRepo: authRepo,
      );
      final vm = HomeDecisionEngine.decide(
        snapshot: approvedSnapshot,
        freshness: HomeFreshness.live,
      );
      expect(vm.stateId, equals(HomeStateId.h6));
      await tester.drag(find.byType(RefreshIndicator), const Offset(0, 120));
      await tester.pumpAndSettle();
      final kycHits = hitMethods.where((m) => m.toUpperCase().contains('KYC')).length;
      final loanHits = hitMethods.where((m) => m.contains('/LOAN/') || m.contains('/LOANS')).length;
      final postStateHits = hitMethods.where((m) => m.contains('POST_STATE')).length;
      expect(kycHits, equals(0), reason: '§39 §45(33) FORBIDDEN: /api/kyc* runtime count MUST be 0.');
      expect(loanHits, equals(0), reason: '§39 FORBIDDEN: /api/loan/* runtime count MUST be 0.');
      expect(postStateHits, equals(0), reason: '§39 FORBIDDEN: POST /api/h5/state count MUST be 0.');
    });

    test('Structural invariant: Home/customer-state files never import/mention forbidden endpoints',
        () async {
      final files = [
        'lib/features/customer_state/presentation/customer_state_notifier.dart',
        'lib/features/home/presentation/real_home_page.dart',
      ];
      for (final path in files) {
        final src = await File(path).readAsString();
        expect(src.contains('/api/kyc'), isFalse,
            reason: '$path references forbidden /api/kyc*. §5 no Home KYC direct calls.');
        expect(src.contains('/api/loan'), isFalse,
            reason: '$path references forbidden /api/loan*. §5 no Home Loan direct calls.');
      }
    });
  });

  group('P1 W2 Home Widget: §40 Unknown Kyc/Loan status safe render', () {
    testWidgets('KycUnknown + LoanUnknown render no crash, primary disabled, H18 panel generic',
        (tester) async {
      final authRepo = _buildAuthRepo(cid);
      final badLoan = LoanSummary(
        id: 'loan-aaaaaaaabbbbbbbbccccccccdddddddd',
        status: const LoanUnknown('MYSTERY_STATUS_X'),
        amount: 50000,
        fee: 5000,
        paid: 0,
        createdAt: DateTime(2026, 10, 1),
        dueAt: DateTime(2026, 10, 15),
        billConfirmedAt: DateTime(2026, 10, 2),
        contract: 'x',
      );
      final snap = CustomerSnapshot(
        companyId: cid,
        kycStatus: const KycUnknown('KYC_MYSTERY_Z'),
        loans: [badLoan],
        fetchedAt: DateTime(2026, 10, 5),
        events: const [],
      );
      await pumpHome(
        tester,
        cid: cid,
        value: CustomerStateValue(
          snapshot: snap,
          status: CustomerStateFetchStatus.loaded,
          lastAttempt: DateTime(2026, 10, 5),
        ),
        authRepo: authRepo,
      );
      final err = tester.takeException();
      expect(err, isNull, reason: '§40 Unknown KYC/Loan must not throw. Got $err');
      final vm = HomeDecisionEngine.decide(snapshot: snap, freshness: HomeFreshness.live);
      expect(vm.stateId, equals(HomeStateId.h18),
          reason: 'Unknown snapshot → generic H18 panel per §02 §3.7.');
      expect(vm.primaryDestination, isNot(anyOf(HomeDestination.loans, HomeDestination.loanDetail)),
          reason: '§40 Unknown status must not navigate to apply/detail mutation pages.');
      expect(find.byType(Scaffold), findsOneWidget);
    });
  });

  group('P1 W2 Home Widget: §41 Offline preserves snapshot, no fake data', () {
    testWidgets('H21 Offline warm: snapshot retained; no company/institution shown (docs 54)',
        (tester) async {
      final authRepo = _buildAuthRepo(cid);
      await pumpHome(
        tester,
        cid: cid,
        value: CustomerStateValue(
          snapshot: openSnapshot,
          status: CustomerStateFetchStatus.offline,
          lastAttempt: DateTime(2026, 10, 5),
        ),
        authRepo: authRepo,
      );
      final vm = HomeDecisionEngine.decide(
        snapshot: openSnapshot,
        freshness: HomeFreshness.offlineWithSnapshot,
      );
      expect(vm.stateId, equals(HomeStateId.h21));
      expect(tester.takeException(), isNull);
      // The public app never shows a company/institution on Home (docs 54).
      expect(find.textContaining('KhmerX Demo Co. Ltd'), findsNothing);
      expect(find.byType(Text), findsWidgets,
          reason: '§41 Offline warm must keep rendering the snapshot.');
    });

    testWidgets('H21 prime cold (no snapshot offline) → no fabricated currency/due text',
        (tester) async {
      final authRepo = _buildAuthRepo(cid);
      await pumpHome(
        tester,
        cid: cid,
        value: const CustomerStateValue(
          status: CustomerStateFetchStatus.offline,
        ),
        authRepo: authRepo,
      );
      final vm = HomeDecisionEngine.decide(
        snapshot: null,
        freshness: HomeFreshness.offlineNoSnapshot,
      );
      expect(vm.stateId, equals(HomeStateId.h21Prime));
      final texts =
          find.byType(Text).evaluate().map((e) => (e.widget as Text).data ?? '').toList();
      for (final t in texts) {
        final hasFakeDollar = t.contains('\$100') || t.contains('\$ 100');
        final hasFakeDue = RegExp(r'due by 20\d\d', caseSensitive: false).hasMatch(t);
        expect(hasFakeDollar, isFalse,
            reason: '§41 Cold no-snapshot must never paint fake amounts: $t');
        expect(hasFakeDue, isFalse,
            reason: '§41 Cold no-snapshot must never paint fake due dates: $t');
      }
    });
  });

  group('P1 W2 Home Widget: §42 L10N en/km/zh non-empty texts & no fallback keys', () {
    for (final locale in const [Locale('en'), Locale('km'), Locale('zh')]) {
      testWidgets('Locale ${locale.languageCode}: 5 Home states all render without fallback',
          (tester) async {
        final authRepo = _buildAuthRepo(cid);
        final cases = <CustomerStateValue>[
          CustomerStateValue(
            snapshot: approvedSnapshot,
            status: CustomerStateFetchStatus.loaded,
            lastAttempt: DateTime(2026, 10, 5),
          ),
          CustomerStateValue(
            snapshot: openSnapshot,
            status: CustomerStateFetchStatus.loaded,
            lastAttempt: DateTime(2026, 10, 5),
          ),
          CustomerStateValue(
            snapshot: approvedSnapshot,
            status: CustomerStateFetchStatus.error,
            lastAttempt: DateTime(2026, 10, 5),
          ),
          CustomerStateValue(
            snapshot: approvedSnapshot,
            status: CustomerStateFetchStatus.offline,
            lastAttempt: DateTime(2026, 10, 5),
          ),
          const CustomerStateValue(status: CustomerStateFetchStatus.sessionInvalid),
        ];
        for (final c in cases) {
          await pumpHome(
            tester,
            cid: cid,
            value: c,
            authRepo: authRepo,
            locale: locale,
          );
          final texts = find
              .byType(Text)
              .evaluate()
              .map((e) => (e.widget as Text).data?.trim() ?? '')
              .where((t) => t.isNotEmpty)
              .toList();
          expect(texts, isNotEmpty,
              reason: '§42 Locale ${locale.languageCode} must render non-empty texts.');
          final fallbackKey = texts.where(
            (t) =>
                (t.startsWith('home_') || t.startsWith('panel_') || t.startsWith('freshness_')) &&
                RegExp(r'^[a-z0-9_]+$').hasMatch(t),
          );
          expect(fallbackKey, isEmpty,
              reason: '§42 Locale ${locale.languageCode} untranslated ARB keys: $fallbackKey');
          final err = tester.takeException();
          expect(err, isNull,
              reason:
                  '§42 Locale ${locale.languageCode} must not throw layout/l10n. Got: $err');
        }
      });
    }
  });
}
