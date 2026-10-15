import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:khmerx_app/app/bootstrap/providers.dart';
import 'package:khmerx_app/app/config/app_config.dart';
import 'package:khmerx_app/core/feature_flags/feature_flags.dart';
import 'package:khmerx_app/core/network/network_config.dart';
import 'package:khmerx_app/l10n/app_localizations.dart';

import '../../support/fake_secure_kv.dart';

void main() {
  group('P1 Route Inventory (45 §12 + C4-A)', () {
    const p1Required = <String>{
      '/startup',
      '/auth/login',
      '/auth/telegram-consent',
      '/auth/telegram-code',
      '/auth/password',
      '/auth/set-password',
      '/auth/recover',
      '/auth/recover/code',
      '/home',
      '/loans',
      '/loans/:loanId',
      '/me',
      '/me/language',
      '/me/password',
    };

    // Public app (docs 54 §8.1): no company UI routes exist at all.
    const p1Forbidden = <String>{
      '/company/select',
      '/company/recovery',
      '/company/scan',
      '/company/paste-link',
      '/company/candidate-confirm',
      '/me/company',
      '/feature/repay/:loanId',
      '/feature/withdraw/:loanId',
      '/feature/repay-disabled',
      '/feature/withdraw-disabled',
    };

    late ProviderContainer c;

    setUp(() {
      c = ProviderContainer(
        overrides: [
          appConfigProvider.overrideWithValue(
            AppConfig.dev().copyWith(
              networkConfig: NetworkConfig(
                baseUrl: Uri.http('127.0.0.1', ''),
                connectTimeout: const Duration(milliseconds: 1000),
                sendTimeout: const Duration(milliseconds: 1000),
                receiveTimeout: const Duration(milliseconds: 1000),
                logoutTimeout: const Duration(milliseconds: 1000),
              ),
              flags: const FeatureFlags(
                repay: false,
                withdraw: false,
              ),
            ),
          ),
          secureKvProvider.overrideWithValue(FakeSecureKv()),
        ],
      );
      AppLocalizations.delegate;
    });
    tearDown(() => c.dispose());

    GoRouter buildRouter() => c.read(routerProvider);

    Set<String> collectAllPaths(List<RouteBase> list) {
      final out = <String>{};
      void walk(List<RouteBase> routes) {
        for (final r in routes) {
          if (r is GoRoute) {
            out.add(r.path);
          }
          walk(r.routes);
        }
      }
      walk(list);
      return out;
    }

    test('RI-P1-01 All P1 approved routes registered in GoRouter', () {
      final router = buildRouter();
      final routes = collectAllPaths(router.configuration.routes);
      for (final req in p1Required) {
        expect(routes, contains(req),
            reason: 'Missing approved P1 route: $req (45 §12 Route Inventory)');
      }
    });

    test('RI-P1-02 /feature/* routes removed from P1 product path', () {
      final router = buildRouter();
      final routes = collectAllPaths(router.configuration.routes);
      for (final forbidden in p1Forbidden) {
        expect(routes, isNot(contains(forbidden)),
            reason:
                'P1 Contract (45 §13) explicitly forbids /feature/* routes. Found: $forbidden');
      }
    });
  });
}
