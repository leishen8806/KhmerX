import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/money/money.dart';
import '../../../../l10n/app_localizations.dart';
import '../domain/loan_event.dart';
import '../domain/loan_status.dart';

extension LoanStatusL10nX on LoanStatus {
  String loanStatusLabel(AppLocalizations l10n) {
    return switch (this) {
      LoanKycApproved() => l10n.loanStatusKycApproved,
      LoanDecisionPending() => l10n.loanStatusDecisionPending,
      LoanSigned() => l10n.loanStatusSigned,
      LoanActive() => l10n.loanStatusActive,
      LoanRegistered() => l10n.loanStatusRegistered,
      LoanKycPending() => l10n.loanStatusKycPending,
      LoanNeedsInfo() => l10n.loanStatusNeedsInfo,
      LoanLegacyApproved() => l10n.loanStatusLegacyApproved,
      LoanUnknown() => l10n.loanStatusUnknown,
      LoanClosed() => l10n.loanStatusClosed,
      LoanRejected() => l10n.loanStatusRejected,
    };
  }

  Color statusColor(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return switch (this) {
      LoanActive() => scheme.primary,
      LoanClosed() => Colors.green.shade700,
      LoanRejected() => scheme.error,
      LoanUnknown() => scheme.onSurfaceVariant,
      LoanKycPending() ||
      LoanRegistered() ||
      LoanLegacyApproved() ||
      LoanNeedsInfo() ||
      LoanDecisionPending() ||
      LoanSigned() ||
      LoanKycApproved() =>
        Colors.orange.shade700,
    };
  }
}

extension LoanEventL10nX on LoanEvent {
  String eventActionLabel(AppLocalizations l10n) {
    return switch (this) {
      LoanEventCreated() => l10n.loanEventCreated,
      LoanEventSubmitted() => l10n.loanEventSubmitted,
      LoanEventSigned() => l10n.loanEventSigned,
      LoanEventFunded() => l10n.loanEventFunded,
      LoanEventRepayment() => l10n.loanEventRepayment,
      LoanEventClosed() => l10n.loanEventClosed,
      LoanEventRejected() => l10n.loanEventRejected,
      LoanEventUnknown() => l10n.loanEventUnknown,
    };
  }
}

String formatCents(int cents, Locale locale, {String? currency, String? ifMissing}) {
  if (cents < 0) {
    return ifMissing ?? '—';
  }
  try {
    return MoneyFormatter.format(
      Money.fromCents(cents),
      locale,
      currencyCode: currency,
    );
  } catch (_) {
    return ifMissing ?? '—';
  }
}

String formatDateMd(DateTime? date, Locale locale, {String fallback = '—'}) {
  if (date == null) return fallback;
  return DateFormat.yMd(locale.toLanguageTag()).format(date);
}

String formatDateTimeMd(DateTime? date, Locale locale, {String fallback = '—'}) {
  if (date == null) return fallback;
  final tag = locale.toLanguageTag();
  return '${DateFormat.yMd(tag).format(date)} ${DateFormat.Hm(tag).format(date)}';
}
