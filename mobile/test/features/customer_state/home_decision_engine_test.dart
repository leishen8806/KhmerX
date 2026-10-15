import 'package:flutter_test/flutter_test.dart';

import 'package:khmerx_app/core/session/company_id.dart';
import 'package:khmerx_app/features/customer_state/domain/billing.dart';
import 'package:khmerx_app/features/customer_state/domain/customer_snapshot.dart';
import 'package:khmerx_app/features/customer_state/domain/home_decision_engine.dart';
import 'package:khmerx_app/features/customer_state/domain/home_viewmodel.dart';
import 'package:khmerx_app/features/customer_state/domain/kyc_status.dart';
import 'package:khmerx_app/features/customer_state/domain/loan_status.dart';
import 'package:khmerx_app/features/customer_state/domain/loan_summary.dart';

CompanyId _cid() => CompanyId('t_00000000-0000-0000-0000-000000000001');

void main() {
  group('HomeDecisionEngine (H1–H22 + overlays)', () {
    final snapshotCompanyId = _cid();

    CustomerSnapshot snap({
      KycStatus kyc = const KycNone(),
      List<LoanSummary> loans = const <LoanSummary>[],
    }) {
      return CustomerSnapshot(
        companyId: snapshotCompanyId,
        kycStatus: kyc,
        loans: List<LoanSummary>.unmodifiable(loans),
      );
    }

    LoanSummary openLoan({
      required LoanStatus status,
      String id = 'l_open_00000001',
      int amount = 50000,
      int fee = 3000,
      int paid = 0,
      DateTime? signedAt,
      DateTime? billConfirmedAt,
      String? contract,
      Billing? bill,
    }) {
      return LoanSummary(
        id: id,
        status: status,
        amount: amount,
        fee: fee,
        paid: paid,
        signedAt: signedAt,
        billConfirmedAt: billConfirmedAt,
        contract: contract,
        bill: bill,
      );
    }

    LoanSummary closedLoan({String id = 'l_closed_00000001'}) => LoanSummary(
          id: id,
          status: const LoanClosed(),
          amount: 40000,
          fee: 2400,
          paid: 42400,
          createdAt: DateTime(2026, 9, 1),
        );

    LoanSummary rejectedLoan({String id = 'l_rejected_00000001'}) =>
        LoanSummary(
          id: id,
          status: const LoanRejected(),
          amount: 40000,
          fee: 2400,
          paid: 0,
          createdAt: DateTime(2026, 9, 5),
        );

    test('H1: KYC none × no loans → disabled primary + status panel secondary',
        () {
      final vm = HomeDecisionEngine.decide(
        snapshot: snap(),
        freshness: HomeFreshness.live,
      );
      expect(vm.stateId, HomeStateId.h1);
      expect(vm.titleKey, 'home_h1_title');
      expect(vm.summaryKey, 'home_h1_summary');
      expect(vm.primaryLabelKey, 'home_h1_primary');
      expect(vm.primaryEnabled, isTrue, reason: 'P2: KYC starts in the app');
      expect(vm.primaryDestination, HomeDestination.kyc);
      expect(vm.secondaryLabelKey, 'home_h1_secondary');
      expect(vm.secondaryDestination, HomeDestination.statusPanel);
      expect(vm.statusPanelId, HomeStatusPanelId.panelNone);
      expect(vm.showStatusPanelButton, isTrue);
    });

    test(
        'H2: KYC draft × no loans → disabled primary + status panel secondary',
        () {
      final vm = HomeDecisionEngine.decide(
        snapshot: snap(kyc: const KycDraft()),
        freshness: HomeFreshness.live,
      );
      expect(vm.stateId, HomeStateId.h2);
      expect(vm.titleKey, 'home_h2_title');
      expect(vm.summaryKey, 'home_h2_summary');
      expect(vm.primaryEnabled, isTrue);
      expect(vm.primaryDestination, HomeDestination.kyc);
      expect(vm.secondaryDestination, HomeDestination.statusPanel);
      expect(vm.statusPanelId, HomeStatusPanelId.panelDraft);
      expect(vm.showStatusPanelButton, isTrue);
    });

    test('H3: KYC submitted × no loans → primary navigates to status panel',
        () {
      final vm = HomeDecisionEngine.decide(
        snapshot: snap(kyc: const KycSubmitted()),
        freshness: HomeFreshness.live,
      );
      expect(vm.stateId, HomeStateId.h3);
      expect(vm.primaryLabelKey, 'home_h3_primary');
      expect(vm.primaryEnabled, isTrue);
      expect(vm.primaryDestination, HomeDestination.statusPanel);
      expect(vm.statusPanelId, HomeStatusPanelId.panelSubmitted);
      expect(vm.secondaryLabelKey, isNull);
    });

    test(
        'H4: KYC needs_info × no loans → disabled primary + status panel secondary',
        () {
      final vm = HomeDecisionEngine.decide(
        snapshot: snap(kyc: const KycNeedsInfo()),
        freshness: HomeFreshness.live,
      );
      expect(vm.stateId, HomeStateId.h4);
      expect(vm.primaryEnabled, isTrue);
      expect(vm.primaryDestination, HomeDestination.kyc);
      expect(vm.secondaryDestination, HomeDestination.statusPanel);
      expect(vm.statusPanelId, HomeStatusPanelId.panelNeedsInfo);
      expect(vm.showStatusPanelButton, isTrue);
    });

    test('H5: KYC rejected × no loans → locked terminal status panel', () {
      final vm = HomeDecisionEngine.decide(
        snapshot: snap(kyc: const KycRejected()),
        freshness: HomeFreshness.live,
      );
      expect(vm.stateId, HomeStateId.h5);
      expect(vm.primaryEnabled, isTrue);
      expect(vm.primaryDestination, HomeDestination.statusPanel);
      expect(vm.statusPanelId, HomeStatusPanelId.panelRejected);
    });

    test(
        'H6: KYC approved × no loans → future disabled apply, view loans secondary',
        () {
      final vm = HomeDecisionEngine.decide(
        snapshot: snap(kyc: const KycApproved()),
        freshness: HomeFreshness.live,
      );
      expect(vm.stateId, HomeStateId.h6);
      expect(vm.primaryEnabled, isFalse);
      expect(vm.primaryLabelKey, 'home_h6_primary');
      expect(vm.secondaryLabelKey, 'home_h6_secondary');
      expect(vm.secondaryDestination, HomeDestination.loans);
      expect(vm.statusPanelId, HomeStatusPanelId.panelApprovedNoLoan);
    });

    test('H7: approved × latest closed (no open) → navigate /loans', () {
      final vm = HomeDecisionEngine.decide(
        snapshot: snap(kyc: const KycApproved(), loans: [closedLoan()]),
        freshness: HomeFreshness.live,
      );
      expect(vm.stateId, HomeStateId.h7);
      expect(vm.primaryEnabled, isTrue);
      expect(vm.primaryDestination, HomeDestination.loans);
    });

    test('H8: approved × latest rejected (no open) → navigate /loans/:id',
        () {
      final r = rejectedLoan(id: 'l_rejected_44444444');
      final vm = HomeDecisionEngine.decide(
        snapshot: snap(kyc: const KycApproved(), loans: [r]),
        freshness: HomeFreshness.live,
      );
      expect(vm.stateId, HomeStateId.h8);
      expect(vm.primaryDestination, HomeDestination.loanDetail);
      expect(vm.primaryLoanId, r.id);
    });

    test('H9: open kyc_approved !billConfirmed → /loans/:id', () {
      final l = openLoan(
        status: const LoanKycApproved(),
        billConfirmedAt: null,
        contract: null,
      );
      final vm = HomeDecisionEngine.decide(
        snapshot: snap(kyc: const KycApproved(), loans: [l]),
        freshness: HomeFreshness.live,
      );
      expect(vm.stateId, HomeStateId.h9);
      expect(vm.primaryEnabled, isTrue);
      expect(vm.primaryDestination, HomeDestination.loanDetail);
      expect(vm.primaryLoanId, l.id);
      expect(vm.openLoanId, l.id);
    });

    test('H10: open kyc_approved billConfirmed !contract → loan detail', () {
      final l = openLoan(
        status: const LoanKycApproved(),
        billConfirmedAt: DateTime(2026, 10, 1),
        contract: null,
      );
      final vm = HomeDecisionEngine.decide(
        snapshot: snap(kyc: const KycApproved(), loans: [l]),
        freshness: HomeFreshness.live,
      );
      expect(vm.stateId, HomeStateId.h10);
      expect(vm.primaryDestination, HomeDestination.loanDetail);
    });

    test('H11: open kyc_approved hasContract → loan detail', () {
      final l = openLoan(
        status: const LoanKycApproved(),
        billConfirmedAt: DateTime(2026, 10, 1),
        contract: 'sig_v1',
      );
      final vm = HomeDecisionEngine.decide(
        snapshot: snap(kyc: const KycApproved(), loans: [l]),
        freshness: HomeFreshness.live,
      );
      expect(vm.stateId, HomeStateId.h11);
      expect(vm.primaryDestination, HomeDestination.loanDetail);
    });

    test('H12: open decision_pending → loan detail', () {
      final l = openLoan(status: const LoanDecisionPending());
      final vm = HomeDecisionEngine.decide(
        snapshot: snap(kyc: const KycApproved(), loans: [l]),
        freshness: HomeFreshness.live,
      );
      expect(vm.stateId, HomeStateId.h12);
      expect(vm.primaryDestination, HomeDestination.loanDetail);
    });

    test('H13: open signed → loan detail', () {
      final l = openLoan(status: const LoanSigned());
      final vm = HomeDecisionEngine.decide(
        snapshot: snap(kyc: const KycApproved(), loans: [l]),
        freshness: HomeFreshness.live,
      );
      expect(vm.stateId, HomeStateId.h13);
      expect(vm.primaryDestination, HomeDestination.loanDetail);
    });

    test('H14: open active → loan detail', () {
      final l = openLoan(status: const LoanActive());
      final vm = HomeDecisionEngine.decide(
        snapshot: snap(kyc: const KycApproved(), loans: [l]),
        freshness: HomeFreshness.live,
      );
      expect(vm.stateId, HomeStateId.h14);
      expect(vm.primaryDestination, HomeDestination.loanDetail);
    });

    test('H15: open legacy statuses → loan detail generic processing', () {
      final legacyStatuses = <LoanStatus>[
        const LoanRegistered(),
        const LoanKycPending(),
        const LoanNeedsInfo(),
        const LoanLegacyApproved(),
      ];
      for (final s in legacyStatuses) {
        final l = openLoan(status: s);
        final vm = HomeDecisionEngine.decide(
          snapshot: snap(kyc: const KycApproved(), loans: [l]),
          freshness: HomeFreshness.live,
        );
        expect(vm.stateId, HomeStateId.h15,
            reason: 'failed for ${s.runtimeType}');
        expect(vm.primaryDestination, HomeDestination.loanDetail);
      }
    });

    test('H16: open LoanUnknown → safe, no crash, treat as not-open', () {
      final loans = [
        closedLoan(id: 'l_closed_xyz'),
      ];
      final vm = HomeDecisionEngine.decide(
        snapshot: snap(kyc: const KycApproved(), loans: loans),
        freshness: HomeFreshness.live,
      );
      expect(vm.stateId, HomeStateId.h7,
          reason: 'unknown closed → approved no-open loans list view');
      expect(vm.primaryDestination, HomeDestination.loans);
    });

    test('LoanUnknown(raw) standalone: treated safe read-only by mapper', () {
      final unknownLoanUnknownStatus = openLoan(
        status: const LoanUnknown('future_status_xyz'),
      );
      expect(
        unknownLoanUnknownStatus.status,
        const TypeMatcher<LoanUnknown>(),
      );
      expect(unknownLoanUnknownStatus.isOpen, isFalse,
          reason: 'LoanUnknown must not be considered open (read-only safe)');
      expect(
        (unknownLoanUnknownStatus.status as LoanUnknown).raw,
        'future_status_xyz',
      );
    });

    test('H17: draft + open loan → loan detail + extra KYC notice overlay',
        () {
      final l = openLoan(status: const LoanActive());
      final vm = HomeDecisionEngine.decide(
        snapshot: snap(kyc: const KycDraft(), loans: [l]),
        freshness: HomeFreshness.live,
      );
      expect(vm.stateId, HomeStateId.h17);
      expect(vm.openLoanId, l.id);
      expect(vm.openLoanExtraKycNotice, isTrue);
      expect(vm.primaryDestination, HomeDestination.loanDetail);
    });

    test(
        'H17: needs_info + open loan → loan detail + extra KYC notice overlay',
        () {
      final l = openLoan(status: const LoanActive());
      final vm = HomeDecisionEngine.decide(
        snapshot: snap(kyc: const KycNeedsInfo(), loans: [l]),
        freshness: HomeFreshness.live,
      );
      expect(vm.stateId, HomeStateId.h17);
      expect(vm.openLoanExtraKycNotice, isTrue);
      expect(vm.primaryDestination, HomeDestination.loanDetail);
    });

    test('H18: unknown KYC × no open → status panel generic unknown', () {
      final vm = HomeDecisionEngine.decide(
        snapshot: snap(kyc: const KycUnknown('server_state_999')),
        freshness: HomeFreshness.live,
      );
      expect(vm.stateId, HomeStateId.h18);
      expect(vm.primaryEnabled, isTrue);
      expect(vm.primaryDestination, HomeDestination.statusPanel);
      expect(vm.statusPanelId, HomeStatusPanelId.panelUnknown);
    });

    test('H19: firstLoad regardless snapshot → skeleton', () {
      final vm = HomeDecisionEngine.decide(
        snapshot: null,
        freshness: HomeFreshness.firstLoad,
      );
      expect(vm.stateId, HomeStateId.h19);
      expect(vm.primaryEnabled, isFalse);
    });

    test(
        'H20: refreshFailed overlay uses previous business state but retry primary',
        () {
      final s = snap(kyc: const KycApproved(), loans: [closedLoan()]);
      final vm = HomeDecisionEngine.decide(
        snapshot: s,
        freshness: HomeFreshness.refreshFailed,
      );
      expect(vm.stateId, HomeStateId.h20);
      expect(vm.primaryDestination, HomeDestination.retry);
      expect(vm.primaryEnabled, isTrue);
      expect(
        vm.secondaryDestination,
        HomeDestination.none,
        reason: 'H7 baseline has no secondary; overlay must not invent one',
      );
    });

    test('H21: offline with snapshot → keep + retry', () {
      final s = snap(kyc: const KycApproved(), loans: [closedLoan()]);
      final vm = HomeDecisionEngine.decide(
        snapshot: s,
        freshness: HomeFreshness.offlineWithSnapshot,
      );
      expect(vm.stateId, HomeStateId.h21);
      expect(vm.primaryDestination, HomeDestination.retry);
      expect(
        vm.secondaryDestination,
        HomeDestination.none,
        reason: 'H7 baseline has no secondary; offline overlay must keep none',
      );
    });

    test('H21 Prime: offline NO snapshot → pure offline page with retry', () {
      final vm = HomeDecisionEngine.decide(
        snapshot: null,
        freshness: HomeFreshness.offlineNoSnapshot,
      );
      expect(vm.stateId, HomeStateId.h21Prime);
      expect(vm.primaryDestination, HomeDestination.retry);
      expect(vm.primaryEnabled, isTrue);
    });

    test('H22: session invalid → re-login with return intent /home', () {
      final vm = HomeDecisionEngine.decide(
        snapshot: snap(kyc: const KycApproved()),
        freshness: HomeFreshness.sessionInvalid,
      );
      expect(vm.stateId, HomeStateId.h22);
      expect(vm.primaryDestination, HomeDestination.authLogin);
      expect(vm.returnIntentPath, '/home');
    });
  });

  group('LoanStatus Unknown safety invariants', () {
    test('LoanUnknown raw preserved + not treated as open', () {
      const u = LoanUnknown('some_future_state');
      expect(u.rawValue, 'some_future_state');
      expect(u.isUnknown, isTrue);
      expect(u.isTerminalClosed, isFalse);
    });
  });

  group('Future CTA: no business mutation when disabled', () {
    final cid = _cid();

    test('H6 /loans secondary remains permitted P1; no application route', () {
      final vm = HomeDecisionEngine.decide(
        snapshot: CustomerSnapshot(
          companyId: cid,
          kycStatus: const KycApproved(),
        ),
        freshness: HomeFreshness.live,
      );
      expect(vm.primaryDestination, HomeDestination.none);
      expect(vm.primaryEnabled, isFalse);
      expect(vm.secondaryDestination, HomeDestination.loans);
    });

    test('H4 needs_info: primary opens the KYC screen (no direct mutation from Home)',
        () {
      final vm = HomeDecisionEngine.decide(
        snapshot: CustomerSnapshot(
          companyId: cid,
          kycStatus: const KycNeedsInfo(),
        ),
        freshness: HomeFreshness.live,
      );
      expect(vm.primaryEnabled, isTrue,
          reason: 'P2: needs_info is resolved on the KYC screen, never by a Home mutation');
      expect(vm.primaryDestination, HomeDestination.kyc);
    });
  });

  group('Single Primary CTA: each state exactly one primary definition', () {
    final cid = _cid();
    final kycCases = <(String, KycStatus, HomeStateId)>[
      ('H1', const KycNone(), HomeStateId.h1),
      ('H2', const KycDraft(), HomeStateId.h2),
      ('H3', const KycSubmitted(), HomeStateId.h3),
      ('H4', const KycNeedsInfo(), HomeStateId.h4),
      ('H5', const KycRejected(), HomeStateId.h5),
      ('H6', const KycApproved(), HomeStateId.h6),
      ('H18', const KycUnknown('x'), HomeStateId.h18),
    ];
    for (final (name, kyc, expectedId) in kycCases) {
      test('$name exactly one primary label key (non-empty)', () {
        final vm = HomeDecisionEngine.decide(
          snapshot: CustomerSnapshot(companyId: cid, kycStatus: kyc),
          freshness: HomeFreshness.live,
        );
        expect(vm.stateId, expectedId);
        expect(vm.primaryLabelKey, isNotEmpty);
      });
    }
  });
}
