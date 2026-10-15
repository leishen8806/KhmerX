import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

import 'kyc_schema.dart';
import 'kyc_wire.dart';

/// One selectable value. [value] is what the server stores/validates;
/// [label] is the raw label (possibly "English / ខ្មែរ"), shown via
/// [KycOption.labelFor].
final class KycOption {
  const KycOption(this.value, this.label);
  final String value;
  final String label;

  /// Picks the part of the label that matches the UI language.
  /// Server labels look like `English / Khmer`, `Chinese / English / Khmer`
  /// (districts) or `Chinese/English` (provinces).
  String labelFor(String languageCode) => kycPickLabel(label, languageCode);
}

String kycPickLabel(String label, String languageCode) {
  var parts = label.split(' / ').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
  if (parts.length == 1 && label.contains('/')) {
    parts = label.split('/').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
  }
  if (parts.length >= 3) {
    // zh / en / km
    return switch (languageCode) {
      'zh' => parts[0],
      'km' => parts[2],
      _ => parts[1],
    };
  }
  if (parts.length == 2) {
    final first = parts[0];
    final second = parts[1];
    final firstIsCjk = RegExp(r'[\u4e00-\u9fff]').hasMatch(first);
    if (firstIsCjk) {
      // zh / en  (province values have no Khmer part)
      return languageCode == 'zh' ? first : second;
    }
    // en / km
    return languageCode == 'km' ? second : first;
  }
  return label;
}

final class KycRegion {
  const KycRegion(this.value, this.districts);
  final String value;
  final List<KycOption> districts;
}

final class KycOptions {
  const KycOptions({
    required this.version,
    required this.lists,
    required this.regions,
  });

  final String version;
  final Map<String, List<KycOption>> lists;
  final List<KycRegion> regions;

  static KycOptions parse(String jsonText) {
    KycOption option(Object? e) {
      final m = e! as Map<String, dynamic>;
      return KycOption(m['value'] as String, m['label'] as String);
    }

    final root = json.decode(jsonText) as Map<String, dynamic>;
    final options = (root['options'] as Map<String, dynamic>).map(
      (k, v) => MapEntry(k, (v as List<dynamic>).map(option).toList(growable: false)),
    );
    final regions = (root['regions'] as List<dynamic>).map((r) {
      final m = r as Map<String, dynamic>;
      return KycRegion(
        m['value'] as String,
        (m['districts'] as List<dynamic>).map(option).toList(growable: false),
      );
    }).toList(growable: false);
    return KycOptions(
      version: root['version'] as String,
      lists: options,
      regions: regions,
    );
  }

  static Future<KycOptions> load() async =>
      parse(await rootBundle.loadString('assets/kyc/options.json'));

  List<KycOption> optionsFor(KycOptionSource source) {
    // Fixed wire values: the screen localizes them via kycFixedValueLabel.
    List<KycOption> fixed(List<String> values) =>
        values.map((v) => KycOption(v, v)).toList(growable: false);
    return switch (source) {
      KycOptionSource.none => const [],
      KycOptionSource.education => lists['education'] ?? const [],
      KycOptionSource.workType => lists['workType'] ?? const [],
      KycOptionSource.industry => lists['industry'] ?? const [],
      KycOptionSource.position => lists['position'] ?? const [],
      KycOptionSource.income => lists['income'] ?? const [],
      KycOptionSource.tenure => lists['tenure'] ?? const [],
      KycOptionSource.gender => fixed(kKycGenderValues),
      KycOptionSource.marital => fixed(kKycMaritalValues),
      KycOptionSource.relation => fixed(kKycRelationValues),
      KycOptionSource.vehicle => fixed(kKycVehicleValues),
      KycOptionSource.housing => fixed(kKycHousingValues),
      KycOptionSource.bank => fixed(kKycBankValues),
    };
  }

  List<KycOption> provinces() =>
      regions.map((r) => KycOption(r.value, r.value)).toList(growable: false);

  List<KycOption> districtsOf(String? province) {
    for (final r in regions) {
      if (r.value == province) return r.districts;
    }
    return const [];
  }
}
