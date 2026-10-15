import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/core/session/company_id.dart';
import 'package:khmerx_app/features/company/domain/active_company_store.dart';

import '../../../support/fake_secure_kv.dart';

void main() {
  group('G1 COMPANY-01 — ActiveCompanyStore (persistence)', () {
    final idA = CompanyId('t_aaaaaaaa-1234-1234-1234-123456789012');
    final idB = CompanyId('t_bbbbbbbb-1234-1234-1234-123456789012');

    test('setActive then loadActive returns same id', () async {
      final kv = FakeSecureKv();
      final store = ActiveCompanyStore(secureKv: kv);
      expect(await store.loadActive(), isNull);
      await store.setActive(idA);
      expect((await store.loadActive())?.raw, equals(idA.raw));
      final fresh = ActiveCompanyStore(secureKv: kv);
      expect((await fresh.loadActive())?.raw, equals(idA.raw));
    });

    test('clearActive resets loadActive to null', () async {
      final kv = FakeSecureKv();
      final store = ActiveCompanyStore(secureKv: kv);
      await store.setActive(idA);
      await store.clearActive();
      expect(await store.loadActive(), isNull);
    });

    test('addCompany maintains unique list; removeCompany deletes only target',
        () async {
      final kv = FakeSecureKv();
      final store = ActiveCompanyStore(secureKv: kv);
      await store.addCompany(idA);
      await store.addCompany(idB);
      await store.addCompany(idA);
      final before = await store.loadCompanies();
      expect(before.map((e) => e.raw), unorderedEquals([idA.raw, idB.raw]));
      await store.removeCompany(idA);
      final after = await store.loadCompanies();
      expect(after.map((e) => e.raw), equals([idB.raw]));
    });

    test('malformed JSON list => empty (fail-safe read)', () async {
      final kv = FakeSecureKv();
      await kv.write('v1/app/companies', '{this-is-not-a-list}');
      final store = ActiveCompanyStore(secureKv: kv);
      expect(await store.loadCompanies(), isEmpty);
    });
  });
}
