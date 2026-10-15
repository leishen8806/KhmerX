import 'package:equatable/equatable.dart';

final class CompanyId extends Equatable {
  factory CompanyId(String raw) {
    if (!_regex.hasMatch(raw)) {
      throw FormatException('Invalid CompanyId format: "$raw"', raw);
    }
    return CompanyId._(raw);
  }

  const CompanyId._(this.raw);

  /// Runtime context for the open consumer app (docs 54): the client never
  /// selects or sends a company. This sentinel only keys local storage and
  /// per-context clients; it is never put on the wire. Tenant mode
  /// (`t_<uuid>`) stays in the code base, dormant.
  static const CompanyId publicWorkspace = CompanyId._('public');

  bool get isPublic => raw == 'public';

  static final RegExp _regex = RegExp(r'^t_[a-f0-9-]{36}$');

  static CompanyId? tryParse(String? raw) {
    if (raw == null) return null;
    if (raw == 'public') return publicWorkspace;
    try {
      return CompanyId(raw);
    } on FormatException {
      return null;
    }
  }

  final String raw;

  bool get isValid => isPublic || _regex.hasMatch(raw);

  @override
  List<Object?> get props => [raw];
}
