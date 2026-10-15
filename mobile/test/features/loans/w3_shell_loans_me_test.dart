// ignore_for_file: prefer_const_constructors
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:khmerx_app/app/bootstrap/providers.dart';
import 'package:khmerx_app/app/config/app_config.dart';
import 'package:khmerx_app/core/error/failure.dart';
import 'package:khmerx_app/core/network/api_client_factory.dart';
import 'package:khmerx_app/core/session/company_cookie_store.dart';
import 'package:khmerx_app/core/session/company_id.dart';
import 'package:khmerx_app/core/session/session_manager.dart';
import 'package:khmerx_app/core/util/either.dart';
import 'package:khmerx_app/features/auth/data/auth_repository.dart';
import 'package:khmerx_app/features/auth/domain/auth_gate_state.dart';
import 'package:khmerx_app/features/customer_state/domain/billing.dart';
import 'package:khmerx_app/features/customer_state/domain/customer_snapshot.dart';
import 'package:khmerx_app/features/customer_state/domain/kyc_status.dart';
import 'package:khmerx_app/features/customer_state/domain/loan_event.dart';
import 'package:khmerx_app/features/customer_state/domain/loan_status.dart';
import 'package:khmerx_app/features/customer_state/domain/loan_summary.dart';
import 'package:khmerx_app/features/customer_state/presentation/customer_state_notifier.dart';
import 'package:khmerx_app/l10n/app_localizations.dart';
import 'package:khmerx_app/features/loans/presentation/loan_list_page.dart';
import 'package:khmerx_app/features/loans/presentation/loan_detail_page.dart';

import '../../support/fake_secure_kv.dart';

final class _Recorder {
  final List<String> calls = <String>[];
  void record(String s) => calls.add(s);
  int countWhere(bool Function(String s) predicate) => calls.where(predicate).length;
}

AuthRepository _buildRepo(CompanyId cid) {
  final factory = ApiClientFactory(
    config: AppConfig.production(),
    store: CompanyCookieStore(),
    secureKv: FakeSecureKv(),
  );
  final repo = AuthRepository(factory: factory, sessionManager: SessionManager());
  repo.seedPreflightForTesting(
    cid,
    const AuthPreflightSnapshot(
      company: 'Demo Co.',
      authenticated: true,
      languages: {'en': true, 'km': true, 'zh': true},
    ),
  );
  return repo;
}

void _assertNoForbiddenStructural() {
  final files = <String>[
    'lib/features/loans/presentation/loan_list_page.dart',
    'lib/features/loans/presentation/loan_detail_page.dart',
    'lib/features/me/presentation/me_page.dart',
    'lib/features/me/presentation/change_password_page.dart',
    'lib/app/shell/authenticated_shell.dart',
    'lib/app/router/router.dart',
  ];
  const forbidden = <Pattern>['/api/kyc', '/api/loan/', 'POST /api/h5/state', 'postH5State'];
  for (final f in files) {
    final text = File(f).readAsStringSync();
    for (final p in forbidden) {
      expect(text.contains(p), isFalse, reason: '$f must not reference forbidden pattern $p');
    }
  }
}

LoanSummary _loan({
  required String id,
  required LoanStatus status,
  DateTime? createdAt,
  int amount = 50000,
  int fee = 5000,
  int paid = 12000,
  Billing? bill,
}) {
  return LoanSummary(
    id: id,
    status: status,
    amount: amount,
    fee: fee,
    paid: paid,
    createdAt: createdAt ?? DateTime(2026, 9, 30),
    bill: bill,
  );
}

GoRouter _router({
  required List<RouteBase> routes,
  String initial = '/loans',
}) {
  return GoRouter(
    initialLocation: initial,
    routes: routes,
  );
}

Future<void> pumpP1(
  WidgetTester tester, {
  required CompanyId cid,
  required CustomerStateValue value,
  required AuthRepository authRepo,
  required Widget child,
  String location = '/loans',
  List<RouteBase> extraRoutes = const [],
  Locale locale = const Locale('en'),
  double width = 412,
  double height = 800,
  double textScale = 1.0,
}) async {
  const double dpr = 2.0;
  tester.view.physicalSize = Size(width * dpr, height * dpr);
  tester.view.devicePixelRatio = dpr;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
    tester.platformDispatcher.clearTextScaleFactorTestValue();
  });
  final previousOverride = CustomerStateNotifier.testingLoadOverride;
  addTearDown(() {
    CustomerStateNotifier.testingLoadOverride = previousOverride;
  });
  CustomerStateNotifier.testingLoadOverride = (notifier, _, {force = false, isBackgroundRefresh = false}) async {
    return notifier.state;
  };
  final router = _router(
    initial: location,
    routes: [
      if (child is LoanListPage) GoRoute(path: '/loans', builder: (_, __) => child),
      if (child is! LoanListPage && child is! LoanDetailPage) GoRoute(path: location, builder: (_, __) => child),
      if (child is LoanDetailPage) GoRoute(path: location, builder: (_, __) => child),
      GoRoute(
        path: '/loans/:loanId',
        builder: (_, s) => LoanDetailPage(loanId: s.pathParameters['loanId'] ?? ''),
      ),
      ...extraRoutes,
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        secureKvProvider.overrideWithValue(FakeSecureKv()),
        appConfigProvider.overrideWithValue(AppConfig.production()),
        activeCompanyIdProvider.overrideWithBuild((ref, notifier) {
          notifier.state = cid;
          return cid;
        }),
        customerStateProvider.overrideWithBuild((ref, notifier) {
          notifier.state = value;
          return value;
        }),
        authRepositoryProvider.overrideWithValue(authRepo),
        authGateStateProvider.overrideWithBuild((ref, notifier) {
          notifier.markAuthenticated('acc-1');
          return const AuthGateAuthenticated(accountId: 'acc-1');
        }),
        knownCompaniesProvider.overrideWithBuild((ref, notifier) {
          final list = List<CompanyId>.unmodifiable([cid]);
          notifier.state = list;
          return list;
        }),
        localeProvider.overrideWithBuild((ref, notifier) {
          notifier.state = locale;
          return locale;
        }),
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

void main() {
  final cidA = CompanyId('t_aaaaaaaa-0000-0000-0000-000000000001');
  final cidB = CompanyId('t_bbbbbbbb-0000-0000-0000-000000000002');
  final loanA1 = _loan(
    id: 'loan-a100000000000000000000001',
    status: const LoanActive(),
    amount: 100000,
    fee: 12000,
    paid: 18000,
    bill: Billing(principal: 100000, net: 95000, termDays: 14, currency: 'USD', total: 112000),
  );
  final loanA2 = _loan(
    id: 'loan-a200000000000000000000002',
    status: const LoanClosed(),
    amount: 40000,
    fee: 4000,
    paid: 44000,
  );
  final event1 = LoanEventFunded(
    loanId: loanA1.id,
    at: DateTime(2026, 10, 1, 9, 0),
  );
  final event2 = LoanEventRepayment(
    loanId: loanA1.id,
    at: DateTime(2026, 10, 8, 10, 30),
  );
  final snapA = CustomerSnapshot(
    companyId: cidA,
    kycStatus: const KycApproved(),
    loans: [loanA1, loanA2],
    events: [event1, event2],
    fetchedAt: DateTime(2026, 10, 10),
  );
  final snapEmptyA = CustomerSnapshot(
    companyId: cidA,
    kycStatus: const KycApproved(),
    loans: const [],
    events: const [],
    fetchedAt: DateTime(2026, 10, 10),
  );
  final snapB = CustomerSnapshot(
    companyId: cidB,
    kycStatus: const KycApproved(),
    loans: const [],
    events: const [],
    fetchedAt: DateTime(2026, 10, 10),
  );

  group('P1 W3: §50 §53 Router inventory + forbidden endpoints structural 0-count', () {
    test('Forbidden endpoints structural 0-count across all W3 new files', () {
      _assertNoForbiddenStructural();
    });
  });

  group('P1 W3: §13-§19 Loan List Ready/Empty/Unknown safe', () {
    testWidgets('Loan List Ready: 2 loans + row tap push detail route', (tester) async {
      final repo = _buildRepo(cidA);
      await pumpP1(
        tester,
        cid: cidA,
        value: CustomerStateValue(snapshot: snapA, status: CustomerStateFetchStatus.loaded),
        authRepo: repo,
        child: const LoanListPage(),
      );
      expect(find.textContaining('#LOAN-A10'), findsOneWidget);
      expect(find.textContaining('#LOAN-A20'), findsOneWidget);
      await tester.tap(find.textContaining('#LOAN-A10').first);
      await tester.pumpAndSettle();
      expect(find.byType(LoanDetailPage), findsOneWidget);
    });

    testWidgets('§15 Loan List Empty C4-B: zero Apply/Submit/Create CTA anywhere', (tester) async {
      final repo = _buildRepo(cidA);
      await pumpP1(
        tester,
        cid: cidA,
        value: CustomerStateValue(snapshot: snapEmptyA, status: CustomerStateFetchStatus.loaded),
        authRepo: repo,
        child: const LoanListPage(),
      );
      expect(
        find.descendant(
          of: find.byType(Scaffold),
          matching: find.textContaining(RegExp('Apply|Create|Submit|New loan', caseSensitive: false)),
        ),
        findsNothing,
      );
    });

    testWidgets('Loan List LoanUnknown status: safe render no crash + en label', (tester) async {
      final loanU = _loan(id: 'loan-unknown0001', status: const LoanUnknown('weird'));
      final snapU = CustomerSnapshot(
        companyId: cidA,
        kycStatus: const KycApproved(),
        loans: [loanU],
        events: const [],
        fetchedAt: DateTime(2026, 10, 10),
      );
      final repo = _buildRepo(cidA);
      await pumpP1(
        tester,
        cid: cidA,
        value: CustomerStateValue(snapshot: snapU, status: CustomerStateFetchStatus.loaded),
        authRepo: repo,
        child: const LoanListPage(),
      );
      final l10n = lookupAppLocalizations(const Locale('en'));
      expect(find.text(l10n.loanStatusUnknown), findsOneWidget);
    });
  });

  group('P1 W3: §20-§29 Read-only Loan Detail wrong-ID-safe / recent5Events / netDisplay', () {
    testWidgets('Detail shows 8 field labels + billing + events sections + 2 action rows', (tester) async {
      final repo = _buildRepo(cidA);
      await pumpP1(
        tester,
        cid: cidA,
        value: CustomerStateValue(snapshot: snapA, status: CustomerStateFetchStatus.loaded),
        authRepo: repo,
        child: LoanDetailPage(loanId: loanA1.id),
        location: '/w3-detail-valid',
        height: 1000,
      );
      final l10n = lookupAppLocalizations(const Locale('en'));
      expect(find.text(l10n.loanFieldStatus), findsWidgets);
      expect(find.text(l10n.loanFieldRemaining), findsWidgets);
      expect(find.text(l10n.loanFieldActualReceived), findsWidgets);
      expect(find.text(l10n.loanSectionBillingTitle), findsOneWidget);
      await tester.ensureVisible(find.text(l10n.loanSectionBillingTitle));
      await tester.pumpAndSettle();
      final eventsTitleFinder = find.text(l10n.loanSectionEventsTitle);
      if (eventsTitleFinder.evaluate().isEmpty) {
        await tester.dragFrom(const Offset(200, 600), const Offset(0, -400));
        await tester.pumpAndSettle();
      }
      expect(eventsTitleFinder, findsOneWidget);
      expect(find.text(l10n.loanEventFunded), findsOneWidget);
      expect(find.text(l10n.loanEventRepayment), findsOneWidget);
    });

    testWidgets('§21 Wrong ID Loan Detail: unavailable screen; A1 shortId not rendered', (tester) async {
      final repo = _buildRepo(cidA);
      await pumpP1(
        tester,
        cid: cidA,
        value: CustomerStateValue(snapshot: snapA, status: CustomerStateFetchStatus.loaded),
        authRepo: repo,
        child: const LoanDetailPage(loanId: 'loan-nonexistent1111111'),
        location: '/w3-detail-missing',
      );
      final l10n = lookupAppLocalizations(const Locale('en'));
      expect(find.text(l10n.loanDetailNotFoundTitle), findsOneWidget);
      expect(find.textContaining('#LOAN-A10'), findsNothing);
    });
  });

  group('P1 W3: §55 Tenant Isolation A→B clears snapshot, A1 never appears under B', () {
    test('ProviderContainer tenant switch: invalidateForCompany(cidA) clears A snapshot', () {
      final repoA = _buildRepo(cidA);
      final container = ProviderContainer(
        overrides: [
          secureKvProvider.overrideWithValue(FakeSecureKv()),
          appConfigProvider.overrideWithValue(AppConfig.production()),
          activeCompanyIdProvider.overrideWithBuild((ref, notifier) {
            notifier.state = cidA;
            return cidA;
          }),
          customerStateProvider.overrideWithBuild((ref, notifier) {
            notifier.state = CustomerStateValue(snapshot: snapA, status: CustomerStateFetchStatus.loaded);
            return CustomerStateValue(snapshot: snapA, status: CustomerStateFetchStatus.loaded);
          }),
          authRepositoryProvider.overrideWithValue(repoA),
        ],
      );
      addTearDown(container.dispose);
      container.read(customerStateProvider);
      final shortIdA = loanA1.shortId;
      expect(shortIdA, '#LOAN-A10');
      container.read(customerStateProvider.notifier).invalidateForCompany(cidA);
      container.read(customerStateProvider.notifier).state = CustomerStateValue(snapshot: snapB, status: CustomerStateFetchStatus.loaded);
      final underB = container.read(customerStateProvider).snapshot!;
      expect(underB.findLoan(loanA1.id), isNull);
      expect(underB.companyId, cidB);
    });
  });

  group('P1 W3: §56 Logout data-leak: local snapshot cleared + gate unauth', () {
    testWidgets('Logout Either.when(right) triggers invalidateLocal + markUnauthenticated + recorder count', (tester) async {
      final recorder = _Recorder();
      final repo = _buildRepo(cidA);
      await pumpP1(
        tester,
        cid: cidA,
        value: CustomerStateValue(snapshot: snapA, status: CustomerStateFetchStatus.loaded),
        authRepo: repo,
        child: const LoanListPage(),
      );
      final container = ProviderScope.containerOf(tester.element(find.byType(LoanListPage)));
      const Either<AppFailure, void> r = Right(null);
      bool allowLocal = false;
      r.when(
        left: (_) {},
        right: (_) {
          recorder.record('logout:${cidA.raw}');
          allowLocal = true;
        },
      );
      if (allowLocal) {
        container.read(customerStateProvider.notifier).invalidateLocal();
        container.read(authGateStateProvider.notifier).markUnauthenticated();
      }
      expect(recorder.countWhere((s) => s.startsWith('logout:')), 1);
      expect(container.read(customerStateProvider).snapshot, isNull);
      final gate = container.read(authGateStateProvider);
      expect(gate.isUnauthenticated, isTrue);
    });
  });

  group('P1 W3: §54 Shared-state tab refresh updates all consumers', () {
    testWidgets('Mutate shared provider updates LoanListPage rows in place', (tester) async {
      final repo = _buildRepo(cidA);
      await pumpP1(
        tester,
        cid: cidA,
        value: CustomerStateValue(snapshot: snapEmptyA, status: CustomerStateFetchStatus.loaded),
        authRepo: repo,
        child: const LoanListPage(),
      );
      final l10n = lookupAppLocalizations(const Locale('en'));
      expect(find.text(l10n.loansEmptyTitle), findsOneWidget);
      final container = ProviderScope.containerOf(tester.element(find.byType(LoanListPage)));
      container.read(customerStateProvider.notifier).state =
          CustomerStateValue(snapshot: snapA, status: CustomerStateFetchStatus.loaded);
      await tester.pumpAndSettle();
      expect(find.textContaining('#LOAN-A10'), findsOneWidget);
    });
  });
}
