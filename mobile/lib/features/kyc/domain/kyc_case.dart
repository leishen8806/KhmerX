import 'package:equatable/equatable.dart';

enum KycCaseStatus { draft, submitted, needsInfo, approved, rejected, unknown }

KycCaseStatus kycStatusFrom(String? raw) => switch (raw) {
      'draft' => KycCaseStatus.draft,
      'submitted' => KycCaseStatus.submitted,
      'needs_info' => KycCaseStatus.needsInfo,
      'approved' => KycCaseStatus.approved,
      'rejected' => KycCaseStatus.rejected,
      _ => KycCaseStatus.unknown,
    };

extension KycCaseStatusX on KycCaseStatus {
  /// Only these two statuses accept edits on the server.
  bool get editable => this == KycCaseStatus.draft || this == KycCaseStatus.needsInfo;
}

final class KycFileRef extends Equatable {
  const KycFileRef({required this.id, required this.slot, this.size = 0, this.type = ''});
  final String id;
  final String slot;
  final int size;
  final String type;

  @override
  List<Object?> get props => [id, slot, size, type];
}

/// The server's view of the KYC case (GET /api/kyc, and the reply of POST).
final class KycCase extends Equatable {
  const KycCase({
    required this.id,
    required this.revision,
    required this.status,
    required this.values,
    required this.files,
    required this.consent,
    required this.declarationVersion,
    required this.phoneVerified,
    required this.ruleVersion,
    this.reviewReason,
    this.updatedAt,
  });

  final String id;
  final int revision;
  final KycCaseStatus status;
  final Map<String, String> values;
  final Map<String, KycFileRef> files;
  final bool consent;
  final String declarationVersion;
  final bool phoneVerified;
  final String ruleVersion;

  /// Reviewer's note (needs_info / rejected). Shown verbatim.
  final String? reviewReason;
  final String? updatedAt;

  static KycCase? tryParse(Object? data) {
    if (data is! Map) return null;
    final m = Map<String, dynamic>.from(data);
    final profile = m['profile'];
    if (profile is! Map) return null;
    final values = <String, String>{};
    final rawValues = profile['values'];
    if (rawValues is Map) {
      rawValues.forEach((k, v) {
        if (v is String && v.isNotEmpty) values[k.toString()] = v;
      });
    }
    final files = <String, KycFileRef>{};
    final rawFiles = profile['files'];
    if (rawFiles is Map) {
      rawFiles.forEach((k, v) {
        if (v is Map && v['id'] is String) {
          files[k.toString()] = KycFileRef(
            id: v['id'] as String,
            slot: k.toString(),
            size: (v['size'] is num) ? (v['size'] as num).toInt() : 0,
            type: v['type']?.toString() ?? '',
          );
        }
      });
    }
    final review = m['review'];
    final reason = review is Map ? review['reason']?.toString() : null;
    final revision = m['revision'];
    return KycCase(
      id: m['id']?.toString() ?? '',
      revision: revision is num ? revision.toInt() : 0,
      status: kycStatusFrom(m['status']?.toString()),
      values: values,
      files: files,
      consent: profile['consent'] == true,
      declarationVersion: profile['declarationVersion']?.toString() ?? '',
      phoneVerified: m['phoneVerified'] == true,
      ruleVersion: m['ruleVersion']?.toString() ?? '',
      reviewReason: (reason != null && reason.isNotEmpty) ? reason : null,
      updatedAt: m['updatedAt']?.toString(),
    );
  }

  @override
  List<Object?> get props => [
        id,
        revision,
        status,
        values,
        files,
        consent,
        declarationVersion,
        phoneVerified,
        ruleVersion,
        reviewReason,
        updatedAt,
      ];
}
