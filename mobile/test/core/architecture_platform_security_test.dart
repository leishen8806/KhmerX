import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/core/logging/redaction_policy.dart';

final String _projectRoot = Directory.current.path.replaceAll('\\', '/');
final String _mobileRoot = _projectRoot.toLowerCase().endsWith('/mobile') ||
        _projectRoot.toLowerCase().endsWith('\\mobile')
    ? _projectRoot
    : '$_projectRoot/mobile';
final String _androidSrc = '$_mobileRoot/android/app/src';
final String _libRoot = '$_mobileRoot/lib';

void main() {
  String mainManifest() => '$_androidSrc/main/AndroidManifest.xml';
  String debugManifest() => '$_androidSrc/debug/AndroidManifest.xml';
  String debugNsc() => '$_androidSrc/debug/res/xml/network_security_config.xml';

  String loadText(String path) {
    final f = File(path);
    expect(f.existsSync(), isTrue, reason: 'File missing: $path');
    return f.readAsStringSync();
  }

  bool hasSubstring(String haystack, Pattern p) => p.allMatches(haystack).isNotEmpty;

  group('§27 Scanner Architecture Boundary (mobile_scanner import isolation)', () {
    test('Arch-01 mobile_scanner import ONLY in presentation layer files', () {
      final dir = Directory(_libRoot);
      final dartFiles = dir
          .listSync(recursive: true)
          .whereType<File>()
          .where((f) => f.path.toLowerCase().endsWith('.dart'))
          .toList();
      final hitFiles = <String>[];
      for (final f in dartFiles) {
        final content = f.readAsStringSync();
        if (content.contains("'package:mobile_scanner/") ||
            content.contains('"package:mobile_scanner/')) {
          hitFiles.add(f.path.replaceAll('\\', '/'));
        }
      }
      expect(hitFiles, isNotEmpty,
          reason: 'at least one mobile_scanner import expected (presentation layer)');
      for (final path in hitFiles) {
        expect(path, contains('/presentation/'),
            reason: 'mobile_scanner import ONLY allowed in /presentation/; violated: $path\n'
                'Forbidden locations: domain/ repository/ core/network/ (§27 contract)');
        expect(path, isNot(contains('/domain/')));
        expect(path, isNot(contains('/data/')));
        expect(path, isNot(contains('core/network')));
        expect(path, isNot(contains('/repository/')));
      }
    });

    test('Arch-02 domain + core/network ZERO mobile_scanner imports (explicit grep)', () {
      for (final sub in ['domain', 'core/network', 'core/session', 'core/storage']) {
        final d = Directory('$_libRoot/$sub');
        if (!d.existsSync()) continue;
        final files = d
            .listSync(recursive: true)
            .whereType<File>()
            .where((f) => f.path.endsWith('.dart'));
        for (final f in files) {
          final content = f.readAsStringSync();
          expect(content.contains('mobile_scanner'), isFalse,
              reason: '$sub MUST NOT import mobile_scanner (§27). Found in: ${f.path}');
        }
      }
    });
  });

  group('§33 Android Static Manifest Assertions', () {
    test('Manifest-01 main manifest has INTERNET permission', () {
      final m = loadText(mainManifest());
      expect(
        m,
        contains('android.permission.INTERNET'),
        reason: 'main manifest must request INTERNET permission',
      );
    });

    test('Manifest-02 main manifest has CAMERA permission (UI scan flow)', () {
      final m = loadText(mainManifest());
      expect(m, contains('android.permission.CAMERA'));
    });

    test('Manifest-03 camera hardware required="false" (optional, §28 paste fallback)', () {
      final m = loadText(mainManifest());
      final re = RegExp(
        r'<uses-feature[^>]*android:name="android\.hardware\.camera"[^>]*>',
        caseSensitive: false,
      );
      final match = re.firstMatch(m);
      expect(match, isNotNull, reason: 'uses-feature android.hardware.camera missing');
      final tag = match!.group(0)!;
      expect(tag, contains('android:required="false"'),
          reason:
              'camera feature MUST be optional (required=false). Actual tag: $tag\n'
              'Reason: §28 camera denied → paste fallback, not block install on devices without camera');
    });

    test('Manifest-04 company App Link is dormant in P1 (docs 54 §8.1): no VIEW/BROWSABLE filter', () {
      final m = loadText(mainManifest());
      expect(m, isNot(contains('android.intent.category.BROWSABLE')));
      expect(m, isNot(contains('android:host="khmerx.org"')));
      // The launcher intent filter must still exist.
      expect(m, contains('android.intent.action.MAIN'));
      expect(m, contains('android.intent.category.LAUNCHER'));
    });

    test('Manifest-05 debug manifest applies networkSecurityConfig', () {
      final m = loadText(debugManifest());
      expect(m, contains('android:networkSecurityConfig="@xml/network_security_config"'),
          reason: 'debug builds must apply the XML network security config');
    });

    test('NetSec-01 debug base-config disables global cleartext (no global allow)', () {
      final nsc = loadText(debugNsc());
      final base = RegExp(r'<base-config[^>]*>', caseSensitive: false).firstMatch(nsc);
      expect(base, isNotNull, reason: 'network_security_config needs <base-config> element');
      final baseTag = base!.group(0)!;
      // default for API 28+ is false; explicit or omitted (default) both OK.
      if (hasSubstring(baseTag, 'cleartextTrafficPermitted=')) {
        expect(baseTag, contains('cleartextTrafficPermitted="false"'),
            reason: '§31/§33 base config MUST NOT globally enable cleartext (true forbidden)');
      }
    });

    test('NetSec-02 debug cleartext exception: ONLY 10.0.2.2 no subdomains wildcard', () {
      final nsc = loadText(debugNsc());
      final domainConfigs = nsc
          .split('</domain-config>')
          .where((s) => s.contains('<domain-config'))
          .map((s) => s.substring(s.indexOf('<domain-config')))
          .toList();
      final allowedExactDomains = <String>[];
      for (final dc in domainConfigs) {
        if (dc.contains('cleartextTrafficPermitted="true"')) {
          final re = RegExp(r'<domain([^>]*)>([^<]*)</domain>', caseSensitive: false);
          for (final m in re.allMatches(dc)) {
            final attrs = m.group(1)!;
            if (attrs.contains('includeSubdomains')) {
              expect(attrs, contains('includeSubdomains="false"'),
                  reason: '§31 debug: no subdomain wildcards; 10.0.2.2 EXACT only');
            }
            allowedExactDomains.add(m.group(2)!.trim());
          }
        }
      }
      expect(allowedExactDomains, hasLength(1),
          reason: '§31 debug cleartext scope: EXACTLY one host (10.0.2.2). Actual: $allowedExactDomains');
      expect(allowedExactDomains.single, '10.0.2.2');
    });

    test('NetSec-03 release behavior: no main nsc with <base-config cleartextTrafficPermitted="true"',
        () {
      const mainNscPathTpl = '/main/res/xml/network_security_config.xml';
      final f = File('$_androidSrc$mainNscPathTpl');
      if (f.existsSync()) {
        final c = f.readAsStringSync();
        expect(c, isNot(contains('cleartextTrafficPermitted="true"')),
            reason: '§31 Release MUST NOT allow global cleartext in any shipped xml config');
      }
    });
  });

  group('§28 Camera denied → Paste link fallback UI (static source assertions)', () {
    test('UI-01 permissionDenied + permanentlyDenied both offer /company/paste-link', () {
      final path = '$_libRoot/features/company/presentation/company_pages.dart';
      final content = loadText(path);
      expect(content, contains('ScannerUiState.permissionDenied'));
      expect(content, contains('ScannerUiState.permissionPermanentlyDenied'));
      expect(content, contains('/company/paste-link'),
          reason: '§28 camera denied states must navigate to Paste link fallback');
      expect(content, contains('Paste link instead'),
          reason: 'visible copy for users denied camera permission');
    });

    test('UI-02 CompanySelect page offers both Scan QR + Paste link as explicit alternative paths',
        () {
      final content =
          loadText('$_libRoot/features/company/presentation/company_pages.dart');
      expect(content, contains('/company/paste-link'));
      expect(content, contains('/company/scan'));
    });
  });

  group('§29-§30 SafeLogger: RedactionPolicy — 6 sensitives NEVER appear in logs', () {
    test('Redact-01 password / confirmPassword / otp / code in body map → [REDACTED]', () {
      final m = <String, dynamic>{
        'username': 'alice',
        'password': 'SecretP@ssw0rd!',
        'confirmPassword': 'SecretP@ssw0rd!',
        'otp': '123456',
        'code': '998877',
      };
      final r = RedactionPolicy.redactMap(m);
      expect(r['password'], '[REDACTED]');
      expect(r['confirmPassword'], '[REDACTED]');
      expect(r['otp'], '[REDACTED]');
      expect(r['code'], '[REDACTED]');
      expect(r['username'], 'alice');
    });

    test('Redact-02 Cookie / Authorization / Set-Cookie header lists → [REDACTED]', () {
      const headers = <String, List<String>>{
        'Cookie': ['payease_company=t_abc; sessionId=xyz'],
        'Authorization': ['Bearer token-123'],
        'X-Request-Id': ['req-1'],
        'Set-Cookie': ['foo=bar'],
      };
      final r = RedactionPolicy.redactHeaders(headers);
      expect(r['Cookie']!.single, '[REDACTED]');
      expect(r['Authorization']!.single, '[REDACTED]');
      expect(r['Set-Cookie']!.single, '[REDACTED]');
      expect(r['X-Request-Id']!.single, 'req-1');
    });

    test('Redact-03 Cookie/Authorization strings in message → sensitive raw value gone from output',
        () {
      const msg =
          'Request failed headers=Cookie: payease_company=aaa; Authorization: Bearer secret-token';
      final r = RedactionPolicy.redactMessage(msg);
      // Assert contract (§29): raw sensitive values never appear
      expect(r, isNot(contains('payease_company=aaa')));
      expect(r, isNot(contains('Bearer secret-token')));
      expect(r, isNot(contains('secret-token')));
      // And at least one redaction pattern applied (non-trivial result)
      expect(r, anyOf(contains('[REDACTED]'), contains('Cookie: [REDACTED]'), contains('Cookie=[REDACTED]')));
    });

    test('Redact-04 password= challengeId= phone= token= KV patterns → [REDACTED]', () {
      const msg =
          'login attempt password=qwerty12 challengeId=chal_abc phone=+85512345678 token=tok_xyz';
      final r = RedactionPolicy.redactMessage(msg);
      expect(r, contains('password=[REDACTED]'));
      expect(r, contains('challengeId=[REDACTED]'));
      expect(r, contains('phone=[REDACTED]'));
      expect(r, contains('token=[REDACTED]'));
      expect(r, isNot(contains('qwerty12')));
      expect(r, isNot(contains('chal_abc')));
      expect(r, isNot(contains('+85512345678')));
      expect(r, isNot(contains('tok_xyz')));
    });

    test('Redact-05 E.164 full phone number: raw actual value NOT present in output', () {
      const raw = '+855998877665544';
      const value = 'user contact dial: $raw';
      final r = RedactionPolicy.redactMessage(value);
      expect(r, isNot(contains(raw)),
          reason: '§29: full phone never appears plaintext in log output');
    });

    test('Redact-06 nested map + list items: idNumber/bankAccount/password/otp recursive [REDACTED]',
        () {
      final m = <String, dynamic>{
        'user': {
          'idNumber': 'KH12345678',
          'bankAccount': '000123456789',
          'name': 'Bob',
        },
        'data': <dynamic>[
          <String, dynamic>{'password': 'a', 'otp': 'b'},
          <String, dynamic>{'normal': 'c'},
        ],
      };
      final r = RedactionPolicy.redactMap(m);
      final user = r['user'] as Map<String, dynamic>;
      expect(user['idNumber'], '[REDACTED]');
      expect(user['bankAccount'], '[REDACTED]');
      expect(user['name'], 'Bob');
      final list = r['data'] as List<dynamic>;
      final first = list.first as Map<String, dynamic>;
      expect(first['password'], '[REDACTED]');
      expect(first['otp'], '[REDACTED]');
      final second = list[1] as Map<String, dynamic>;
      expect(second['normal'], 'c');
    });

    test('Redact-07 64-hex session/token signatures → [hex64] (no raw hex tokens)', () {
      final rawHexToken = 'a' * 64;
      final logLine = 'session=$rawHexToken end';
      final r = RedactionPolicy.redactMessage(logLine);
      expect(r, contains('[hex64]'));
      expect(r, isNot(contains(rawHexToken)));
    });

    test('Redact-08 non-sensitive log fields preserved intact (no over-redaction)', () {
      const msg = 'HTTP 200 status=OK X-Request=req-1234 size=1200';
      final r = RedactionPolicy.redactMessage(msg);
      expect(r, equals(msg));
    });
  });
}
