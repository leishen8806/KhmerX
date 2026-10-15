import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/app/bootstrap/providers.dart';
import 'package:khmerx_app/core/session/company_id.dart';

import '../../../support/fake_secure_kv.dart';

void main() {
  group('G1 Candidate vs Active Invariant (P1-01 root cause lock)', () {
    late CompanyId idA;
    late CompanyId idB;
    late ProviderContainer c;

    setUp(() {
      idA = CompanyId('t_aaaaaaaa-1234-1234-1234-123456789012');
      idB = CompanyId('t_bbbbbbbb-1234-1234-1234-123456789012');
      c = ProviderContainer(
        overrides: [
          secureKvProvider.overrideWithValue(FakeSecureKv()),
        ],
      );
    });

    tearDown(() => c.dispose());

    test('CI-01 write pendingCandidate(B) when active=null → active STAYS null', () {
      expect(c.read(activeCompanyIdProvider), isNull);
      expect(c.read(pendingCandidateCompanyProvider), isNull);

      c.read(pendingCandidateCompanyProvider.notifier).set(idB);

      expect(c.read(pendingCandidateCompanyProvider), idB,
          reason: 'pendingCandidate MUST be stored for confirmation flow');
      expect(c.read(activeCompanyIdProvider), isNull,
          reason:
              'CRITICAL INVARIANT: Setting pendingCandidate MUST NEVER implicitly set active. '
              'Prevents A/B cookie cross-contamination (CF-0 guard).');
    });

    test('CI-02 active=A → write pendingCandidate(B) → active STILL =A (isolation)',
        () async {
      await c.read(activeCompanyIdProvider.notifier).activate(idA);
      expect(c.read(activeCompanyIdProvider), idA);

      c.read(pendingCandidateCompanyProvider.notifier).set(idB);

      expect(c.read(pendingCandidateCompanyProvider), idB);
      expect(c.read(activeCompanyIdProvider), idA,
          reason:
              'While user browses/confirms candidate B, A session (active, cookies, API context) '
              'MUST remain intact until user explicitly taps Confirm on B. '
              'Any premature switch breaks CF-0 exactly-one payease_company.');
    });

    test('CI-03 Confirm flow: activate(B) after preflight → active=B + pending cleared',
        () async {
      c.read(pendingCandidateCompanyProvider.notifier).set(idB);

      await c.read(activeCompanyIdProvider.notifier).activate(idB);
      c.read(pendingCandidateCompanyProvider.notifier).set(null);

      expect(c.read(activeCompanyIdProvider), idB,
          reason: 'After user explicit Confirm, active becomes new company.');
      expect(c.read(pendingCandidateCompanyProvider), isNull,
          reason:
              'After activate, pendingCandidate MUST be null so that future Select '
              'page starts fresh (no stale candidate).');
    });

    test('CI-04 Cancel (Choose another) → pendingCandidate=null; active preserved (A)',
        () async {
      await c.read(activeCompanyIdProvider.notifier).activate(idA);
      c.read(pendingCandidateCompanyProvider.notifier).set(idB);

      c.read(pendingCandidateCompanyProvider.notifier).set(null);

      expect(c.read(activeCompanyIdProvider), idA,
          reason: 'Cancelling candidate selection MUST NOT destroy A active session.');
      expect(c.read(pendingCandidateCompanyProvider), isNull);
    });
  });
}
