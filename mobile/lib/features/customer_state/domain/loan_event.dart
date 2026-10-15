import 'package:equatable/equatable.dart';

sealed class LoanEvent extends Equatable {
  const LoanEvent();

  String? get loanId;
  DateTime? get at;
  String? get rawAction;
  String? get rawValue;

  static int compareDescAt(LoanEvent a, LoanEvent b) {
    final ta = a.at;
    final tb = b.at;
    if (ta == null && tb == null) return 0;
    if (ta == null) return 1;
    if (tb == null) return -1;
    return tb.compareTo(ta);
  }
}

sealed class LoanEventKnown extends LoanEvent {
  const LoanEventKnown(this.action, this.loanId, this.at);
  final String action;
  @override
  final String? loanId;
  @override
  final DateTime? at;

  @override
  String? get rawAction => action;

  @override
  String? get rawValue => null;

  @override
  List<Object?> get props => [action, loanId, at];
}

final class LoanEventCreated extends LoanEventKnown {
  const LoanEventCreated({required String? loanId, required DateTime? at})
      : super('created', loanId, at);
}

final class LoanEventSubmitted extends LoanEventKnown {
  const LoanEventSubmitted({required String? loanId, required DateTime? at})
      : super('submitted', loanId, at);
}

final class LoanEventSigned extends LoanEventKnown {
  const LoanEventSigned({required String? loanId, required DateTime? at})
      : super('signed', loanId, at);
}

final class LoanEventFunded extends LoanEventKnown {
  const LoanEventFunded({required String? loanId, required DateTime? at})
      : super('funded', loanId, at);
}

final class LoanEventRepayment extends LoanEventKnown {
  const LoanEventRepayment({required String? loanId, required DateTime? at})
      : super('repayment', loanId, at);
}

final class LoanEventClosed extends LoanEventKnown {
  const LoanEventClosed({required String? loanId, required DateTime? at})
      : super('closed', loanId, at);
}

final class LoanEventRejected extends LoanEventKnown {
  const LoanEventRejected({required String? loanId, required DateTime? at})
      : super('rejected', loanId, at);
}

final class LoanEventUnknown extends LoanEvent {
  const LoanEventUnknown({
    this.loanId,
    this.at,
    this.rawAction,
    this.rawValue,
  });

  @override
  final String? loanId;
  @override
  final DateTime? at;
  @override
  final String? rawAction;
  @override
  final String? rawValue;

  @override
  List<Object?> get props => [loanId, at, rawAction, rawValue];
}

final class LoanEventParser {
  LoanEventParser._();

  static DateTime? _parseAt(Object? raw) {
    if (raw == null) return null;
    if (raw is DateTime) return raw;
    try {
      final s = raw.toString().trim();
      if (s.isEmpty) return null;
      return DateTime.tryParse(s);
    } catch (_) {
      return null;
    }
  }

  static LoanEvent parse(Object? raw) {
    if (raw is! Map<String, dynamic>) {
      return LoanEventUnknown(rawValue: raw?.toString());
    }
    final loanId = raw['loanId']?.toString();
    final at = _parseAt(raw['at'] ?? raw['timestamp'] ?? raw['createdAt']);
    final actionRaw = raw['action']?.toString().trim();
    if (actionRaw == null || actionRaw.isEmpty) {
      return LoanEventUnknown(
        loanId: loanId,
        at: at,
        rawValue: raw.toString(),
      );
    }
    return switch (actionRaw) {
      'created' || 'create' =>
        LoanEventCreated(loanId: loanId, at: at),
      'submitted' || 'submit' || 'apply' =>
        LoanEventSubmitted(loanId: loanId, at: at),
      'signed' || 'sign' =>
        LoanEventSigned(loanId: loanId, at: at),
      'funded' || 'active' || 'disbursed' =>
        LoanEventFunded(loanId: loanId, at: at),
      'repayment' || 'pay' || 'paid' || 'repay' =>
        LoanEventRepayment(loanId: loanId, at: at),
      'closed' || 'settled' =>
        LoanEventClosed(loanId: loanId, at: at),
      'rejected' || 'denied' || 'declined' =>
        LoanEventRejected(loanId: loanId, at: at),
      _ => LoanEventUnknown(
          loanId: loanId,
          at: at,
          rawAction: actionRaw,
          rawValue: raw.toString(),
        ),
    };
  }
}
