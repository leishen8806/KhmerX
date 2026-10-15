import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/bootstrap/providers.dart';
import '../../../../l10n/app_localizations.dart';
import '../../customer_state/domain/home_decision_engine.dart';
import '../../customer_state/domain/home_viewmodel.dart';
import '../../customer_state/presentation/customer_state_notifier.dart';
import 'widgets/business_status_card.dart';
import 'widgets/freshness_banner.dart';
import 'widgets/status_explanation_panel.dart';

class RealHomePage extends ConsumerStatefulWidget {
  const RealHomePage({super.key});

  @override
  ConsumerState<RealHomePage> createState() => _RealHomePageState();
}

class _RealHomePageState extends ConsumerState<RealHomePage>
    with WidgetsBindingObserver {
  static const _waitingPollInterval = Duration(seconds: 30);
  static const _waitingStateIds = <HomeStateId>{
    HomeStateId.h3,
    HomeStateId.h9,
    HomeStateId.h10,
    HomeStateId.h11,
    HomeStateId.h12,
    HomeStateId.h13,
  };

  Timer? _pollTimer;
  bool _isForeground = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _cancelPollTimer();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final wasForeground = _isForeground;
    _isForeground = state == AppLifecycleState.resumed;
    if (!wasForeground && _isForeground) {
      _maybeStartPolling();
    } else if (!_isForeground) {
      _cancelPollTimer();
    }
  }

  void _bootstrap() {
    final companyId = ref.read(activeCompanyIdProvider);
    if (companyId == null) return;
    final value = ref.read(customerStateProvider);
    if (value.snapshot == null &&
        value.status != CustomerStateFetchStatus.loading) {
      ref
          .read(customerStateProvider.notifier)
          .load(companyId: companyId, force: false);
    }
  }

  void _maybeStartPolling() {
    _cancelPollTimer();
    if (!_isForeground || !mounted) return;
    final value = ref.read(customerStateProvider);
    final freshness = _toFreshness(value);
    final vm = HomeDecisionEngine.decide(
      snapshot: value.snapshot,
      freshness: freshness,
    );
    if (!_waitingStateIds.contains(vm.stateId)) return;
    final companyId = ref.read(activeCompanyIdProvider);
    if (companyId == null) return;
    _pollTimer = Timer.periodic(_waitingPollInterval, (_) {
      if (!mounted) return;
      ref.read(customerStateProvider.notifier).load(
            companyId: companyId,
            force: true,
            isBackgroundRefresh: true,
          );
    });
  }

  void _cancelPollTimer() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  static HomeFreshness _toFreshness(CustomerStateValue v) {
    switch (v.status) {
      case CustomerStateFetchStatus.idle:
      case CustomerStateFetchStatus.loading:
        return HomeFreshness.firstLoad;
      case CustomerStateFetchStatus.loaded:
      case CustomerStateFetchStatus.refreshing:
        return HomeFreshness.live;
      case CustomerStateFetchStatus.error:
        return v.snapshot != null
            ? HomeFreshness.refreshFailed
            : HomeFreshness.offlineNoSnapshot;
      case CustomerStateFetchStatus.offline:
        return v.snapshot != null
            ? HomeFreshness.offlineWithSnapshot
            : HomeFreshness.offlineNoSnapshot;
      case CustomerStateFetchStatus.sessionInvalid:
        return HomeFreshness.sessionInvalid;
    }
  }

  Future<void> _onPullRefresh() async {
    final companyId = ref.read(activeCompanyIdProvider);
    if (companyId == null) return;
    await ref
        .read(customerStateProvider.notifier)
        .load(companyId: companyId, force: true);
  }

  void _onPrimary(HomeViewModel vm) {
    switch (vm.primaryDestination) {
      case HomeDestination.kyc:
        context.push('/kyc');
      case HomeDestination.loans:
        context.go('/loans');
      case HomeDestination.loanDetail:
        final loanId = vm.primaryLoanId;
        if (loanId != null) context.push('/loans/$loanId');
      case HomeDestination.authLogin:
        final companyId = ref.read(activeCompanyIdProvider);
        if (companyId != null) {
          ref
              .read(returnIntentProvider.notifier)
              .saveSafe(companyId, vm.returnIntentPath);
        }
        context.go('/auth/login');
      case HomeDestination.retry:
        final companyId = ref.read(activeCompanyIdProvider);
        if (companyId != null) {
          ref
              .read(customerStateProvider.notifier)
              .load(companyId: companyId, force: true);
        }
      case HomeDestination.statusPanel:
        StatusExplanationPanel.show(context, vm.statusPanelId);
      case HomeDestination.none:
        break;
    }
  }

  void _onSecondary(HomeViewModel vm) {
    switch (vm.secondaryDestination) {
      case HomeDestination.kyc:
        context.push('/kyc');
      case HomeDestination.loans:
        context.go('/loans');
      case HomeDestination.loanDetail:
        final loanId = vm.secondaryLoanId;
        if (loanId != null) context.push('/loans/$loanId');
      case HomeDestination.statusPanel:
        StatusExplanationPanel.show(context, vm.statusPanelId);
      case HomeDestination.authLogin:
        final companyId = ref.read(activeCompanyIdProvider);
        if (companyId != null) {
          ref
              .read(returnIntentProvider.notifier)
              .saveSafe(companyId, vm.returnIntentPath);
        }
        context.go('/auth/login');
      case HomeDestination.retry:
        final companyId = ref.read(activeCompanyIdProvider);
        if (companyId != null) {
          ref
              .read(customerStateProvider.notifier)
              .load(companyId: companyId, force: true);
        }
      case HomeDestination.none:
        break;
    }
  }

  String _futureCtaHint(AppLocalizations l10n, HomeViewModel vm) {
    if (vm.primaryEnabled) return '';
    return switch (vm.stateId) {
      HomeStateId.h1 ||
      HomeStateId.h2 ||
      HomeStateId.h4 =>
        l10n.home_future_cta_hint_kyc_edit,
      HomeStateId.h6 => l10n.home_future_cta_hint_apply,
      HomeStateId.h19 => '',
      _ => l10n.home_future_cta_hint_generic,
    };
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final value = ref.watch(customerStateProvider);

    final freshness = _toFreshness(value);
    final vm = HomeDecisionEngine.decide(
      snapshot: value.snapshot,
      freshness: freshness,
    );

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _maybeStartPolling();
    });

    final showWaitingHint = _waitingStateIds.contains(vm.stateId);
    final futureHint = _futureCtaHint(l10n, vm);

    final primaryLabel = _HomeLabelResolver.primary(l10n, vm);
    final secondaryLabel = vm.secondaryLabelKey == null
        ? null
        : _HomeLabelResolver.secondary(l10n, vm);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.homeTitle),
        actions: [
          IconButton(
            onPressed: () => context.go('/me'),
            icon: const Icon(Icons.person),
            tooltip: l10n.home_user_label,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _onPullRefresh,
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: constraints.maxHeight - 32,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    FreshnessBanner(freshness: freshness),
                    const SizedBox(height: 12),
                    BusinessStatusCard(
                      vm: vm,
                      snapshot: value.snapshot,
                      locale: Localizations.localeOf(context),
                      lastUpdated: value.lastAttempt,
                    ),
                    if (showWaitingHint) ...[
                      const SizedBox(height: 12),
                      _HintRow(text: l10n.home_waiting_state_hint),
                    ],
                    if (futureHint.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      _HintRow(text: futureHint),
                    ],
                    const SizedBox(height: 20),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(48),
                      ),
                      onPressed:
                          vm.primaryEnabled ? () => _onPrimary(vm) : null,
                      child: Text(primaryLabel),
                    ),
                    if (secondaryLabel != null) ...[
                      const SizedBox(height: 8),
                      OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(48),
                        ),
                        onPressed: () => _onSecondary(vm),
                        child: Text(secondaryLabel),
                      ),
                    ],
                    // The secondary action already carries the same label (state H1);
                    // do not show two identical buttons.
                    if (vm.showStatusPanelButton &&
                        secondaryLabel != l10n.home_h1_secondary) ...[
                      const SizedBox(height: 16),
                      OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(48),
                        ),
                        icon: const Icon(Icons.info_outline),
                        label: Text(l10n.home_h1_secondary),
                        onPressed: () => StatusExplanationPanel.show(
                          context,
                          vm.statusPanelId,
                        ),
                      ),
                    ],
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _HomeLabelResolver {
  static String primary(AppLocalizations l10n, HomeViewModel vm) =>
      _resolve(l10n, vm.primaryLabelKey, vm);

  static String secondary(AppLocalizations l10n, HomeViewModel vm) =>
      _resolve(l10n, vm.secondaryLabelKey!, vm);

  static String _resolve(AppLocalizations l10n, String key, HomeViewModel vm) {
    return switch (key) {
      'home_h1_primary' => l10n.home_h1_primary,
      'home_h2_primary' => l10n.home_h2_primary,
      'home_h3_primary' => l10n.home_h3_primary,
      'home_h4_primary' => l10n.home_h4_primary,
      'home_h5_primary' => l10n.home_h5_primary,
      'home_h6_primary' => l10n.home_h6_primary,
      'home_h7_primary' => l10n.home_h7_primary,
      'home_h8_primary' => l10n.home_h8_primary,
      'home_h9_primary' => l10n.home_h9_primary,
      'home_h10_primary' => l10n.home_h10_primary,
      'home_h11_primary' => l10n.home_h11_primary,
      'home_h12_primary' => l10n.home_h12_primary,
      'home_h13_primary' => l10n.home_h13_primary,
      'home_h14_primary' => l10n.home_h14_primary,
      'home_h15_primary' => l10n.home_h15_primary,
      'home_h16_primary' => l10n.home_h16_primary,
      'home_h17_primary' => l10n.home_h17_primary,
      'home_h18_primary' => l10n.home_h18_primary,
      'home_h19_primary' => l10n.home_h19_primary,
      'home_h20_primary' => l10n.home_h20_primary,
      'home_h21_primary' => l10n.home_h21_primary,
      'home_h21p_primary' => l10n.home_h21p_primary,
      'home_h22_primary' => l10n.home_h22_primary,
      'home_h1_secondary' => l10n.home_h1_secondary,
      'home_h2_secondary' => l10n.home_h2_secondary,
      'home_h4_secondary' => l10n.home_h4_secondary,
      'home_h6_secondary' => l10n.home_h6_secondary,
      _ => key,
    };
  }
}

class _HintRow extends StatelessWidget {
  const _HintRow({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 2),
          child: Icon(Icons.info_outline, size: 16, color: Colors.blueGrey),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.blueGrey.shade700,
                ),
          ),
        ),
      ],
    );
  }
}
