import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/features/kyc/domain/kyc_requests.dart';
import 'package:khmerx_app/features/kyc/domain/kyc_schema.dart';

void main() {
  test('requests absence differs from explicit empty and preserves original note', () {
    expect(parseKycRequests({}), isNull);
    expect(parseKycRequests({'requests': []}), isEmpty);
    final requests = parseKycRequests({'requests': [
      {'target': 'field:givenName', 'reasonCode': 'data_mismatch', 'note': '原始 note'},
    ]})!;
    expect(requests.single.target, 'field:givenName');
    expect(requests.single.note, '原始 note');
    expect(() => requests.clear(), throwsUnsupportedError);
  });
  test('seven core sections map to five app groups and exact field or slot steps', () {
    for (final section in ['employment', 'income', 'assets']) {
      expect(KycRequest('section:$section', 'other', '').section, KycSection.employment);
    }
    for (final section in ['identity', 'contacts', 'bank', 'consent']) {
      expect(KycRequest('section:$section', 'other', '').section?.name, section);
    }
    const request = KycRequest('slot:idFront', 'blurred', '');
    final steps = kycStepsOf(KycSection.identity, {});
    expect(steps.where(request.matchesStep).single.slotIds, contains('idFront'));
    expect(const KycRequest('field:givenName', 'other', '').section, KycSection.identity);
    expect(const KycRequest('field:unknown-private-key', 'other', '').section, isNull);
    expect(const KycRequest('slot:signature', 'other', '').section, isNull);
  });
}
