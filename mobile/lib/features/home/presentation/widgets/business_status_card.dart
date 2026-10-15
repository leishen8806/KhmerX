import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/money/money.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../customer_state/domain/customer_snapshot.dart';
import '../../../customer_state/domain/home_viewmodel.dart';
import '../../../customer_state/domain/loan_summary.dart';

class BusinessStatusCard extends StatelessWidget {
  const BusinessStatusCard({
    super.key,
    required this.vm,
    required this.snapshot,
    required this.locale,
    this.companyName,
    this.lastUpdated,
  });

  final HomeViewModel vm;
  final CustomerSnapshot? snapshot;
  final Locale locale;
  final String? companyName;
  final DateTime? lastUpdated;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final title = _title(l10n);
    final summary = _summary(l10n);
    final openLoan = _openLoanForVm();

    return Semantics(
      label: l10n.home_semantics_business_card,
      child: Card(
        margin: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if ((companyName ?? '').isNotEmpty) ...[
                Text(
                  l10n.home_company_label,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: Colors.grey.shade600,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  companyName!,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 12),
              ],
              Text(
                l10n.home_status_label,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: Colors.grey.shade600,
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                title,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 6),
              Text(
                summary,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              if (openLoan != null) ...[
                const SizedBox(height: 16),
                const Divider(height: 1),
                const SizedBox(height: 14),
                _LoanSummaryRows(
                  loan: openLoan,
                  locale: locale,
                  l10n: l10n,
                ),
              ],
              if (vm.openLoanExtraKycNotice) ...[
                const SizedBox(height: 14),
                _ExtraKycNotice(text: l10n.home_open_loan_kyc_notice_extra),
              ],
              const SizedBox(height: 12),
              Text(
                _lastUpdatedLine(l10n),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.grey.shade600,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  LoanSummary? _openLoanForVm() {
    final s = snapshot;
    final openId = vm.openLoanId;
    if (s == null) return null;
    if (openId != null) return s.findLoan(openId);
    final opens = s.openLoans;
    return opens.isEmpty ? null : opens.first;
  }

  String _title(AppLocalizations l10n) => switch (vm.titleKey) {
        'home_h1_title' => l10n.home_h1_title,
        'home_h2_title' => l10n.home_h2_title,
        'home_h3_title' => l10n.home_h3_title,
        'home_h4_title' => l10n.home_h4_title,
        'home_h5_title' => l10n.home_h5_title,
        'home_h6_title' => l10n.home_h6_title,
        'home_h7_title' => l10n.home_h7_title,
        'home_h8_title' => l10n.home_h8_title,
        'home_h9_title' => l10n.home_h9_title,
        'home_h10_title' => l10n.home_h10_title,
        'home_h11_title' => l10n.home_h11_title,
        'home_h12_title' => l10n.home_h12_title,
        'home_h13_title' => l10n.home_h13_title,
        'home_h14_title' => l10n.home_h14_title,
        'home_h15_title' => l10n.home_h15_title,
        'home_h16_title' => l10n.home_h16_title,
        'home_h17_title' => l10n.home_h17_title,
        'home_h18_title' => l10n.home_h18_title,
        'home_h19_title' => l10n.home_h19_title,
        'home_h20_title' => l10n.home_h20_title,
        'home_h21_title' => l10n.home_h21_title,
        'home_h21p_title' => l10n.home_h21p_title,
        'home_h22_title' => l10n.home_h22_title,
        _ => vm.titleKey,
      };

  String _summary(AppLocalizations l10n) {
    if (vm.summaryKey == 'home_h14_summary') {
      final open = _openLoanForVm();
      final remainingStr = open == null
          ? l10n.home_amount_missing
          : MoneyFormatter.format(
              Money.fromCents(open.remaining),
              locale,
              currencyCode: open.bill?.currency ?? l10n.home_currency_usd,
            );
      final dueDateStr = open == null || open.dueAt == null
          ? l10n.home_due_date_missing
          : DateFormat.yMd(locale.toLanguageTag()).format(open.dueAt!);
      return l10n.home_h14_summary(remainingStr, dueDateStr);
    }
    return switch (vm.summaryKey) {
      'home_h1_summary' => l10n.home_h1_summary,
      'home_h2_summary' => l10n.home_h2_summary,
      'home_h3_summary' => l10n.home_h3_summary,
      'home_h4_summary' => l10n.home_h4_summary,
      'home_h5_summary' => l10n.home_h5_summary,
      'home_h6_summary' => l10n.home_h6_summary,
      'home_h7_summary' => l10n.home_h7_summary,
      'home_h8_summary' => l10n.home_h8_summary,
      'home_h9_summary' => l10n.home_h9_summary,
      'home_h10_summary' => l10n.home_h10_summary,
      'home_h11_summary' => l10n.home_h11_summary,
      'home_h12_summary' => l10n.home_h12_summary,
      'home_h13_summary' => l10n.home_h13_summary,
      'home_h15_summary' => l10n.home_h15_summary,
      'home_h16_summary' => l10n.home_h16_summary,
      'home_h17_summary' => l10n.home_h17_summary,
      'home_h18_summary' => l10n.home_h18_summary,
      'home_h19_summary' => l10n.home_h19_summary,
      'home_h20_summary' => l10n.home_h20_summary,
      'home_h21_summary' => l10n.home_h21_summary,
      'home_h21p_summary' => l10n.home_h21p_summary,
      'home_h22_summary' => l10n.home_h22_summary,
      _ => vm.summaryKey,
    };
  }

  String _lastUpdatedLine(AppLocalizations l10n) {
    final when = lastUpdated;
    if (when == null) return l10n.home_last_updated_never;
    final tag = locale.toLanguageTag();
    final date = DateFormat.yMd(tag).format(when);
    final time = DateFormat.Hm(tag).format(when);
    return '${l10n.home_last_updated}: $date $time';
  }
}

class _LoanSummaryRows extends StatelessWidget {
  const _LoanSummaryRows({
    required this.loan,
    required this.locale,
    required this.l10n,
  });

  final LoanSummary loan;
  final Locale locale;
  final AppLocalizations l10n;

  String _fmt(int cents, {String? currency}) => MoneyFormatter.format(
        Money.fromCents(cents),
        locale,
        currencyCode: currency ?? loan.bill?.currency ?? l10n.home_currency_usd,
      );

  String _date(DateTime? dt) {
    if (dt == null) return l10n.home_due_date_missing;
    return DateFormat.yMd(locale.toLanguageTag()).format(dt);
  }

  @override
  Widget build(BuildContext context) {
    final currency = loan.bill?.currency ?? l10n.home_currency_usd;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l10n.home_loan_summary_label,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: Colors.grey.shade600,
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 10),
        _Row(label: l10n.home_remaining_label, value: _fmt(loan.remaining, currency: currency)),
        const SizedBox(height: 6),
        _Row(
          label: l10n.home_term_label,
          value: '${loan.termDaysDisplay} ${l10n.home_term_days_unit}',
        ),
        const SizedBox(height: 6),
        _Row(label: l10n.home_due_date_label, value: _date(loan.dueAt)),
        const SizedBox(height: 6),
        _Row(
          label: l10n.home_principal_label,
          value: _fmt(loan.netDisplay, currency: currency),
        ),
        const SizedBox(height: 6),
        _Row(
          label: l10n.home_total_repay_label,
          value: _fmt(loan.amount + loan.fee, currency: currency),
        ),
        const SizedBox(height: 6),
        _Row(label: l10n.home_paid_label, value: _fmt(loan.paid, currency: currency)),
      ],
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 5,
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.grey.shade600,
                ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          flex: 6,
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w500,
                ),
          ),
        ),
      ],
    );
  }
}

class _ExtraKycNotice extends StatelessWidget {
  const _ExtraKycNotice({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.amber.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.amber.shade200),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.warning_amber_outlined, size: 18, color: Colors.amber),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.amber.shade900,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}
