import '../../../shared/widgets/brand_loader.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/bootstrap/providers.dart';
import '../../../../l10n/app_localizations.dart';
import '../../customer_state/domain/customer_snapshot.dart';
import '../../customer_state/domain/loan_event.dart';
import '../../customer_state/domain/loan_summary.dart';
import '../../customer_state/presentation/customer_state_notifier.dart';
import '../../customer_state/presentation/formatters.dart';

final class LoanDetailPage extends ConsumerStatefulWidget {
  const LoanDetailPage({super.key, required this.loanId});

  final String loanId;

  @override
  ConsumerState<LoanDetailPage> createState() => _LoanDetailPageState();
}

class _LoanDetailPageState extends ConsumerState<LoanDetailPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadIfNeeded();
    });
  }

  void _loadIfNeeded() {
    final companyId = ref.read(activeCompanyIdProvider);
    if (companyId == null) return;
    final value = ref.read(customerStateProvider);
    if (value.snapshot == null && value.status != CustomerStateFetchStatus.loading) {
      ref.read(customerStateProvider.notifier).load(companyId: companyId, force: false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context);
    final state = ref.watch(customerStateProvider);
    final snap = state.snapshot;
    final LoanSummary? loan = snap?.findLoan(widget.loanId);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.loanDetailTitle)),
      body: switch (state.status) {
        CustomerStateFetchStatus.sessionInvalid => const _SessionInvalidView(),
        CustomerStateFetchStatus.loading when loan == null => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const BrandLoader(),
                  const SizedBox(height: 12),
                  Text(l10n.commonLoading),
                ],
              ),
            ),
          ),
        _ when loan == null => const _LoanMissingView(),
        _ => _LoanLoadedView(
            snapshot: snap!,
            loan: loan,
            locale: locale,
          ),
      },
    );
  }
}

final class _SessionInvalidView extends ConsumerWidget {
  const _SessionInvalidView();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(Icons.error_outline, size: 56, color: Colors.red),
            const SizedBox(height: 16),
            Text(l10n.loansSessionInvalid, textAlign: TextAlign.center),
            const SizedBox(height: 20),
            FilledButton(
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              onPressed: () {
                final cid = ref.read(activeCompanyIdProvider);
                if (cid != null) {
                  ref
                      .read(returnIntentProvider.notifier)
                      .saveSafe(cid, '/loans');
                }
                context.go('/auth/login');
              },
              child: Text(l10n.home_h22_primary),
            ),
          ],
        ),
      ),
    );
  }
}

final class _LoanMissingView extends StatelessWidget {
  const _LoanMissingView();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.hide_source_outlined, size: 56, color: Theme.of(context).colorScheme.onSurfaceVariant),
            const SizedBox(height: 16),
            Text(
              l10n.loanDetailNotFoundTitle,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              l10n.loanDetailNotFoundBody,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              onPressed: () {
                if (GoRouter.of(context).canPop()) {
                  context.pop();
                } else {
                  context.go('/loans');
                }
              },
              icon: const Icon(Icons.arrow_back),
              label: Text(MaterialLocalizations.of(context).backButtonTooltip),
            ),
          ],
        ),
      ),
    );
  }
}

final class _LoanLoadedView extends StatelessWidget {
  const _LoanLoadedView({required this.snapshot, required this.loan, required this.locale});

  final CustomerSnapshot snapshot;
  final LoanSummary loan;
  final Locale locale;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final currency = loan.bill?.currency ?? l10n.home_currency_usd;
    final events = loan.recent5From(snapshot.events);
    final status = loan.status;
    final List<({String label, String value})> fields = [
      (label: l10n.loanFieldStatus, value: status.loanStatusLabel(l10n)),
      (label: l10n.loanFieldPrincipal, value: formatCents(loan.bill?.principal ?? loan.amount, locale, currency: currency)),
      (label: l10n.loanFieldTerm, value: '${loan.termDaysDisplay} ${l10n.home_term_days_unit}'),
      (label: l10n.loanFieldActualReceived, value: formatCents(loan.netDisplay, locale, currency: currency)),
      (label: l10n.loanFieldTotalRepayment, value: formatCents(loan.amount + loan.fee, locale, currency: currency)),
      (label: l10n.loanFieldPaid, value: formatCents(loan.paid, locale, currency: currency)),
      (label: l10n.loanFieldRemaining, value: formatCents(loan.remaining, locale, currency: currency)),
      (label: l10n.loanFieldDueDate, value: formatDateMd(loan.dueAt, locale, fallback: l10n.home_due_date_missing)),
    ];
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        _HeroCard(loan: loan, locale: locale, currency: currency),
        const SizedBox(height: 16),
        Text(
          l10n.loanDetailTitle,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                for (final f in fields) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          width: 110,
                          child: Text(
                            f.label,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            f.value,
                            textAlign: TextAlign.right,
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (f != fields.last) const Divider(height: 1),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          l10n.loanSectionBillingTitle,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _BillingRow(
                  label: l10n.loanFieldPrincipal,
                  value: formatCents(loan.bill?.principal ?? loan.amount, locale, currency: currency),
                ),
                _BillingRow(
                  label: l10n.loanFieldActualReceived,
                  value: formatCents(loan.netDisplay, locale, currency: currency),
                ),
                _BillingRow(
                  label: l10n.loanFieldTotalRepayment,
                  value: formatCents(loan.amount + loan.fee, locale, currency: currency),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          l10n.loanSectionEventsTitle,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        events.isEmpty
            ? Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    l10n.loansEmptyBody,
                    style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
                  ),
                ),
              )
            : Card(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Column(
                    children: [
                      for (int i = 0; i < events.length; i++) ...[
                        _EventRow(event: events[i], locale: locale),
                        if (i != events.length - 1) const Divider(height: 1, indent: 16, endIndent: 16),
                      ],
                    ],
                  ),
                ),
              ),
      ],
    );
  }
}

final class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.loan, required this.locale, required this.currency});

  final LoanSummary loan;
  final Locale locale;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final status = loan.status;
    return Card(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${l10n.loanShortIdLabel} ${loan.shortId}',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          )),
                  const SizedBox(height: 4),
                  Text(
                    '${l10n.loanStatusLabel}: ${status.loanStatusLabel(l10n)}',
                    style: TextStyle(color: status.statusColor(context), fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Flexible(
              fit: FlexFit.loose,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    formatCents(loan.remaining, locale, currency: currency),
                    textAlign: TextAlign.right,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    l10n.loanFieldRemaining,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

final class _BillingRow extends StatelessWidget {
  const _BillingRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(label, style: Theme.of(context).textTheme.bodyMedium),
          ),
          const SizedBox(width: 12),
          Flexible(
            fit: FlexFit.loose,
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

final class _EventRow extends StatelessWidget {
  const _EventRow({required this.event, required this.locale});

  final LoanEvent event;
  final Locale locale;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 4),
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(event.eventActionLabel(l10n), style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text(formatDateTimeMd(event.at, locale), style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
