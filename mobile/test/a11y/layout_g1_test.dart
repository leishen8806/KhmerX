// ignore_for_file: prefer_const_constructors, unnecessary_const
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/app/bootstrap/providers.dart';
import 'package:khmerx_app/app/config/app_config.dart';
import 'package:khmerx_app/core/network/api_client_factory.dart';
import 'package:khmerx_app/core/session/company_cookie_store.dart';
import 'package:khmerx_app/core/session/company_id.dart';
import 'package:khmerx_app/core/session/session_manager.dart';
import 'package:khmerx_app/features/auth/data/auth_repository.dart';
import 'package:khmerx_app/features/auth/domain/auth_gate_state.dart';
import 'package:khmerx_app/features/auth/presentation/auth_placeholder.dart';
import 'package:khmerx_app/features/company/presentation/company_pages.dart';
import 'package:khmerx_app/features/customer_state/domain/billing.dart';
import 'package:khmerx_app/features/customer_state/domain/customer_snapshot.dart';
import 'package:khmerx_app/features/customer_state/domain/kyc_status.dart';
import 'package:khmerx_app/features/customer_state/domain/loan_status.dart';
import 'package:khmerx_app/features/customer_state/domain/loan_summary.dart';
import 'package:khmerx_app/features/customer_state/presentation/customer_state_notifier.dart';
import 'package:khmerx_app/features/home/presentation/real_home_page.dart';
import 'package:khmerx_app/l10n/app_localizations.dart';

import '../support/fake_secure_kv.dart';

typedef PageBuilder = Widget Function();

AuthRepository _buildAuthRepoWithSnapshot(CompanyId cid) {
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

class _TestApp extends StatelessWidget {
  const _TestApp({required this.child, this.extraOverrides = const []});
  final Widget child;
  final List<Override> extraOverrides;

  @override
  Widget build(BuildContext context) => ProviderScope(
        overrides: [
          secureKvProvider.overrideWithValue(FakeSecureKv()),
          ...extraOverrides,
        ],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          locale: const Locale('en'),
          home: child,
        ),
      );
}

Future<void> pumpAt(
  WidgetTester tester,
  PageBuilder builder, {
  required double widthDp,
  required double scale,
  List<Override> overrides = const [],
}) async {
  const double heightDp = 800;
  const double devicePixelRatio = 2.0;
  tester.view.physicalSize = Size(widthDp * devicePixelRatio, heightDp * devicePixelRatio);
  tester.view.devicePixelRatio = devicePixelRatio;
  tester.platformDispatcher.textScaleFactorTestValue = scale;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
    tester.platformDispatcher.clearTextScaleFactorTestValue();
  });
  await tester.pumpWidget(_TestApp(extraOverrides: overrides, child: builder()));
  await tester.pumpAndSettle();
}

void main() {
  const dimensions = <double>[320, 360, 412];
  const scales = <double>[1.0, 1.3, 2.0];
  const longKhmer = 'ខ្មែរ ខ្មែរ ខ្មែរ ខ្មែរ ខ្មែរ ខ្មែរ ខ្មែរ ខ្មែរ ខ្មែរ ខ្មែរ';
  const longKhmerX5 = '$longKhmer $longKhmer $longKhmer $longKhmer $longKhmer';

  void noOverflow(WidgetTester tester, String name) {
    final dynamic err = tester.takeException();
    expect(err, isNull,
        reason:
            'A11Y OVERFLOW on $name: $err. Fix layout constraints / scrollable. (35 P1-A11y)');
  }

  void assertButtons48dp(WidgetTester tester, String name) {
    final filled = find.byType(FilledButton);
    final outlined = find.byType(OutlinedButton);
    for (final btn in [filled, outlined]) {
      for (final e in btn.evaluate()) {
        final size = tester.getSize(find.byWidget(e.widget));
        expect(size.height, greaterThanOrEqualTo(48),
            reason: 'A11Y CTA too small on $name: ${e.widget.runtimeType} '
                'height=${size.height}dp < 48dp. W3C Mobile A11y requirement.');
      }
    }
  }

  group('G1 A11y (35 P1-A11y): responsive + text scale + CTA 48dp', () {
    testWidgets('A11Y-01 Select Page: responsive no overflow + CTA>=48',
        (tester) async {
      for (final w in dimensions) {
        for (final s in scales) {
          await pumpAt(
            tester,
            () => const CompanySelectPage(),
            widthDp: w,
            scale: s,
          );
          noOverflow(tester, 'Select ${w}dp @${s}x');
          assertButtons48dp(tester, 'Select ${w}dp @${s}x');
        }
      }
    });

    testWidgets('A11Y-02 Candidate Confirm Page: no overflow + CTA>=48',
        (tester) async {
      for (final w in dimensions) {
        for (final s in scales) {
          await pumpAt(
            tester,
            () => const CompanyCandidateConfirmationPage(),
            widthDp: w,
            scale: s,
          );
          noOverflow(tester, 'CandidateConfirm ${w}dp @${s}x');
          assertButtons48dp(tester, 'CandidateConfirm ${w}dp @${s}x');
        }
      }
    });

    testWidgets('A11Y-03 Auth Login Page: no overflow + CTA>=48',
        (tester) async {
      final cid = CompanyId('t_00000000-0000-0000-0000-000000000001');
      final fakeAuthRepo = _buildAuthRepoWithSnapshot(cid);
      for (final w in dimensions) {
        for (final s in scales) {
          await pumpAt(
            tester,
            () => const AuthLoginPage(),
            widthDp: w,
            scale: s,
            overrides: [
              activeCompanyIdProvider.overrideWithBuild((ref, notifier) {
                notifier.state = cid;
                return cid;
              }),
              authRepositoryProvider.overrideWithValue(fakeAuthRepo),
            ],
          );
          noOverflow(tester, 'Login ${w}dp @${s}x');
          assertButtons48dp(tester, 'Login ${w}dp @${s}x');
        }
      }
    });

    testWidgets('A11Y-04 Telegram Code Page: no overflow + CTA>=48',
        (tester) async {
      for (final w in dimensions) {
        for (final s in scales) {
          await pumpAt(
            tester,
            () => const TelegramCodePage(),
            widthDp: w,
            scale: s,
          );
          noOverflow(tester, 'TelegramCode ${w}dp @${s}x');
          assertButtons48dp(tester, 'TelegramCode ${w}dp @${s}x');
        }
      }
    });

    testWidgets('A11Y-05 Real Home Page: no overflow + CTA>=48 across 7 states',
        (tester) async {
      final cid = CompanyId('t_00000000-0000-0000-0000-000000000001');
      final dueDate = DateTime(2026, 11, 30);
      final baseOpenLoan = LoanSummary(
        id: 'loan-00000000-0000-0000-0000-000000000002',
        status: const LoanActive(),
        amount: 100000,
        fee: 15000,
        paid: 25000,
        createdAt: DateTime(2026, 10, 1),
        dueAt: dueDate,
        bill: Billing(
          principal: 100000,
          interest: 12000,
          service: 3000,
          net: 100000,
          total: 115000,
          currency: 'USD',
          termDays: 60,
        ),
        billConfirmedAt: DateTime(2026, 10, 2),
        contract: 'contract-ref',
      );
      final approvedNoLoanSnapshot = CustomerSnapshot(
        companyId: cid,
        kycStatus: const KycApproved(),
        loans: const [],
        fetchedAt: DateTime(2026, 10, 5),
      );
      final kycNoneSnapshot = CustomerSnapshot(
        companyId: cid,
        kycStatus: const KycNone(),
        fetchedAt: DateTime(2026, 10, 5),
      );
      final openLoanSnapshot = CustomerSnapshot(
        companyId: cid,
        kycStatus: const KycApproved(),
        loans: [baseOpenLoan],
        fetchedAt: DateTime(2026, 10, 5),
      );
      final cases = <({String name, CustomerStateValue value, CustomerSnapshot? snap})>[
        (
          name: 'H19-firstLoad',
          value: const CustomerStateValue(),
          snap: null,
        ),
        (
          name: 'H1-kycNone',
          value: CustomerStateValue(
            snapshot: kycNoneSnapshot,
            status: CustomerStateFetchStatus.loaded,
            lastAttempt: DateTime(2026, 10, 5),
          ),
          snap: kycNoneSnapshot,
        ),
        (
          name: 'H6-approved',
          value: CustomerStateValue(
            snapshot: approvedNoLoanSnapshot,
            status: CustomerStateFetchStatus.loaded,
            lastAttempt: DateTime(2026, 10, 5),
          ),
          snap: approvedNoLoanSnapshot,
        ),
        (
          name: 'H14-openLoan',
          value: CustomerStateValue(
            snapshot: openLoanSnapshot,
            status: CustomerStateFetchStatus.loaded,
            lastAttempt: DateTime(2026, 10, 5),
          ),
          snap: openLoanSnapshot,
        ),
        (
          name: 'H20-refreshFail',
          value: CustomerStateValue(
            snapshot: approvedNoLoanSnapshot,
            status: CustomerStateFetchStatus.error,
            lastAttempt: DateTime(2026, 10, 5),
          ),
          snap: approvedNoLoanSnapshot,
        ),
        (
          name: 'H21-offline',
          value: CustomerStateValue(
            snapshot: approvedNoLoanSnapshot,
            status: CustomerStateFetchStatus.offline,
            lastAttempt: DateTime(2026, 10, 5),
          ),
          snap: approvedNoLoanSnapshot,
        ),
        (
          name: 'H22-sessionInvalid',
          value: const CustomerStateValue(
            status: CustomerStateFetchStatus.sessionInvalid,
          ),
          snap: null,
        ),
      ];
      final fakeAuthRepo = _buildAuthRepoWithSnapshot(cid);
      final previousOverride = CustomerStateNotifier.testingLoadOverride;
      addTearDown(() {
        CustomerStateNotifier.testingLoadOverride = previousOverride;
      });
      CustomerStateNotifier.testingLoadOverride = (notifier, c, {force = false, isBackgroundRefresh = false}) async {
        return notifier.state;
      };
      for (final c in cases) {
        for (final w in dimensions) {
          for (final s in scales) {
            await pumpAt(
              tester,
              () => const RealHomePage(),
              widthDp: w,
              scale: s,
              overrides: [
                activeCompanyIdProvider.overrideWithBuild((ref, notifier) {
                  notifier.state = cid;
                  return cid;
                }),
                customerStateProvider.overrideWithBuild((ref, notifier) {
                  notifier.state = c.value;
                  return c.value;
                }),
                authRepositoryProvider.overrideWithValue(fakeAuthRepo),
              ],
            );
            noOverflow(tester, 'Home ${c.name} ${w}dp @${s}x');
            assertButtons48dp(tester, 'Home ${c.name} ${w}dp @${s}x');
          }
        }
      }
    });

    testWidgets('A11Y-06 Long Khmer text (5x) + 48dp CTA no trunc @ 412dp 200% scale',
        (tester) async {
      await pumpAt(
        tester,
        () => Scaffold(
          appBar: AppBar(title: const Text('Khmer A11y smoke')),
          body: SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                return SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.blueGrey),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          longKhmerX5,
                        ),
                      ),
                      const SizedBox(height: 24),
                      FilledButton(
                        style: FilledButton.styleFrom(
                          minimumSize: const Size.fromHeight(48),
                        ),
                        onPressed: () {},
                        child: const Text('Primary CTA 48dp'),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(48),
                        ),
                        onPressed: () {},
                        child: const Text('Secondary CTA 48dp'),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ),
        widthDp: 412,
        scale: 2.0,
      );
      noOverflow(tester, 'KhmerLongText @412dp 2.0x');
      final filled = find.byType(FilledButton);
      final outlined = find.byType(OutlinedButton);
      expect(filled, findsOneWidget);
      expect(outlined, findsOneWidget);
      expect(tester.getSize(filled).height, greaterThanOrEqualTo(48));
      expect(tester.getSize(outlined).height, greaterThanOrEqualTo(48));
      final khmerTextFinder = find.text(longKhmerX5);
      expect(khmerTextFinder, findsOneWidget,
          reason: 'Long Khmer text must be rendered (not silently dropped).');
    });
  });
}
