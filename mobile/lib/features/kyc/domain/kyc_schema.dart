/// KYC form schema mirrored from the server (`lib/kyc/core.ts`, docs 76 §4).
/// The server stays the final judge; this lets the app guide the user and
/// catch missing items before upload. Values are exact strings the server
/// validates; only the on-screen labels are localized.
library;

import '../../../shared/utils/regexp.dart';
import 'kyc_wire.dart';

enum KycSection { identity, contacts, employment, bank, consent }

enum KycFieldKind { text, phone, select, province, district }

/// Where a select field's options come from (assets/kyc/options.json or fixed).
enum KycOptionSource {
  none,
  education,
  workType,
  industry,
  position,
  income,
  tenure,
  gender,
  marital,
  relation,
  vehicle,
  housing,
  bank,
}

/// Sources whose values are fixed wire identifiers (labels come from l10n).
bool kycSourceIsFixed(KycOptionSource s) => const {
      KycOptionSource.gender,
      KycOptionSource.marital,
      KycOptionSource.relation,
      KycOptionSource.vehicle,
      KycOptionSource.housing,
      KycOptionSource.bank,
    }.contains(s);

final class KycField {
  const KycField(
    this.id,
    this.section, {
    this.required = false,
    this.kind = KycFieldKind.text,
    this.options = KycOptionSource.none,
    this.isPersonName = false,
  });

  final String id;
  final KycSection section;
  final bool required;
  final KycFieldKind kind;
  final KycOptionSource options;

  /// The server upper-cases person names; mirror it so what the user sees is
  /// what is stored.
  final bool isPersonName;
}

final class KycSlot {
  const KycSlot(this.id, this.section, {this.required = false, this.imageOnly = false});
  final String id;
  final KycSection section;
  final bool required;

  /// selfie / vehiclePhoto accept images only (server rule); P2 uploads images
  /// for every slot anyway.
  final bool imageOnly;
}

/// Expected options version bundled with the app (assets/kyc/options.json).
const String kKycRuleVersion = 'kyc-2026-09-21-v1';
const String kKycConsentVersion = 'kyc-data-consent-v2';

const List<KycField> kKycFields = [
  KycField('surname', KycSection.identity, required: true, isPersonName: true),
  KycField('givenName', KycSection.identity, required: true, isPersonName: true),
  KycField('gender', KycSection.identity,
      required: true, kind: KycFieldKind.select, options: KycOptionSource.gender),
  KycField('education', KycSection.identity,
      required: true, kind: KycFieldKind.select, options: KycOptionSource.education),
  KycField('marital', KycSection.identity,
      required: true, kind: KycFieldKind.select, options: KycOptionSource.marital),
  KycField('province', KycSection.identity,
      required: true, kind: KycFieldKind.province),
  KycField('district', KycSection.identity,
      required: true, kind: KycFieldKind.district),
  KycField('address', KycSection.identity, required: true),
  // contacts 1..3
  KycField('contact1Relation', KycSection.contacts,
      required: true, kind: KycFieldKind.select, options: KycOptionSource.relation),
  KycField('contact1Name', KycSection.contacts, required: true, isPersonName: true),
  KycField('contact1Phone', KycSection.contacts,
      required: true, kind: KycFieldKind.phone),
  KycField('contact2Relation', KycSection.contacts,
      required: true, kind: KycFieldKind.select, options: KycOptionSource.relation),
  KycField('contact2Name', KycSection.contacts, required: true, isPersonName: true),
  KycField('contact2Phone', KycSection.contacts,
      required: true, kind: KycFieldKind.phone),
  KycField('contact3Relation', KycSection.contacts,
      kind: KycFieldKind.select, options: KycOptionSource.relation),
  KycField('contact3Name', KycSection.contacts, isPersonName: true),
  KycField('contact3Phone', KycSection.contacts, kind: KycFieldKind.phone),
  // employment
  KycField('workType', KycSection.employment,
      required: true, kind: KycFieldKind.select, options: KycOptionSource.workType),
  KycField('company', KycSection.employment, required: true),
  KycField('industry', KycSection.employment,
      required: true, kind: KycFieldKind.select, options: KycOptionSource.industry),
  KycField('position', KycSection.employment,
      required: true, kind: KycFieldKind.select, options: KycOptionSource.position),
  KycField('income', KycSection.employment,
      required: true, kind: KycFieldKind.select, options: KycOptionSource.income),
  KycField('tenure', KycSection.employment,
      required: true, kind: KycFieldKind.select, options: KycOptionSource.tenure),
  KycField('supervisorName', KycSection.employment, isPersonName: true),
  KycField('supervisorPhone', KycSection.employment, kind: KycFieldKind.phone),
  KycField('vehicle', KycSection.employment,
      kind: KycFieldKind.select, options: KycOptionSource.vehicle),
  KycField('housing', KycSection.employment,
      kind: KycFieldKind.select, options: KycOptionSource.housing),
  // bank
  KycField('bankName', KycSection.bank,
      required: true, kind: KycFieldKind.select, options: KycOptionSource.bank),
  KycField('bankAccount', KycSection.bank, required: true),
  KycField('bankHolder', KycSection.bank, required: true, isPersonName: true),
];

/// `signature` is intentionally absent: signing belongs to the loan flow (P3).
const List<KycSlot> kKycSlots = [
  KycSlot('idFront', KycSection.identity, required: true),
  KycSlot('idBack', KycSection.identity, required: true),
  KycSlot('selfie', KycSection.identity, required: true, imageOnly: true),
  KycSlot('incomeProof', KycSection.employment, required: true),
  KycSlot('vehicleInvoice', KycSection.employment),
  KycSlot('vehicleContract', KycSection.employment),
  KycSlot('vehiclePhoto', KycSection.employment, imageOnly: true),
  KycSlot('rentContract', KycSection.employment),
  KycSlot('propertyCertificate', KycSection.employment),
];

const List<String> kKycVehicleSlots = ['vehicleInvoice', 'vehicleContract', 'vehiclePhoto'];

final RegExp kKycPhonePattern = RegExp(r'^\+[1-9]\d{7,14}$');

KycField? kycFieldById(String id) {
  for (final f in kKycFields) {
    if (f.id == id) return f;
  }
  return null;
}

List<KycField> kycFieldsOf(KycSection s) =>
    kKycFields.where((f) => f.section == s).toList(growable: false);

bool kycHasVehicle(Map<String, String> values) =>
    kKycOwnedVehicleValues.contains(values['vehicle']);

/// Is this material slot relevant for the current values?
bool kycSlotVisible(String slotId, Map<String, String> values) {
  if (kKycVehicleSlots.contains(slotId)) return kycHasVehicle(values);
  if (slotId == 'rentContract') return values['housing'] == kWireRented;
  if (slotId == 'propertyCertificate') return values['housing'] == kWireOwnedProperty;
  return true;
}

bool kycSlotRequired(String slotId, Map<String, String> values) {
  final slot = kKycSlots.firstWhere((s) => s.id == slotId);
  if (slot.required) return true;
  return (slotId == 'rentContract' || slotId == 'propertyCertificate') &&
      kycSlotVisible(slotId, values);
}

List<KycSlot> kycSlotsOf(KycSection s, Map<String, String> values) => kKycSlots
    .where((x) => x.section == s && kycSlotVisible(x.id, values))
    .toList(growable: false);

/// Normalizes a value the way the server does before comparing/sending.
String kycNormalize(KycField f, String raw) {
  var v = raw.trim();
  if (f.isPersonName) v = v.toUpperCase();
  if (f.kind == KycFieldKind.phone) {
    v = KhmerXRegexp.normalizePhone(v);
  }
  return v;
}

/// A problem found by the local completeness check. `section` lets the UI jump
/// to where it can be fixed; `field`/`slot` identify the item; `kind` selects
/// the localized message.
enum KycProblemKind {
  missingField,
  missingSlot,
  invalidPhone,
  vehicleMaterial,
  contact3Incomplete,
  supervisorIncomplete,
  duplicateRelation,
  duplicatePhone,
  consentRequired,
}

final class KycProblem {
  const KycProblem(this.kind, this.section, {this.field, this.slot});
  final KycProblemKind kind;
  final KycSection section;
  final String? field;
  final String? slot;
}

/// Local mirror of the server's `missing()` + `cleanProfile` rules.
List<KycProblem> kycValidate({
  required Map<String, String> values,
  required Set<String> uploadedSlots,
  required bool consent,
}) {
  final out = <KycProblem>[];
  for (final f in kKycFields) {
    final v = kycNormalize(f, values[f.id] ?? '');
    if (f.required && v.isEmpty) {
      out.add(KycProblem(KycProblemKind.missingField, f.section, field: f.id));
    }
    if (v.isNotEmpty && f.kind == KycFieldKind.phone && !kKycPhonePattern.hasMatch(v)) {
      out.add(KycProblem(KycProblemKind.invalidPhone, f.section, field: f.id));
    }
  }
  for (final s in kKycSlots) {
    if (kycSlotVisible(s.id, values) &&
        kycSlotRequired(s.id, values) &&
        !uploadedSlots.contains(s.id)) {
      out.add(KycProblem(KycProblemKind.missingSlot, s.section, slot: s.id));
    }
  }
  if (kycHasVehicle(values)) {
    final n = kKycVehicleSlots.where(uploadedSlots.contains).length;
    if (n != 1) {
      out.add(const KycProblem(KycProblemKind.vehicleMaterial, KycSection.employment));
    }
  }
  final c3 = ['Name', 'Phone', 'Relation'].map((k) => values['contact3$k'] ?? '').toList();
  if (c3.any((x) => x.isNotEmpty) && !c3.every((x) => x.isNotEmpty)) {
    out.add(const KycProblem(KycProblemKind.contact3Incomplete, KycSection.contacts));
  }
  if ((values['supervisorName'] ?? '').isNotEmpty !=
      (values['supervisorPhone'] ?? '').isNotEmpty) {
    out.add(const KycProblem(KycProblemKind.supervisorIncomplete, KycSection.employment));
  }
  final relations = [1, 2, 3]
      .map((n) => values['contact${n}Relation'] ?? '')
      .where((x) => x.isNotEmpty)
      .toList();
  if (relations.toSet().length != relations.length) {
    out.add(const KycProblem(KycProblemKind.duplicateRelation, KycSection.contacts));
  }
  final phones = [1, 2, 3]
      .map((n) => values['contact${n}Phone'] ?? '')
      .where((x) => x.isNotEmpty)
      .toList();
  if (phones.toSet().length != phones.length) {
    out.add(const KycProblem(KycProblemKind.duplicatePhone, KycSection.contacts));
  }
  if (!consent) {
    out.add(const KycProblem(KycProblemKind.consentRequired, KycSection.consent));
  }
  return out;
}

/// Per-field problem the user can fix while typing (null = fine).
/// - a malformed phone number;
/// - an emergency-contact phone / relationship that repeats an EARLIER contact
///   (the later one is flagged, so contact 1 is never blamed).
KycProblemKind? kycFieldIssue(Map<String, String> values, String fieldId) {
  final m = RegExp(r'^contact([123])(Relation|Phone)$').firstMatch(fieldId);
  final raw = (values[fieldId] ?? '').trim();
  if (raw.isEmpty) return null;
  final field = kycFieldById(fieldId);
  if (field != null && field.kind == KycFieldKind.phone) {
    final v = kycNormalize(field, raw);
    if (!kKycPhonePattern.hasMatch(v)) return KycProblemKind.invalidPhone;
  }
  if (m == null) return null;
  final index = int.parse(m.group(1)!);
  final isPhone = m.group(2) == 'Phone';
  String norm(String id) {
    final f = kycFieldById(id);
    final x = values[id] ?? '';
    return f == null ? x.trim() : kycNormalize(f, x);
  }

  final mine = norm(fieldId);
  for (var n = 1; n < index; n++) {
    final other = norm('contact$n${isPhone ? 'Phone' : 'Relation'}');
    if (other.isNotEmpty && other == mine) {
      return isPhone ? KycProblemKind.duplicatePhone : KycProblemKind.duplicateRelation;
    }
  }
  return null;
}

/// One screen of the wizard: a few inputs (and/or material slots) at a time so
/// the form never looks long.
final class KycStep {
  const KycStep(this.fieldIds, [this.slotIds = const []]);
  final List<String> fieldIds;
  final List<String> slotIds;
}

/// The wizard steps of a section for the current values (material slots depend
/// on the vehicle / housing answers).
List<KycStep> kycStepsOf(KycSection s, Map<String, String> values) {
  switch (s) {
    case KycSection.identity:
      return const [
        KycStep(['surname', 'givenName', 'gender']),
        KycStep(['education', 'marital']),
        KycStep(['province', 'district', 'address']),
        KycStep([], ['idFront', 'idBack', 'selfie']),
      ];
    case KycSection.contacts:
      return const [
        KycStep(['contact1Relation', 'contact1Name', 'contact1Phone']),
        KycStep(['contact2Relation', 'contact2Name', 'contact2Phone']),
        KycStep(['contact3Relation', 'contact3Name', 'contact3Phone']),
      ];
    case KycSection.employment:
      final extra = kycSlotsOf(s, values)
          .map((x) => x.id)
          .where((id) => id != 'incomeProof')
          .toList(growable: false);
      return [
        const KycStep(['workType', 'company', 'industry']),
        const KycStep(['position', 'income', 'tenure']),
        const KycStep(['supervisorName', 'supervisorPhone', 'vehicle', 'housing']),
        KycStep(const [], ['incomeProof', ...extra]),
      ];
    case KycSection.bank:
      return const [
        KycStep(['bankName', 'bankAccount', 'bankHolder']),
      ];
    case KycSection.consent:
      return const [KycStep([])];
  }
}
