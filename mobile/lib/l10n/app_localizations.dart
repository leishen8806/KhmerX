import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_km.dart';
import 'app_localizations_zh.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('km'),
    Locale('zh'),
  ];

  /// No description provided for @appName.
  ///
  /// In en, this message translates to:
  /// **'KhmerX'**
  String get appName;

  /// No description provided for @errorNetworkConnectionTimeout.
  ///
  /// In en, this message translates to:
  /// **'Connection timed out. Please try again.'**
  String get errorNetworkConnectionTimeout;

  /// No description provided for @errorNetworkSendTimeout.
  ///
  /// In en, this message translates to:
  /// **'Request timed out. Please try again.'**
  String get errorNetworkSendTimeout;

  /// No description provided for @errorNetworkReceiveTimeout.
  ///
  /// In en, this message translates to:
  /// **'Response timed out. Please try again.'**
  String get errorNetworkReceiveTimeout;

  /// No description provided for @errorNetworkUnknown.
  ///
  /// In en, this message translates to:
  /// **'Network error occurred.'**
  String get errorNetworkUnknown;

  /// No description provided for @errorAuthUnauthenticated.
  ///
  /// In en, this message translates to:
  /// **'Please log in to continue.'**
  String get errorAuthUnauthenticated;

  /// No description provided for @errorAuthSessionExpired.
  ///
  /// In en, this message translates to:
  /// **'Your session has expired. Please log in again.'**
  String get errorAuthSessionExpired;

  /// No description provided for @errorAuthLoginPageExpired.
  ///
  /// In en, this message translates to:
  /// **'Login page has expired. Please refresh.'**
  String get errorAuthLoginPageExpired;

  /// No description provided for @errorAuthInvalidCredentials.
  ///
  /// In en, this message translates to:
  /// **'Invalid phone number or password.'**
  String get errorAuthInvalidCredentials;

  /// No description provided for @errorAuthOtpUndeliverable.
  ///
  /// In en, this message translates to:
  /// **'Unable to send OTP. Please try again later.'**
  String get errorAuthOtpUndeliverable;

  /// No description provided for @errorAuthTooManyAttempts.
  ///
  /// In en, this message translates to:
  /// **'Too many attempts. Please try again later.'**
  String get errorAuthTooManyAttempts;

  /// No description provided for @errorForbiddenCrossSite.
  ///
  /// In en, this message translates to:
  /// **'Cross-site access is not allowed.'**
  String get errorForbiddenCrossSite;

  /// No description provided for @errorForbiddenInvalidCompany.
  ///
  /// In en, this message translates to:
  /// **'Invalid company access.'**
  String get errorForbiddenInvalidCompany;

  /// No description provided for @errorForbiddenRegistrationIncomplete.
  ///
  /// In en, this message translates to:
  /// **'Please complete registration first.'**
  String get errorForbiddenRegistrationIncomplete;

  /// No description provided for @errorForbiddenNotOwner.
  ///
  /// In en, this message translates to:
  /// **'You do not have permission to perform this action.'**
  String get errorForbiddenNotOwner;

  /// No description provided for @errorConflictDataChanged.
  ///
  /// In en, this message translates to:
  /// **'Data has been modified. Please refresh.'**
  String get errorConflictDataChanged;

  /// No description provided for @errorConflictVersionMismatch.
  ///
  /// In en, this message translates to:
  /// **'Version mismatch. Please refresh.'**
  String get errorConflictVersionMismatch;

  /// No description provided for @errorConflictQuoteExpired.
  ///
  /// In en, this message translates to:
  /// **'Quote has expired. Please request a new one.'**
  String get errorConflictQuoteExpired;

  /// No description provided for @errorConflictAlreadySigned.
  ///
  /// In en, this message translates to:
  /// **'Document has already been signed.'**
  String get errorConflictAlreadySigned;

  /// No description provided for @errorConflictStatusChanged.
  ///
  /// In en, this message translates to:
  /// **'Status has changed. Please refresh.'**
  String get errorConflictStatusChanged;

  /// No description provided for @errorRateLimit.
  ///
  /// In en, this message translates to:
  /// **'Too many requests. Please wait a moment.'**
  String get errorRateLimit;

  /// No description provided for @errorServiceUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Service is temporarily unavailable.'**
  String get errorServiceUnavailable;

  /// No description provided for @errorOffline.
  ///
  /// In en, this message translates to:
  /// **'You are offline. Please check your connection.'**
  String get errorOffline;

  /// No description provided for @errorUnknown.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get errorUnknown;

  /// No description provided for @appTitle.
  ///
  /// In en, this message translates to:
  /// **'KhmerX'**
  String get appTitle;

  /// No description provided for @commonLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading...'**
  String get commonLoading;

  /// No description provided for @commonError.
  ///
  /// In en, this message translates to:
  /// **'An error occurred.'**
  String get commonError;

  /// No description provided for @commonRetry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get commonRetry;

  /// No description provided for @commonCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get commonCancel;

  /// No description provided for @commonConfirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get commonConfirm;

  /// No description provided for @commonContinue.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get commonContinue;

  /// No description provided for @commonSave.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get commonSave;

  /// No description provided for @commonBack.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get commonBack;

  /// No description provided for @commonOk.
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get commonOk;

  /// No description provided for @commonOffline.
  ///
  /// In en, this message translates to:
  /// **'You are offline.'**
  String get commonOffline;

  /// No description provided for @errorConflict.
  ///
  /// In en, this message translates to:
  /// **'Data has changed. Please refresh.'**
  String get errorConflict;

  /// No description provided for @errorSessionExpired.
  ///
  /// In en, this message translates to:
  /// **'Session has expired. Please log in again.'**
  String get errorSessionExpired;

  /// No description provided for @errorForbidden.
  ///
  /// In en, this message translates to:
  /// **'Access denied.'**
  String get errorForbidden;

  /// No description provided for @errorCompanyInvalid.
  ///
  /// In en, this message translates to:
  /// **'This company is not available.'**
  String get errorCompanyInvalid;

  /// No description provided for @errorAuthInvalid.
  ///
  /// In en, this message translates to:
  /// **'Invalid phone or password.'**
  String get errorAuthInvalid;

  /// No description provided for @errorNetwork.
  ///
  /// In en, this message translates to:
  /// **'Network error.'**
  String get errorNetwork;

  /// No description provided for @startupTitle.
  ///
  /// In en, this message translates to:
  /// **'Starting...'**
  String get startupTitle;

  /// No description provided for @companySelectTitle.
  ///
  /// In en, this message translates to:
  /// **'Select Company'**
  String get companySelectTitle;

  /// No description provided for @companySelectScan.
  ///
  /// In en, this message translates to:
  /// **'Scan QR Code'**
  String get companySelectScan;

  /// No description provided for @companySelectPaste.
  ///
  /// In en, this message translates to:
  /// **'Paste Link'**
  String get companySelectPaste;

  /// No description provided for @companySelectRecent.
  ///
  /// In en, this message translates to:
  /// **'Recent Companies'**
  String get companySelectRecent;

  /// No description provided for @authLoginTitle.
  ///
  /// In en, this message translates to:
  /// **'Log In'**
  String get authLoginTitle;

  /// No description provided for @authLoginPhoneHint.
  ///
  /// In en, this message translates to:
  /// **'Phone number'**
  String get authLoginPhoneHint;

  /// No description provided for @authLoginPasswordHint.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get authLoginPasswordHint;

  /// No description provided for @authLoginOtp.
  ///
  /// In en, this message translates to:
  /// **'Verify OTP Code'**
  String get authLoginOtp;

  /// No description provided for @authLoginPassword.
  ///
  /// In en, this message translates to:
  /// **'Log in with password'**
  String get authLoginPassword;

  /// No description provided for @homePlaceholderTitle.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get homePlaceholderTitle;

  /// No description provided for @homePlaceholderBody.
  ///
  /// In en, this message translates to:
  /// **'Waiting for UX contract.'**
  String get homePlaceholderBody;

  /// No description provided for @featureWithdrawDisabled.
  ///
  /// In en, this message translates to:
  /// **'Feature is not available yet.'**
  String get featureWithdrawDisabled;

  /// No description provided for @featureRepayDisabled.
  ///
  /// In en, this message translates to:
  /// **'Feature is not available yet.'**
  String get featureRepayDisabled;

  /// No description provided for @languageTitle.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get languageTitle;

  /// No description provided for @languageEn.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get languageEn;

  /// No description provided for @languageKm.
  ///
  /// In en, this message translates to:
  /// **'ភាសាខ្មែរ'**
  String get languageKm;

  /// No description provided for @languageZh.
  ///
  /// In en, this message translates to:
  /// **'中文'**
  String get languageZh;

  /// No description provided for @settingsTitle.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settingsTitle;

  /// No description provided for @aboutTitle.
  ///
  /// In en, this message translates to:
  /// **'About KhmerX'**
  String get aboutTitle;

  /// No description provided for @aboutVersion.
  ///
  /// In en, this message translates to:
  /// **'Version {version}'**
  String aboutVersion(String version);

  /// No description provided for @homeTitle.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get homeTitle;

  /// No description provided for @homeRefresh.
  ///
  /// In en, this message translates to:
  /// **'Refresh'**
  String get homeRefresh;

  /// No description provided for @homeEmptyPrimary.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get homeEmptyPrimary;

  /// No description provided for @home_company_label.
  ///
  /// In en, this message translates to:
  /// **'Company'**
  String get home_company_label;

  /// No description provided for @home_user_label.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get home_user_label;

  /// No description provided for @home_status_label.
  ///
  /// In en, this message translates to:
  /// **'Current status'**
  String get home_status_label;

  /// No description provided for @home_loan_summary_label.
  ///
  /// In en, this message translates to:
  /// **'Loan summary'**
  String get home_loan_summary_label;

  /// No description provided for @home_remaining_label.
  ///
  /// In en, this message translates to:
  /// **'Remaining due'**
  String get home_remaining_label;

  /// No description provided for @home_due_date_label.
  ///
  /// In en, this message translates to:
  /// **'Due date'**
  String get home_due_date_label;

  /// No description provided for @home_due_date_missing.
  ///
  /// In en, this message translates to:
  /// **'—'**
  String get home_due_date_missing;

  /// No description provided for @home_term_label.
  ///
  /// In en, this message translates to:
  /// **'Term'**
  String get home_term_label;

  /// No description provided for @home_term_days_unit.
  ///
  /// In en, this message translates to:
  /// **'days'**
  String get home_term_days_unit;

  /// No description provided for @home_principal_label.
  ///
  /// In en, this message translates to:
  /// **'Principal'**
  String get home_principal_label;

  /// No description provided for @home_total_repay_label.
  ///
  /// In en, this message translates to:
  /// **'Total repayable'**
  String get home_total_repay_label;

  /// No description provided for @home_paid_label.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get home_paid_label;

  /// No description provided for @home_last_updated.
  ///
  /// In en, this message translates to:
  /// **'Last updated'**
  String get home_last_updated;

  /// No description provided for @home_last_updated_never.
  ///
  /// In en, this message translates to:
  /// **'Not updated yet'**
  String get home_last_updated_never;

  /// No description provided for @home_semantics_business_card.
  ///
  /// In en, this message translates to:
  /// **'Business status card'**
  String get home_semantics_business_card;

  /// No description provided for @home_semantics_status_panel_open.
  ///
  /// In en, this message translates to:
  /// **'Open status explanation panel'**
  String get home_semantics_status_panel_open;

  /// No description provided for @home_freshness_stale_offline.
  ///
  /// In en, this message translates to:
  /// **'Offline. Data shown may be outdated.'**
  String get home_freshness_stale_offline;

  /// No description provided for @home_freshness_refresh_failed.
  ///
  /// In en, this message translates to:
  /// **'Refresh failed. Retaining last loaded data.'**
  String get home_freshness_refresh_failed;

  /// No description provided for @home_freshness_session_invalid.
  ///
  /// In en, this message translates to:
  /// **'Session expired. Please sign in again.'**
  String get home_freshness_session_invalid;

  /// No description provided for @home_waiting_state_hint.
  ///
  /// In en, this message translates to:
  /// **'Waiting for update. Refreshes automatically while open.'**
  String get home_waiting_state_hint;

  /// No description provided for @home_open_loan_kyc_notice_extra.
  ///
  /// In en, this message translates to:
  /// **'Your KYC profile still needs attention. Loans may be affected.'**
  String get home_open_loan_kyc_notice_extra;

  /// No description provided for @home_status_panel_title.
  ///
  /// In en, this message translates to:
  /// **'Current status explained'**
  String get home_status_panel_title;

  /// No description provided for @home_status_panel_close.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get home_status_panel_close;

  /// No description provided for @home_status_panel_section_current.
  ///
  /// In en, this message translates to:
  /// **'1. Current status'**
  String get home_status_panel_section_current;

  /// No description provided for @home_status_panel_section_meaning.
  ///
  /// In en, this message translates to:
  /// **'2. What this means'**
  String get home_status_panel_section_meaning;

  /// No description provided for @home_status_panel_section_available.
  ///
  /// In en, this message translates to:
  /// **'3. What you can do now'**
  String get home_status_panel_section_available;

  /// No description provided for @home_status_panel_section_not_available.
  ///
  /// In en, this message translates to:
  /// **'4. What is not available yet'**
  String get home_status_panel_section_not_available;

  /// No description provided for @panel_none_status.
  ///
  /// In en, this message translates to:
  /// **'No KYC on file'**
  String get panel_none_status;

  /// No description provided for @panel_none_meaning.
  ///
  /// In en, this message translates to:
  /// **'You have not started the identity verification required for loans.'**
  String get panel_none_meaning;

  /// No description provided for @panel_none_available.
  ///
  /// In en, this message translates to:
  /// **'View company context, switch company, change language, change password, or continue reviewing loan history when records exist.'**
  String get panel_none_available;

  /// No description provided for @panel_none_not_available.
  ///
  /// In en, this message translates to:
  /// **'Starting KYC or applying for a loan in this app version. Please use the web/mini app to complete identity verification first.'**
  String get panel_none_not_available;

  /// No description provided for @panel_draft_status.
  ///
  /// In en, this message translates to:
  /// **'KYC draft saved'**
  String get panel_draft_status;

  /// No description provided for @panel_draft_meaning.
  ///
  /// In en, this message translates to:
  /// **'You have an in-progress identity verification draft that has not been submitted for review.'**
  String get panel_draft_meaning;

  /// No description provided for @panel_draft_available.
  ///
  /// In en, this message translates to:
  /// **'Review the current status and access other read-only features.'**
  String get panel_draft_available;

  /// No description provided for @panel_draft_not_available.
  ///
  /// In en, this message translates to:
  /// **'Editing or submitting KYC, or applying for a new loan. Please switch to the web/mini app to continue your KYC draft.'**
  String get panel_draft_not_available;

  /// No description provided for @panel_submitted_status.
  ///
  /// In en, this message translates to:
  /// **'KYC under review'**
  String get panel_submitted_status;

  /// No description provided for @panel_submitted_meaning.
  ///
  /// In en, this message translates to:
  /// **'Your identity documents have been submitted and are being reviewed. Please wait for the result.'**
  String get panel_submitted_meaning;

  /// No description provided for @panel_submitted_available.
  ///
  /// In en, this message translates to:
  /// **'Check this status page again for the latest result. Browse your loan history if any.'**
  String get panel_submitted_available;

  /// No description provided for @panel_submitted_not_available.
  ///
  /// In en, this message translates to:
  /// **'Editing KYC, uploading more documents, or applying for a new loan.'**
  String get panel_submitted_not_available;

  /// No description provided for @panel_needs_info_status.
  ///
  /// In en, this message translates to:
  /// **'Additional information requested'**
  String get panel_needs_info_status;

  /// No description provided for @panel_needs_info_meaning.
  ///
  /// In en, this message translates to:
  /// **'Reviewers are asking for additional information before KYC can be approved.'**
  String get panel_needs_info_meaning;

  /// No description provided for @panel_needs_info_available.
  ///
  /// In en, this message translates to:
  /// **'View your current status and inspect existing loan records.'**
  String get panel_needs_info_available;

  /// No description provided for @panel_needs_info_not_available.
  ///
  /// In en, this message translates to:
  /// **'Submitting supplementary materials, editing KYC, or starting new loan applications in this app version. Please use the web/mini app to submit the requested information.'**
  String get panel_needs_info_not_available;

  /// No description provided for @panel_rejected_status.
  ///
  /// In en, this message translates to:
  /// **'KYC rejected (final)'**
  String get panel_rejected_status;

  /// No description provided for @panel_rejected_meaning.
  ///
  /// In en, this message translates to:
  /// **'Identity verification did not pass. This result is final in the current release.'**
  String get panel_rejected_meaning;

  /// No description provided for @panel_rejected_available.
  ///
  /// In en, this message translates to:
  /// **'View the rejection status summary here.'**
  String get panel_rejected_available;

  /// No description provided for @panel_rejected_not_available.
  ///
  /// In en, this message translates to:
  /// **'Re-submitting KYC, editing documents, or applying for a loan in this app version.'**
  String get panel_rejected_not_available;

  /// No description provided for @panel_approved_noloan_status.
  ///
  /// In en, this message translates to:
  /// **'KYC approved — eligible to borrow'**
  String get panel_approved_noloan_status;

  /// No description provided for @panel_approved_noloan_meaning.
  ///
  /// In en, this message translates to:
  /// **'You have passed identity verification and are eligible for loans once the loan feature is released.'**
  String get panel_approved_noloan_meaning;

  /// No description provided for @panel_approved_noloan_available.
  ///
  /// In en, this message translates to:
  /// **'View your loan history, change password, change display language, and browse company context.'**
  String get panel_approved_noloan_available;

  /// No description provided for @panel_approved_noloan_not_available.
  ///
  /// In en, this message translates to:
  /// **'Starting a new loan application. New loan applications will open in a later release.'**
  String get panel_approved_noloan_not_available;

  /// No description provided for @panel_unknown_status.
  ///
  /// In en, this message translates to:
  /// **'Status unavailable right now'**
  String get panel_unknown_status;

  /// No description provided for @panel_unknown_meaning.
  ///
  /// In en, this message translates to:
  /// **'The server returned a status that this client version does not recognize. No assumptions are made.'**
  String get panel_unknown_meaning;

  /// No description provided for @panel_unknown_available.
  ///
  /// In en, this message translates to:
  /// **'Pull to refresh or retry to load the latest state.'**
  String get panel_unknown_available;

  /// No description provided for @panel_unknown_not_available.
  ///
  /// In en, this message translates to:
  /// **'Status-specific actions. No KYC or loan mutations are offered in the unknown state.'**
  String get panel_unknown_not_available;

  /// No description provided for @home_offline_no_snapshot_title.
  ///
  /// In en, this message translates to:
  /// **'Unable to load'**
  String get home_offline_no_snapshot_title;

  /// No description provided for @home_offline_no_snapshot_summary.
  ///
  /// In en, this message translates to:
  /// **'We could not reach the service and have no cached data to display. Check your connection and retry.'**
  String get home_offline_no_snapshot_summary;

  /// No description provided for @home_offline_no_snapshot_primary.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get home_offline_no_snapshot_primary;

  /// No description provided for @home_h1_title.
  ///
  /// In en, this message translates to:
  /// **'Identity verification not started'**
  String get home_h1_title;

  /// No description provided for @home_h1_summary.
  ///
  /// In en, this message translates to:
  /// **'Complete identity verification before you can borrow.'**
  String get home_h1_summary;

  /// No description provided for @home_h1_primary.
  ///
  /// In en, this message translates to:
  /// **'Start verification'**
  String get home_h1_primary;

  /// No description provided for @home_h1_secondary.
  ///
  /// In en, this message translates to:
  /// **'View current status'**
  String get home_h1_secondary;

  /// No description provided for @home_h2_title.
  ///
  /// In en, this message translates to:
  /// **'Identity draft in progress'**
  String get home_h2_title;

  /// No description provided for @home_h2_summary.
  ///
  /// In en, this message translates to:
  /// **'Your KYC draft was saved but has not been submitted.'**
  String get home_h2_summary;

  /// No description provided for @home_h2_primary.
  ///
  /// In en, this message translates to:
  /// **'Continue KYC'**
  String get home_h2_primary;

  /// No description provided for @home_h2_secondary.
  ///
  /// In en, this message translates to:
  /// **'View current status'**
  String get home_h2_secondary;

  /// No description provided for @home_h3_title.
  ///
  /// In en, this message translates to:
  /// **'Identity being reviewed'**
  String get home_h3_title;

  /// No description provided for @home_h3_summary.
  ///
  /// In en, this message translates to:
  /// **'Reviewers are processing your KYC submission.'**
  String get home_h3_summary;

  /// No description provided for @home_h3_primary.
  ///
  /// In en, this message translates to:
  /// **'View current status'**
  String get home_h3_primary;

  /// No description provided for @home_h4_title.
  ///
  /// In en, this message translates to:
  /// **'Additional info requested'**
  String get home_h4_title;

  /// No description provided for @home_h4_summary.
  ///
  /// In en, this message translates to:
  /// **'Reviewers need additional information before KYC approval.'**
  String get home_h4_summary;

  /// No description provided for @home_h4_primary.
  ///
  /// In en, this message translates to:
  /// **'Submit supplement'**
  String get home_h4_primary;

  /// No description provided for @home_h4_secondary.
  ///
  /// In en, this message translates to:
  /// **'View current status'**
  String get home_h4_secondary;

  /// No description provided for @home_h5_title.
  ///
  /// In en, this message translates to:
  /// **'Identity verification failed'**
  String get home_h5_title;

  /// No description provided for @home_h5_summary.
  ///
  /// In en, this message translates to:
  /// **'This result is final and cannot be edited in this release.'**
  String get home_h5_summary;

  /// No description provided for @home_h5_primary.
  ///
  /// In en, this message translates to:
  /// **'View current status'**
  String get home_h5_primary;

  /// No description provided for @home_h6_title.
  ///
  /// In en, this message translates to:
  /// **'Identity verified'**
  String get home_h6_title;

  /// No description provided for @home_h6_summary.
  ///
  /// In en, this message translates to:
  /// **'You are eligible. New loan applications open in a later release.'**
  String get home_h6_summary;

  /// No description provided for @home_h6_primary.
  ///
  /// In en, this message translates to:
  /// **'Apply for a loan'**
  String get home_h6_primary;

  /// No description provided for @home_h6_secondary.
  ///
  /// In en, this message translates to:
  /// **'View loan history'**
  String get home_h6_secondary;

  /// No description provided for @home_h7_title.
  ///
  /// In en, this message translates to:
  /// **'Last loan settled'**
  String get home_h7_title;

  /// No description provided for @home_h7_summary.
  ///
  /// In en, this message translates to:
  /// **'No open loan right now.'**
  String get home_h7_summary;

  /// No description provided for @home_h7_primary.
  ///
  /// In en, this message translates to:
  /// **'View loan history'**
  String get home_h7_primary;

  /// No description provided for @home_h8_title.
  ///
  /// In en, this message translates to:
  /// **'Last application was not approved'**
  String get home_h8_title;

  /// No description provided for @home_h8_summary.
  ///
  /// In en, this message translates to:
  /// **'View the rejected application details.'**
  String get home_h8_summary;

  /// No description provided for @home_h8_primary.
  ///
  /// In en, this message translates to:
  /// **'View loan details'**
  String get home_h8_primary;

  /// No description provided for @home_h9_title.
  ///
  /// In en, this message translates to:
  /// **'Loan application created'**
  String get home_h9_title;

  /// No description provided for @home_h9_summary.
  ///
  /// In en, this message translates to:
  /// **'Awaiting fee billing confirmation.'**
  String get home_h9_summary;

  /// No description provided for @home_h9_primary.
  ///
  /// In en, this message translates to:
  /// **'View loan details'**
  String get home_h9_primary;

  /// No description provided for @home_h10_title.
  ///
  /// In en, this message translates to:
  /// **'Loan awaiting signature'**
  String get home_h10_title;

  /// No description provided for @home_h10_summary.
  ///
  /// In en, this message translates to:
  /// **'The agreement is ready to sign.'**
  String get home_h10_summary;

  /// No description provided for @home_h10_primary.
  ///
  /// In en, this message translates to:
  /// **'View loan details'**
  String get home_h10_primary;

  /// No description provided for @home_h11_title.
  ///
  /// In en, this message translates to:
  /// **'Agreement signed'**
  String get home_h11_title;

  /// No description provided for @home_h11_summary.
  ///
  /// In en, this message translates to:
  /// **'Waiting for final approval submission.'**
  String get home_h11_summary;

  /// No description provided for @home_h11_primary.
  ///
  /// In en, this message translates to:
  /// **'View loan details'**
  String get home_h11_primary;

  /// No description provided for @home_h12_title.
  ///
  /// In en, this message translates to:
  /// **'Awaiting partner approval'**
  String get home_h12_title;

  /// No description provided for @home_h12_summary.
  ///
  /// In en, this message translates to:
  /// **'The partner is reviewing the signed application.'**
  String get home_h12_summary;

  /// No description provided for @home_h12_primary.
  ///
  /// In en, this message translates to:
  /// **'View loan details'**
  String get home_h12_primary;

  /// No description provided for @home_h13_title.
  ///
  /// In en, this message translates to:
  /// **'Approved. Awaiting disbursement.'**
  String get home_h13_title;

  /// No description provided for @home_h13_summary.
  ///
  /// In en, this message translates to:
  /// **'Your loan is approved and the disbursement is being processed.'**
  String get home_h13_summary;

  /// No description provided for @home_h13_primary.
  ///
  /// In en, this message translates to:
  /// **'View loan details'**
  String get home_h13_primary;

  /// No description provided for @home_h14_title.
  ///
  /// In en, this message translates to:
  /// **'Loan in repayment'**
  String get home_h14_title;

  /// No description provided for @home_h14_summary.
  ///
  /// In en, this message translates to:
  /// **'Remaining {remaining} · Due {dueDate}'**
  String home_h14_summary(String remaining, String dueDate);

  /// No description provided for @home_h14_primary.
  ///
  /// In en, this message translates to:
  /// **'View loan details'**
  String get home_h14_primary;

  /// No description provided for @home_h15_title.
  ///
  /// In en, this message translates to:
  /// **'Loan being processed'**
  String get home_h15_title;

  /// No description provided for @home_h15_summary.
  ///
  /// In en, this message translates to:
  /// **'An existing loan from an earlier flow is still being processed.'**
  String get home_h15_summary;

  /// No description provided for @home_h15_primary.
  ///
  /// In en, this message translates to:
  /// **'View loan details'**
  String get home_h15_primary;

  /// No description provided for @home_h16_title.
  ///
  /// In en, this message translates to:
  /// **'Loan status updating'**
  String get home_h16_title;

  /// No description provided for @home_h16_summary.
  ///
  /// In en, this message translates to:
  /// **'This specific status is not recognized by the current app version.'**
  String get home_h16_summary;

  /// No description provided for @home_h16_primary.
  ///
  /// In en, this message translates to:
  /// **'View loan details'**
  String get home_h16_primary;

  /// No description provided for @home_h17_title.
  ///
  /// In en, this message translates to:
  /// **'Loan processing · KYC needs attention'**
  String get home_h17_title;

  /// No description provided for @home_h17_summary.
  ///
  /// In en, this message translates to:
  /// **'Your loan is being processed. Additionally, your KYC profile needs attention.'**
  String get home_h17_summary;

  /// No description provided for @home_h17_primary.
  ///
  /// In en, this message translates to:
  /// **'View loan details'**
  String get home_h17_primary;

  /// No description provided for @home_h18_title.
  ///
  /// In en, this message translates to:
  /// **'Identity status updating'**
  String get home_h18_title;

  /// No description provided for @home_h18_summary.
  ///
  /// In en, this message translates to:
  /// **'The current KYC status is not recognized. No actions are taken automatically.'**
  String get home_h18_summary;

  /// No description provided for @home_h18_primary.
  ///
  /// In en, this message translates to:
  /// **'View current status'**
  String get home_h18_primary;

  /// No description provided for @home_h19_primary.
  ///
  /// In en, this message translates to:
  /// **'Loading…'**
  String get home_h19_primary;

  /// No description provided for @home_h19_title.
  ///
  /// In en, this message translates to:
  /// **'Loading status'**
  String get home_h19_title;

  /// No description provided for @home_h19_summary.
  ///
  /// In en, this message translates to:
  /// **'Please wait while we load the latest data.'**
  String get home_h19_summary;

  /// No description provided for @home_h20_primary.
  ///
  /// In en, this message translates to:
  /// **'Retry refresh'**
  String get home_h20_primary;

  /// No description provided for @home_h20_title.
  ///
  /// In en, this message translates to:
  /// **'Refresh failed'**
  String get home_h20_title;

  /// No description provided for @home_h20_summary.
  ///
  /// In en, this message translates to:
  /// **'Showing last loaded data. Retry to fetch the latest updates.'**
  String get home_h20_summary;

  /// No description provided for @home_h21_primary.
  ///
  /// In en, this message translates to:
  /// **'Retry connection'**
  String get home_h21_primary;

  /// No description provided for @home_h21_title.
  ///
  /// In en, this message translates to:
  /// **'Offline'**
  String get home_h21_title;

  /// No description provided for @home_h21_summary.
  ///
  /// In en, this message translates to:
  /// **'Showing last loaded data. Reconnect and retry to update.'**
  String get home_h21_summary;

  /// No description provided for @home_h21p_title.
  ///
  /// In en, this message translates to:
  /// **'Unable to load'**
  String get home_h21p_title;

  /// No description provided for @home_h21p_summary.
  ///
  /// In en, this message translates to:
  /// **'No cached data and the service is currently unavailable.'**
  String get home_h21p_summary;

  /// No description provided for @home_h21p_primary.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get home_h21p_primary;

  /// No description provided for @home_h22_title.
  ///
  /// In en, this message translates to:
  /// **'Session expired'**
  String get home_h22_title;

  /// No description provided for @home_h22_summary.
  ///
  /// In en, this message translates to:
  /// **'Please sign in again to continue.'**
  String get home_h22_summary;

  /// No description provided for @home_h22_primary.
  ///
  /// In en, this message translates to:
  /// **'Sign in again'**
  String get home_h22_primary;

  /// No description provided for @home_future_cta_hint_generic.
  ///
  /// In en, this message translates to:
  /// **'This feature is not available in the current release.'**
  String get home_future_cta_hint_generic;

  /// No description provided for @home_future_cta_hint_kyc_edit.
  ///
  /// In en, this message translates to:
  /// **'KYC editing is not available in this release. Please use the web/mini app.'**
  String get home_future_cta_hint_kyc_edit;

  /// No description provided for @home_future_cta_hint_apply.
  ///
  /// In en, this message translates to:
  /// **'New loan applications will open in a later release.'**
  String get home_future_cta_hint_apply;

  /// No description provided for @home_currency_usd.
  ///
  /// In en, this message translates to:
  /// **'USD'**
  String get home_currency_usd;

  /// No description provided for @home_amount_missing.
  ///
  /// In en, this message translates to:
  /// **'—'**
  String get home_amount_missing;

  /// No description provided for @shellTabHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get shellTabHome;

  /// No description provided for @shellTabLoans.
  ///
  /// In en, this message translates to:
  /// **'Loans'**
  String get shellTabLoans;

  /// No description provided for @shellTabMe.
  ///
  /// In en, this message translates to:
  /// **'Me'**
  String get shellTabMe;

  /// No description provided for @shellSemanticHome.
  ///
  /// In en, this message translates to:
  /// **'Home tab'**
  String get shellSemanticHome;

  /// No description provided for @shellSemanticLoans.
  ///
  /// In en, this message translates to:
  /// **'Loans tab'**
  String get shellSemanticLoans;

  /// No description provided for @shellSemanticMe.
  ///
  /// In en, this message translates to:
  /// **'Me tab'**
  String get shellSemanticMe;

  /// No description provided for @loansTitle.
  ///
  /// In en, this message translates to:
  /// **'Loans'**
  String get loansTitle;

  /// No description provided for @loansEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No loans yet'**
  String get loansEmptyTitle;

  /// No description provided for @loansEmptyBody.
  ///
  /// In en, this message translates to:
  /// **'Loan records will appear here when available.'**
  String get loansEmptyBody;

  /// No description provided for @loansRefreshFailed.
  ///
  /// In en, this message translates to:
  /// **'Refresh failed. Showing previously loaded records.'**
  String get loansRefreshFailed;

  /// No description provided for @loansOfflineWarm.
  ///
  /// In en, this message translates to:
  /// **'Offline. Showing the latest records we have.'**
  String get loansOfflineWarm;

  /// No description provided for @loansSessionInvalid.
  ///
  /// In en, this message translates to:
  /// **'Your session has expired. Sign in again to view loans.'**
  String get loansSessionInvalid;

  /// No description provided for @loansUnknownStatus.
  ///
  /// In en, this message translates to:
  /// **'Status not recognized by this app version.'**
  String get loansUnknownStatus;

  /// No description provided for @loanShortIdLabel.
  ///
  /// In en, this message translates to:
  /// **'Loan'**
  String get loanShortIdLabel;

  /// No description provided for @loanCreatedLabel.
  ///
  /// In en, this message translates to:
  /// **'Created'**
  String get loanCreatedLabel;

  /// No description provided for @loanTermLabel.
  ///
  /// In en, this message translates to:
  /// **'Term'**
  String get loanTermLabel;

  /// No description provided for @loanPrincipalLabel.
  ///
  /// In en, this message translates to:
  /// **'Principal'**
  String get loanPrincipalLabel;

  /// No description provided for @loanStatusLabel.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get loanStatusLabel;

  /// No description provided for @loanStatusKycApproved.
  ///
  /// In en, this message translates to:
  /// **'KYC approved'**
  String get loanStatusKycApproved;

  /// No description provided for @loanStatusDecisionPending.
  ///
  /// In en, this message translates to:
  /// **'Partner review'**
  String get loanStatusDecisionPending;

  /// No description provided for @loanStatusSigned.
  ///
  /// In en, this message translates to:
  /// **'Signed'**
  String get loanStatusSigned;

  /// No description provided for @loanStatusActive.
  ///
  /// In en, this message translates to:
  /// **'In repayment'**
  String get loanStatusActive;

  /// No description provided for @loanStatusRegistered.
  ///
  /// In en, this message translates to:
  /// **'Registered'**
  String get loanStatusRegistered;

  /// No description provided for @loanStatusKycPending.
  ///
  /// In en, this message translates to:
  /// **'KYC pending'**
  String get loanStatusKycPending;

  /// No description provided for @loanStatusNeedsInfo.
  ///
  /// In en, this message translates to:
  /// **'Information requested'**
  String get loanStatusNeedsInfo;

  /// No description provided for @loanStatusLegacyApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved (legacy)'**
  String get loanStatusLegacyApproved;

  /// No description provided for @loanStatusUnknown.
  ///
  /// In en, this message translates to:
  /// **'Status unknown'**
  String get loanStatusUnknown;

  /// No description provided for @loanStatusClosed.
  ///
  /// In en, this message translates to:
  /// **'Settled'**
  String get loanStatusClosed;

  /// No description provided for @loanStatusRejected.
  ///
  /// In en, this message translates to:
  /// **'Not approved'**
  String get loanStatusRejected;

  /// No description provided for @loanDetailTitle.
  ///
  /// In en, this message translates to:
  /// **'Loan details'**
  String get loanDetailTitle;

  /// No description provided for @loanDetailNotFoundTitle.
  ///
  /// In en, this message translates to:
  /// **'Loan not available'**
  String get loanDetailNotFoundTitle;

  /// No description provided for @loanDetailNotFoundBody.
  ///
  /// In en, this message translates to:
  /// **'This loan record is not currently available for your account.'**
  String get loanDetailNotFoundBody;

  /// No description provided for @loanFieldStatus.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get loanFieldStatus;

  /// No description provided for @loanFieldPrincipal.
  ///
  /// In en, this message translates to:
  /// **'Principal amount'**
  String get loanFieldPrincipal;

  /// No description provided for @loanFieldTerm.
  ///
  /// In en, this message translates to:
  /// **'Term'**
  String get loanFieldTerm;

  /// No description provided for @loanFieldActualReceived.
  ///
  /// In en, this message translates to:
  /// **'Amount received'**
  String get loanFieldActualReceived;

  /// No description provided for @loanFieldTotalRepayment.
  ///
  /// In en, this message translates to:
  /// **'Total repayment'**
  String get loanFieldTotalRepayment;

  /// No description provided for @loanFieldPaid.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get loanFieldPaid;

  /// No description provided for @loanFieldRemaining.
  ///
  /// In en, this message translates to:
  /// **'Remaining due'**
  String get loanFieldRemaining;

  /// No description provided for @loanFieldDueDate.
  ///
  /// In en, this message translates to:
  /// **'Due date'**
  String get loanFieldDueDate;

  /// No description provided for @loanSectionBillingTitle.
  ///
  /// In en, this message translates to:
  /// **'Billing summary'**
  String get loanSectionBillingTitle;

  /// No description provided for @loanSectionEventsTitle.
  ///
  /// In en, this message translates to:
  /// **'Latest activity'**
  String get loanSectionEventsTitle;

  /// No description provided for @loanEventCreated.
  ///
  /// In en, this message translates to:
  /// **'Loan created'**
  String get loanEventCreated;

  /// No description provided for @loanEventSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Application submitted'**
  String get loanEventSubmitted;

  /// No description provided for @loanEventSigned.
  ///
  /// In en, this message translates to:
  /// **'Agreement signed'**
  String get loanEventSigned;

  /// No description provided for @loanEventFunded.
  ///
  /// In en, this message translates to:
  /// **'Disbursed'**
  String get loanEventFunded;

  /// No description provided for @loanEventRepayment.
  ///
  /// In en, this message translates to:
  /// **'Repayment recorded'**
  String get loanEventRepayment;

  /// No description provided for @loanEventClosed.
  ///
  /// In en, this message translates to:
  /// **'Loan settled'**
  String get loanEventClosed;

  /// No description provided for @loanEventRejected.
  ///
  /// In en, this message translates to:
  /// **'Application not approved'**
  String get loanEventRejected;

  /// No description provided for @loanEventUnknown.
  ///
  /// In en, this message translates to:
  /// **'Activity updated'**
  String get loanEventUnknown;

  /// No description provided for @meTitle.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get meTitle;

  /// No description provided for @meAccountSummaryTitle.
  ///
  /// In en, this message translates to:
  /// **'Current session'**
  String get meAccountSummaryTitle;

  /// No description provided for @meCompanyLabel.
  ///
  /// In en, this message translates to:
  /// **'Company'**
  String get meCompanyLabel;

  /// No description provided for @meLanguageLabel.
  ///
  /// In en, this message translates to:
  /// **'Display language'**
  String get meLanguageLabel;

  /// No description provided for @meAccountMaskedLabel.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get meAccountMaskedLabel;

  /// No description provided for @meSectionActionsTitle.
  ///
  /// In en, this message translates to:
  /// **'Actions'**
  String get meSectionActionsTitle;

  /// No description provided for @meActionLanguageTitle.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get meActionLanguageTitle;

  /// No description provided for @meActionLanguageSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Change display language'**
  String get meActionLanguageSubtitle;

  /// No description provided for @meActionPasswordTitle.
  ///
  /// In en, this message translates to:
  /// **'Change password'**
  String get meActionPasswordTitle;

  /// No description provided for @meActionPasswordSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Update your sign-in password'**
  String get meActionPasswordSubtitle;

  /// No description provided for @meActionCompanyTitle.
  ///
  /// In en, this message translates to:
  /// **'Company switch'**
  String get meActionCompanyTitle;

  /// No description provided for @meActionCompanySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Switch or add organization'**
  String get meActionCompanySubtitle;

  /// No description provided for @meActionLogoutTitle.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get meActionLogoutTitle;

  /// No description provided for @meActionLogoutSubtitle.
  ///
  /// In en, this message translates to:
  /// **'End this session on this device'**
  String get meActionLogoutSubtitle;

  /// No description provided for @passwordTitle.
  ///
  /// In en, this message translates to:
  /// **'Change password'**
  String get passwordTitle;

  /// No description provided for @passwordCurrentLabel.
  ///
  /// In en, this message translates to:
  /// **'Current password'**
  String get passwordCurrentLabel;

  /// No description provided for @passwordNewLabel.
  ///
  /// In en, this message translates to:
  /// **'New password'**
  String get passwordNewLabel;

  /// No description provided for @passwordConfirmLabel.
  ///
  /// In en, this message translates to:
  /// **'Confirm new password'**
  String get passwordConfirmLabel;

  /// No description provided for @passwordToggleShow.
  ///
  /// In en, this message translates to:
  /// **'Show password'**
  String get passwordToggleShow;

  /// No description provided for @passwordToggleHide.
  ///
  /// In en, this message translates to:
  /// **'Hide password'**
  String get passwordToggleHide;

  /// No description provided for @passwordSubmit.
  ///
  /// In en, this message translates to:
  /// **'Update password'**
  String get passwordSubmit;

  /// No description provided for @passwordLoading.
  ///
  /// In en, this message translates to:
  /// **'Updating…'**
  String get passwordLoading;

  /// No description provided for @passwordSuccess.
  ///
  /// In en, this message translates to:
  /// **'Password updated successfully.'**
  String get passwordSuccess;

  /// No description provided for @passwordMismatch.
  ///
  /// In en, this message translates to:
  /// **'New passwords do not match.'**
  String get passwordMismatch;

  /// No description provided for @passwordTooShort.
  ///
  /// In en, this message translates to:
  /// **'Password must be at least {min} characters.'**
  String passwordTooShort(int min);

  /// No description provided for @passwordTooLong.
  ///
  /// In en, this message translates to:
  /// **'Password must not exceed {max} characters.'**
  String passwordTooLong(int max);

  /// No description provided for @passwordSameAsCurrent.
  ///
  /// In en, this message translates to:
  /// **'New password must differ from the current password.'**
  String get passwordSameAsCurrent;

  /// No description provided for @passwordSetTitle.
  ///
  /// In en, this message translates to:
  /// **'Set password'**
  String get passwordSetTitle;

  /// No description provided for @passwordSetSubmit.
  ///
  /// In en, this message translates to:
  /// **'Save password'**
  String get passwordSetSubmit;

  /// No description provided for @logoutConfirmTitle.
  ///
  /// In en, this message translates to:
  /// **'Sign out?'**
  String get logoutConfirmTitle;

  /// No description provided for @logoutConfirmBody.
  ///
  /// In en, this message translates to:
  /// **'Signing out will end the current session for this organization.'**
  String get logoutConfirmBody;

  /// No description provided for @logoutConfirmConfirm.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get logoutConfirmConfirm;

  /// No description provided for @logoutFailed.
  ///
  /// In en, this message translates to:
  /// **'Unable to sign out right now. Please try again.'**
  String get logoutFailed;

  /// No description provided for @companySwitchTitle.
  ///
  /// In en, this message translates to:
  /// **'Switch company'**
  String get companySwitchTitle;

  /// No description provided for @companySwitchCurrentLabel.
  ///
  /// In en, this message translates to:
  /// **'Current company'**
  String get companySwitchCurrentLabel;

  /// No description provided for @companySwitchKnownSection.
  ///
  /// In en, this message translates to:
  /// **'Your recent companies'**
  String get companySwitchKnownSection;

  /// No description provided for @companySwitchAddButton.
  ///
  /// In en, this message translates to:
  /// **'Add or select a different company'**
  String get companySwitchAddButton;

  /// No description provided for @companySwitchSwitching.
  ///
  /// In en, this message translates to:
  /// **'Preparing company…'**
  String get companySwitchSwitching;

  /// No description provided for @tabBackHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get tabBackHome;

  /// No description provided for @tabBackLoans.
  ///
  /// In en, this message translates to:
  /// **'Loans'**
  String get tabBackLoans;

  /// No description provided for @tabBackMe.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get tabBackMe;

  /// No description provided for @companyRecoveryTitle.
  ///
  /// In en, this message translates to:
  /// **'Service institution not recognized'**
  String get companyRecoveryTitle;

  /// No description provided for @companyRecoverySwitchTitle.
  ///
  /// In en, this message translates to:
  /// **'Change service institution'**
  String get companyRecoverySwitchTitle;

  /// No description provided for @companyRecoveryBody.
  ///
  /// In en, this message translates to:
  /// **'We were unable to determine your service institution. Please use one of the options below to connect.'**
  String get companyRecoveryBody;

  /// No description provided for @companyRecoveryPersistedUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Your previous service institution is currently unavailable. Please reconnect with your invitation link or contact support.'**
  String get companyRecoveryPersistedUnavailable;

  /// No description provided for @companyRecoveryLinkInvalid.
  ///
  /// In en, this message translates to:
  /// **'The invitation link could not be verified or the institution is not available.'**
  String get companyRecoveryLinkInvalid;

  /// No description provided for @companyRecoveryDefaultUnavailable.
  ///
  /// In en, this message translates to:
  /// **'This service is currently unavailable. Please try again later or use your invitation link.'**
  String get companyRecoveryDefaultUnavailable;

  /// No description provided for @companyRecoveryPasteCta.
  ///
  /// In en, this message translates to:
  /// **'Paste invitation link'**
  String get companyRecoveryPasteCta;

  /// No description provided for @companyRecoveryScanCta.
  ///
  /// In en, this message translates to:
  /// **'Scan institution QR'**
  String get companyRecoveryScanCta;

  /// No description provided for @companyRecoveryRecentSection.
  ///
  /// In en, this message translates to:
  /// **'Recent service institutions'**
  String get companyRecoveryRecentSection;

  /// No description provided for @companyRecoveryHint.
  ///
  /// In en, this message translates to:
  /// **'Connect using your invitation link or QR code provided by the institution.'**
  String get companyRecoveryHint;

  /// No description provided for @authLoginChangeInstitution.
  ///
  /// In en, this message translates to:
  /// **'Change service institution'**
  String get authLoginChangeInstitution;

  /// No description provided for @authLoginInstitutionLabel.
  ///
  /// In en, this message translates to:
  /// **'Service institution'**
  String get authLoginInstitutionLabel;

  /// No description provided for @authLoginChooseMethod.
  ///
  /// In en, this message translates to:
  /// **'Choose a secure sign in method for your account.'**
  String get authLoginChooseMethod;

  /// No description provided for @companyRecoveryGoLogin.
  ///
  /// In en, this message translates to:
  /// **'Back to sign in'**
  String get companyRecoveryGoLogin;

  /// No description provided for @startupFailureTitle.
  ///
  /// In en, this message translates to:
  /// **'Unable to start'**
  String get startupFailureTitle;

  /// No description provided for @startupFailureBody.
  ///
  /// In en, this message translates to:
  /// **'We could not connect to the service right now. Check your connection and retry.'**
  String get startupFailureBody;

  /// No description provided for @languagePageTitle.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get languagePageTitle;

  /// No description provided for @authSignInTitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get authSignInTitle;

  /// No description provided for @authContinueTelegram.
  ///
  /// In en, this message translates to:
  /// **'Continue with Telegram'**
  String get authContinueTelegram;

  /// No description provided for @authUsePassword.
  ///
  /// In en, this message translates to:
  /// **'Use password'**
  String get authUsePassword;

  /// No description provided for @authForgotPassword.
  ///
  /// In en, this message translates to:
  /// **'Forgot password?'**
  String get authForgotPassword;

  /// No description provided for @authPhoneInvalidE164.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid phone number, e.g. +85512345678 or 012345678.'**
  String get authPhoneInvalidE164;

  /// No description provided for @authTelegramVerificationTitle.
  ///
  /// In en, this message translates to:
  /// **'Telegram verification'**
  String get authTelegramVerificationTitle;

  /// No description provided for @authPhoneLabel.
  ///
  /// In en, this message translates to:
  /// **'Phone number'**
  String get authPhoneLabel;

  /// No description provided for @authConsentTelegramCode.
  ///
  /// In en, this message translates to:
  /// **'I consent to receive a verification code via Telegram.'**
  String get authConsentTelegramCode;

  /// No description provided for @authSendCode.
  ///
  /// In en, this message translates to:
  /// **'Send code'**
  String get authSendCode;

  /// No description provided for @authPhoneMissing.
  ///
  /// In en, this message translates to:
  /// **'Phone number missing or invalid. Enter the phone number again.'**
  String get authPhoneMissing;

  /// No description provided for @authCodeExpiredResend.
  ///
  /// In en, this message translates to:
  /// **'Verification code has expired. Resend a code.'**
  String get authCodeExpiredResend;

  /// No description provided for @authEnterCodeTitle.
  ///
  /// In en, this message translates to:
  /// **'Enter Telegram code'**
  String get authEnterCodeTitle;

  /// No description provided for @authCodeSentTo.
  ///
  /// In en, this message translates to:
  /// **'Verification code sent to {phone}'**
  String authCodeSentTo(String phone);

  /// No description provided for @authYourPhone.
  ///
  /// In en, this message translates to:
  /// **'your phone'**
  String get authYourPhone;

  /// No description provided for @authCodeLabel.
  ///
  /// In en, this message translates to:
  /// **'6-digit code'**
  String get authCodeLabel;

  /// No description provided for @authResendIn.
  ///
  /// In en, this message translates to:
  /// **'Resend available in {time}'**
  String authResendIn(String time);

  /// No description provided for @authCodeExpiredTapResend.
  ///
  /// In en, this message translates to:
  /// **'Code has expired. Tap Resend code.'**
  String get authCodeExpiredTapResend;

  /// No description provided for @authTapResendHint.
  ///
  /// In en, this message translates to:
  /// **'Tap Resend code after the timer reaches 0.'**
  String get authTapResendHint;

  /// No description provided for @authVerify.
  ///
  /// In en, this message translates to:
  /// **'Verify'**
  String get authVerify;

  /// No description provided for @authResendCode.
  ///
  /// In en, this message translates to:
  /// **'Resend code'**
  String get authResendCode;

  /// No description provided for @authPasswordSignInTitle.
  ///
  /// In en, this message translates to:
  /// **'Password sign in'**
  String get authPasswordSignInTitle;

  /// No description provided for @authPasswordLabel.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get authPasswordLabel;

  /// No description provided for @authRecoverTitle.
  ///
  /// In en, this message translates to:
  /// **'Recover password'**
  String get authRecoverTitle;

  /// No description provided for @authConsentResetCode.
  ///
  /// In en, this message translates to:
  /// **'I consent to receive a reset code via Telegram.'**
  String get authConsentResetCode;

  /// No description provided for @authRateLimited.
  ///
  /// In en, this message translates to:
  /// **'Rate limited. Retry in {seconds}s.'**
  String authRateLimited(int seconds);

  /// No description provided for @authSendResetCode.
  ///
  /// In en, this message translates to:
  /// **'Send reset code'**
  String get authSendResetCode;

  /// No description provided for @authPasswordMin12.
  ///
  /// In en, this message translates to:
  /// **'Password must be at least 12 characters.'**
  String get authPasswordMin12;

  /// No description provided for @authPasswordsMismatch.
  ///
  /// In en, this message translates to:
  /// **'Passwords do not match.'**
  String get authPasswordsMismatch;

  /// No description provided for @authResetTitle.
  ///
  /// In en, this message translates to:
  /// **'Reset password'**
  String get authResetTitle;

  /// No description provided for @authEnterResetCode.
  ///
  /// In en, this message translates to:
  /// **'Enter the reset code sent to {phone}.'**
  String authEnterResetCode(String phone);

  /// No description provided for @authResetCodeLabel.
  ///
  /// In en, this message translates to:
  /// **'Reset code'**
  String get authResetCodeLabel;

  /// No description provided for @authNewPasswordLabel.
  ///
  /// In en, this message translates to:
  /// **'New password (12–128 characters)'**
  String get authNewPasswordLabel;

  /// No description provided for @authConfirmPasswordLabel.
  ///
  /// In en, this message translates to:
  /// **'Confirm new password'**
  String get authConfirmPasswordLabel;

  /// No description provided for @authResetPassword.
  ///
  /// In en, this message translates to:
  /// **'Reset password'**
  String get authResetPassword;

  /// No description provided for @errNetwork.
  ///
  /// In en, this message translates to:
  /// **'Network error. Check your connection.'**
  String get errNetwork;

  /// No description provided for @errOffline.
  ///
  /// In en, this message translates to:
  /// **'You are offline. Connect and try again.'**
  String get errOffline;

  /// No description provided for @errServiceUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Service unavailable. Try again later.'**
  String get errServiceUnavailable;

  /// No description provided for @errSessionExpired.
  ///
  /// In en, this message translates to:
  /// **'Your session has expired. Please sign in again.'**
  String get errSessionExpired;

  /// No description provided for @errInvalidCredentials.
  ///
  /// In en, this message translates to:
  /// **'Phone or password is incorrect.'**
  String get errInvalidCredentials;

  /// No description provided for @errLoginPageExpired.
  ///
  /// In en, this message translates to:
  /// **'The login page expired. Please start again.'**
  String get errLoginPageExpired;

  /// No description provided for @errSignInFailed.
  ///
  /// In en, this message translates to:
  /// **'Sign in failed. Please try again.'**
  String get errSignInFailed;

  /// No description provided for @errFinishPassword.
  ///
  /// In en, this message translates to:
  /// **'Please finish setting your password.'**
  String get errFinishPassword;

  /// No description provided for @errSecurity.
  ///
  /// In en, this message translates to:
  /// **'Security validation failed.'**
  String get errSecurity;

  /// No description provided for @errForbidden.
  ///
  /// In en, this message translates to:
  /// **'This action is not available.'**
  String get errForbidden;

  /// No description provided for @errStatusChanged.
  ///
  /// In en, this message translates to:
  /// **'Status changed. Refresh and try again.'**
  String get errStatusChanged;

  /// No description provided for @errPhoneInUse.
  ///
  /// In en, this message translates to:
  /// **'This phone number is already used by another account.'**
  String get errPhoneInUse;

  /// No description provided for @errConflict.
  ///
  /// In en, this message translates to:
  /// **'Conflict. Please retry.'**
  String get errConflict;

  /// No description provided for @errCodeIncorrect.
  ///
  /// In en, this message translates to:
  /// **'Verification code is incorrect.'**
  String get errCodeIncorrect;

  /// No description provided for @errCodeExpired.
  ///
  /// In en, this message translates to:
  /// **'Verification code has expired.'**
  String get errCodeExpired;

  /// No description provided for @errTooManyAttempts.
  ///
  /// In en, this message translates to:
  /// **'Too many attempts. Send a new code.'**
  String get errTooManyAttempts;

  /// No description provided for @errPasswordLength.
  ///
  /// In en, this message translates to:
  /// **'Password must be 12–128 characters.'**
  String get errPasswordLength;

  /// No description provided for @errRequestTooLarge.
  ///
  /// In en, this message translates to:
  /// **'Request too large. Reduce the input size.'**
  String get errRequestTooLarge;

  /// No description provided for @errInvalidInput.
  ///
  /// In en, this message translates to:
  /// **'Invalid input.'**
  String get errInvalidInput;

  /// No description provided for @errTooManyRequests.
  ///
  /// In en, this message translates to:
  /// **'Too many requests. Try again in {seconds}s.'**
  String errTooManyRequests(int seconds);

  /// No description provided for @errGeneric.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get errGeneric;

  /// No description provided for @logoutLocalOnly.
  ///
  /// In en, this message translates to:
  /// **'Signed out on this device. The server session will expire on its own.'**
  String get logoutLocalOnly;

  /// No description provided for @authAttemptsRemaining.
  ///
  /// In en, this message translates to:
  /// **'{count} attempts remaining before a new code is required.'**
  String authAttemptsRemaining(int count);

  /// No description provided for @kycSection_identity.
  ///
  /// In en, this message translates to:
  /// **'Personal & identity'**
  String get kycSection_identity;

  /// No description provided for @kycSection_contacts.
  ///
  /// In en, this message translates to:
  /// **'Emergency contacts'**
  String get kycSection_contacts;

  /// No description provided for @kycSection_employment.
  ///
  /// In en, this message translates to:
  /// **'Work & assets'**
  String get kycSection_employment;

  /// No description provided for @kycSection_bank.
  ///
  /// In en, this message translates to:
  /// **'Receiving account'**
  String get kycSection_bank;

  /// No description provided for @kycSection_consent.
  ///
  /// In en, this message translates to:
  /// **'Authorization'**
  String get kycSection_consent;

  /// No description provided for @kycField_surname.
  ///
  /// In en, this message translates to:
  /// **'Surname'**
  String get kycField_surname;

  /// No description provided for @kycField_givenName.
  ///
  /// In en, this message translates to:
  /// **'Given name'**
  String get kycField_givenName;

  /// No description provided for @kycField_gender.
  ///
  /// In en, this message translates to:
  /// **'Gender'**
  String get kycField_gender;

  /// No description provided for @kycField_education.
  ///
  /// In en, this message translates to:
  /// **'Education'**
  String get kycField_education;

  /// No description provided for @kycField_marital.
  ///
  /// In en, this message translates to:
  /// **'Marital status'**
  String get kycField_marital;

  /// No description provided for @kycField_province.
  ///
  /// In en, this message translates to:
  /// **'Province / city'**
  String get kycField_province;

  /// No description provided for @kycField_district.
  ///
  /// In en, this message translates to:
  /// **'District'**
  String get kycField_district;

  /// No description provided for @kycField_address.
  ///
  /// In en, this message translates to:
  /// **'Detailed address'**
  String get kycField_address;

  /// No description provided for @kycField_workType.
  ///
  /// In en, this message translates to:
  /// **'Work type'**
  String get kycField_workType;

  /// No description provided for @kycField_company.
  ///
  /// In en, this message translates to:
  /// **'Company / shop name'**
  String get kycField_company;

  /// No description provided for @kycField_industry.
  ///
  /// In en, this message translates to:
  /// **'Industry'**
  String get kycField_industry;

  /// No description provided for @kycField_position.
  ///
  /// In en, this message translates to:
  /// **'Position'**
  String get kycField_position;

  /// No description provided for @kycField_income.
  ///
  /// In en, this message translates to:
  /// **'Monthly income range'**
  String get kycField_income;

  /// No description provided for @kycField_tenure.
  ///
  /// In en, this message translates to:
  /// **'Time at work'**
  String get kycField_tenure;

  /// No description provided for @kycField_supervisorName.
  ///
  /// In en, this message translates to:
  /// **'Supervisor name (optional)'**
  String get kycField_supervisorName;

  /// No description provided for @kycField_supervisorPhone.
  ///
  /// In en, this message translates to:
  /// **'Supervisor phone, with country code (optional)'**
  String get kycField_supervisorPhone;

  /// No description provided for @kycField_vehicle.
  ///
  /// In en, this message translates to:
  /// **'Vehicle (optional)'**
  String get kycField_vehicle;

  /// No description provided for @kycField_housing.
  ///
  /// In en, this message translates to:
  /// **'Housing (optional)'**
  String get kycField_housing;

  /// No description provided for @kycField_bankName.
  ///
  /// In en, this message translates to:
  /// **'Bank'**
  String get kycField_bankName;

  /// No description provided for @kycField_bankAccount.
  ///
  /// In en, this message translates to:
  /// **'Account number'**
  String get kycField_bankAccount;

  /// No description provided for @kycField_bankHolder.
  ///
  /// In en, this message translates to:
  /// **'Account holder name'**
  String get kycField_bankHolder;

  /// No description provided for @kycContactRelation.
  ///
  /// In en, this message translates to:
  /// **'Contact {n} · relationship'**
  String kycContactRelation(int n);

  /// No description provided for @kycContactName.
  ///
  /// In en, this message translates to:
  /// **'Contact {n} · name'**
  String kycContactName(int n);

  /// No description provided for @kycContactPhone.
  ///
  /// In en, this message translates to:
  /// **'Contact {n} · phone, with country code'**
  String kycContactPhone(int n);

  /// No description provided for @kycContactOptional.
  ///
  /// In en, this message translates to:
  /// **'Contact 3 is optional: fill in all three items or leave them all empty.'**
  String get kycContactOptional;

  /// No description provided for @kycSlot_idFront.
  ///
  /// In en, this message translates to:
  /// **'ID card (front)'**
  String get kycSlot_idFront;

  /// No description provided for @kycSlot_idBack.
  ///
  /// In en, this message translates to:
  /// **'ID card (back)'**
  String get kycSlot_idBack;

  /// No description provided for @kycSlot_selfie.
  ///
  /// In en, this message translates to:
  /// **'Selfie'**
  String get kycSlot_selfie;

  /// No description provided for @kycSlot_incomeProof.
  ///
  /// In en, this message translates to:
  /// **'Income / work proof'**
  String get kycSlot_incomeProof;

  /// No description provided for @kycSlot_vehicleInvoice.
  ///
  /// In en, this message translates to:
  /// **'Vehicle purchase invoice'**
  String get kycSlot_vehicleInvoice;

  /// No description provided for @kycSlot_vehicleContract.
  ///
  /// In en, this message translates to:
  /// **'Vehicle purchase contract'**
  String get kycSlot_vehicleContract;

  /// No description provided for @kycSlot_vehiclePhoto.
  ///
  /// In en, this message translates to:
  /// **'Vehicle photo'**
  String get kycSlot_vehiclePhoto;

  /// No description provided for @kycSlot_rentContract.
  ///
  /// In en, this message translates to:
  /// **'Rental contract'**
  String get kycSlot_rentContract;

  /// No description provided for @kycSlot_propertyCertificate.
  ///
  /// In en, this message translates to:
  /// **'Property certificate'**
  String get kycSlot_propertyCertificate;

  /// No description provided for @kycVehicleMaterialHint.
  ///
  /// In en, this message translates to:
  /// **'Upload one vehicle document: invoice, contract or photo.'**
  String get kycVehicleMaterialHint;

  /// No description provided for @kycTitle.
  ///
  /// In en, this message translates to:
  /// **'Identity verification'**
  String get kycTitle;

  /// No description provided for @kycScopeNote.
  ///
  /// In en, this message translates to:
  /// **'Your information is reviewed manually. This is not an external ID, bank or liveness check.'**
  String get kycScopeNote;

  /// No description provided for @kycStatusDraft.
  ///
  /// In en, this message translates to:
  /// **'Draft — not submitted yet'**
  String get kycStatusDraft;

  /// No description provided for @kycStatusSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Submitted — waiting for review'**
  String get kycStatusSubmitted;

  /// No description provided for @kycStatusNeedsInfo.
  ///
  /// In en, this message translates to:
  /// **'More information needed'**
  String get kycStatusNeedsInfo;

  /// No description provided for @kycStatusApproved.
  ///
  /// In en, this message translates to:
  /// **'Approved'**
  String get kycStatusApproved;

  /// No description provided for @kycStatusRejected.
  ///
  /// In en, this message translates to:
  /// **'Not approved'**
  String get kycStatusRejected;

  /// No description provided for @kycStatusUnknown.
  ///
  /// In en, this message translates to:
  /// **'Status unavailable'**
  String get kycStatusUnknown;

  /// No description provided for @kycStatusSubmittedBody.
  ///
  /// In en, this message translates to:
  /// **'You cannot edit while it is being reviewed.'**
  String get kycStatusSubmittedBody;

  /// No description provided for @kycStatusApprovedBody.
  ///
  /// In en, this message translates to:
  /// **'Your information passed the manual review.'**
  String get kycStatusApprovedBody;

  /// No description provided for @kycStatusRejectedBody.
  ///
  /// In en, this message translates to:
  /// **'Your information was not approved.'**
  String get kycStatusRejectedBody;

  /// No description provided for @kycStatusNeedsInfoBody.
  ///
  /// In en, this message translates to:
  /// **'Please review the note below, update your information and submit again.'**
  String get kycStatusNeedsInfoBody;

  /// No description provided for @kycReviewerNote.
  ///
  /// In en, this message translates to:
  /// **'Reviewer note'**
  String get kycReviewerNote;

  /// No description provided for @kycSectionDone.
  ///
  /// In en, this message translates to:
  /// **'Complete'**
  String get kycSectionDone;

  /// No description provided for @kycSectionTodo.
  ///
  /// In en, this message translates to:
  /// **'To do'**
  String get kycSectionTodo;

  /// No description provided for @kycSubmit.
  ///
  /// In en, this message translates to:
  /// **'Submit for review'**
  String get kycSubmit;

  /// No description provided for @kycSaveDraft.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get kycSaveDraft;

  /// No description provided for @kycSavedDraft.
  ///
  /// In en, this message translates to:
  /// **'Saved'**
  String get kycSavedDraft;

  /// No description provided for @kycSubmittedOk.
  ///
  /// In en, this message translates to:
  /// **'Submitted. We will review it soon.'**
  String get kycSubmittedOk;

  /// No description provided for @kycReload.
  ///
  /// In en, this message translates to:
  /// **'Reload'**
  String get kycReload;

  /// No description provided for @kycTakePhoto.
  ///
  /// In en, this message translates to:
  /// **'Take photo'**
  String get kycTakePhoto;

  /// No description provided for @kycChooseGallery.
  ///
  /// In en, this message translates to:
  /// **'Choose from gallery'**
  String get kycChooseGallery;

  /// No description provided for @kycReplace.
  ///
  /// In en, this message translates to:
  /// **'Replace'**
  String get kycReplace;

  /// No description provided for @kycUploaded.
  ///
  /// In en, this message translates to:
  /// **'Uploaded'**
  String get kycUploaded;

  /// No description provided for @kycUploading.
  ///
  /// In en, this message translates to:
  /// **'Uploading…'**
  String get kycUploading;

  /// No description provided for @kycRequired.
  ///
  /// In en, this message translates to:
  /// **'Required'**
  String get kycRequired;

  /// No description provided for @kycOptional.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get kycOptional;

  /// No description provided for @kycSelectPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Select'**
  String get kycSelectPlaceholder;

  /// No description provided for @kycConsentTitle.
  ///
  /// In en, this message translates to:
  /// **'Data authorization'**
  String get kycConsentTitle;

  /// No description provided for @kycConsentBody.
  ///
  /// In en, this message translates to:
  /// **'I confirm that the information and documents I provide are true and belong to me. I authorize KhmerX and its lending partner to review them manually to assess my loan application and to keep them securely for that purpose.'**
  String get kycConsentBody;

  /// No description provided for @kycConsentNotice.
  ///
  /// In en, this message translates to:
  /// **'Placeholder authorization text — the final legal wording will replace it before release.'**
  String get kycConsentNotice;

  /// No description provided for @kycConsentCheckbox.
  ///
  /// In en, this message translates to:
  /// **'I have read and agree'**
  String get kycConsentCheckbox;

  /// No description provided for @kycLockedNote.
  ///
  /// In en, this message translates to:
  /// **'This information is locked and cannot be edited.'**
  String get kycLockedNote;

  /// No description provided for @kycRuleMismatch.
  ///
  /// In en, this message translates to:
  /// **'Please update the app to continue verification.'**
  String get kycRuleMismatch;

  /// No description provided for @kycPickFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not read the photo. Please try again.'**
  String get kycPickFailed;

  /// No description provided for @kycProblemMissingField.
  ///
  /// In en, this message translates to:
  /// **'Please fill in: {item}'**
  String kycProblemMissingField(String item);

  /// No description provided for @kycProblemMissingSlot.
  ///
  /// In en, this message translates to:
  /// **'Please upload: {item}'**
  String kycProblemMissingSlot(String item);

  /// No description provided for @kycProblemInvalidPhone.
  ///
  /// In en, this message translates to:
  /// **'Invalid phone number: {item}. Use the international format, for example +85512345678.'**
  String kycProblemInvalidPhone(String item);

  /// No description provided for @kycProblemVehicle.
  ///
  /// In en, this message translates to:
  /// **'Upload exactly one vehicle document.'**
  String get kycProblemVehicle;

  /// No description provided for @kycProblemContact3.
  ///
  /// In en, this message translates to:
  /// **'Contact 3: fill in all three items or leave them all empty.'**
  String get kycProblemContact3;

  /// No description provided for @kycProblemSupervisor.
  ///
  /// In en, this message translates to:
  /// **'Supervisor name and phone must be filled in together.'**
  String get kycProblemSupervisor;

  /// No description provided for @kycProblemDupRelation.
  ///
  /// In en, this message translates to:
  /// **'Emergency contacts must have different relationships.'**
  String get kycProblemDupRelation;

  /// No description provided for @kycProblemDupPhone.
  ///
  /// In en, this message translates to:
  /// **'Emergency contacts must have different phone numbers.'**
  String get kycProblemDupPhone;

  /// No description provided for @kycProblemConsent.
  ///
  /// In en, this message translates to:
  /// **'Please read and accept the authorization.'**
  String get kycProblemConsent;

  /// No description provided for @kycErrConflict.
  ///
  /// In en, this message translates to:
  /// **'Your information was changed or is locked. It has been reloaded.'**
  String get kycErrConflict;

  /// No description provided for @kycErrFileTooLarge.
  ///
  /// In en, this message translates to:
  /// **'The file is too large (max 10 MB).'**
  String get kycErrFileTooLarge;

  /// No description provided for @kycErrFileRejected.
  ///
  /// In en, this message translates to:
  /// **'The file was not accepted. Please choose another photo.'**
  String get kycErrFileRejected;

  /// No description provided for @kycErrInvalid.
  ///
  /// In en, this message translates to:
  /// **'Some information is not valid. Please check and try again.'**
  String get kycErrInvalid;

  /// No description provided for @kycErrUnavailable.
  ///
  /// In en, this message translates to:
  /// **'The service is temporarily unavailable. Nothing was saved. Please try again.'**
  String get kycErrUnavailable;

  /// No description provided for @kycOpt_Male.
  ///
  /// In en, this message translates to:
  /// **'Male'**
  String get kycOpt_Male;

  /// No description provided for @kycOpt_Female.
  ///
  /// In en, this message translates to:
  /// **'Female'**
  String get kycOpt_Female;

  /// No description provided for @kycOpt_Married.
  ///
  /// In en, this message translates to:
  /// **'Married'**
  String get kycOpt_Married;

  /// No description provided for @kycOpt_Single.
  ///
  /// In en, this message translates to:
  /// **'Single'**
  String get kycOpt_Single;

  /// No description provided for @kycOpt_Parent.
  ///
  /// In en, this message translates to:
  /// **'Parent'**
  String get kycOpt_Parent;

  /// No description provided for @kycOpt_Spouse.
  ///
  /// In en, this message translates to:
  /// **'Spouse'**
  String get kycOpt_Spouse;

  /// No description provided for @kycOpt_Relative.
  ///
  /// In en, this message translates to:
  /// **'Relative'**
  String get kycOpt_Relative;

  /// No description provided for @kycOpt_Friend.
  ///
  /// In en, this message translates to:
  /// **'Friend'**
  String get kycOpt_Friend;

  /// No description provided for @kycOpt_VillageChief.
  ///
  /// In en, this message translates to:
  /// **'Village chief'**
  String get kycOpt_VillageChief;

  /// No description provided for @kycOpt_CompanySupervisor.
  ///
  /// In en, this message translates to:
  /// **'Company supervisor'**
  String get kycOpt_CompanySupervisor;

  /// No description provided for @kycOpt_Motorbike.
  ///
  /// In en, this message translates to:
  /// **'Motorbike'**
  String get kycOpt_Motorbike;

  /// No description provided for @kycOpt_TukTuk.
  ///
  /// In en, this message translates to:
  /// **'Tuk-tuk'**
  String get kycOpt_TukTuk;

  /// No description provided for @kycOpt_Car.
  ///
  /// In en, this message translates to:
  /// **'Car'**
  String get kycOpt_Car;

  /// No description provided for @kycOpt_None.
  ///
  /// In en, this message translates to:
  /// **'None'**
  String get kycOpt_None;

  /// No description provided for @kycOpt_Rented.
  ///
  /// In en, this message translates to:
  /// **'Rented'**
  String get kycOpt_Rented;

  /// No description provided for @kycOpt_OwnedProperty.
  ///
  /// In en, this message translates to:
  /// **'Owned property'**
  String get kycOpt_OwnedProperty;

  /// No description provided for @kycSwitchKeyboard.
  ///
  /// In en, this message translates to:
  /// **'Switch keyboard'**
  String get kycSwitchKeyboard;

  /// No description provided for @kycErrPhoneFormat.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid phone number, e.g. +85512345678 or 012345678.'**
  String get kycErrPhoneFormat;

  /// No description provided for @kycErrFieldIssue.
  ///
  /// In en, this message translates to:
  /// **'Saved. Some entries were not saved because they are not valid yet: please correct the highlighted fields.'**
  String get kycErrFieldIssue;

  /// No description provided for @startupTagline.
  ///
  /// In en, this message translates to:
  /// **'Simple, transparent small loans'**
  String get startupTagline;

  /// No description provided for @kycNext.
  ///
  /// In en, this message translates to:
  /// **'Next'**
  String get kycNext;

  /// No description provided for @kycBack.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get kycBack;

  /// No description provided for @kycFieldRequired.
  ///
  /// In en, this message translates to:
  /// **'Required'**
  String get kycFieldRequired;

  /// No description provided for @kycStepProgress.
  ///
  /// In en, this message translates to:
  /// **'Step {current} of {total}'**
  String kycStepProgress(String current, String total);

  /// No description provided for @kycOverallProgress.
  ///
  /// In en, this message translates to:
  /// **'{done} of {total} sections done'**
  String kycOverallProgress(String done, String total);

  /// No description provided for @authBrandEyebrow.
  ///
  /// In en, this message translates to:
  /// **'Made for Cambodia'**
  String get authBrandEyebrow;

  /// No description provided for @authBrandSlogan.
  ///
  /// In en, this message translates to:
  /// **'Simple finance for everyday life.'**
  String get authBrandSlogan;

  /// No description provided for @authTrustClear.
  ///
  /// In en, this message translates to:
  /// **'Clear terms'**
  String get authTrustClear;

  /// No description provided for @authTrustSecure.
  ///
  /// In en, this message translates to:
  /// **'Secure data'**
  String get authTrustSecure;

  /// No description provided for @authTrustProgress.
  ///
  /// In en, this message translates to:
  /// **'Visible progress'**
  String get authTrustProgress;

  /// No description provided for @kycUseLocation.
  ///
  /// In en, this message translates to:
  /// **'Use my current location'**
  String get kycUseLocation;

  /// No description provided for @kycLocating.
  ///
  /// In en, this message translates to:
  /// **'Locating...'**
  String get kycLocating;

  /// No description provided for @kycLocHint.
  ///
  /// In en, this message translates to:
  /// **'Fills in the address from your location. Please check and edit it.'**
  String get kycLocHint;

  /// No description provided for @kycLocDenied.
  ///
  /// In en, this message translates to:
  /// **'Location permission is off. Allow it in system settings, or type the address.'**
  String get kycLocDenied;

  /// No description provided for @kycLocServiceOff.
  ///
  /// In en, this message translates to:
  /// **'Location services are off. Turn them on, or type the address.'**
  String get kycLocServiceOff;

  /// No description provided for @kycLocFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not get your address. Please type it.'**
  String get kycLocFailed;

  /// No description provided for @kycLocStagePosition.
  ///
  /// In en, this message translates to:
  /// **'Getting your location...'**
  String get kycLocStagePosition;

  /// No description provided for @kycLocStageAddress.
  ///
  /// In en, this message translates to:
  /// **'Finding your address...'**
  String get kycLocStageAddress;

  /// No description provided for @kycLocWait.
  ///
  /// In en, this message translates to:
  /// **'Please wait, this can take up to 30 seconds.'**
  String get kycLocWait;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'km', 'zh'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'km':
      return AppLocalizationsKm();
    case 'zh':
      return AppLocalizationsZh();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
