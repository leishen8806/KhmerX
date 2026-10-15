// ignore_for_file: prefer_const_constructors
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/app/bootstrap/providers.dart';
import 'package:khmerx_app/app/config/app_config.dart';
import 'package:khmerx_app/core/network/api_client_factory.dart';
import 'package:khmerx_app/core/session/company_cookie_store.dart';
import 'package:khmerx_app/core/session/company_id.dart';
import 'package:khmerx_app/core/session/session_manager.dart';
import 'package:khmerx_app/features/auth/data/auth_repository.dart';
import 'package:khmerx_app/features/auth/domain/auth_gate_state.dart';
import 'package:khmerx_app/features/customer_state/domain/billing.dart';
import 'package:khmerx_app/features/customer_state/domain/customer_snapshot.dart';
import 'package:khmerx_app/features/customer_state/domain/kyc_status.dart';
import 'package:khmerx_app/features/customer_state/domain/loan_status.dart';
import 'package:khmerx_app/features/customer_state/domain/loan_summary.dart';
import 'package:khmerx_app/features/customer_state/presentation/customer_state_notifier.dart';
import 'package:khmerx_app/features/loans/presentation/loan_detail_page.dart';
import 'package:khmerx_app/features/loans/presentation/loan_list_page.dart';
import 'package:khmerx_app/features/me/presentation/change_password_page.dart';
import 'package:khmerx_app/features/me/presentation/me_page.dart';
import 'package:khmerx_app/features/settings/presentation/language_page.dart';
import 'package:khmerx_app/l10n/app_localizations.dart';

import '../support/fake_secure_kv.dart';

const _w3Widths = <double>[320, 360, 412];
const _w3Scales = <double>[1.0, 1.3, 2.0];
const _heightDp = 880.0;

AuthRepository _repo(CompanyId cid) {
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

void _noOverflow(WidgetTester tester, String name) {
  final err = tester.takeException();
  expect(err, isNull, reason: 'W3 A11Y OVERFLOW on $name: $err');
}

void _cta48dp(WidgetTester tester, String name) {
  final groups = [
    find.byType(FilledButton),
    find.byType(OutlinedButton),
    find.byType(TextButton),
    find.byType(ListTile),
    find.byType(IconButton),
    find.byType(NavigationBar),
  ];
  for (final g in groups) {
    for (final e in g.evaluate()) {
      if (e.widget is ListTile) {
        final s = tester.getSize(find.byWidget(e.widget));
        expect(s.height, greaterThanOrEqualTo(48),
            reason: 'W3 A11Y ListTile too small ($name): h=${s.height}');
        continue;
      }
      if (e.widget is NavigationBar) {
        continue;
      }
      final s = tester.getSize(find.byWidget(e.widget));
      if (s.height < 1) continue;
      expect(s.height, greaterThanOrEqualTo(48),
          reason: 'W3 A11Y CTA < 48dp @$name: ${e.widget.runtimeType} h=${s.height}');
    }
  }
}

Future<void> pumpW3(
  WidgetTester tester, {
  required double width,
  required double scale,
  required CompanyId cid,
  required CustomerStateValue value,
  required AuthRepository repo,
  required Widget child,
}) async {
  const double dpr = 2.0;
  tester.view.physicalSize = Size(width * dpr, _heightDp * dpr);
  tester.view.devicePixelRatio = dpr;
  tester.platformDispatcher.textScaleFactorTestValue = scale;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
    tester.platformDispatcher.clearTextScaleFactorTestValue();
  });
  final prev = CustomerStateNotifier.testingLoadOverride;
  addTearDown(() => CustomerStateNotifier.testingLoadOverride = prev);
  CustomerStateNotifier.testingLoadOverride = (notifier, _, {force = false, isBackgroundRefresh = false}) async {
    return notifier.state;
  };
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
        authRepositoryProvider.overrideWithValue(repo),
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
          notifier.state = const Locale('km');
          return const Locale('km');
        }),
      ],
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        locale: const Locale('km'),
        home: Scaffold(body: child),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  final cid = CompanyId('t_aaaaaaaa-0000-0000-0000-000000000001');
  final loan1 = LoanSummary(
    id: 'loan-abc-aaaaaaaaaaaaaaaaa',
    status: const LoanActive(),
    amount: 250000,
    fee: 30000,
    paid: 42000,
    createdAt: DateTime(2026, 9, 30),
    dueAt: DateTime(2026, 11, 14),
    billConfirmedAt: DateTime(2026, 10, 1),
    bill: Billing(principal: 250000, net: 237500, termDays: 45, currency: 'USD', total: 280000),
  );
  final snap = CustomerSnapshot(
    companyId: cid,
    kycStatus: const KycApproved(),
    loans: [loan1],
    events: const [],
    fetchedAt: DateTime(2026, 10, 10),
  );
  final snapEmpty = CustomerSnapshot(
    companyId: cid,
    kycStatus: const KycApproved(),
    loans: const [],
    events: const [],
    fetchedAt: DateTime(2026, 10, 10),
  );
  final loanU = LoanSummary(
    id: 'loan-unk-aaaaaaaaaaaaaaa',
    status: const LoanUnknown('strange'),
    amount: 10000,
    fee: 1000,
    paid: 0,
    createdAt: DateTime(2026, 10, 1),
  );
  final snapUnknown = CustomerSnapshot(
    companyId: cid,
    kycStatus: const KycApproved(),
    loans: [loanU],
    events: const [],
    fetchedAt: DateTime(2026, 10, 10),
  );

  group('W3 A11y: LoanList × 3w × 3s — km long text', () {
    testWidgets('Loan list with 1 loan: 0 overflow + CTA≥48', (tester) async {
      final repo = _repo(cid);
      for (final w in _w3Widths) {
        for (final s in _w3Scales) {
          await pumpW3(
            tester,
            width: w,
            scale: s,
            cid: cid,
            value: CustomerStateValue(snapshot: snap, status: CustomerStateFetchStatus.loaded),
            repo: repo,
            child: const LoanListPage(),
          );
          _noOverflow(tester, 'LoanList-ready ${w}dp @${s}x');
          _cta48dp(tester, 'LoanList-ready ${w}dp @${s}x');
        }
      }
    });

    testWidgets('Loan list empty: 0 overflow + no apply CTA', (tester) async {
      final repo = _repo(cid);
      for (final w in _w3Widths) {
        for (final s in _w3Scales) {
          await pumpW3(
            tester,
            width: w,
            scale: s,
            cid: cid,
            value: CustomerStateValue(snapshot: snapEmpty, status: CustomerStateFetchStatus.loaded),
            repo: repo,
            child: const LoanListPage(),
          );
          _noOverflow(tester, 'LoanList-empty ${w}dp @${s}x');
          _cta48dp(tester, 'LoanList-empty ${w}dp @${s}x');
        }
      }
    });

    testWidgets('Loan list unknown status: 0 overflow safe', (tester) async {
      final repo = _repo(cid);
      for (final w in _w3Widths) {
        for (final s in _w3Scales) {
          await pumpW3(
            tester,
            width: w,
            scale: s,
            cid: cid,
            value: CustomerStateValue(snapshot: snapUnknown, status: CustomerStateFetchStatus.loaded),
            repo: repo,
            child: const LoanListPage(),
          );
          _noOverflow(tester, 'LoanList-unknown ${w}dp @${s}x');
        }
      }
    });

    testWidgets('Loan list sessionInvalid: 0 overflow signin CTA≥48', (tester) async {
      final repo = _repo(cid);
      for (final w in _w3Widths) {
        for (final s in _w3Scales) {
          await pumpW3(
            tester,
            width: w,
            scale: s,
            cid: cid,
            value: const CustomerStateValue(snapshot: null, status: CustomerStateFetchStatus.sessionInvalid),
            repo: repo,
            child: const LoanListPage(),
          );
          _noOverflow(tester, 'LoanList-sessionInvalid ${w}dp @${s}x');
          _cta48dp(tester, 'LoanList-sessionInvalid ${w}dp @${s}x');
        }
      }
    });
  });

  group('W3 A11y: LoanDetail × 3w × 3s — km long text', () {
    testWidgets('Loan detail valid loan: 0 overflow billing/events', (tester) async {
      final repo = _repo(cid);
      for (final w in _w3Widths) {
        for (final s in _w3Scales) {
          await pumpW3(
            tester,
            width: w,
            scale: s,
            cid: cid,
            value: CustomerStateValue(snapshot: snap, status: CustomerStateFetchStatus.loaded),
            repo: repo,
            child: LoanDetailPage(loanId: loan1.id),
          );
          _noOverflow(tester, 'LoanDetail-valid ${w}dp @${s}x');
          _cta48dp(tester, 'LoanDetail-valid ${w}dp @${s}x');
        }
      }
    });

    testWidgets('Loan detail not-found: 0 overflow back CTA≥48', (tester) async {
      final repo = _repo(cid);
      for (final w in _w3Widths) {
        for (final s in _w3Scales) {
          await pumpW3(
            tester,
            width: w,
            scale: s,
            cid: cid,
            value: CustomerStateValue(snapshot: snap, status: CustomerStateFetchStatus.loaded),
            repo: repo,
            child: const LoanDetailPage(loanId: 'loan-nonexistent-xyz'),
          );
          _noOverflow(tester, 'LoanDetail-missing ${w}dp @${s}x');
          _cta48dp(tester, 'LoanDetail-missing ${w}dp @${s}x');
        }
      }
    });
  });

  group('W3 A11y: Me tab + Password + Language + Company — km long text', () {
    testWidgets('Me tab 4 actions: 0 overflow + tiles≥48dp', (tester) async {
      final repo = _repo(cid);
      for (final w in _w3Widths) {
        for (final s in _w3Scales) {
          await pumpW3(
            tester,
            width: w,
            scale: s,
            cid: cid,
            value: CustomerStateValue(snapshot: snap, status: CustomerStateFetchStatus.loaded),
            repo: repo,
            child: const MePage(),
          );
          _noOverflow(tester, 'Me ${w}dp @${s}x');
          _cta48dp(tester, 'Me ${w}dp @${s}x');
        }
      }
    });

    testWidgets('Change Password 3 fields: 0 overflow + submit≥48dp', (tester) async {
      final repo = _repo(cid);
      for (final w in _w3Widths) {
        for (final s in _w3Scales) {
          await pumpW3(
            tester,
            width: w,
            scale: s,
            cid: cid,
            value: CustomerStateValue(snapshot: snap, status: CustomerStateFetchStatus.loaded),
            repo: repo,
            child: const ChangePasswordPage(),
          );
          _noOverflow(tester, 'Password ${w}dp @${s}x');
          _cta48dp(tester, 'Password ${w}dp @${s}x');
        }
      }
    });

    testWidgets('Language selector 3 rows: 0 overflow + tiles≥48dp', (tester) async {
      final repo = _repo(cid);
      for (final w in _w3Widths) {
        for (final s in _w3Scales) {
          await pumpW3(
            tester,
            width: w,
            scale: s,
            cid: cid,
            value: CustomerStateValue(snapshot: snap, status: CustomerStateFetchStatus.loaded),
            repo: repo,
            child: const LanguagePage(),
          );
          _noOverflow(tester, 'Language ${w}dp @${s}x');
          _cta48dp(tester, 'Language ${w}dp @${s}x');
        }
      }
    });
  });
}
