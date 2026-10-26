import 'kyc_schema.dart';

final class KycRequest {
  const KycRequest(this.target, this.reasonCode, this.note);
  final String target;
  final String reasonCode;
  final String note;
  KycSection? get section {
    final parts = target.split(':');
    if (parts.length != 2) return null;
    final id = parts[1];
    if (parts[0] == 'section') {
      if (id == 'income' || id == 'assets') return KycSection.employment;
      for (final section in KycSection.values) {
        if (section.name == id) return section;
      }
    }
    if (parts[0] == 'field') {
      for (final field in kKycFields) {
        if (field.id == id) return field.section;
      }
      if (id == 'documentType' || id == 'documentNumber') return KycSection.identity;
    }
    if (parts[0] == 'slot' && id != 'signature') {
      for (final slot in kKycSlots) {
        if (slot.id == id) return slot.section;
      }
    }
    return null;
  }
  bool matchesStep(KycStep step) {
    if (target == 'section:income') return step.fieldIds.any(const ['income','tenure','supervisorName','supervisorPhone'].contains) || step.slotIds.contains('incomeProof');
    if (target == 'section:assets') return step.fieldIds.any(const ['vehicle','housing'].contains) || step.slotIds.any((id) => id != 'incomeProof');
    if (target == 'section:employment') return step.fieldIds.any(const ['workType','company','industry','position'].contains);
    return target.startsWith('field:')
      ? step.fieldIds.contains(target.substring(6))
      : target.startsWith('slot:')
          ? step.slotIds.contains(target.substring(5))
          : target.startsWith('section:');
  }
}

/// Null means legacy/missing; an explicit empty array never activates fallback.
List<KycRequest>? parseKycRequests(Object? review) {
  if (review is! Map || !review.containsKey('requests')) return null;
  final raw = review['requests'];
  if (raw is! List) return const [];
  return List.unmodifiable(raw.whereType<Map>().where((r) => r['target'] is String).map(
    (r) => KycRequest(r['target'] as String,
        r['reasonCode'] is String ? r['reasonCode'] as String : 'other',
        r['note'] is String ? r['note'] as String : ''),
  ));
}
