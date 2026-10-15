import 'package:flutter/material.dart';

import '../../../../l10n/app_localizations.dart';
import '../../customer_state/domain/loan_summary.dart';
import '../../customer_state/presentation/customer_state_notifier.dart';

enum LoansListKind {
  loading,
  ready,
  empty,
  sessionInvalid,
}

final class LoansTabViewModel {
  const LoansTabViewModel({
    required this.kind,
    required this.loans,
    this.headerBanner,
  });

  final LoansListKind kind;
  final List<LoanSummary> loans;
  final Widget Function(BuildContext)? headerBanner;

  factory LoansTabViewModel.from(CustomerStateValue value) {
    final status = value.status;
    final snap = value.snapshot;
    Widget Function(BuildContext)? header;
    final l = switch (status) {
      CustomerStateFetchStatus.loading => snap == null ? LoansListKind.loading : LoansListKind.ready,
      CustomerStateFetchStatus.refreshing => LoansListKind.ready,
      CustomerStateFetchStatus.loaded => LoansListKind.ready,
      CustomerStateFetchStatus.error => snap == null ? LoansListKind.loading : LoansListKind.ready,
      CustomerStateFetchStatus.offline => snap == null ? LoansListKind.sessionInvalid : LoansListKind.ready,
      CustomerStateFetchStatus.sessionInvalid => LoansListKind.sessionInvalid,
      CustomerStateFetchStatus.idle => snap == null ? LoansListKind.loading : LoansListKind.ready,
    };
    if (status == CustomerStateFetchStatus.error && snap != null) {
      header = (ctx) {
        final l10n = AppLocalizations.of(ctx);
        return Container(
          margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.amber.shade100,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.amber.shade300),
          ),
          child: Row(
            children: [
              Icon(Icons.cloud_off_outlined, color: Colors.amber.shade800),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  l10n.loansRefreshFailed,
                  style: TextStyle(color: Colors.amber.shade900),
                ),
              ),
            ],
          ),
        );
      };
    }
    if (status == CustomerStateFetchStatus.offline && snap != null) {
      header = (ctx) {
        final l10n = AppLocalizations.of(ctx);
        return Container(
          margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.grey.shade200,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey.shade400),
          ),
          child: Row(
            children: [
              const Icon(Icons.signal_wifi_connected_no_internet_4_outlined, color: Colors.black54),
              const SizedBox(width: 10),
              Expanded(child: Text(l10n.loansOfflineWarm)),
            ],
          ),
        );
      };
    }
    final list = snap == null ? <LoanSummary>[] : snap.loansSortedByCreatedDesc();
    if (l == LoansListKind.ready && list.isEmpty) {
      return LoansTabViewModel(kind: LoansListKind.empty, loans: const [], headerBanner: header);
    }
    return LoansTabViewModel(kind: l, loans: list, headerBanner: header);
  }
}
