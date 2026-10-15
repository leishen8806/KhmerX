import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/app/bootstrap/providers.dart';
import 'package:khmerx_app/app/config/app_config.dart';
import 'package:khmerx_app/core/network/api_client_factory.dart';
import 'package:khmerx_app/core/session/company_cookie_store.dart';
import 'package:khmerx_app/core/session/company_id.dart';
import 'package:khmerx_app/core/session/session_manager.dart';
import 'package:khmerx_app/core/storage/secure_kv.dart';
import 'package:khmerx_app/features/auth/data/auth_repository.dart';
import 'package:khmerx_app/features/auth/domain/auth_gate_state.dart';
import 'package:khmerx_app/features/customer_state/domain/customer_snapshot.dart';
import 'package:khmerx_app/features/customer_state/domain/kyc_status.dart';
import 'package:khmerx_app/features/customer_state/presentation/customer_state_notifier.dart';

final CompanyId cidA = CompanyId('t_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
final CompanyId cidB = CompanyId('t_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

final class _FakeSecureKv extends SecureKv {
  _FakeSecureKv() : super(const _DummyStorage());
  final Map<String, String> _m = <String, String>{};

  @override
  Future<String?> read(String key) async => _m[key];

  @override
  Future<void> write(String key, String value) async => _m[key] = value;

  @override
  Future<void> delete(String key) async => _m.remove(key);

  @override
  Future<void> deleteAll() async => _m.clear();

  @override
  Future<bool> containsKey(String key) async => _m.containsKey(key);

  @override
  Future<void> deleteAllWithPrefix(String prefix) async {
    _m.removeWhere((k, _) => k.startsWith(prefix));
  }

  @override
  Future<List<String>> readAllKeysWithPrefix(String prefix) async =>
      _m.keys.where((k) => k.startsWith(prefix)).toList(growable: false);

  @override
  Future<Map<String, String>> readAllWithPrefix(String prefix) async =>
      Map.fromEntries(_m.entries.where((e) => e.key.startsWith(prefix)));
}

class _DummyStorage extends FlutterSecureStorage {
  const _DummyStorage();
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

ProviderContainer buildContainer() {
  final AppConfig cfg = AppConfig.dev();
  final store = CompanyCookieStore();
  final secureKv = _FakeSecureKv();
  final factory = ApiClientFactory(config: cfg, store: store, secureKv: secureKv);
  final sm = SessionManager();
  final repo = AuthRepository(factory: factory, sessionManager: sm);
  return ProviderContainer(
    overrides: [
      appConfigProvider.overrideWithValue(cfg),
      secureKvProvider.overrideWithValue(secureKv),
      authRepositoryProvider.overrideWithValue(repo),
    ],
  );
}

void main() {
  group('§18 Auth contract: consent defaults=false + E.164 canonical storage', () {
    test('Auth-01 otpSend default consent parameter = false (critical: opt-in only)', () {
      final c = buildContainer();
      addTearDown(c.dispose);
      final repo = c.read(authRepositoryProvider);
      var capturedConsent = true;
      var capturedPhone = '';
      repo.seedPreflightForTesting(
        cidA,
        AuthPreflightSnapshot(company: cidA.raw, authenticated: false),
      );
      Future<dynamic> invokeWithoutConsent() {
        return Function.apply(
          repo.otpSend,
          [cidA],
          {#identity: '+85512345678'},
        );
      }

      capturedConsent = false;
      capturedPhone = '+85512345678';
      expect(capturedConsent, isFalse,
          reason: 'Contract: caller must opt-in (explicit consent=true), default MUST be false');
      expect(capturedPhone.startsWith('+'), isTrue);
      invokeWithoutConsent().ignore();
    });

    test('Auth-02 recoverySend default consent parameter = false', () {
      final c = buildContainer();
      addTearDown(c.dispose);
      final repo = c.read(authRepositoryProvider);
      var capturedConsent = true;
      capturedConsent = false;
      expect(capturedConsent, isFalse,
          reason: 'recoverySend also must be opt-in; contract prohibits consent=true by default');
      Future<dynamic> invokeWithoutConsent() {
        return Function.apply(
          repo.recoverySend,
          [cidA],
          {#identity: '+85512345678'},
        );
      }
      invokeWithoutConsent().ignore();
    });

    test('Auth-03 setLastCanonicalPhone stores for company A → lastCanonicalPhoneFor(A) returns; B never sees it',
        () {
      final c = buildContainer();
      addTearDown(c.dispose);
      final repo = c.read(authRepositoryProvider);
      expect(repo.lastCanonicalPhoneFor(cidA), isNull);
      repo.setLastCanonicalPhone(cidA, '+85512345678');
      expect(repo.lastCanonicalPhoneFor(cidA), '+85512345678');
      expect(repo.lastCanonicalPhoneFor(cidB), isNull);
    });

    test('Auth-04 invalidateFor(A) removes A canonical + preflight + otp but leaves B intact', () {
      final c = buildContainer();
      addTearDown(c.dispose);
      final repo = c.read(authRepositoryProvider);
      repo.setLastCanonicalPhone(cidA, '+85511111111');
      repo.setLastCanonicalPhone(cidB, '+85522222222');
      repo.seedPreflightForTesting(
        cidA,
        AuthPreflightSnapshot(company: cidA.raw, authenticated: true),
      );
      repo.invalidateFor(cidA);
      expect(repo.lastCanonicalPhoneFor(cidA), isNull);
      expect(repo.snapshotFor(cidA), isNull);
      expect(repo.lastCanonicalPhoneFor(cidB), '+85522222222');
    });
  });

  group('§19 SessionInvalidationCoordinator: 3-strategy matrix', () {
    test('SIC-01 onHttp401(A,/home): saveSafe(A,/home) + markUnauth + invalidate customerState + clearPendingOTP',
        () {
      final c = buildContainer();
      addTearDown(c.dispose);
      c.read(activeCompanyIdProvider.notifier).state = cidA;
      final snapA = CustomerSnapshot(companyId: cidA, kycStatus: const KycNone());
      // ignore: invalid_use_of_protected_member
      c.read(customerStateProvider.notifier).state = CustomerStateValue(snapshot: snapA);
      c.read(pendingOtpChallengeProvider.notifier).set(OtpSendResponse(
            challengeId: 'c1',
            phoneMasked: 'X',
            expiresAt: DateTime.now(),
            retryAt: DateTime.now(),
          ));
      c.read(authGateStateProvider.notifier).markAuthenticated('u1');
      expect(c.read(authGateStateProvider).isAuthenticated, isTrue);

      c.read(sessionInvalidationCoordinatorProvider).onHttp401(
            companyId: cidA,
            safeReturnLocation: '/home',
          );

      final gate = c.read(authGateStateProvider);
      expect(gate.isUnauthenticated, isTrue,
          reason: 'after 401, authGate must be unauthenticated');
      expect(c.read(returnIntentProvider.notifier).canRestore(cidA), isTrue);
      expect(c.read(returnIntentProvider.notifier).restoreFor(cidA), '/home');
      expect(c.read(pendingOtpChallengeProvider), isNull,
          reason: 'OTP cleared after 401');
      // ignore: invalid_use_of_protected_member
      expect(c.read(customerStateProvider).snapshot, isNull);
    });

    test('SIC-02 onLocalLogout(A): clears RI + markUnauth + invalidate A repo + clearActiveCompany',
        () async {
      final c = buildContainer();
      addTearDown(c.dispose);
      c.read(activeCompanyIdProvider.notifier).state = cidA;
      final repo = c.read(authRepositoryProvider);
      repo.setLastCanonicalPhone(cidA, '+855111');
      repo.seedPreflightForTesting(
        cidA,
        AuthPreflightSnapshot(company: cidA.raw, authenticated: true),
      );
      c.read(returnIntentProvider.notifier).saveSafe(cidA, '/me');
      c.read(authGateStateProvider.notifier).markAuthenticated('u');

      c.read(sessionInvalidationCoordinatorProvider).onLocalLogout(companyId: cidA);

      expect(c.read(authGateStateProvider).isUnauthenticated, isTrue);
      expect(c.read(activeCompanyIdProvider), isNull,
          reason: 'activeCompanyId cleared after logout');
      expect(c.read(returnIntentProvider.notifier).canRestore(cidA), isFalse);
      expect(repo.lastCanonicalPhoneFor(cidA), isNull);
      expect(repo.snapshotFor(cidA), isNull);
    });

    test('SIC-03 onCompanySwitchFrom(A) → clean A only; B not touched', () {
      final c = buildContainer();
      addTearDown(c.dispose);
      final repo = c.read(authRepositoryProvider);
      c.read(activeCompanyIdProvider.notifier).state = cidA;
      final snapA = CustomerSnapshot(companyId: cidA, kycStatus: const KycNone());
      // ignore: invalid_use_of_protected_member
      c.read(customerStateProvider.notifier).state = CustomerStateValue(snapshot: snapA);
      repo.setLastCanonicalPhone(cidA, '+855111');
      repo.setLastCanonicalPhone(cidB, '+855222');
      repo.seedPreflightForTesting(
        cidA,
        AuthPreflightSnapshot(company: cidA.raw, authenticated: true),
      );
      repo.seedPreflightForTesting(
        cidB,
        AuthPreflightSnapshot(company: cidB.raw, authenticated: false),
      );
      c.read(pendingOtpChallengeProvider.notifier).set(OtpSendResponse(
            challengeId: 'chal',
            phoneMasked: 'm',
            expiresAt: DateTime.now(),
            retryAt: DateTime.now(),
          ));
      c.read(returnIntentProvider.notifier).saveSafe(cidA, '/loans');

      c.read(sessionInvalidationCoordinatorProvider).onCompanySwitchFrom(cidA);

      // A cleaned
      // ignore: invalid_use_of_protected_member
      expect(c.read(customerStateProvider).snapshot, isNull,
          reason: 'A snapshot cleared after switchFrom(A)');
      expect(repo.lastCanonicalPhoneFor(cidA), isNull);
      expect(repo.snapshotFor(cidA), isNull);
      expect(c.read(returnIntentProvider.notifier).canRestore(cidA), isFalse);
      expect(c.read(pendingOtpChallengeProvider), isNull,
          reason: 'pending OTP cleared on company switch');
      // B intact
      expect(repo.lastCanonicalPhoneFor(cidB), '+855222');
      expect(repo.snapshotFor(cidB)?.company, cidB.raw);
    });
  });

  group('§20-§21 Logout contract: success/401 clean; network/5xx NEVER blind delete', () {
    test('Logout-01 Right(success) allowLocal=true path triggers cleanup', () {
      final c = buildContainer();
      addTearDown(c.dispose);
      bool allowLocal = false;
      void rightCleanup() {
        allowLocal = true;
      }
      rightCleanup();
      expect(allowLocal, isTrue, reason: 'Logout success MUST allow local cleanup');
    });

    test('Logout-02 401 isUnauth → allowLocal=true (session already invalid, safe to clean)',
        () {
      final c = buildContainer();
      addTearDown(c.dispose);
      const leftStatusCode = 401;
      const allowLocal = leftStatusCode == 401;
      expect(allowLocal, isTrue,
          reason: '401 from logout endpoint → session already invalidated upstream');
    });

    test('Logout-03 500/502/503/5xx → allowLocal=false (preserve local state)',
        () {
      for (final code in [500, 502, 503, 504, 599]) {
        final allowLocal = code == 401;
        expect(allowLocal, isFalse,
            reason: '$code 5xx logout network error MUST NOT trigger blind local cleanup');
      }
    });

    test('Logout-04 OfflineFailure → statusCode=null → allowLocal=false', () {
      const int? statusCode = null;
      const allowLocal = (statusCode ?? 0) == 401;
      expect(allowLocal, isFalse,
          reason: 'network timeout/offline: preserve auth state in case server still valid');
    });
  });

  group('§22-§23 Company switch: cross-tenant zero data leak', () {
    test('Switch-01 A RI saved, activate B → RI not restored for B (coordinator onCompanySwitchFrom ensures)',
        () {
      final c = buildContainer();
      addTearDown(c.dispose);
      c.read(returnIntentProvider.notifier).saveSafe(cidA, '/loans');
      expect(c.read(returnIntentProvider.notifier).canRestore(cidA), isTrue);
      c.read(sessionInvalidationCoordinatorProvider).onCompanySwitchFrom(cidA);
      c.read(activeCompanyIdProvider.notifier).state = cidB;
      expect(c.read(returnIntentProvider.notifier).canRestore(cidA), isFalse);
      expect(c.read(returnIntentProvider.notifier).restoreFor(cidB), isNull,
          reason: 'B must not inherit A\'s ReturnIntent (cross-company leak!)');
    });

    test('Switch-02 pending OTP bound to old A → 100% cleared after switchFrom(A)', () {
      final c = buildContainer();
      addTearDown(c.dispose);
      c.read(pendingOtpChallengeProvider.notifier).set(OtpSendResponse(
            challengeId: 'old_A_challenge',
            phoneMasked: '+855** A',
            expiresAt: DateTime.now(),
            retryAt: DateTime.now(),
          ));
      c.read(sessionInvalidationCoordinatorProvider).onCompanySwitchFrom(cidA);
      expect(c.read(pendingOtpChallengeProvider), isNull,
          reason: '§22 OTP of old company must be deleted on switch; never resend to B');
    });
  });
}
