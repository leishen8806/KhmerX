import 'package:equatable/equatable.dart';

import 'billing.dart';
import 'loan_event.dart';
import 'loan_status.dart';

final class LoanSummary extends Equatable {
  const LoanSummary({
    required this.id,
    required this.status,
    required this.amount,
    required this.fee,
    required this.paid,
    this.wallet,
    this.createdAt,
    this.dueAt,
    this.signedAt,
    this.bill,
    this.billConfirmedAt,
    this.name,
    this.contract,
  });

  final String id;
  final LoanStatus status;
  final int amount;
  final int fee;
  final int paid;
  final int? wallet;
  final DateTime? createdAt;
  final DateTime? dueAt;
  final DateTime? signedAt;
  final Billing? bill;
  final DateTime? billConfirmedAt;
  final String? name;
  final String? contract;

  bool get isOpen {
    if (status is LoanUnknown) return false;
    return !status.isTerminalClosed;
  }

  int get remaining {
    final r = amount + fee - paid;
    return r < 0 ? 0 : r;
  }

  int get termDaysDisplay => bill?.termDays ?? 14;

  int get netDisplay => bill?.net ?? amount;

  String get shortId {
    if (id.length < 8) return '#${id.toUpperCase()}';
    return '#${id.substring(0, 8).toUpperCase()}';
  }

  bool get hasContract => contract != null && contract!.isNotEmpty;

  List<LoanEvent> recent5From(List<LoanEvent> allEvents) {
    final filtered = allEvents.where((e) => e.loanId == id).toList(growable: false);
    filtered.sort(LoanEvent.compareDescAt);
    return filtered.take(5).toList(growable: false);
  }

  LoanSummary copyWith({
    String? id,
    LoanStatus? status,
    int? amount,
    int? fee,
    int? paid,
    int? wallet,
    DateTime? createdAt,
    DateTime? dueAt,
    DateTime? signedAt,
    Billing? bill,
    DateTime? billConfirmedAt,
    String? name,
    String? contract,
  }) {
    return LoanSummary(
      id: id ?? this.id,
      status: status ?? this.status,
      amount: amount ?? this.amount,
      fee: fee ?? this.fee,
      paid: paid ?? this.paid,
      wallet: wallet ?? this.wallet,
      createdAt: createdAt ?? this.createdAt,
      dueAt: dueAt ?? this.dueAt,
      signedAt: signedAt ?? this.signedAt,
      bill: bill ?? this.bill,
      billConfirmedAt: billConfirmedAt ?? this.billConfirmedAt,
      name: name ?? this.name,
      contract: contract ?? this.contract,
    );
  }

  @override
  List<Object?> get props => [
        id,
        status,
        amount,
        fee,
        paid,
        wallet,
        createdAt,
        dueAt,
        signedAt,
        bill,
        billConfirmedAt,
        name,
        contract,
      ];
}
