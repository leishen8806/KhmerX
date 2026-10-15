import 'package:equatable/equatable.dart';

sealed class LoanStatus extends Equatable {
  const LoanStatus();

  bool get isKycApproved => this is LoanKycApproved;
  bool get isDecisionPending => this is LoanDecisionPending;
  bool get isSigned => this is LoanSigned;
  bool get isActive => this is LoanActive;
  bool get isClosed => this is LoanClosed;
  bool get isRejected => this is LoanRejected;
  bool get isRegistered => this is LoanRegistered;
  bool get isKycPending => this is LoanKycPending;
  bool get isLoanNeedsInfo => this is LoanNeedsInfo;
  bool get isLegacyApproved => this is LoanLegacyApproved;
  bool get isUnknown => this is LoanUnknown;

  bool get isTerminalClosed => this is LoanClosed || this is LoanRejected;

  String? get rawValue {
    return switch (this) {
      LoanKnown(value: final v) => v,
      LoanUnknown(raw: final v) => v,
    };
  }
}

sealed class LoanKnown extends LoanStatus {
  const LoanKnown(this.value);
  final String value;
}

final class LoanKycApproved extends LoanKnown {
  const LoanKycApproved() : super('kyc_approved');
  @override
  List<Object?> get props => [value];
}

final class LoanDecisionPending extends LoanKnown {
  const LoanDecisionPending() : super('decision_pending');
  @override
  List<Object?> get props => [value];
}

final class LoanSigned extends LoanKnown {
  const LoanSigned() : super('signed');
  @override
  List<Object?> get props => [value];
}

final class LoanActive extends LoanKnown {
  const LoanActive() : super('active');
  @override
  List<Object?> get props => [value];
}

final class LoanClosed extends LoanKnown {
  const LoanClosed() : super('closed');
  @override
  List<Object?> get props => [value];
}

final class LoanRejected extends LoanKnown {
  const LoanRejected() : super('rejected');
  @override
  List<Object?> get props => [value];
}

final class LoanRegistered extends LoanKnown {
  const LoanRegistered() : super('registered');
  @override
  List<Object?> get props => [value];
}

final class LoanKycPending extends LoanKnown {
  const LoanKycPending() : super('kyc_pending');
  @override
  List<Object?> get props => [value];
}

final class LoanNeedsInfo extends LoanKnown {
  const LoanNeedsInfo() : super('needs_info');
  @override
  List<Object?> get props => [value];
}

final class LoanLegacyApproved extends LoanKnown {
  const LoanLegacyApproved() : super('approved');
  @override
  List<Object?> get props => [value];
}

final class LoanUnknown extends LoanStatus {
  const LoanUnknown(this.raw);
  final String? raw;

  @override
  List<Object?> get props => [raw];
}

final class LoanStatusParser {
  LoanStatusParser._();
  static LoanStatus parse(Object? raw) {
    if (raw == null) return const LoanUnknown(null);
    final s = raw.toString().trim();
    if (s.isEmpty) return const LoanUnknown('');
    return switch (s) {
      'kyc_approved' => const LoanKycApproved(),
      'decision_pending' => const LoanDecisionPending(),
      'signed' => const LoanSigned(),
      'active' => const LoanActive(),
      'closed' => const LoanClosed(),
      'rejected' => const LoanRejected(),
      'registered' => const LoanRegistered(),
      'kyc_pending' => const LoanKycPending(),
      'needs_info' => const LoanNeedsInfo(),
      'approved' => const LoanLegacyApproved(),
      _ => LoanUnknown(s),
    };
  }
}
