import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/app/app.dart';
import 'package:khmerx_app/app/bootstrap/bootstrap.dart';
import 'package:khmerx_app/app/bootstrap/providers.dart';
import 'package:khmerx_app/app/config/app_config.dart';
import 'package:khmerx_app/app/theme/khmerx_theme.dart';
import 'package:khmerx_app/core/network/network_config.dart';
import 'package:khmerx_app/core/session/company_id.dart';
import 'package:khmerx_app/core/storage/secure_kv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class _InMemorySecureKv implements SecureKv {
  final _store = <String, String>{};
  @override
  Future<String?> read(String key) async => _store[key];
  @override
  Future<void> write(String key, String value) async => _store[key] = value;
  @override
  Future<void> delete(String key) async => _store.remove(key);
  @override
  Future<void> deleteAll() async => _store.clear();
  @override
  Future<bool> containsKey(String key) async => _store.containsKey(key);
  @override
  Future<void> deleteAllWithPrefix(String prefix) async {
    _store.removeWhere((k, _) => k.startsWith(prefix));
  }
  @override
  Future<List<String>> readAllKeysWithPrefix(String prefix) async =>
      _store.keys.where((k) => k.startsWith(prefix)).toList(growable: false);
  @override
  Future<Map<String, String>> readAllWithPrefix(String prefix) async =>
      Map.fromEntries(_store.entries.where((e) => e.key.startsWith(prefix)));
}

void main() {
  group('KhmerXApp', () {
    testWidgets('KhmerXApp starts without crashing', (tester) async {
      // Startup now preflights the public workspace; point it at a refused
      // local port so it fails fast instead of waiting on the emulator host.
      final config = AppConfig.dev().copyWith(
        networkConfig: NetworkConfig(
          baseUrl: Uri.http('127.0.0.1:1', ''),
          connectTimeout: const Duration(milliseconds: 500),
          sendTimeout: const Duration(milliseconds: 500),
          receiveTimeout: const Duration(milliseconds: 500),
          logoutTimeout: const Duration(milliseconds: 500),
        ),
      );
      final container = await bootstrap(overrides: [
        appConfigProvider.overrideWithValue(config),
        secureKvProvider.overrideWithValue(_InMemorySecureKv()),
      ],);
      await tester.pumpWidget(UncontrolledProviderScope(
        container: container,
        child: const KhmerXApp(),
      ),);
      await tester.pump();
      expect(find.byType(MaterialApp), findsOneWidget);
      // Let the startup preflight fail, then tear the tree down cleanly.
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 800)));
      await tester.pump(const Duration(seconds: 1));
      await tester.pumpWidget(const SizedBox());
      container.dispose();
    });
  });

  group('KhmerX Theme', () {
    test('Light primary is #1677FF (not default Flutter purple)', () {
      final theme = KhmerXTheme.light();
      expect(theme.colorScheme.primary, const Color(0xFF1677FF));
      expect(theme.colorScheme.primary, isNot(const Color(0xFF6750A4)));
    });

    test('Dark primary is #69A8FF (not default Flutter purple)', () {
      final theme = KhmerXTheme.dark();
      expect(theme.colorScheme.primary, const Color(0xFF69A8FF));
      expect(theme.colorScheme.primary, isNot(const Color(0xFF6750A4)));
    });

    test('Light text colors match specification', () {
      final theme = KhmerXTheme.light();
      final bodyLarge = theme.textTheme.bodyLarge;
      final bodySmall = theme.textTheme.bodySmall;
      expect(bodyLarge?.color, const Color(0xFF172033));
      expect(bodySmall?.color, const Color(0xFF667085));
    });

    test('Buttons minimum interactive 48dp', () {
      final theme = KhmerXTheme.light();
      final minSize =
          theme.elevatedButtonTheme.style?.minimumSize;
      final s = minSize?.resolve(const {}) ?? Size.zero;
      expect(s.width, greaterThanOrEqualTo(48));
      expect(s.height, greaterThanOrEqualTo(48));
    });
  });

  group('Router Gates', () {
    late ProviderContainer container;

    setUp(() async {
      container = await bootstrap(overrides: [
        appConfigProvider.overrideWithValue(AppConfig.dev()),
        secureKvProvider.overrideWithValue(_InMemorySecureKv()),
      ],);
    });

    String? redirectFor(String top) {
      final activeCompanyId = container.read(activeCompanyIdProvider);
      final auth = container.read(authGateStateProvider);
      final flags = container.read(featureFlagsProvider);
      final pendingCandidate = container.read(pendingCandidateCompanyProvider);
      final inCompanyFlow = top.startsWith('/company/') || top == '/startup';
      final inAuthFlow = top.startsWith('/auth/');
      final hasPendingCandidate = pendingCandidate != null;

      if (top == '/startup') {
        return null;
      }
      if (activeCompanyId == null &&
          !inCompanyFlow &&
          !hasPendingCandidate &&
          top != '/company/candidate-confirm') {
        return '/startup';
      }
      if (hasPendingCandidate && top == '/company/candidate-confirm') {
        return null;
      }
      if (activeCompanyId != null) {
        if ((auth.isUnknown || auth.isUnauthenticated) &&
            !inAuthFlow &&
            !inCompanyFlow) {
          return '/auth/login';
        }
        if (auth.isRegistrationIncomplete &&
            top != '/auth/set-password' &&
            !inCompanyFlow) {
          return '/auth/set-password';
        }
      }
      if (top.startsWith('/feature/repay/') && !flags.repay) {
        return '/feature/repay-disabled';
      }
      if (top.startsWith('/feature/withdraw/') && !flags.withdraw) {
        return '/feature/withdraw-disabled';
      }
      return null;
    }

    test('no company → redirects to /startup (not /company/select)', () {
      container.read(activeCompanyIdProvider.notifier).clear();
      container.read(pendingCandidateCompanyProvider.notifier).set(null);
      container.read(authGateStateProvider.notifier)
          .markUnauthenticated();
      expect(redirectFor('/startup'), isNull);
      expect(redirectFor('/home'), equals('/startup'));
    });

    test('company set but unauthenticated → protected → /auth/login', () {
      container.read(activeCompanyIdProvider.notifier)
          .activate(CompanyId('t_12345678-1234-1234-1234-123456789012'));
      container.read(authGateStateProvider.notifier)
          .markUnauthenticated();
      expect(redirectFor('/startup'), isNull);
      expect(redirectFor('/loans'), equals('/auth/login'));
    });

    test('company + authenticated → /startup does not redirect (Resolver drives)', () {
      container.read(activeCompanyIdProvider.notifier)
          .activate(CompanyId('t_12345678-1234-1234-1234-123456789012'));
      container.read(authGateStateProvider.notifier)
          .markAuthenticated('acc-test-001');
      expect(redirectFor('/startup'), isNull);
    });

    test('feature flags: repay=false → /feature/repay/1 → disabled', () {
      container.read(activeCompanyIdProvider.notifier)
          .activate(CompanyId('t_12345678-1234-1234-1234-123456789012'));
      container.read(authGateStateProvider.notifier)
          .markAuthenticated('acc-test-001');
      expect(redirectFor('/feature/repay/1'),
          equals('/feature/repay-disabled'),);
    });
  });
}
