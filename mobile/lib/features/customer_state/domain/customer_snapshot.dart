import 'package:equatable/equatable.dart';

import '../../../../core/session/company_id.dart';
import 'kyc_status.dart';
import 'loan_event.dart';
import 'loan_summary.dart';

enum CustomerSnapshotFreshness {
  live,
  staleWarm,
  offlineCold,
}

final class CustomerSnapshot extends Equatable {
  const CustomerSnapshot({
    required this.companyId,
    required this.kycStatus,
    this.loans = const <LoanSummary>[],
    this.events = const <LoanEvent>[],
    this.revision,
    this.fetchedAt,
  });

  final CompanyId companyId;
  final KycStatus kycStatus;
  final List<LoanSummary> loans;
  final List<LoanEvent> events;
  final Object? revision;
  final DateTime? fetchedAt;

  List<LoanSummary> get openLoans =>
      loans.where((l) => l.isOpen).toList(growable: false);

  List<LoanSummary> get closedLoans =>
      loans.where((l) => !l.isOpen).toList(growable: false);

  LoanSummary? findLoan(String id) {
    for (final l in loans) {
      if (l.id == id) return l;
    }
    return null;
  }

  List<LoanSummary> loansSortedByCreatedDesc() {
    final copy = List<LoanSummary>.of(loans);
    copy.sort((a, b) {
      final ta = a.createdAt;
      final tb = b.createdAt;
      if (ta == null && tb == null) return 0;
      if (ta == null) return 1;
      if (tb == null) return -1;
      return tb.compareTo(ta);
    });
    return List.unmodifiable(copy);
  }

  int get totalRemainingCents => openLoans.fold<int>(
        0,
        (sum, l) => sum + l.remaining,
      );

  CustomerSnapshot copyWith({
    CompanyId? companyId,
    KycStatus? kycStatus,
    List<LoanSummary>? loans,
    List<LoanEvent>? events,
    Object? revision,
    DateTime? fetchedAt,
  }) {
    return CustomerSnapshot(
      companyId: companyId ?? this.companyId,
      kycStatus: kycStatus ?? this.kycStatus,
      loans: loans ?? this.loans,
      events: events ?? this.events,
      revision: revision ?? this.revision,
      fetchedAt: fetchedAt ?? this.fetchedAt,
    );
  }

  @override
  List<Object?> get props => [
        companyId,
        kycStatus,
        loans,
        events,
        revision,
        fetchedAt,
      ];
}
