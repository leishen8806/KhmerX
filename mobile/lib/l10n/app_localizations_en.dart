// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'KhmerX';

  @override
  String get errorNetworkConnectionTimeout =>
      'Connection timed out. Please try again.';

  @override
  String get errorNetworkSendTimeout => 'Request timed out. Please try again.';

  @override
  String get errorNetworkReceiveTimeout =>
      'Response timed out. Please try again.';

  @override
  String get errorNetworkUnknown => 'Network error occurred.';

  @override
  String get errorAuthUnauthenticated => 'Please log in to continue.';

  @override
  String get errorAuthSessionExpired =>
      'Your session has expired. Please log in again.';

  @override
  String get errorAuthLoginPageExpired =>
      'Login page has expired. Please refresh.';

  @override
  String get errorAuthInvalidCredentials => 'Invalid phone number or password.';

  @override
  String get errorAuthOtpUndeliverable =>
      'Unable to send OTP. Please try again later.';

  @override
  String get errorAuthTooManyAttempts =>
      'Too many attempts. Please try again later.';

  @override
  String get errorForbiddenCrossSite => 'Cross-site access is not allowed.';

  @override
  String get errorForbiddenInvalidCompany => 'Invalid company access.';

  @override
  String get errorForbiddenRegistrationIncomplete =>
      'Please complete registration first.';

  @override
  String get errorForbiddenNotOwner =>
      'You do not have permission to perform this action.';

  @override
  String get errorConflictDataChanged =>
      'Data has been modified. Please refresh.';

  @override
  String get errorConflictVersionMismatch =>
      'Version mismatch. Please refresh.';

  @override
  String get errorConflictQuoteExpired =>
      'Quote has expired. Please request a new one.';

  @override
  String get errorConflictAlreadySigned => 'Document has already been signed.';

  @override
  String get errorConflictStatusChanged =>
      'Status has changed. Please refresh.';

  @override
  String get errorRateLimit => 'Too many requests. Please wait a moment.';

  @override
  String get errorServiceUnavailable => 'Service is temporarily unavailable.';

  @override
  String get errorOffline => 'You are offline. Please check your connection.';

  @override
  String get errorUnknown => 'Something went wrong. Please try again.';

  @override
  String get appTitle => 'KhmerX';

  @override
  String get commonLoading => 'Loading...';

  @override
  String get commonError => 'An error occurred.';

  @override
  String get commonRetry => 'Retry';

  @override
  String get commonCancel => 'Cancel';

  @override
  String get commonConfirm => 'Confirm';

  @override
  String get commonContinue => 'Continue';

  @override
  String get commonSave => 'Save';

  @override
  String get commonBack => 'Back';

  @override
  String get commonOk => 'OK';

  @override
  String get commonOffline => 'You are offline.';

  @override
  String get errorConflict => 'Data has changed. Please refresh.';

  @override
  String get errorSessionExpired => 'Session has expired. Please log in again.';

  @override
  String get errorForbidden => 'Access denied.';

  @override
  String get errorCompanyInvalid => 'This company is not available.';

  @override
  String get errorAuthInvalid => 'Invalid phone or password.';

  @override
  String get errorNetwork => 'Network error.';

  @override
  String get startupTitle => 'Starting...';

  @override
  String get companySelectTitle => 'Select Company';

  @override
  String get companySelectScan => 'Scan QR Code';

  @override
  String get companySelectPaste => 'Paste Link';

  @override
  String get companySelectRecent => 'Recent Companies';

  @override
  String get authLoginTitle => 'Log In';

  @override
  String get authLoginPhoneHint => 'Phone number';

  @override
  String get authLoginPasswordHint => 'Password';

  @override
  String get authLoginOtp => 'Verify OTP Code';

  @override
  String get authLoginPassword => 'Log in with password';

  @override
  String get homePlaceholderTitle => 'Home';

  @override
  String get homePlaceholderBody => 'Waiting for UX contract.';

  @override
  String get featureWithdrawDisabled => 'Feature is not available yet.';

  @override
  String get featureRepayDisabled => 'Feature is not available yet.';

  @override
  String get languageTitle => 'Language';

  @override
  String get languageEn => 'English';

  @override
  String get languageKm => 'ភាសាខ្មែរ';

  @override
  String get languageZh => '中文';

  @override
  String get settingsTitle => 'Settings';

  @override
  String get aboutTitle => 'About KhmerX';

  @override
  String aboutVersion(String version) {
    return 'Version $version';
  }

  @override
  String get homeTitle => 'Home';

  @override
  String get homeRefresh => 'Refresh';

  @override
  String get homeEmptyPrimary => 'Continue';

  @override
  String get home_company_label => 'Company';

  @override
  String get home_user_label => 'Account';

  @override
  String get home_status_label => 'Current status';

  @override
  String get home_loan_summary_label => 'Loan summary';

  @override
  String get home_remaining_label => 'Remaining due';

  @override
  String get home_due_date_label => 'Due date';

  @override
  String get home_due_date_missing => '—';

  @override
  String get home_term_label => 'Term';

  @override
  String get home_term_days_unit => 'days';

  @override
  String get home_principal_label => 'Principal';

  @override
  String get home_total_repay_label => 'Total repayable';

  @override
  String get home_paid_label => 'Paid';

  @override
  String get home_last_updated => 'Last updated';

  @override
  String get home_last_updated_never => 'Not updated yet';

  @override
  String get home_semantics_business_card => 'Business status card';

  @override
  String get home_semantics_status_panel_open =>
      'Open status explanation panel';

  @override
  String get home_freshness_stale_offline =>
      'Offline. Data shown may be outdated.';

  @override
  String get home_freshness_refresh_failed =>
      'Refresh failed. Retaining last loaded data.';

  @override
  String get home_freshness_session_invalid =>
      'Session expired. Please sign in again.';

  @override
  String get home_waiting_state_hint =>
      'Waiting for update. Refreshes automatically while open.';

  @override
  String get home_open_loan_kyc_notice_extra =>
      'Your KYC profile still needs attention. Loans may be affected.';

  @override
  String get home_status_panel_title => 'Current status explained';

  @override
  String get home_status_panel_close => 'Close';

  @override
  String get home_status_panel_section_current => '1. Current status';

  @override
  String get home_status_panel_section_meaning => '2. What this means';

  @override
  String get home_status_panel_section_available => '3. What you can do now';

  @override
  String get home_status_panel_section_not_available =>
      '4. What is not available yet';

  @override
  String get panel_none_status => 'No KYC on file';

  @override
  String get panel_none_meaning =>
      'You have not started the identity verification required for loans.';

  @override
  String get panel_none_available =>
      'View company context, switch company, change language, change password, or continue reviewing loan history when records exist.';

  @override
  String get panel_none_not_available =>
      'Starting KYC or applying for a loan in this app version. Please use the web/mini app to complete identity verification first.';

  @override
  String get panel_draft_status => 'KYC draft saved';

  @override
  String get panel_draft_meaning =>
      'You have an in-progress identity verification draft that has not been submitted for review.';

  @override
  String get panel_draft_available =>
      'Review the current status and access other read-only features.';

  @override
  String get panel_draft_not_available =>
      'Editing or submitting KYC, or applying for a new loan. Please switch to the web/mini app to continue your KYC draft.';

  @override
  String get panel_submitted_status => 'KYC under review';

  @override
  String get panel_submitted_meaning =>
      'Your identity documents have been submitted and are being reviewed. Please wait for the result.';

  @override
  String get panel_submitted_available =>
      'Check this status page again for the latest result. Browse your loan history if any.';

  @override
  String get panel_submitted_not_available =>
      'Editing KYC, uploading more documents, or applying for a new loan.';

  @override
  String get panel_needs_info_status => 'Additional information requested';

  @override
  String get panel_needs_info_meaning =>
      'Reviewers are asking for additional information before KYC can be approved.';

  @override
  String get panel_needs_info_available =>
      'View your current status and inspect existing loan records.';

  @override
  String get panel_needs_info_not_available =>
      'Submitting supplementary materials, editing KYC, or starting new loan applications in this app version. Please use the web/mini app to submit the requested information.';

  @override
  String get panel_rejected_status => 'KYC rejected (final)';

  @override
  String get panel_rejected_meaning =>
      'Identity verification did not pass. This result is final in the current release.';

  @override
  String get panel_rejected_available =>
      'View the rejection status summary here.';

  @override
  String get panel_rejected_not_available =>
      'Re-submitting KYC, editing documents, or applying for a loan in this app version.';

  @override
  String get panel_approved_noloan_status =>
      'KYC approved — eligible to borrow';

  @override
  String get panel_approved_noloan_meaning =>
      'You have passed identity verification and are eligible for loans once the loan feature is released.';

  @override
  String get panel_approved_noloan_available =>
      'View your loan history, change password, change display language, and browse company context.';

  @override
  String get panel_approved_noloan_not_available =>
      'Starting a new loan application. New loan applications will open in a later release.';

  @override
  String get panel_unknown_status => 'Status unavailable right now';

  @override
  String get panel_unknown_meaning =>
      'The server returned a status that this client version does not recognize. No assumptions are made.';

  @override
  String get panel_unknown_available =>
      'Pull to refresh or retry to load the latest state.';

  @override
  String get panel_unknown_not_available =>
      'Status-specific actions. No KYC or loan mutations are offered in the unknown state.';

  @override
  String get home_offline_no_snapshot_title => 'Unable to load';

  @override
  String get home_offline_no_snapshot_summary =>
      'We could not reach the service and have no cached data to display. Check your connection and retry.';

  @override
  String get home_offline_no_snapshot_primary => 'Retry';

  @override
  String get home_h1_title => 'Identity verification not started';

  @override
  String get home_h1_summary =>
      'Complete identity verification before you can borrow.';

  @override
  String get home_h1_primary => 'Start verification';

  @override
  String get home_h1_secondary => 'View current status';

  @override
  String get home_h2_title => 'Identity draft in progress';

  @override
  String get home_h2_summary =>
      'Your KYC draft was saved but has not been submitted.';

  @override
  String get home_h2_primary => 'Continue KYC';

  @override
  String get home_h2_secondary => 'View current status';

  @override
  String get home_h3_title => 'Identity being reviewed';

  @override
  String get home_h3_summary => 'Reviewers are processing your KYC submission.';

  @override
  String get home_h3_primary => 'View current status';

  @override
  String get home_h4_title => 'Additional info requested';

  @override
  String get home_h4_summary =>
      'Reviewers need additional information before KYC approval.';

  @override
  String get home_h4_primary => 'Submit supplement';

  @override
  String get home_h4_secondary => 'View current status';

  @override
  String get home_h5_title => 'Identity verification failed';

  @override
  String get home_h5_summary =>
      'This result is final and cannot be edited in this release.';

  @override
  String get home_h5_primary => 'View current status';

  @override
  String get home_h6_title => 'Identity verified';

  @override
  String get home_h6_summary =>
      'You are eligible. New loan applications open in a later release.';

  @override
  String get home_h6_primary => 'Apply for a loan';

  @override
  String get home_h6_secondary => 'View loan history';

  @override
  String get home_h7_title => 'Last loan settled';

  @override
  String get home_h7_summary => 'No open loan right now.';

  @override
  String get home_h7_primary => 'View loan history';

  @override
  String get home_h8_title => 'Last application was not approved';

  @override
  String get home_h8_summary => 'View the rejected application details.';

  @override
  String get home_h8_primary => 'View loan details';

  @override
  String get home_h9_title => 'Loan application created';

  @override
  String get home_h9_summary => 'Awaiting fee billing confirmation.';

  @override
  String get home_h9_primary => 'View loan details';

  @override
  String get home_h10_title => 'Loan awaiting signature';

  @override
  String get home_h10_summary => 'The agreement is ready to sign.';

  @override
  String get home_h10_primary => 'View loan details';

  @override
  String get home_h11_title => 'Agreement signed';

  @override
  String get home_h11_summary => 'Waiting for final approval submission.';

  @override
  String get home_h11_primary => 'View loan details';

  @override
  String get home_h12_title => 'Awaiting partner approval';

  @override
  String get home_h12_summary =>
      'The partner is reviewing the signed application.';

  @override
  String get home_h12_primary => 'View loan details';

  @override
  String get home_h13_title => 'Approved. Awaiting disbursement.';

  @override
  String get home_h13_summary =>
      'Your loan is approved and the disbursement is being processed.';

  @override
  String get home_h13_primary => 'View loan details';

  @override
  String get home_h14_title => 'Loan in repayment';

  @override
  String home_h14_summary(String remaining, String dueDate) {
    return 'Remaining $remaining · Due $dueDate';
  }

  @override
  String get home_h14_primary => 'View loan details';

  @override
  String get home_h15_title => 'Loan being processed';

  @override
  String get home_h15_summary =>
      'An existing loan from an earlier flow is still being processed.';

  @override
  String get home_h15_primary => 'View loan details';

  @override
  String get home_h16_title => 'Loan status updating';

  @override
  String get home_h16_summary =>
      'This specific status is not recognized by the current app version.';

  @override
  String get home_h16_primary => 'View loan details';

  @override
  String get home_h17_title => 'Loan processing · KYC needs attention';

  @override
  String get home_h17_summary =>
      'Your loan is being processed. Additionally, your KYC profile needs attention.';

  @override
  String get home_h17_primary => 'View loan details';

  @override
  String get home_h18_title => 'Identity status updating';

  @override
  String get home_h18_summary =>
      'The current KYC status is not recognized. No actions are taken automatically.';

  @override
  String get home_h18_primary => 'View current status';

  @override
  String get home_h19_primary => 'Loading…';

  @override
  String get home_h19_title => 'Loading status';

  @override
  String get home_h19_summary => 'Please wait while we load the latest data.';

  @override
  String get home_h20_primary => 'Retry refresh';

  @override
  String get home_h20_title => 'Refresh failed';

  @override
  String get home_h20_summary =>
      'Showing last loaded data. Retry to fetch the latest updates.';

  @override
  String get home_h21_primary => 'Retry connection';

  @override
  String get home_h21_title => 'Offline';

  @override
  String get home_h21_summary =>
      'Showing last loaded data. Reconnect and retry to update.';

  @override
  String get home_h21p_title => 'Unable to load';

  @override
  String get home_h21p_summary =>
      'No cached data and the service is currently unavailable.';

  @override
  String get home_h21p_primary => 'Retry';

  @override
  String get home_h22_title => 'Session expired';

  @override
  String get home_h22_summary => 'Please sign in again to continue.';

  @override
  String get home_h22_primary => 'Sign in again';

  @override
  String get home_future_cta_hint_generic =>
      'This feature is not available in the current release.';

  @override
  String get home_future_cta_hint_kyc_edit =>
      'KYC editing is not available in this release. Please use the web/mini app.';

  @override
  String get home_future_cta_hint_apply =>
      'New loan applications will open in a later release.';

  @override
  String get home_currency_usd => 'USD';

  @override
  String get home_amount_missing => '—';

  @override
  String get shellTabHome => 'Home';

  @override
  String get shellTabLoans => 'Loans';

  @override
  String get shellTabMe => 'Me';

  @override
  String get shellSemanticHome => 'Home tab';

  @override
  String get shellSemanticLoans => 'Loans tab';

  @override
  String get shellSemanticMe => 'Me tab';

  @override
  String get loansTitle => 'Loans';

  @override
  String get loansEmptyTitle => 'No loans yet';

  @override
  String get loansEmptyBody => 'Loan records will appear here when available.';

  @override
  String get loansRefreshFailed =>
      'Refresh failed. Showing previously loaded records.';

  @override
  String get loansOfflineWarm => 'Offline. Showing the latest records we have.';

  @override
  String get loansSessionInvalid =>
      'Your session has expired. Sign in again to view loans.';

  @override
  String get loansUnknownStatus => 'Status not recognized by this app version.';

  @override
  String get loanShortIdLabel => 'Loan';

  @override
  String get loanCreatedLabel => 'Created';

  @override
  String get loanTermLabel => 'Term';

  @override
  String get loanPrincipalLabel => 'Principal';

  @override
  String get loanStatusLabel => 'Status';

  @override
  String get loanStatusKycApproved => 'KYC approved';

  @override
  String get loanStatusDecisionPending => 'Partner review';

  @override
  String get loanStatusSigned => 'Signed';

  @override
  String get loanStatusActive => 'In repayment';

  @override
  String get loanStatusRegistered => 'Registered';

  @override
  String get loanStatusKycPending => 'KYC pending';

  @override
  String get loanStatusNeedsInfo => 'Information requested';

  @override
  String get loanStatusLegacyApproved => 'Approved (legacy)';

  @override
  String get loanStatusUnknown => 'Status unknown';

  @override
  String get loanStatusClosed => 'Settled';

  @override
  String get loanStatusRejected => 'Not approved';

  @override
  String get loanDetailTitle => 'Loan details';

  @override
  String get loanDetailNotFoundTitle => 'Loan not available';

  @override
  String get loanDetailNotFoundBody =>
      'This loan record is not currently available for your account.';

  @override
  String get loanFieldStatus => 'Status';

  @override
  String get loanFieldPrincipal => 'Principal amount';

  @override
  String get loanFieldTerm => 'Term';

  @override
  String get loanFieldActualReceived => 'Amount received';

  @override
  String get loanFieldTotalRepayment => 'Total repayment';

  @override
  String get loanFieldPaid => 'Paid';

  @override
  String get loanFieldRemaining => 'Remaining due';

  @override
  String get loanFieldDueDate => 'Due date';

  @override
  String get loanSectionBillingTitle => 'Billing summary';

  @override
  String get loanSectionEventsTitle => 'Latest activity';

  @override
  String get loanEventCreated => 'Loan created';

  @override
  String get loanEventSubmitted => 'Application submitted';

  @override
  String get loanEventSigned => 'Agreement signed';

  @override
  String get loanEventFunded => 'Disbursed';

  @override
  String get loanEventRepayment => 'Repayment recorded';

  @override
  String get loanEventClosed => 'Loan settled';

  @override
  String get loanEventRejected => 'Application not approved';

  @override
  String get loanEventUnknown => 'Activity updated';

  @override
  String get meTitle => 'Account';

  @override
  String get meAccountSummaryTitle => 'Current session';

  @override
  String get meCompanyLabel => 'Company';

  @override
  String get meLanguageLabel => 'Display language';

  @override
  String get meAccountMaskedLabel => 'Account';

  @override
  String get meSectionActionsTitle => 'Actions';

  @override
  String get meActionLanguageTitle => 'Language';

  @override
  String get meActionLanguageSubtitle => 'Change display language';

  @override
  String get meActionPasswordTitle => 'Change password';

  @override
  String get meActionPasswordSubtitle => 'Update your sign-in password';

  @override
  String get meActionCompanyTitle => 'Company switch';

  @override
  String get meActionCompanySubtitle => 'Switch or add organization';

  @override
  String get meActionLogoutTitle => 'Sign out';

  @override
  String get meActionLogoutSubtitle => 'End this session on this device';

  @override
  String get passwordTitle => 'Change password';

  @override
  String get passwordCurrentLabel => 'Current password';

  @override
  String get passwordNewLabel => 'New password';

  @override
  String get passwordConfirmLabel => 'Confirm new password';

  @override
  String get passwordToggleShow => 'Show password';

  @override
  String get passwordToggleHide => 'Hide password';

  @override
  String get passwordSubmit => 'Update password';

  @override
  String get passwordLoading => 'Updating…';

  @override
  String get passwordSuccess => 'Password updated successfully.';

  @override
  String get passwordMismatch => 'New passwords do not match.';

  @override
  String passwordTooShort(int min) {
    return 'Password must be at least $min characters.';
  }

  @override
  String passwordTooLong(int max) {
    return 'Password must not exceed $max characters.';
  }

  @override
  String get passwordSameAsCurrent =>
      'New password must differ from the current password.';

  @override
  String get passwordSetTitle => 'Set password';

  @override
  String get passwordSetSubmit => 'Save password';

  @override
  String get logoutConfirmTitle => 'Sign out?';

  @override
  String get logoutConfirmBody =>
      'Signing out will end the current session for this organization.';

  @override
  String get logoutConfirmConfirm => 'Sign out';

  @override
  String get logoutFailed => 'Unable to sign out right now. Please try again.';

  @override
  String get companySwitchTitle => 'Switch company';

  @override
  String get companySwitchCurrentLabel => 'Current company';

  @override
  String get companySwitchKnownSection => 'Your recent companies';

  @override
  String get companySwitchAddButton => 'Add or select a different company';

  @override
  String get companySwitchSwitching => 'Preparing company…';

  @override
  String get tabBackHome => 'Home';

  @override
  String get tabBackLoans => 'Loans';

  @override
  String get tabBackMe => 'Account';

  @override
  String get companyRecoveryTitle => 'Service institution not recognized';

  @override
  String get companyRecoverySwitchTitle => 'Change service institution';

  @override
  String get companyRecoveryBody =>
      'We were unable to determine your service institution. Please use one of the options below to connect.';

  @override
  String get companyRecoveryPersistedUnavailable =>
      'Your previous service institution is currently unavailable. Please reconnect with your invitation link or contact support.';

  @override
  String get companyRecoveryLinkInvalid =>
      'The invitation link could not be verified or the institution is not available.';

  @override
  String get companyRecoveryDefaultUnavailable =>
      'This service is currently unavailable. Please try again later or use your invitation link.';

  @override
  String get companyRecoveryPasteCta => 'Paste invitation link';

  @override
  String get companyRecoveryScanCta => 'Scan institution QR';

  @override
  String get companyRecoveryRecentSection => 'Recent service institutions';

  @override
  String get companyRecoveryHint =>
      'Connect using your invitation link or QR code provided by the institution.';

  @override
  String get authLoginChangeInstitution => 'Change service institution';

  @override
  String get authLoginInstitutionLabel => 'Service institution';

  @override
  String get authLoginChooseMethod =>
      'Choose a secure sign in method for your account.';

  @override
  String get companyRecoveryGoLogin => 'Back to sign in';

  @override
  String get startupFailureTitle => 'Unable to start';

  @override
  String get startupFailureBody =>
      'We could not connect to the service right now. Check your connection and retry.';

  @override
  String get languagePageTitle => 'Language';

  @override
  String get authSignInTitle => 'Sign in';

  @override
  String get authContinueTelegram => 'Continue with Telegram';

  @override
  String get authUsePassword => 'Use password';

  @override
  String get authForgotPassword => 'Forgot password?';

  @override
  String get authPhoneInvalidE164 =>
      'Enter a valid phone number, e.g. +85512345678 or 012345678.';

  @override
  String get authTelegramVerificationTitle => 'Telegram verification';

  @override
  String get authPhoneLabel => 'Phone number';

  @override
  String get authConsentTelegramCode =>
      'I consent to receive a verification code via Telegram.';

  @override
  String get authSendCode => 'Send code';

  @override
  String get authPhoneMissing =>
      'Phone number missing or invalid. Enter the phone number again.';

  @override
  String get authCodeExpiredResend =>
      'Verification code has expired. Resend a code.';

  @override
  String get authEnterCodeTitle => 'Enter Telegram code';

  @override
  String authCodeSentTo(String phone) {
    return 'Verification code sent to $phone';
  }

  @override
  String get authYourPhone => 'your phone';

  @override
  String get authCodeLabel => '6-digit code';

  @override
  String authResendIn(String time) {
    return 'Resend available in $time';
  }

  @override
  String get authCodeExpiredTapResend => 'Code has expired. Tap Resend code.';

  @override
  String get authTapResendHint => 'Tap Resend code after the timer reaches 0.';

  @override
  String get authVerify => 'Verify';

  @override
  String get authResendCode => 'Resend code';

  @override
  String get authPasswordSignInTitle => 'Password sign in';

  @override
  String get authPasswordLabel => 'Password';

  @override
  String get authRecoverTitle => 'Recover password';

  @override
  String get authConsentResetCode =>
      'I consent to receive a reset code via Telegram.';

  @override
  String authRateLimited(int seconds) {
    return 'Rate limited. Retry in ${seconds}s.';
  }

  @override
  String get authSendResetCode => 'Send reset code';

  @override
  String get authPasswordMin12 => 'Password must be at least 12 characters.';

  @override
  String get authPasswordsMismatch => 'Passwords do not match.';

  @override
  String get authResetTitle => 'Reset password';

  @override
  String authEnterResetCode(String phone) {
    return 'Enter the reset code sent to $phone.';
  }

  @override
  String get authResetCodeLabel => 'Reset code';

  @override
  String get authNewPasswordLabel => 'New password (12–128 characters)';

  @override
  String get authConfirmPasswordLabel => 'Confirm new password';

  @override
  String get authResetPassword => 'Reset password';

  @override
  String get errNetwork => 'Network error. Check your connection.';

  @override
  String get errOffline => 'You are offline. Connect and try again.';

  @override
  String get errServiceUnavailable => 'Service unavailable. Try again later.';

  @override
  String get errSessionExpired =>
      'Your session has expired. Please sign in again.';

  @override
  String get errInvalidCredentials => 'Phone or password is incorrect.';

  @override
  String get errLoginPageExpired =>
      'The login page expired. Please start again.';

  @override
  String get errSignInFailed => 'Sign in failed. Please try again.';

  @override
  String get errFinishPassword => 'Please finish setting your password.';

  @override
  String get errSecurity => 'Security validation failed.';

  @override
  String get errForbidden => 'This action is not available.';

  @override
  String get errStatusChanged => 'Status changed. Refresh and try again.';

  @override
  String get errPhoneInUse =>
      'This phone number is already used by another account.';

  @override
  String get errConflict => 'Conflict. Please retry.';

  @override
  String get errCodeIncorrect => 'Verification code is incorrect.';

  @override
  String get errCodeExpired => 'Verification code has expired.';

  @override
  String get errTooManyAttempts => 'Too many attempts. Send a new code.';

  @override
  String get errPasswordLength => 'Password must be 12–128 characters.';

  @override
  String get errRequestTooLarge => 'Request too large. Reduce the input size.';

  @override
  String get errInvalidInput => 'Invalid input.';

  @override
  String errTooManyRequests(int seconds) {
    return 'Too many requests. Try again in ${seconds}s.';
  }

  @override
  String get errGeneric => 'Something went wrong. Please try again.';

  @override
  String get logoutLocalOnly =>
      'Signed out on this device. The server session will expire on its own.';

  @override
  String authAttemptsRemaining(int count) {
    return '$count attempts remaining before a new code is required.';
  }

  @override
  String get kycSection_identity => 'Personal & identity';

  @override
  String get kycSection_contacts => 'Emergency contacts';

  @override
  String get kycSection_employment => 'Work & assets';

  @override
  String get kycSection_bank => 'Receiving account';

  @override
  String get kycSection_consent => 'Authorization';

  @override
  String get kycField_surname => 'Surname';

  @override
  String get kycField_givenName => 'Given name';

  @override
  String get kycField_gender => 'Gender';

  @override
  String get kycField_education => 'Education';

  @override
  String get kycField_marital => 'Marital status';

  @override
  String get kycField_province => 'Province / city';

  @override
  String get kycField_district => 'District';

  @override
  String get kycField_address => 'Detailed address';

  @override
  String get kycField_workType => 'Work type';

  @override
  String get kycField_company => 'Company / shop name';

  @override
  String get kycField_industry => 'Industry';

  @override
  String get kycField_position => 'Position';

  @override
  String get kycField_income => 'Monthly income range';

  @override
  String get kycField_tenure => 'Time at work';

  @override
  String get kycField_supervisorName => 'Supervisor name (optional)';

  @override
  String get kycField_supervisorPhone =>
      'Supervisor phone, with country code (optional)';

  @override
  String get kycField_vehicle => 'Vehicle (optional)';

  @override
  String get kycField_housing => 'Housing (optional)';

  @override
  String get kycField_bankName => 'Bank';

  @override
  String get kycField_bankAccount => 'Account number';

  @override
  String get kycField_bankHolder => 'Account holder name';

  @override
  String kycContactRelation(int n) {
    return 'Contact $n · relationship';
  }

  @override
  String kycContactName(int n) {
    return 'Contact $n · name';
  }

  @override
  String kycContactPhone(int n) {
    return 'Contact $n · phone, with country code';
  }

  @override
  String get kycContactOptional =>
      'Contact 3 is optional: fill in all three items or leave them all empty.';

  @override
  String get kycSlot_idFront => 'ID card (front)';

  @override
  String get kycSlot_idBack => 'ID card (back)';

  @override
  String get kycSlot_selfie => 'Selfie';

  @override
  String get kycSlot_incomeProof => 'Income / work proof';

  @override
  String get kycSlot_vehicleInvoice => 'Vehicle purchase invoice';

  @override
  String get kycSlot_vehicleContract => 'Vehicle purchase contract';

  @override
  String get kycSlot_vehiclePhoto => 'Vehicle photo';

  @override
  String get kycSlot_rentContract => 'Rental contract';

  @override
  String get kycSlot_propertyCertificate => 'Property certificate';

  @override
  String get kycVehicleMaterialHint =>
      'Upload one vehicle document: invoice, contract or photo.';

  @override
  String get kycTitle => 'Identity verification';

  @override
  String get kycScopeNote =>
      'Your information is reviewed manually. This is not an external ID, bank or liveness check.';

  @override
  String get kycStatusDraft => 'Draft — not submitted yet';

  @override
  String get kycStatusSubmitted => 'Submitted — waiting for review';

  @override
  String get kycStatusNeedsInfo => 'More information needed';

  @override
  String get kycStatusApproved => 'Approved';

  @override
  String get kycStatusRejected => 'Not approved';

  @override
  String get kycStatusUnknown => 'Status unavailable';

  @override
  String get kycStatusSubmittedBody =>
      'You cannot edit while it is being reviewed.';

  @override
  String get kycStatusApprovedBody =>
      'Your information passed the manual review.';

  @override
  String get kycStatusRejectedBody => 'Your information was not approved.';

  @override
  String get kycStatusNeedsInfoBody =>
      'Please review the note below, update your information and submit again.';

  @override
  String get kycReviewerNote => 'Reviewer note';

  @override
  String get kycSectionDone => 'Complete';

  @override
  String get kycSectionTodo => 'To do';

  @override
  String get kycSubmit => 'Submit for review';

  @override
  String get kycSaveDraft => 'Save';

  @override
  String get kycSavedDraft => 'Saved';

  @override
  String get kycSubmittedOk => 'Submitted. We will review it soon.';

  @override
  String get kycReload => 'Reload';

  @override
  String get kycTakePhoto => 'Take photo';

  @override
  String get kycChooseGallery => 'Choose from gallery';

  @override
  String get kycReplace => 'Replace';

  @override
  String get kycUploaded => 'Uploaded';

  @override
  String get kycUploading => 'Uploading…';

  @override
  String get kycRequired => 'Required';

  @override
  String get kycOptional => 'Optional';

  @override
  String get kycSelectPlaceholder => 'Select';

  @override
  String get kycConsentTitle => 'Data authorization';

  @override
  String get kycConsentBody =>
      'I confirm that the information and documents I provide are true and belong to me. I authorize KhmerX and its lending partner to review them manually to assess my loan application and to keep them securely for that purpose.';

  @override
  String get kycConsentNotice =>
      'Placeholder authorization text — the final legal wording will replace it before release.';

  @override
  String get kycConsentCheckbox => 'I have read and agree';

  @override
  String get kycLockedNote =>
      'This information is locked and cannot be edited.';

  @override
  String get kycRuleMismatch =>
      'Please update the app to continue verification.';

  @override
  String get kycPickFailed => 'Could not read the photo. Please try again.';

  @override
  String kycProblemMissingField(String item) {
    return 'Please fill in: $item';
  }

  @override
  String kycProblemMissingSlot(String item) {
    return 'Please upload: $item';
  }

  @override
  String kycProblemInvalidPhone(String item) {
    return 'Invalid phone number: $item. Use the international format, for example +85512345678.';
  }

  @override
  String get kycProblemVehicle => 'Upload exactly one vehicle document.';

  @override
  String get kycProblemContact3 =>
      'Contact 3: fill in all three items or leave them all empty.';

  @override
  String get kycProblemSupervisor =>
      'Supervisor name and phone must be filled in together.';

  @override
  String get kycProblemDupRelation =>
      'Emergency contacts must have different relationships.';

  @override
  String get kycProblemDupPhone =>
      'Emergency contacts must have different phone numbers.';

  @override
  String get kycProblemConsent => 'Please read and accept the authorization.';

  @override
  String get kycErrConflict =>
      'Your information was changed or is locked. It has been reloaded.';

  @override
  String get kycErrFileTooLarge => 'The file is too large (max 10 MB).';

  @override
  String get kycErrFileRejected =>
      'The file was not accepted. Please choose another photo.';

  @override
  String get kycErrInvalid =>
      'Some information is not valid. Please check and try again.';

  @override
  String get kycErrUnavailable =>
      'The service is temporarily unavailable. Nothing was saved. Please try again.';

  @override
  String get kycOpt_Male => 'Male';

  @override
  String get kycOpt_Female => 'Female';

  @override
  String get kycOpt_Married => 'Married';

  @override
  String get kycOpt_Single => 'Single';

  @override
  String get kycOpt_Parent => 'Parent';

  @override
  String get kycOpt_Spouse => 'Spouse';

  @override
  String get kycOpt_Relative => 'Relative';

  @override
  String get kycOpt_Friend => 'Friend';

  @override
  String get kycOpt_VillageChief => 'Village chief';

  @override
  String get kycOpt_CompanySupervisor => 'Company supervisor';

  @override
  String get kycOpt_Motorbike => 'Motorbike';

  @override
  String get kycOpt_TukTuk => 'Tuk-tuk';

  @override
  String get kycOpt_Car => 'Car';

  @override
  String get kycOpt_None => 'None';

  @override
  String get kycOpt_Rented => 'Rented';

  @override
  String get kycOpt_OwnedProperty => 'Owned property';

  @override
  String get kycSwitchKeyboard => 'Switch keyboard';

  @override
  String get kycErrPhoneFormat =>
      'Enter a valid phone number, e.g. +85512345678 or 012345678.';

  @override
  String get kycErrFieldIssue =>
      'Saved. Some entries were not saved because they are not valid yet: please correct the highlighted fields.';

  @override
  String get startupTagline => 'Simple, transparent small loans';

  @override
  String get kycNext => 'Next';

  @override
  String get kycBack => 'Back';

  @override
  String get kycFieldRequired => 'Required';

  @override
  String kycStepProgress(String current, String total) {
    return 'Step $current of $total';
  }

  @override
  String kycOverallProgress(String done, String total) {
    return '$done of $total sections done';
  }

  @override
  String get authBrandEyebrow => 'Made for Cambodia';

  @override
  String get authBrandSlogan => 'Simple finance for everyday life.';

  @override
  String get authTrustClear => 'Clear terms';

  @override
  String get authTrustSecure => 'Secure data';

  @override
  String get authTrustProgress => 'Visible progress';

  @override
  String get kycUseLocation => 'Use my current location';

  @override
  String get kycLocating => 'Locating...';

  @override
  String get kycLocHint =>
      'Fills in the address from your location. Please check and edit it.';

  @override
  String get kycLocDenied =>
      'Location permission is off. Allow it in system settings, or type the address.';

  @override
  String get kycLocServiceOff =>
      'Location services are off. Turn them on, or type the address.';

  @override
  String get kycLocFailed => 'Could not get your address. Please type it.';

  @override
  String get kycLocStagePosition => 'Getting your location...';

  @override
  String get kycLocStageAddress => 'Finding your address...';

  @override
  String get kycLocWait => 'Please wait, this can take up to 30 seconds.';
}
