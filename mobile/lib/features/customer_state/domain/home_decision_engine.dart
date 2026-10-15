import '../../../../core/logging/safe_logger.dart';
import 'customer_snapshot.dart';
import 'home_viewmodel.dart';
import 'kyc_status.dart';
import 'loan_status.dart';
import 'loan_summary.dart';

final class HomeDecisionEngine {
  HomeDecisionEngine._();

  static HomeViewModel decide({
    required CustomerSnapshot? snapshot,
    required HomeFreshness freshness,
  }) {
    if (freshness == HomeFreshness.sessionInvalid) {
      return const HomeViewModel(
        stateId: HomeStateId.h22,
        titleKey: 'home_h22_title',
        summaryKey: 'home_h22_summary',
        primaryLabelKey: 'home_h22_primary',
        primaryEnabled: true,
        primaryDestination: HomeDestination.authLogin,
        returnIntentPath: '/home',
      );
    }

    if (freshness == HomeFreshness.firstLoad) {
      return const HomeViewModel(
        stateId: HomeStateId.h19,
        titleKey: 'home_h19_title',
        summaryKey: 'home_h19_summary',
        primaryLabelKey: 'home_h19_primary',
        primaryEnabled: false,
      );
    }

    if (freshness == HomeFreshness.offlineNoSnapshot) {
      return const HomeViewModel(
        stateId: HomeStateId.h21Prime,
        titleKey: 'home_h21p_title',
        summaryKey: 'home_h21p_summary',
        primaryLabelKey: 'home_h21p_primary',
        primaryEnabled: true,
        primaryDestination: HomeDestination.retry,
      );
    }

    if (snapshot == null) {
      SafeLogger.w(
        'HomeDecisionEngine: snapshot null in non-firstLoad path; fallback to H19',
      );
      return const HomeViewModel(
        stateId: HomeStateId.h19,
        titleKey: 'home_h19_title',
        summaryKey: 'home_h19_summary',
        primaryLabelKey: 'home_h19_primary',
        primaryEnabled: false,
      );
    }

    final base = _decideBusiness(snapshot);

    switch (freshness) {
      case HomeFreshness.refreshFailed:
        return base.copyWithFreshnessOverlay(HomeStateId.h20);
      case HomeFreshness.offlineWithSnapshot:
        return base.copyWithFreshnessOverlay(HomeStateId.h21);
      case HomeFreshness.live:
      case HomeFreshness.firstLoad:
      case HomeFreshness.offlineNoSnapshot:
      case HomeFreshness.sessionInvalid:
        return base;
    }
  }

  static HomeViewModel _decideBusiness(CustomerSnapshot s) {
    final kyc = s.kycStatus;
    final loans = s.loansSortedByCreatedDesc();
    final openLoan = _findFirstOpen(loans);

    if (openLoan != null) {
      return _loanDriven(s, openLoan);
    }

    return _kycDriven(kyc, loans);
  }

  static LoanSummary? _findFirstOpen(List<LoanSummary> loans) {
    for (final l in loans) {
      if (l.isOpen) return l;
    }
    return null;
  }

  static LoanSummary? _latestLoan(List<LoanSummary> loans) {
    if (loans.isEmpty) return null;
    return loans.first;
  }

  static HomeViewModel _loanDriven(CustomerSnapshot s, LoanSummary open) {
    final bool kycNotice = s.kycStatus.isDraft || s.kycStatus.isNeedsInfo;

    HomeStateId id;
    String titleKey;
    String summaryKey;

    final status = open.status;
    switch (status) {
      case LoanKycApproved():
        if (open.billConfirmedAt == null) {
          id = HomeStateId.h9;
          titleKey = 'home_h9_title';
          summaryKey = 'home_h9_summary';
        } else if (!open.hasContract) {
          id = HomeStateId.h10;
          titleKey = 'home_h10_title';
          summaryKey = 'home_h10_summary';
        } else {
          id = HomeStateId.h11;
          titleKey = 'home_h11_title';
          summaryKey = 'home_h11_summary';
        }
      case LoanDecisionPending():
        id = HomeStateId.h12;
        titleKey = 'home_h12_title';
        summaryKey = 'home_h12_summary';
      case LoanSigned():
        id = HomeStateId.h13;
        titleKey = 'home_h13_title';
        summaryKey = 'home_h13_summary';
      case LoanActive():
        id = HomeStateId.h14;
        titleKey = 'home_h14_title';
        summaryKey = 'home_h14_summary';
      case LoanRegistered() ||
            LoanKycPending() ||
            LoanNeedsInfo() ||
            LoanLegacyApproved():
        id = HomeStateId.h15;
        titleKey = 'home_h15_title';
        summaryKey = 'home_h15_summary';
      case LoanUnknown() || LoanClosed() || LoanRejected():
        id = HomeStateId.h16;
        titleKey = 'home_h16_title';
        summaryKey = 'home_h16_summary';
    }

    if (kycNotice && id != HomeStateId.h16) {
      id = HomeStateId.h17;
    }

    final primaryKey = 'home_${_idCode(id)}_primary';
    return HomeViewModel(
      stateId: id,
      titleKey: titleKey,
      summaryKey: summaryKey,
      primaryLabelKey: primaryKey,
      primaryEnabled: true,
      primaryDestination: HomeDestination.loanDetail,
      primaryLoanId: open.id,
      openLoanId: open.id,
      openLoanExtraKycNotice: kycNotice,
    );
  }

  static String _idCode(HomeStateId id) => switch (id) {
        HomeStateId.h1 => 'h1',
        HomeStateId.h2 => 'h2',
        HomeStateId.h3 => 'h3',
        HomeStateId.h4 => 'h4',
        HomeStateId.h5 => 'h5',
        HomeStateId.h6 => 'h6',
        HomeStateId.h7 => 'h7',
        HomeStateId.h8 => 'h8',
        HomeStateId.h9 => 'h9',
        HomeStateId.h10 => 'h10',
        HomeStateId.h11 => 'h11',
        HomeStateId.h12 => 'h12',
        HomeStateId.h13 => 'h13',
        HomeStateId.h14 => 'h14',
        HomeStateId.h15 => 'h15',
        HomeStateId.h16 => 'h16',
        HomeStateId.h17 => 'h17',
        HomeStateId.h18 => 'h18',
        HomeStateId.h19 => 'h19',
        HomeStateId.h20 => 'h20',
        HomeStateId.h21 => 'h21',
        HomeStateId.h21Prime => 'h21p',
        HomeStateId.h22 => 'h22',
      };

  static HomeViewModel _kycDriven(KycStatus kyc, List<LoanSummary> loans) {
    final latest = _latestLoan(loans);

    return switch (kyc) {
      KycNone() => const HomeViewModel(
          stateId: HomeStateId.h1,
          titleKey: 'home_h1_title',
          summaryKey: 'home_h1_summary',
          primaryLabelKey: 'home_h1_primary',
          primaryEnabled: true,
          primaryDestination: HomeDestination.kyc,
          secondaryLabelKey: 'home_h1_secondary',
          secondaryDestination: HomeDestination.statusPanel,
          statusPanelId: HomeStatusPanelId.panelNone,
          showStatusPanelButton: true,
        ),
      KycDraft() => const HomeViewModel(
          stateId: HomeStateId.h2,
          titleKey: 'home_h2_title',
          summaryKey: 'home_h2_summary',
          primaryLabelKey: 'home_h2_primary',
          primaryEnabled: true,
          primaryDestination: HomeDestination.kyc,
          secondaryLabelKey: 'home_h2_secondary',
          secondaryDestination: HomeDestination.statusPanel,
          statusPanelId: HomeStatusPanelId.panelDraft,
          showStatusPanelButton: true,
        ),
      KycSubmitted() => const HomeViewModel(
          stateId: HomeStateId.h3,
          titleKey: 'home_h3_title',
          summaryKey: 'home_h3_summary',
          primaryLabelKey: 'home_h3_primary',
          primaryEnabled: true,
          primaryDestination: HomeDestination.statusPanel,
          statusPanelId: HomeStatusPanelId.panelSubmitted,
          showStatusPanelButton: false,
        ),
      KycNeedsInfo() => const HomeViewModel(
          stateId: HomeStateId.h4,
          titleKey: 'home_h4_title',
          summaryKey: 'home_h4_summary',
          primaryLabelKey: 'home_h4_primary',
          primaryEnabled: true,
          primaryDestination: HomeDestination.kyc,
          secondaryLabelKey: 'home_h4_secondary',
          secondaryDestination: HomeDestination.statusPanel,
          statusPanelId: HomeStatusPanelId.panelNeedsInfo,
          showStatusPanelButton: true,
        ),
      KycRejected() => const HomeViewModel(
          stateId: HomeStateId.h5,
          titleKey: 'home_h5_title',
          summaryKey: 'home_h5_summary',
          primaryLabelKey: 'home_h5_primary',
          primaryEnabled: true,
          primaryDestination: HomeDestination.statusPanel,
          statusPanelId: HomeStatusPanelId.panelRejected,
          showStatusPanelButton: false,
        ),
      KycApproved() => _kycApprovedNoOpen(latest),
      KycUnknown() => const HomeViewModel(
          stateId: HomeStateId.h18,
          titleKey: 'home_h18_title',
          summaryKey: 'home_h18_summary',
          primaryLabelKey: 'home_h18_primary',
          primaryEnabled: true,
          primaryDestination: HomeDestination.statusPanel,
          statusPanelId: HomeStatusPanelId.panelUnknown,
          showStatusPanelButton: false,
        ),
    };
  }

  static HomeViewModel _kycApprovedNoOpen(LoanSummary? latest) {
    if (latest == null) {
      return const HomeViewModel(
        stateId: HomeStateId.h6,
        titleKey: 'home_h6_title',
        summaryKey: 'home_h6_summary',
        primaryLabelKey: 'home_h6_primary',
        primaryEnabled: false,
        secondaryLabelKey: 'home_h6_secondary',
        secondaryDestination: HomeDestination.loans,
        statusPanelId: HomeStatusPanelId.panelApprovedNoLoan,
        showStatusPanelButton: false,
      );
    }
    if (latest.status.isClosed) {
      return const HomeViewModel(
        stateId: HomeStateId.h7,
        titleKey: 'home_h7_title',
        summaryKey: 'home_h7_summary',
        primaryLabelKey: 'home_h7_primary',
        primaryEnabled: true,
        primaryDestination: HomeDestination.loans,
      );
    }
    if (latest.status.isRejected) {
      return HomeViewModel(
        stateId: HomeStateId.h8,
        titleKey: 'home_h8_title',
        summaryKey: 'home_h8_summary',
        primaryLabelKey: 'home_h8_primary',
        primaryEnabled: true,
        primaryDestination: HomeDestination.loanDetail,
        primaryLoanId: latest.id,
      );
    }
    return const HomeViewModel(
      stateId: HomeStateId.h7,
      titleKey: 'home_h7_title',
      summaryKey: 'home_h7_summary',
      primaryLabelKey: 'home_h7_primary',
      primaryEnabled: true,
      primaryDestination: HomeDestination.loans,
    );
  }
}

extension _HomeViewModelOverlay on HomeViewModel {
  HomeViewModel copyWithFreshnessOverlay(HomeStateId overlayId) {
    assert(
      overlayId == HomeStateId.h20 || overlayId == HomeStateId.h21,
      'overlay must be H20 or H21',
    );
    return HomeViewModel(
      stateId: overlayId,
      titleKey: titleKey,
      summaryKey: summaryKey,
      primaryLabelKey: overlayId == HomeStateId.h20
          ? 'home_h20_primary'
          : 'home_h21_primary',
      primaryEnabled: true,
      primaryDestination: HomeDestination.retry,
      primaryLoanId: primaryLoanId,
      secondaryLabelKey: secondaryLabelKey,
      secondaryDestination: secondaryDestination,
      secondaryLoanId: secondaryLoanId,
      statusPanelId: statusPanelId,
      showStatusPanelButton: showStatusPanelButton,
      returnIntentPath: returnIntentPath,
      openLoanId: openLoanId,
      openLoanExtraKycNotice: openLoanExtraKycNotice,
    );
  }
}
