import 'package:equatable/equatable.dart';

sealed class KycStatus extends Equatable {
  const KycStatus();

  bool get isNone => this is KycNone;
  bool get isDraft => this is KycDraft;
  bool get isSubmitted => this is KycSubmitted;
  bool get isNeedsInfo => this is KycNeedsInfo;
  bool get isApproved => this is KycApproved;
  bool get isRejected => this is KycRejected;
  bool get isUnknown => this is KycUnknown;

  String? get rawValue {
    final v = switch (this) {
      KycKnown(value: final v) => v,
      KycUnknown(raw: final v) => v,
      KycNone() => null,
    };
    return v;
  }
}

final class KycNone extends KycStatus {
  const KycNone();
  @override
  List<Object?> get props => const [];
}

sealed class KycKnown extends KycStatus {
  const KycKnown(this.value);
  final String value;
}

final class KycDraft extends KycKnown {
  const KycDraft() : super('draft');
  @override
  List<Object?> get props => [value];
}

final class KycSubmitted extends KycKnown {
  const KycSubmitted() : super('submitted');
  @override
  List<Object?> get props => [value];
}

final class KycNeedsInfo extends KycKnown {
  const KycNeedsInfo() : super('needs_info');
  @override
  List<Object?> get props => [value];
}

final class KycApproved extends KycKnown {
  const KycApproved() : super('approved');
  @override
  List<Object?> get props => [value];
}

final class KycRejected extends KycKnown {
  const KycRejected() : super('rejected');
  @override
  List<Object?> get props => [value];
}

final class KycUnknown extends KycStatus {
  const KycUnknown(this.raw);
  final String? raw;

  @override
  List<Object?> get props => [raw];
}

final class KycStatusParser {
  KycStatusParser._();
  static KycStatus parse(Object? raw) {
    if (raw == null) return const KycNone();
    final s = raw.toString().trim();
    if (s.isEmpty) return const KycNone();
    return switch (s) {
      'draft' => const KycDraft(),
      'submitted' => const KycSubmitted(),
      'needs_info' => const KycNeedsInfo(),
      'approved' => const KycApproved(),
      'rejected' => const KycRejected(),
      _ => KycUnknown(s),
    };
  }
}
