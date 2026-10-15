import 'dart:io';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/core/session/company_id.dart';
import 'package:khmerx_app/core/session/secure_kv_cookie_storage.dart';
import 'package:khmerx_app/core/session/whitelist_cookie_jar.dart';
import 'package:khmerx_app/core/storage/secure_kv.dart';

class _MemKv implements SecureKv {
  final Map<String, String> _s = <String, String>{};
  @override Future<String?> read(String k) async => _s[k];
  @override Future<void> write(String k, String v) async => _s[k] = v;
  @override Future<void> delete(String k) async => _s.remove(k);
  @override Future<void> deleteAll() async => _s.clear();
  @override Future<bool> containsKey(String k) async => _s.containsKey(k);
  @override Future<void> deleteAllWithPrefix(String p) async =>
      _s.removeWhere((k, _) => k.startsWith(p));
  @override Future<List<String>> readAllKeysWithPrefix(String p) async =>
      _s.keys.where((k) => k.startsWith(p)).toList();
  @override Future<Map<String, String>> readAllWithPrefix(String p) async =>
      Map.fromEntries(_s.entries.where((e) => e.key.startsWith(p)));
}

Future<WhitelistCookieJar> build(CompanyId id, SecureKv kv) =>
    buildWhitelistJar(id, kv);

void main() {
  group('P1-05 / P1-04 — Cookie whitelist + persistence', () {
    late CompanyId idA;
    late CompanyId idB;
    final uri = Uri.parse('https://api.khmerx.org/');

    setUp(() {
      idA = CompanyId('t_aaaaaaaa-1234-1234-1234-123456789012');
      idB = CompanyId('t_bbbbbbbb-1234-1234-1234-123456789012');
    });

    test('CI-1: A stores sessionA; B stores sessionB; reads return respective', () async {
      final kv = _MemKv();
      final jarA = await build(idA, kv);
      final jarB = await build(idB, kv);
      await jarA.saveFromResponse(uri, [
        Cookie('payease_company', idA.raw),
        Cookie('payease_h5_session', 'sessionA-value'),
      ],);
      await jarB.saveFromResponse(uri, [
        Cookie('payease_company', idB.raw),
        Cookie('payease_h5_session', 'sessionB-value'),
      ],);
      final rA = (await jarA.loadForRequest(uri))
          .firstWhere((c) => c.name == 'payease_h5_session').value;
      final rB = (await jarB.loadForRequest(uri))
          .firstWhere((c) => c.name == 'payease_h5_session').value;
      expect(rA, equals('sessionA-value'));
      expect(rB, equals('sessionB-value'));
      expect(rA, isNot(equals(rB)));
    });

    test('CI-3: logout A (clearSession) -> A cleared; B remains', () async {
      final kv = _MemKv();
      final jarA = await build(idA, kv);
      final jarB = await build(idB, kv);
      await jarA.saveFromResponse(uri, [
        Cookie('payease_company', idA.raw),
        Cookie('payease_visitor', 'vA'),
        Cookie('payease_h5_browser', 'bA'),
        Cookie('payease_h5_session', 'sA'),
      ],);
      await jarB.saveFromResponse(uri, [
        Cookie('payease_company', idB.raw),
        Cookie('payease_h5_session', 'sB'),
      ],);
      await jarA.clearSession();
      final loadA = await jarA.loadForRequest(uri);
      final namesA = loadA.map((c) => c.name).toSet();
      expect(namesA.contains('payease_h5_session'), isFalse,
          reason: 'h5_session of A must be removed on clearSession (logout A).',);
      expect(namesA, contains('payease_company'));
      expect(namesA, contains('payease_visitor'));
      expect(namesA, contains('payease_h5_browser'));

      final loadB = await jarB.loadForRequest(uri);
      final namesB = loadB.map((c) => c.name).toSet();
      expect(namesB, contains('payease_h5_session'),
          reason: 'Company B session must remain after Company A logout.',);
      final bSess = loadB.firstWhere((c) => c.name == 'payease_h5_session');
      expect(bSess.value, equals('sB'));
    });

    test('CI-4: switch A → B → A => A session restored', () async {
      final kv = _MemKv();
      final uri = Uri.parse('https://api.khmerx.org/');
      final jarA1 = await build(idA, kv);
      await jarA1.saveFromResponse(uri, [
        Cookie('payease_company', idA.raw),
        Cookie('payease_h5_session', 'sessionA-restore-me'),
      ],);
      final jarB = await build(idB, kv);
      await jarB.saveFromResponse(uri, [
        Cookie('payease_company', idB.raw),
        Cookie('payease_h5_session', 'sessionB'),
      ],);

      final jarA2 = await build(idA, kv);
      final r = await jarA2.loadForRequest(uri);
      final a = r.firstWhere((c) => c.name == 'payease_h5_session');
      expect(a.value, equals('sessionA-restore-me'),
          reason: 'CI-4: reopening Company A after B preserves A\'s session.',);
    });

    test('CI-5: unknown cookie names never persisted (fail-closed white list)', () async {
      final kv = _MemKv();
      final jar = await build(idA, kv);
      await jar.saveFromResponse(uri, [
        Cookie('payease_company', idA.raw),
        Cookie('payease_visitor', 'vvv'),
        Cookie('payease_h5_browser', 'bbb'),
        Cookie('payease_h5_session', 'sss'),
        Cookie('malicious_admin_session', 'GIVE_ME_ACCESS'),
        Cookie('xsrf-token-anything', 'xx'),
        Cookie('session', 'sneaky-session'),
      ],);
      final names = (await jar.loadForRequest(uri)).map((c) => c.name).toSet();
      expect(names, containsAll(<String>[
        'payease_company',
        'payease_visitor',
        'payease_h5_browser',
        'payease_h5_session',
      ],),);
      expect(names.contains('malicious_admin_session'), isFalse);
      expect(names.contains('xsrf-token-anything'), isFalse);
      expect(names.contains('session'), isFalse);
      expect(names.length, equals(4),
          reason: 'Only 4 whitelist names allowed; found extra: ${names.join(', ')}',);
    });

    test('Cookie value content is never validated by client (v_/b_/s_ or any shape OK)', () async {
      final kv = _MemKv();
      final jar = await build(idA, kv);
      const weirdValue = 'any-shape-v_123-b_456-s_789-weird';
      await jar.saveFromResponse(uri, [
        Cookie('payease_company', idA.raw),
        Cookie('payease_h5_session', weirdValue),
      ],);
      final sess = (await jar.loadForRequest(uri))
          .firstWhere((c) => c.name == 'payease_h5_session');
      expect(sess.value, equals(weirdValue),
          reason: '§7 Review: client does NOT validate cookie value shape. '
              'Server defines value format; we store name/domain/path/expiry/secure.',);
    });
  });
}
