// ignore_for_file: curly_braces_in_flow_control_structures, prefer_const_constructors
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../app/shell/authenticated_shell.dart';
import '../../features/auth/domain/auth_gate_state.dart';
import '../../features/auth/presentation/auth_placeholder.dart';
import '../../features/home/presentation/real_home_page.dart';
import '../../features/loans/presentation/loan_detail_page.dart';
import '../../features/loans/presentation/loan_list_page.dart';
import '../../features/kyc/presentation/kyc_pages.dart';
import '../../features/me/presentation/change_password_page.dart';
import '../../features/me/presentation/me_page.dart' as me_tab;
import '../../features/settings/presentation/language_page.dart';
import '../../features/startup/presentation/startup_page.dart';
import '../bootstrap/providers.dart';

final class _RouterRefreshNotifier extends ChangeNotifier {
  void fire() => notifyListeners();
}

/// Cross-fade between the splash and the first real screen (no hard cut).
CustomTransitionPage<void> _fade(Widget child) => CustomTransitionPage<void>(
      child: child,
      transitionDuration: const Duration(milliseconds: 350),
      reverseTransitionDuration: const Duration(milliseconds: 200),
      transitionsBuilder: (_, animation, __, c) => FadeTransition(
        opacity: CurvedAnimation(parent: animation, curve: Curves.easeInOut),
        child: c,
      ),
    );

StatefulShellRoute _shell() {
  return StatefulShellRoute.indexedStack(
    parentNavigatorKey: null,
    branches: [
      StatefulShellBranch(
        routes: [
          GoRoute(
            path: '/home',
            pageBuilder: (_, __) => _fade(const RealHomePage()),
          ),
        ],
      ),
      StatefulShellBranch(
        routes: [
          GoRoute(
            path: '/loans',
            pageBuilder: (_, __) => const NoTransitionPage(child: LoanListPage()),
          ),
        ],
      ),
      StatefulShellBranch(
        routes: [
          GoRoute(
            path: '/me',
            pageBuilder: (_, __) => const NoTransitionPage(child: me_tab.MePage()),
          ),
        ],
      ),
    ],
    builder: (context, state, navigationShell) {
      final tab = shellTabFromLocation(state.matchedLocation);
      return AuthenticatedShell(
        currentTab: tab,
        child: navigationShell,
      );
    },
  );
}

/// Public customer app (docs 54): no company selection, scanning, invite
/// links or company switching. The public workspace is activated by
/// `/startup`; the tenant code under `features/company` stays dormant.
GoRouter createRouter(Ref ref) {
  final refreshNotifier = _RouterRefreshNotifier();
  // Re-evaluate redirects whenever the authentication gate changes, so an
  // invalidated session sends the user to the login page immediately.
  ref.listen<AuthGateState>(
    authGateStateProvider,
    (_, __) => refreshNotifier.fire(),
  );
  return GoRouter(
    initialLocation: '/startup',
    debugLogDiagnostics: false,
    refreshListenable: refreshNotifier,
    redirect: (context, state) {
      final top = state.matchedLocation;
      final active = ref.read(activeCompanyIdProvider);
      final auth = ref.read(authGateStateProvider);
      final authFlow = top.startsWith('/auth/');
      final isProtectedMain = top == '/home' ||
          top == '/kyc' ||
          top.startsWith('/kyc/') ||
          top == '/loans' ||
          top == '/me' ||
          top.startsWith('/me/') ||
          top.startsWith('/loans/');
      if (top == '/startup') return null;
      // Until /startup has activated the public workspace, wait there.
      if (active == null) return '/startup';
      if ((auth.isUnknown || auth.isUnauthenticated) &&
          !authFlow &&
          top != '/me/language') {
        if (isProtectedMain) {
          ref.read(returnIntentProvider.notifier).saveSafe(active, top);
        }
        return '/auth/login';
      }
      if (auth.isRegistrationIncomplete && top != '/auth/set-password') {
        return '/auth/set-password';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/startup', pageBuilder: (_, __) => _fade(const StartupPage())),
      GoRoute(path: '/auth/login', pageBuilder: (_, __) => _fade(const AuthLoginPage())),
      GoRoute(
        path: '/auth/telegram-consent',
        builder: (_, __) => const TelegramConsentPage(),
      ),
      GoRoute(
        path: '/auth/telegram-code',
        builder: (_, __) => const TelegramCodePage(),
      ),
      GoRoute(
        path: '/auth/password',
        builder: (_, __) => const PasswordLoginPage(),
      ),
      GoRoute(
        path: '/auth/set-password',
        builder: (_, __) => const SetPasswordPage(),
      ),
      GoRoute(
        path: '/auth/recover',
        builder: (_, __) => const RecoverySendPage(),
      ),
      GoRoute(
        path: '/auth/recover/code',
        builder: (_, __) => const RecoveryCodePage(),
      ),
      _shell(),
      GoRoute(
        path: '/loans/:loanId',
        builder: (ctx, state) => LoanDetailPage(
          loanId: state.pathParameters['loanId'] ?? '',
        ),
      ),
      GoRoute(path: '/kyc', builder: (_, __) => const KycOverviewPage()),
      GoRoute(
        path: '/kyc/:section',
        builder: (_, state) =>
            KycSectionPage(sectionId: state.pathParameters['section'] ?? ''),
      ),
      GoRoute(
        path: '/me/language',
        builder: (_, __) => const LanguagePage(),
      ),
      GoRoute(
        path: '/me/password',
        builder: (_, __) => const ChangePasswordPage(),
      ),
    ],
  );
}
