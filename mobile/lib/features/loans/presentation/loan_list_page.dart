import '../../../shared/widgets/brand_loader.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/bootstrap/providers.dart';
import '../../../../l10n/app_localizations.dart';
import '../../customer_state/domain/loan_summary.dart';
import '../../customer_state/presentation/customer_state_notifier.dart';
import '../../customer_state/presentation/formatters.dart';
import '../domain/loans_tab_viewmodel.dart';

final class LoanListPage extends ConsumerStatefulWidget {
  const LoanListPage({super.key});

  @override
  ConsumerState<LoanListPage> createState() => _LoanListPageState();
}

class _LoanListPageState extends ConsumerState<LoanListPage> {
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

  Future<void> _refresh() async {
    final companyId = ref.read(activeCompanyIdProvider);
    if (companyId == null) return;
    await ref.read(customerStateProvider.notifier).load(companyId: companyId, force: true);
    if (!mounted) return;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context);
    final state = ref.watch(customerStateProvider);
    final vm = LoansTabViewModel.from(state);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.loansTitle)),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            if (vm.headerBanner != null)
              SliverToBoxAdapter(child: vm.headerBanner!.call(context)),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              sliver: switch (vm.kind) {
                LoansListKind.loading => SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
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
                LoansListKind.sessionInvalid => SliverFillRemaining(
                    hasScrollBody: false,
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Icon(Icons.error_outline, size: 56, color: Colors.red),
                          const SizedBox(height: 16),
                          Text(
                            l10n.loansSessionInvalid,
                            textAlign: TextAlign.center,
                          ),
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
                  ),
                LoansListKind.empty => SliverFillRemaining(
                    hasScrollBody: false,
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.inbox_outlined, size: 64, color: Theme.of(context).colorScheme.onSurfaceVariant),
                          const SizedBox(height: 16),
                          Text(
                            l10n.loansEmptyTitle,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            l10n.loansEmptyBody,
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  ),
                LoansListKind.ready => SliverList.separated(
                    itemCount: vm.loans.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final loan = vm.loans[index];
                      return _LoanRow(loan: loan, locale: locale);
                    },
                  ),
              },
            ),
          ],
        ),
      ),
    );
  }
}

final class _LoanRow extends ConsumerWidget {
  const _LoanRow({required this.loan, required this.locale});

  final LoanSummary loan;
  final Locale locale;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final currency = loan.bill?.currency ?? l10n.home_currency_usd;
    final status = loan.status;
    return Semantics(
      button: true,
      label: '${l10n.loanShortIdLabel} ${loan.shortId} · ${status.loanStatusLabel(l10n)}',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => context.push('/loans/${loan.id}'),
          child: Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${l10n.loanShortIdLabel} ${loan.shortId}',
                              style: Theme.of(context).textTheme.titleMedium,
                              overflow: TextOverflow.ellipsis,
                              maxLines: 2,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${l10n.loanCreatedLabel}: ${formatDateMd(loan.createdAt, locale)}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        fit: FlexFit.loose,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: status.statusColor(context).withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            status.loanStatusLabel(l10n),
                            overflow: TextOverflow.ellipsis,
                            maxLines: 1,
                            style: TextStyle(
                              color: status.statusColor(context),
                              fontWeight: FontWeight.w600,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 20,
                    runSpacing: 8,
                    children: [
                      _InfoCell(
                        label: l10n.loanTermLabel,
                        value: '${loan.termDaysDisplay} ${l10n.home_term_days_unit}',
                      ),
                      _InfoCell(
                        label: l10n.loanPrincipalLabel,
                        value: formatCents(
                          loan.bill?.principal ?? loan.amount,
                          locale,
                          currency: currency,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

final class _InfoCell extends StatelessWidget {
  const _InfoCell({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: theme.textTheme.bodySmall),
        const SizedBox(height: 2),
        Text(value, style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
      ],
    );
  }
}
