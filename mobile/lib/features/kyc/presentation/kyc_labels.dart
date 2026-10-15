import '../../../l10n/app_localizations.dart';
import '../domain/kyc_wire.dart';

// Generated lookup of localized KYC labels (see l10n_kyc.py).

String kycSectionLabel(AppLocalizations l, String id) => switch (id) {
      'identity' => l.kycSection_identity,
      'contacts' => l.kycSection_contacts,
      'employment' => l.kycSection_employment,
      'bank' => l.kycSection_bank,
      'consent' => l.kycSection_consent,
      _ => id,
    };

String kycFieldLabel(AppLocalizations l, String id) {
  final m = RegExp(r'^contact([123])(Relation|Name|Phone)$').firstMatch(id);
  if (m != null) {
    final n = int.parse(m.group(1)!);
    return switch (m.group(2)) {
      'Relation' => l.kycContactRelation(n),
      'Name' => l.kycContactName(n),
      _ => l.kycContactPhone(n),
    };
  }
  return switch (id) {
    'surname' => l.kycField_surname,
    'givenName' => l.kycField_givenName,
    'gender' => l.kycField_gender,
    'education' => l.kycField_education,
    'marital' => l.kycField_marital,
    'province' => l.kycField_province,
    'district' => l.kycField_district,
    'address' => l.kycField_address,
    'workType' => l.kycField_workType,
    'company' => l.kycField_company,
    'industry' => l.kycField_industry,
    'position' => l.kycField_position,
    'income' => l.kycField_income,
    'tenure' => l.kycField_tenure,
    'supervisorName' => l.kycField_supervisorName,
    'supervisorPhone' => l.kycField_supervisorPhone,
    'vehicle' => l.kycField_vehicle,
    'housing' => l.kycField_housing,
    'bankName' => l.kycField_bankName,
    'bankAccount' => l.kycField_bankAccount,
    'bankHolder' => l.kycField_bankHolder,
    _ => id,
  };
}

String kycSlotLabel(AppLocalizations l, String id) => switch (id) {
      'idFront' => l.kycSlot_idFront,
      'idBack' => l.kycSlot_idBack,
      'selfie' => l.kycSlot_selfie,
      'incomeProof' => l.kycSlot_incomeProof,
      'vehicleInvoice' => l.kycSlot_vehicleInvoice,
      'vehicleContract' => l.kycSlot_vehicleContract,
      'vehiclePhoto' => l.kycSlot_vehiclePhoto,
      'rentContract' => l.kycSlot_rentContract,
      'propertyCertificate' => l.kycSlot_propertyCertificate,
      _ => id,
    };

/// Display name of a fixed (wire-value) option, localized.
String kycFixedValueLabel(AppLocalizations l, String value) => switch (value) {
      kWireMale => l.kycOpt_Male,
      kWireFemale => l.kycOpt_Female,
      kWireMarried => l.kycOpt_Married,
      kWireSingle => l.kycOpt_Single,
      kWireParent => l.kycOpt_Parent,
      kWireSpouse => l.kycOpt_Spouse,
      kWireRelative => l.kycOpt_Relative,
      kWireFriend => l.kycOpt_Friend,
      kWireVillageChief => l.kycOpt_VillageChief,
      kWireCompanySupervisor => l.kycOpt_CompanySupervisor,
      kWireMotorbike => l.kycOpt_Motorbike,
      kWireTukTuk => l.kycOpt_TukTuk,
      kWireCar => l.kycOpt_Car,
      kWireNone => l.kycOpt_None,
      kWireRented => l.kycOpt_Rented,
      kWireOwnedProperty => l.kycOpt_OwnedProperty,
      _ => value,
    };
