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

final CompanyId _cidA = CompanyId('t_00000000-0000-0000-0000-000000000001');
final CompanyId _cidB = CompanyId('t_00000000-0000-0000-0000-000000000002');

ProviderContainer _buildCoordinatorContainer() {
  final AppConfig config = AppConfig.dev();
  final store = CompanyCookieStore();
  final secureKv = SecureKv(const FlutterSecureStorage());
  final factory = ApiClientFactory(config: config, store: store, secureKv: secureKv);
  final sm = SessionManager();
  final authRepo = AuthRepository(factory: factory, sessionManager: sm);
  return ProviderContainer(
    overrides: [
      appConfigProvider.overrideWithValue(config),
      secureKvProvider.overrideWithValue(secureKv),
      authRepositoryProvider.overrideWithValue(authRepo),
    ],
  );
}

void main() {
  group('§8 Safe Return Intent company-scoped restoration', () {
    late ProviderContainer c;
    setUp(() => c = ProviderContainer());
    tearDown(() => c.dispose());

    test('RI-01 401 from Home → reauth → restore /home', () {
      final notifier = c.read(returnIntentProvider.notifier);
      notifier.saveSafe(_cidA, '/home');
      final ri = c.read(returnIntentProvider)!;
      expect(ri.companyId.raw, _cidA.raw);
      expect(ri.location, '/home');
      expect(ri.method, 'GET');
      expect(ri.isSafe, isTrue);
      expect(notifier.canRestore(_cidA), isTrue);
      expect(notifier.canRestore(_cidB), isFalse);
      expect(notifier.restoreFor(_cidA), '/home');
      expect(c.read(returnIntentProvider), isNull);
    });

    test('RI-02 401 from Loans → reauth → restore /loans', () {
      final notifier = c.read(returnIntentProvider.notifier);
      notifier.saveSafe(_cidA, '/loans');
      expect(notifier.restoreFor(_cidA), '/loans');
      expect(c.read(returnIntentProvider), isNull);
    });

    test('RI-03 401 from Loan Detail /loans/l_X → restore same detail (prefix whitelist)', () {
      final notifier = c.read(returnIntentProvider.notifier);
      const detail = '/loans/l_91f05b1f-27b0-43b9-9e0f-27d4bf1b66b2';
      notifier.saveSafe(_cidA, detail);
      final ri = c.read(returnIntentProvider)!;
      expect(ReturnIntentNotifier.isSafeRoute(detail), isTrue);
      expect(ri.location, detail);
      expect(notifier.restoreFor(_cidA), detail);
    });

    test('RI-04 401 from Me → reauth → restore /me', () {
      final notifier = c.read(returnIntentProvider.notifier);
      notifier.saveSafe(_cidA, '/me');
      expect(notifier.restoreFor(_cidA), '/me');
    });

    test('RI-05 logout clears same-company RI (canRestore=false)', () {
      final notifier = c.read(returnIntentProvider.notifier);
      notifier.saveSafe(_cidA, '/home');
      expect(notifier.canRestore(_cidA), isTrue);
      notifier.clearForCompany(_cidA);
      expect(c.read(returnIntentProvider), isNull);
      expect(notifier.canRestore(_cidA), isFalse);
    });

    test('RI-06 company switch A→B clears A RI; B cannot restore A', () {
      final notifier = c.read(returnIntentProvider.notifier);
      notifier.saveSafe(_cidA, '/loans');
      expect(notifier.canRestore(_cidA), isTrue);
      notifier.clearForCompany(_cidA);
      expect(c.read(returnIntentProvider), isNull);
      expect(notifier.canRestore(_cidA), isFalse);
      expect(notifier.canRestore(_cidB), isFalse);
    });

    test('RI-07 cross-company restore blocked: A RI saved → restoreFor(B) = null, A intact', () {
      final notifier = c.read(returnIntentProvider.notifier);
      notifier.saveSafe(_cidA, '/me/password');
      expect(notifier.restoreFor(_cidB), isNull);
      final ri = c.read(returnIntentProvider)!;
      expect(ri.companyId.raw, _cidA.raw);
      expect(ri.location, '/me/password');
      expect(notifier.restoreFor(_cidA), '/me/password');
    });

    test('RI-10 unsafe mutation route rejected: /auth/password not saved; empty also rejected', () {
      final notifier = c.read(returnIntentProvider.notifier);
      expect(ReturnIntentNotifier.isSafeRoute('/auth/password'), isFalse);
      expect(ReturnIntentNotifier.isSafeRoute('/auth/login'), isFalse);
      expect(ReturnIntentNotifier.isSafeRoute('/api/kyc/upload'), isFalse);
      notifier.saveSafe(_cidA, '/auth/password');
      expect(c.read(returnIntentProvider), isNull);
      notifier.saveSafe(_cidA, '');
      expect(c.read(returnIntentProvider), isNull);
    });
  });

  group('§22 Company switch invalidation matrix (SessionInvalidationCoordinator)', () {
    late ProviderContainer c;
    setUp(() => c = _buildCoordinatorContainer());
    tearDown(() => c.dispose());

    test('RI-08 switch A→B: pending OTP for A cleared', () {
      final otp = OtpSendResponse(
        challengeId: 'c_1',
        phoneMasked: '+855** *** *123',
        expiresAt: DateTime.now().add(const Duration(minutes: 5)),
        retryAt: DateTime.now().add(const Duration(seconds: 60)),
      );
      c.read(pendingOtpChallengeProvider.notifier).set(otp);
      expect(c.read(pendingOtpChallengeProvider), isNotNull);
      c.read(sessionInvalidationCoordinatorProvider).onCompanySwitchFrom(_cidA);
      expect(c.read(pendingOtpChallengeProvider), isNull);
    });

    test('RI-09 switch A→B: A CustomerSnapshot cleared (B not affected)', () {
      final snapA = CustomerSnapshot(
        companyId: _cidA,
        kycStatus: const KycNone(),
      );
      final stateNotifier = c.read(customerStateProvider.notifier);
      // ignore: invalid_use_of_protected_member
      stateNotifier.state = CustomerStateValue(snapshot: snapA);
      // ignore: invalid_use_of_protected_member
      expect(c.read(customerStateProvider).snapshot?.companyId.raw, _cidA.raw);
      c.read(sessionInvalidationCoordinatorProvider).onCompanySwitchFrom(_cidA);
      // ignore: invalid_use_of_protected_member
      expect(c.read(customerStateProvider).snapshot, isNull);
    });
  });
}
