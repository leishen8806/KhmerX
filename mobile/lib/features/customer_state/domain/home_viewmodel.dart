import 'package:equatable/equatable.dart';

enum HomeStateId {
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  h7,
  h8,
  h9,
  h10,
  h11,
  h12,
  h13,
  h14,
  h15,
  h16,
  h17,
  h18,
  h19,
  h20,
  h21,
  h21Prime,
  h22,
}

enum HomeStatusPanelId {
  panelNone,
  panelDraft,
  panelSubmitted,
  panelNeedsInfo,
  panelRejected,
  panelApprovedNoLoan,
  panelUnknown,
}

enum HomeDestination {
  kyc,
  statusPanel,
  loans,
  loanDetail,
  authLogin,
  retry,
  none,
}

final class HomeViewModel extends Equatable {
  const HomeViewModel({
    required this.stateId,
    required this.titleKey,
    required this.summaryKey,
    required this.primaryLabelKey,
    required this.primaryEnabled,
    this.primaryDestination = HomeDestination.none,
    this.primaryLoanId,
    this.secondaryLabelKey,
    this.secondaryDestination = HomeDestination.none,
    this.secondaryLoanId,
    this.statusPanelId,
    this.showStatusPanelButton = false,
    this.returnIntentPath = '/home',
    this.openLoanId,
    this.openLoanExtraKycNotice = false,
  });

  final HomeStateId stateId;
  final String titleKey;
  final String summaryKey;
  final String primaryLabelKey;
  final bool primaryEnabled;
  final HomeDestination primaryDestination;
  final String? primaryLoanId;
  final String? secondaryLabelKey;
  final HomeDestination secondaryDestination;
  final String? secondaryLoanId;
  final HomeStatusPanelId? statusPanelId;
  final bool showStatusPanelButton;
  final String returnIntentPath;
  final String? openLoanId;
  final bool openLoanExtraKycNotice;

  @override
  List<Object?> get props => [
        stateId,
        titleKey,
        summaryKey,
        primaryLabelKey,
        primaryEnabled,
        primaryDestination,
        primaryLoanId,
        secondaryLabelKey,
        secondaryDestination,
        secondaryLoanId,
        statusPanelId,
        showStatusPanelButton,
        returnIntentPath,
        openLoanId,
        openLoanExtraKycNotice,
      ];
}

enum HomeFreshness {
  firstLoad,
  live,
  refreshFailed,
  offlineWithSnapshot,
  offlineNoSnapshot,
  sessionInvalid,
}
