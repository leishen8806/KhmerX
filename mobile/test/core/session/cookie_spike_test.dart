import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/core/session/company_id.dart';
import 'package:khmerx_app/core/session/secure_kv_cookie_storage.dart';
import 'package:khmerx_app/core/session/whitelist_cookie_jar.dart';
import 'package:khmerx_app/core/storage/key_schema.dart';
import 'package:khmerx_app/core/storage/secure_kv.dart';

class _MemKv implements SecureKv {
  final _store = <String, String>{};
  @override Future<String?> read(String key) async => _store[key];
  @override Future<void> write(String k, String v) async => _store[k] = v;
  @override Future<void> delete(String key) async => _store.remove(key);
  @override Future<void> deleteAll() async => _store.clear();
  @override Future<bool> containsKey(String key) async => _store.containsKey(key);
  @override
  Future<void> deleteAllWithPrefix(String p) async =>
      _store.removeWhere((k, _) => k.startsWith(p));
  @override
  Future<List<String>> readAllKeysWithPrefix(String p) async =>
      _store.keys.where((k) => k.startsWith(p)).toList(growable: false);
  @override
  Future<Map<String, String>> readAllWithPrefix(String p) async =>
      Map.fromEntries(_store.entries.where((e) => e.key.startsWith(p)));
}

const _uuidA = 'aaaaaaaa-1234-1234-1234-123456789012';
const _uuidB = 'bbbbbbbb-5678-5678-5678-123456789012';
CompanyId _cidA() => CompanyId('t_$_uuidA');
CompanyId _cidB() => CompanyId('t_$_uuidB');

Uri _uri(String host) => Uri.parse('https://$host/');

Cookie _c(String name, String value) => Cookie(name, value);

void main() {
  group('G0-COOKIE-01 — cookie_jar 4.0.9 Storage interface SPIKE (8 questions)', () {
    late _MemKv kv;
    late SecureKvCookieStorage storage;

    setUp(() {
      kv = _MemKv();
    });

    Future<WhitelistCookieJar> buildJar(CompanyId id, {bool persistSession = true}) async {
      return buildWhitelistJar(id, kv, persistSession: persistSession);
    }

    test('SPIKE Q1: read() returns Future<String?> and write(String,String) stores', () async {
      final id = _cidA();
      storage = SecureKvCookieStorage(companyId: id, secureKv: kv);
      await storage.init(true, false);
      await storage.write('demo', '{"v":1}');
      final got = await storage.read('demo');
      expect(got, isA<String>());
      expect(got, equals('{"v":1}'));
    });

    test('SPIKE Q2: delete() removes single key; deleteAll(list) removes many', () async {
      final id = _cidA();
      storage = SecureKvCookieStorage(companyId: id, secureKv: kv);
      await storage.init(true, false);
      await storage.write('a', '1');
      await storage.write('b', '2');
      await storage.delete('a');
      expect(await storage.read('a'), isNull);
      expect(await storage.read('b'), equals('2'));
      await storage.deleteAll(['b']);
      expect(await storage.read('b'), isNull);
    });

    test('SPIKE Q3: host-only vs domain cookies both save and match', () async {
      final id = _cidA();
      final jar = await buildJar(id);
      final hostOnly = _c('payease_visitor',
          'aaaaaaaa-1234-1234-1234-123456789012.${'a' * 64}',);
      hostOnly.domain = null;
      await jar.saveFromResponse(_uri('api.khmerx.org'), [hostOnly]);
      final list = await jar.loadForRequest(_uri('api.khmerx.org'));
      expect(list, isNotEmpty);
    });

    test('SPIKE Q4: expiry + secure + path attributes all preserved', () async {
      final id = _cidA();
      final jar = await buildJar(id);
      final c = _c('payease_company', id.raw);
      c.expires = DateTime.now().add(const Duration(days: 30));
      c.secure = true;
      c.path = '/';
      await jar.saveFromResponse(_uri('api.khmerx.org'), [c]);
      final loaded = await jar.loadForRequest(Uri.parse('https://api.khmerx.org/'));
      expect(loaded.single.value, equals(id.raw));
      expect(loaded.single.secure, isTrue);
    });

    test('SPIKE Q5: Max-Age=0 / expired cookies deleted on save', () async {
      final id = _cidA();
      final jar = await buildJar(id);
      final c = _c('payease_h5_session', 'a' * 64);
      c.maxAge = 0;
      await jar.saveFromResponse(_uri('api.khmerx.org'), [c]);
      final loaded = await jar.loadForRequest(_uri('api.khmerx.org'));
      expect(loaded, isEmpty);
    });

    test('SPIKE Q6: persistSession=false drops session cookie (no max-age/expires)', () async {
      final id = _cidA();
      final session = _c('payease_h5_session', 'a' * 64);
      final visitor = _c('payease_visitor',
          'aaaaaaaa-1234-1234-1234-123456789012.${'a' * 64}',);
      visitor.expires = DateTime.now().add(const Duration(days: 30));

      final firstJar = await buildJar(id, persistSession: false);
      await firstJar.saveFromResponse(_uri('api.khmerx.org'), [session, visitor]);

      final reloadedJar = await buildJar(id, persistSession: false);
      final loaded = await reloadedJar.loadForRequest(_uri('api.khmerx.org'));
      final names = loaded.map((e) => e.name).toSet();
      expect(names.contains('payease_h5_session'), isFalse,
          reason: 'persistSession=false should drop session cookies after reload',);
      expect(names.contains('payease_visitor'), isTrue);
    });

    test('SPIKE Q7: whitelist drops unknown cookie names (fail closed)', () async {
      final id = _cidA();
      final jar = await buildJar(id);
      await jar.saveFromResponse(_uri('api.khmerx.org'), [
        _c('payease_visitor',
            'aaaaaaaa-1234-1234-1234-123456789012.${'a' * 64}',),
        _c('third_party_tracker', 'evil'),
      ]);
      final loaded = await jar.loadForRequest(_uri('api.khmerx.org'));
      expect(loaded.map((e) => e.name).toSet(),
          isNot(contains('third_party_tracker')),);
      expect(loaded.map((e) => e.name).toSet(),
          contains('payease_visitor'),);
    });

    test('SPIKE Q8: mismatched payease_company value vs jar owner -> DROP', () async {
      final owner = _cidA();
      final wrong = _cidB();
      final jar = await buildJar(owner);
      final badCompany = _c('payease_company', wrong.raw);
      await jar.saveFromResponse(_uri('api.khmerx.org'), [badCompany]);
      final loaded = await jar.loadForRequest(_uri('api.khmerx.org'));
      expect(loaded.where((e) => e.name == 'payease_company'), isEmpty,
          reason: 'D-2 fix: mismatched owner must be DROPPED (fail closed)',);
    });
  });

  group('G0-COOKIE-03 — 8 company-scoped isolation checks', () {
    final idA = CompanyId('t_aaaaaaaa-1234-1234-1234-123456789012');
    final idB = CompanyId('t_bbbbbbbb-1234-1234-1234-123456789012');
    final uri = Uri.parse('https://api.khmerx.org/');

    _MemKv kv = _MemKv();
    Future<WhitelistCookieJar> jarFor(CompanyId c) =>
        buildWhitelistJar(c, kv, persistSession: true);

    setUp(() => kv = _MemKv());

    test('ISO1: jar(A) !== jar(B) different instances', () async {
      final a = await jarFor(idA);
      final b = await jarFor(idB);
      expect(identical(a, b), isFalse);
    });

    test('ISO2: A cookie not readable from B jar', () async {
      final a = await jarFor(idA);
      final b = await jarFor(idB);
      await a.saveFromResponse(uri, [
        _c('payease_h5_browser', 'a' * 64),
      ]);
      final fromA = await a.loadForRequest(uri);
      final fromB = await b.loadForRequest(uri);
      expect(fromA, isNotEmpty);
      expect(fromB, isEmpty, reason: 'Isolation breach: B reads A cookies!');
    });

    test('ISO3: storage key prefixes A and B are disjoint', () async {
      final a = await jarFor(idA);
      final b = await jarFor(idB);
      await a.saveFromResponse(uri, [
        _c('payease_company', idA.raw)
          ..expires = DateTime.now().add(const Duration(days: 10)),
      ]);
      await b.saveFromResponse(uri, [
        _c('payease_company', idB.raw)
          ..expires = DateTime.now().add(const Duration(days: 10)),
      ]);
      final preA = KeySchema.companyPrefix(idA.raw);
      final preB = KeySchema.companyPrefix(idB.raw);
      final aKeys = await kv.readAllKeysWithPrefix(preA);
      final bKeys = await kv.readAllKeysWithPrefix(preB);
      expect(aKeys, isNotEmpty);
      expect(bKeys, isNotEmpty);
      expect(aKeys.where((k) => k.startsWith(preB)), isEmpty);
      expect(bKeys.where((k) => k.startsWith(preA)), isEmpty);
    });

    Future<void> clearSessionCookiesOnly(WhitelistCookieJar jar) async {
      final saved = <Uri, List<Cookie>>{};
      await kv.readAllKeysWithPrefix(
          KeySchema.cookieJarPrefix(jar.companyId.raw),);
      final iter = <Uri>[uri];
      for (final u in iter) {
        final all = await jar.loadForRequest(u);
        final nonSession = all.where((c) => c.name != 'payease_h5_session').toList();
        if (nonSession.isNotEmpty) saved[u] = nonSession;
      }
      await jar.deleteAll();
      for (final e in saved.entries) {
        await jar.saveFromResponse(e.key, e.value);
      }
    }

    test('ISO4: clearSession(A) deletes only A h5_session; leaves B intact; A non-session intact',
        () async {
      final a = await jarFor(idA);
      final b = await jarFor(idB);
      final sessA = _c('payease_h5_session', 'a' * 64);
      final sessB = _c('payease_h5_session', 'b' * 64);
      final brA = _c('payease_h5_browser', '1' * 64)
        ..expires = DateTime.now().add(const Duration(days: 30));
      final brB = _c('payease_h5_browser', '2' * 64)
        ..expires = DateTime.now().add(const Duration(days: 30));
      await a.saveFromResponse(uri, [sessA, brA]);
      await b.saveFromResponse(uri, [sessB, brB]);

      await clearSessionCookiesOnly(a);

      final aNames = (await a.loadForRequest(uri)).map((e) => e.name).toSet();
      final bNames = (await b.loadForRequest(uri)).map((e) => e.name).toSet();
      expect(aNames.contains('payease_h5_session'), isFalse,
          reason: 'A session cookie must be cleared',);
      expect(aNames.contains('payease_h5_browser'), isTrue,
          reason: 'A non-session browser cookie must survive clearSession(A)',);
      expect(bNames.contains('payease_h5_session'), isTrue,
          reason: 'B session cookie must survive clearSession(A)',);
      expect(bNames.contains('payease_h5_browser'), isTrue);
    });

    test('ISO5: clearCompany(A) -> B jar + prefix untouched', () async {
      final a = await jarFor(idA);
      final b = await jarFor(idB);
      await a.saveFromResponse(uri, [
        _c('payease_h5_browser', 'a' * 64)
          ..expires = DateTime.now().add(const Duration(days: 10)),
      ]);
      await b.saveFromResponse(uri, [
        _c('payease_h5_browser', 'b' * 64)
          ..expires = DateTime.now().add(const Duration(days: 10)),
      ]);
      final preA = KeySchema.companyPrefix(idA.raw);
      final preB = KeySchema.companyPrefix(idB.raw);
      final beforeB = await kv.readAllKeysWithPrefix(preB);
      await kv.deleteAllWithPrefix(preA);
      final afterA = await kv.readAllKeysWithPrefix(preA);
      final afterB = await kv.readAllKeysWithPrefix(preB);
      expect(afterA, isEmpty);
      expect(afterB, equals(beforeB));
    });
  });
}
