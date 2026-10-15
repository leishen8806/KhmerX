import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/app/bootstrap/providers.dart';
import 'package:khmerx_app/app/config/app_config.dart';
import 'package:khmerx_app/core/network/network_config.dart';
import 'package:khmerx_app/core/session/company_id.dart';
import 'package:khmerx_app/features/kyc/domain/kyc_case.dart';
import 'package:khmerx_app/features/kyc/domain/kyc_options.dart';
import 'package:khmerx_app/features/kyc/domain/kyc_schema.dart';
import 'package:khmerx_app/features/kyc/domain/kyc_wire.dart';
import 'package:khmerx_app/features/kyc/presentation/kyc_controller.dart';
import 'package:khmerx_app/features/kyc/presentation/kyc_location.dart';

import '../../support/fake_khmerx_server.dart';
import '../../support/fake_secure_kv.dart';

Map<String, String> _fullValues() => {
      'surname': 'sok',
      'givenName': 'dara',
      'gender': kWireMale,
      'education': 'Primary',
      'marital': kWireSingle,
      'province': 'X',
      'district': 'Y',
      'address': 'Street 1',
      'contact1Relation': kWireParent,
      'contact1Name': 'a',
      'contact1Phone': '+85512345678',
      'contact2Relation': kWireFriend,
      'contact2Name': 'b',
      'contact2Phone': '+85598765432',
      'workType': 'Freelancer',
      'company': 'Shop',
      'industry': 'Civil Service',
      'position': 'Staff',
      'income': '101-250 USD',
      'tenure': '4-12 months',
      'bankName': 'ABA Bank',
      'bankAccount': '123456',
      'bankHolder': 'sok dara',
    };

const _requiredSlots = {'idFront', 'idBack', 'selfie', 'incomeProof'};

Map<String, Object?> _caseJson({
  String status = 'draft',
  int revision = 3,
  Map<String, String>? values,
  Map<String, String>? files,
  bool consent = false,
  String ruleVersion = kKycRuleVersion,
  String? reason,
}) =>
    {
      'id': 'case-1',
      'revision': revision,
      'status': status,
      'updatedAt': '2026-10-12T00:00:00Z',
      'phoneVerified': true,
      'ruleVersion': ruleVersion,
      'profile': {
        'values': values ?? <String, String>{},
        'files': {
          for (final e in (files ?? <String, String>{}).entries)
            e.key: {'id': e.value, 'slot': e.key, 'size': 10, 'type': 'image/jpeg'},
        },
        'consent': consent,
        'declarationVersion': kKycConsentVersion,
      },
      if (reason != null) 'review': {'decision': 'needs_info', 'reason': reason},
    };

class _FakeLocation implements KycLocationSource {
  _FakeLocation(this.result);
  KycLocationResult result;
  String? lastLang;
  @override
  Future<KycLocationResult> currentAddress({
    required String languageCode,
    void Function(KycLocationStage stage)? onStage,
  }) async {
    lastLang = languageCode;
    onStage?.call(KycLocationStage.position);
    onStage?.call(KycLocationStage.address);
    return result;
  }
}

class _FakeImages implements KycImageSource {
  _FakeImages(this.bytes);
  Uint8List? bytes;
  int calls = 0;
  @override
  Future<Uint8List?> pick({required bool camera}) async {
    calls++;
    return bytes;
  }
}

void main() {
  group('P2 KYC schema (mirror of the server rules)', () {
    test('KYC-S-01 a complete profile has no problems', () {
      final problems = kycValidate(
        values: _fullValues(),
        uploadedSlots: _requiredSlots,
        consent: true,
      );
      expect(problems, isEmpty, reason: problems.map((p) => '${p.kind}/${p.field}/${p.slot}').join(','));
    });

    test('KYC-S-02 missing required fields, materials and consent are reported', () {
      final problems = kycValidate(values: const {}, uploadedSlots: const {}, consent: false);
      expect(problems.where((p) => p.kind == KycProblemKind.missingField).length,
          kKycFields.where((f) => f.required).length);
      expect(problems.where((p) => p.kind == KycProblemKind.missingSlot).length, 4);
      expect(problems.any((p) => p.kind == KycProblemKind.consentRequired), isTrue);
    });

    test('KYC-S-03 phone: international (+, 8-15 digits) or a local 0xx number', () {
      final v = _fullValues()..['contact1Phone'] = '12345';
      final problems =
          kycValidate(values: v, uploadedSlots: _requiredSlots, consent: true);
      expect(problems.single.kind, KycProblemKind.invalidPhone);
      // Cambodian local form (leading 0) is accepted and means +855.
      final local = _fullValues()..['contact1Phone'] = '012345678';
      expect(
        kycValidate(values: local, uploadedSlots: _requiredSlots, consent: true)
            .any((p) => p.kind == KycProblemKind.invalidPhone),
        isFalse,
      );
      expect(kKycPhonePattern.hasMatch('+85512345678'), isTrue);
      expect(kKycPhonePattern.hasMatch('+0123456789'), isFalse);
    });

    test('KYC-S-04 contact 3 is all-or-nothing; supervisor name+phone together', () {
      final v = _fullValues()..['contact3Name'] = 'c';
      expect(
        kycValidate(values: v, uploadedSlots: _requiredSlots, consent: true)
            .any((p) => p.kind == KycProblemKind.contact3Incomplete),
        isTrue,
      );
      final w = _fullValues()..['supervisorName'] = 's';
      expect(
        kycValidate(values: w, uploadedSlots: _requiredSlots, consent: true)
            .any((p) => p.kind == KycProblemKind.supervisorIncomplete),
        isTrue,
      );
    });

    test('KYC-S-05 duplicate relation / phone are rejected', () {
      final v = _fullValues()
        ..['contact2Relation'] = kWireParent
        ..['contact2Phone'] = '+85512345678';
      final kinds = kycValidate(values: v, uploadedSlots: _requiredSlots, consent: true)
          .map((p) => p.kind)
          .toSet();
      expect(kinds, containsAll([KycProblemKind.duplicateRelation, KycProblemKind.duplicatePhone]));
    });

    test('KYC-S-06 owning a vehicle needs exactly one vehicle document', () {
      final v = _fullValues()..['vehicle'] = kWireMotorbike;
      expect(
        kycValidate(values: v, uploadedSlots: _requiredSlots, consent: true)
            .any((p) => p.kind == KycProblemKind.vehicleMaterial),
        isTrue,
      );
      expect(
        kycValidate(
          values: v,
          uploadedSlots: {..._requiredSlots, 'vehiclePhoto'},
          consent: true,
        ).any((p) => p.kind == KycProblemKind.vehicleMaterial),
        isFalse,
      );
      expect(
        kycValidate(
          values: v,
          uploadedSlots: {..._requiredSlots, 'vehiclePhoto', 'vehicleInvoice'},
          consent: true,
        ).any((p) => p.kind == KycProblemKind.vehicleMaterial),
        isTrue,
        reason: 'two vehicle documents are not allowed',
      );
    });

    test('KYC-S-07 housing decides which proof is required', () {
      final rent = _fullValues()..['housing'] = kWireRented;
      expect(
        kycValidate(values: rent, uploadedSlots: _requiredSlots, consent: true)
            .any((p) => p.slot == 'rentContract'),
        isTrue,
      );
      final own = _fullValues()..['housing'] = kWireOwnedProperty;
      expect(
        kycValidate(values: own, uploadedSlots: _requiredSlots, consent: true)
            .any((p) => p.slot == 'propertyCertificate'),
        isTrue,
      );
      expect(kycSlotVisible('rentContract', const {}), isFalse);
    });

    test('KYC-S-08 names are upper-cased and phones stripped like the server does', () {
      expect(kycNormalize(kycFieldById('surname')!, ' sok '), 'SOK');
      expect(kycNormalize(kycFieldById('contact1Phone')!, '+855 (12) 345-678'), '+85512345678');
    });

    test('KYC-S-09 wire values are the exact Chinese strings the server expects', () {
      expect(kWireMale, '\u7537');
      expect(kWireSingle, '\u672a\u5a5a');
      expect(kWireRented, '\u79df\u623f');
      expect(kKycBankValues, ['ABA Bank', 'ACLEDA Bank', 'Wing']);
    });
  });

  group('P2 KYC options', () {
    const sample = '''
{"version":"$kKycRuleVersion","options":{"education":[{"value":"None","label":"None / English-Khmer"}]},
 "regions":[{"value":"CN/Phnom Penh","districts":[{"value":"D1","label":"CN-D / D1 / KM-D"}]}]}
''';

    test('KYC-O-01 parse + label picking per language', () {
      final o = KycOptions.parse(sample);
      expect(o.version, kKycRuleVersion);
      expect(o.districtsOf('CN/Phnom Penh').single.value, 'D1');
      final d = o.districtsOf('CN/Phnom Penh').single;
      expect(d.labelFor('en'), 'D1');
      expect(d.labelFor('km'), 'KM-D');
      expect(d.labelFor('zh'), 'CN-D');
      expect(kycPickLabel('None / កម្រិត', 'km'), 'កម្រិត');
      expect(kycPickLabel('None / កម្រិត', 'zh'), 'None');
    });

    test('KYC-O-02 fixed sources expose wire values', () {
      final o = KycOptions.parse(sample);
      expect(o.optionsFor(KycOptionSource.gender).map((e) => e.value), kKycGenderValues);
      expect(o.optionsFor(KycOptionSource.bank).map((e) => e.value), kKycBankValues);
    });
  });

  group('P2 KYC case parsing', () {
    test('KYC-C-01 parses the server view', () {
      final c = KycCase.tryParse(_caseJson(
        status: 'needs_info',
        values: {'surname': 'SOK'},
        files: {'idFront': 'f1'},
        reason: 'Photo is blurry',
        consent: true,
      ))!;
      expect(c.status, KycCaseStatus.needsInfo);
      expect(c.status.editable, isTrue);
      expect(c.revision, 3);
      expect(c.values['surname'], 'SOK');
      expect(c.files['idFront']!.id, 'f1');
      expect(c.reviewReason, 'Photo is blurry');
      expect(c.consent, isTrue);
    });

    test('KYC-C-02 only draft and needs_info are editable; unknown is not', () {
      expect(kycStatusFrom('draft').editable, isTrue);
      for (final s in ['submitted', 'approved', 'rejected', 'weird']) {
        expect(kycStatusFrom(s).editable, isFalse, reason: s);
      }
      expect(KycCase.tryParse('nope'), isNull);
    });
  });

  group('P2 KYC repository + controller (fake server)', () {
    late FakeKhmerxServer server;
    late ProviderContainer container;
    late _FakeImages images;
    late _FakeLocation location;
    var current = <String, Object?>{};

    setUp(() async {
      server = await FakeKhmerxServer.bind();
      images = _FakeImages(Uint8List.fromList([0xff, 0xd8, 0xff, 1, 2, 3]));
      location = _FakeLocation(const KycLocationResult(KycLocationStatus.ok, 'Street 51, Phnom Penh'));
      current = _caseJson(values: {'surname': 'SOK'});
      final base = Uri.parse(server.baseUrl);
      final config = AppConfig.dev().copyWith(
        networkConfig: NetworkConfig(
          baseUrl: base,
          connectTimeout: const Duration(milliseconds: 3000),
          sendTimeout: const Duration(milliseconds: 3000),
          receiveTimeout: const Duration(milliseconds: 3000),
          logoutTimeout: const Duration(milliseconds: 1500),
        ),
      );
      container = ProviderContainer(overrides: [
        appConfigProvider.overrideWithValue(config),
        secureKvProvider.overrideWithValue(FakeSecureKv()),
        kycImageSourceProvider.overrideWithValue(images),
        kycLocationSourceProvider.overrideWithValue(location),
      ]);
      await container.read(activeCompanyIdProvider.notifier).activate(CompanyId.publicWorkspace);
      server.register('GET /api/kyc', (r) => HttpResponseData.fromJson(200, current));
    });

    tearDown(() async {
      container.dispose();
      await server.close();
    });

    KycController ctl() => container.read(kycControllerProvider.notifier);
    KycUiState st() => container.read(kycControllerProvider);

    test('KYC-R-01 load adopts the server view', () async {
      await ctl().load();
      expect(st().phase, KycLoadPhase.ready);
      expect(st().values['surname'], 'SOK');
      expect(st().editable, isTrue);
      expect(st().ruleMismatch, isFalse);
    });

    test('KYC-R-02 a different server rule version fails closed (submit refused)', () async {
      current = _caseJson(ruleVersion: 'kyc-other');
      await ctl().load();
      expect(st().ruleMismatch, isTrue);
      expect(await ctl().submit(), isFalse);
      expect(server.requests.where((r) => r.method == 'POST'), isEmpty);
    });

    test('KYC-R-03 save sends revision, normalized values, file ids and consent version', () async {
      server.register('POST /api/kyc', (r) {
        final body = r.bodyAsJson;
        expect(body['action'], 'save');
        expect(body['revision'], 3);
        final profile = body['profile'] as Map<String, dynamic>;
        expect((profile['values'] as Map)['surname'], 'SOK');
        expect((profile['values'] as Map)['contact1Phone'], '+85512345678');
        expect(profile['declarationVersion'], kKycConsentVersion);
        expect(r.cookie ?? '', isNot(contains('payease_company')));
        return HttpResponseData.fromJson(200, _caseJson(revision: 4, values: {'surname': 'SOK'}));
      });
      await ctl().load();
      ctl().setValue('surname', 'sok');
      ctl().setValue('contact1Phone', '+855 12 345 678');
      expect(await ctl().saveDraft(), isTrue);
      expect(st().serverCase!.revision, 4);
      expect(st().notice, KycNotice.saved);
    });

    test('KYC-R-04 upload sends raw bytes with the slot header, then attaches by saving', () async {
      server.register('POST /api/kyc/files', (r) {
        expect(r.header('x-kyc-slot'), 'idFront');
        expect(r.bodyBytes, [0xff, 0xd8, 0xff, 1, 2, 3]);
        return HttpResponseData.fromJson(200, {
          'id': 'file-9', 'slot': 'idFront', 'size': 6, 'type': 'image/jpeg',
        });
      });
      Map<String, dynamic>? saved;
      server.register('POST /api/kyc', (r) {
        saved = r.bodyAsJson;
        return HttpResponseData.fromJson(
          200,
          _caseJson(revision: 4, values: {'surname': 'SOK'}, files: {'idFront': 'file-9'}),
        );
      });
      await ctl().load();
      await ctl().uploadSlot('idFront', camera: true);
      expect(images.calls, 1);
      expect(st().files['idFront']!.id, 'file-9');
      final files = (saved!['profile'] as Map)['files'] as Map;
      expect((files['idFront'] as Map)['id'], 'file-9');
      expect(st().uploading, isEmpty);
    });

    test('KYC-R-05 a refused file (422) is reported and not attached', () async {
      server.register(
        'POST /api/kyc/files',
        (r) => HttpResponseData.fromJson(422, {'error': 'x'}),
      );
      await ctl().load();
      await ctl().uploadSlot('selfie', camera: false);
      expect(st().notice, KycNotice.fileRejected);
      expect(st().files.containsKey('selfie'), isFalse);
    });

    test('KYC-R-06 submit is blocked locally while items are missing (nothing is sent)', () async {
      await ctl().load();
      expect(await ctl().submit(), isFalse);
      expect(st().problems, isNotEmpty);
      expect(server.requests.where((r) => r.method == 'POST'), isEmpty);
    });

    test('KYC-R-07 a complete case is submitted with action=submit', () async {
      current = _caseJson(
        values: _fullValues(),
        files: {for (final s in _requiredSlots) s: 'f-$s'},
        consent: true,
      );
      String? action;
      server.register('POST /api/kyc', (r) {
        action = (r.bodyAsJson)['action'] as String?;
        return HttpResponseData.fromJson(
          200,
          _caseJson(status: 'submitted', revision: 4, values: _fullValues(), consent: true),
        );
      });
      await ctl().load();
      expect(await ctl().submit(), isTrue);
      expect(action, 'submit');
      expect(st().status, KycCaseStatus.submitted);
      expect(st().editable, isFalse);
      expect(st().notice, KycNotice.submitted);
    });

    test('KYC-R-08 locked cases ignore edits and never call the server', () async {
      current = _caseJson(status: 'submitted');
      await ctl().load();
      ctl().setValue('surname', 'X');
      ctl().setConsent(true);
      expect(st().values.containsKey('surname'), isFalse);
      expect(await ctl().saveDraft(), isFalse);
      await ctl().uploadSlot('idFront', camera: true);
      expect(images.calls, 0);
      expect(server.requests.where((r) => r.method == 'POST'), isEmpty);
    });

    test('KYC-R-09 409 reloads the case and tells the user', () async {
      server.register(
        'POST /api/kyc',
        (r) => HttpResponseData.fromJson(409, {'error': 'x'}),
      );
      await ctl().load();
      ctl().setValue('surname', 'SOK');
      expect(await ctl().saveDraft(), isFalse);
      expect(st().notice, KycNotice.conflict);
      expect(server.requests.where((r) => r.method == 'GET').length, greaterThanOrEqualTo(2));
    });

    test('KYC-R-12 a malformed phone is held back: the draft still saves, the text stays on screen',
        () async {
      Map<String, dynamic>? sent;
      server.register('POST /api/kyc', (r) {
        sent = r.bodyAsJson;
        return HttpResponseData.fromJson(200, _caseJson(revision: 4, values: {'surname': 'SOK'}));
      });
      await ctl().load();
      ctl().setValue('surname', 'sok');
      ctl().setValue('contact2Phone', '3568');
      expect(await ctl().saveDraft(), isTrue);
      final values = (sent!['profile'] as Map)['values'] as Map;
      expect(values.containsKey('contact2Phone'), isFalse, reason: 'the server would reject the whole draft');
      expect(values['surname'], 'SOK');
      expect(st().values['contact2Phone'], '3568', reason: 'the user can correct what they typed');
      expect(st().notice, KycNotice.phoneFormat);
    });

    test('KYC-R-15 address from the device location fills the field; refusals give a notice', () async {
      await ctl().load();
      await ctl().fillAddressFromLocation('en');
      expect(st().values['address'], 'Street 51, Phnom Penh');
      expect(st().addressEpoch, 1);
      expect(st().locating, isFalse);
      expect(location.lastLang, 'en');

      location.result = const KycLocationResult(KycLocationStatus.deniedForever);
      await ctl().fillAddressFromLocation('km');
      expect(st().notice, KycNotice.locationDenied);
      expect(st().values['address'], 'Street 51, Phnom Penh'); // untouched

      ctl().clearNotice();
      location.result = const KycLocationResult(KycLocationStatus.serviceOff);
      await ctl().fillAddressFromLocation('zh');
      expect(st().notice, KycNotice.locationServiceOff);

      ctl().clearNotice();
      location.result = const KycLocationResult(KycLocationStatus.failed);
      await ctl().fillAddressFromLocation('en');
      expect(st().notice, KycNotice.locationFailed);
    });

    test('KYC-R-13 saving duplicate contact phones / relations names the problem and holds them back',
        () async {
      Map<String, dynamic>? sent;
      server.register('POST /api/kyc', (r) {
        sent = r.bodyAsJson;
        return HttpResponseData.fromJson(200, _caseJson(revision: 4, values: {'surname': 'SOK'}));
      });
      await ctl().load();
      ctl().setValue('contact1Phone', '+85512345678');
      ctl().setValue('contact2Phone', '+855 12 345 678');
      expect(await ctl().saveDraft(), isTrue);
      var values = (sent!['profile'] as Map)['values'] as Map;
      expect(values['contact1Phone'], '+85512345678');
      expect(values.containsKey('contact2Phone'), isFalse);
      expect(st().notice, KycNotice.duplicatePhone);

      ctl().clearNotice();
      ctl().setValue('contact1Relation', kWireParent);
      ctl().setValue('contact2Relation', kWireParent);
      ctl().setValue('contact2Phone', '+85598765432');
      expect(await ctl().saveDraft(), isTrue);
      values = (sent!['profile'] as Map)['values'] as Map;
      expect(values.containsKey('contact2Relation'), isFalse);
      expect(st().notice, KycNotice.duplicateRelation);
    });

    test('KYC-R-14 submit is blocked with the duplicate named in the problem list', () async {
      current = _caseJson(
        values: {
          ..._fullValues(),
          'contact2Phone': '+85512345671',
          'contact1Phone': '+85512345671',
        },
        files: {for (final s in _requiredSlots) s: 'f-$s'},
        consent: true,
      );
      await ctl().load();
      expect(await ctl().submit(), isFalse);
      expect(st().problems.map((p) => p.kind), contains(KycProblemKind.duplicatePhone));
      expect(server.requests.where((r) => r.method == 'POST'), isEmpty);
    });

    test('KYC-R-10 changing the province clears the district', () async {
      await ctl().load();
      ctl().setValue('province', 'A');
      ctl().setValue('district', 'B');
      ctl().setValue('province', 'C');
      expect(st().values['district'], isNull);
    });

    test('KYC-R-11 the JSON body stays inside the server limit', () {
      final body = jsonEncode({
        'values': {for (final f in kKycFields) f.id: 'x' * 240},
      });
      expect(utf8.encode(body).length, lessThan(50000));
    });
  });
}
