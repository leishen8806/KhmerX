import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  final mobileRoot = Directory.current.path.toLowerCase().endsWith('mobile')
      ? Directory.current
      : Directory('${Directory.current.path}/mobile');
  final libDir = Directory('${mobileRoot.path}/lib');
  final testDir = Directory('${mobileRoot.path}/test');

  group('Architecture grep tests (fail closed)', () {
    Stream<File> filesUnder(Directory d) async* {
      if (!await d.exists()) return;
      await for (final e in d.list(recursive: true)) {
        if (e is File &&
            (e.path.endsWith('.dart') && !e.path.contains('.dart_tool'))) {
          final p = e.path.replaceAll('\\', '/');
          if (p.contains('/lib/l10n/')) continue;
          yield e;
        }
      }
    }

    Future<List<File>> allSources() async =>
        Stream.fromIterable([libDir, testDir])
            .asyncExpand(filesUnder)
            .toList();

    Future<Map<String, List<String>>> grepPattern(
      List<File> files,
      RegExp pattern, {
      bool includeGenerated = false,
      List<String> excludeSuffixes = const [],
    }) async {
      final out = <String, List<String>>{};
      for (final f in files) {
        if (!includeGenerated && f.path.contains('generated/')) continue;
        final p = f.path.replaceAll('\\', '/');
        var excluded = false;
        for (final s in excludeSuffixes) {
          if (p.contains(s.replaceAll('\\', '/'))) {
            excluded = true;
            break;
          }
        }
        if (excluded) continue;
        final lines = await f.readAsLines();
        final hits = <String>[];
        for (var i = 0; i < lines.length; i++) {
          if (pattern.hasMatch(lines[i])) {
            hits.add('${i + 1}:${lines[i]}');
          }
        }
        if (hits.isNotEmpty) out[f.path] = hits;
      }
      return out;
    }

    const selfExclude = ['architecture_grep_test.dart'];

    test('No Counter template residue (FND-01 grep: counter/MyApp/deepPurple etc.)',
        () async {
      final files = await allSources();
      final hits = await grepPattern(files,
          RegExp(r'counter|_incrementCounter|Flutter Demo|deepPurple|FloatingActionButton|MyApp|MyHomePage',
              caseSensitive: false,),
          excludeSuffixes: selfExclude,);
      final filtered = <String, List<String>>{};
      hits.forEach((k, v) {
        if (k.endsWith('app_localizations_en.arb') ||
            k.endsWith('app_localizations_km.arb') ||
            k.endsWith('app_localizations_zh.arb')) {
          return;
        }
        if (v.every((line) =>
            line.contains('MyApplicationHome') &&
            (line.contains('@@Locale') || line.contains('"') || line.contains('example')),)) {
          return;
        }
        filtered[k] = v;
      });
      expect(filtered, isEmpty,
          reason: 'Counter residue found: $filtered',);
    });

    test('No loan quote repository or /loan/quote endpoints (CR-001 BLOCKED)',
        () async {
      final files = await allSources();
      final hits = await grepPattern(files,
          RegExp(r'LoanQuoteRepository|/api/loan/quote|loanQuote|quoteCalculation',
              caseSensitive: false,),
          excludeSuffixes: selfExclude,);
      expect(hits, isEmpty, reason: 'CR-001: loan/quote must NOT exist: $hits');
    });

    test('No legacy providers used (SC: StateProvider/StateNotifier/ChangeNotifier)',
        () async {
      final files = await allSources();
      final hits = await grepPattern(files,
          RegExp(r'\bStateProvider\b|\bStateNotifierProvider\b|\bChangeNotifierProvider\b|\bNotifierProviderFamily\b|\bFamilyNotifier\b'),
          excludeSuffixes: selfExclude,);
      expect(hits, isEmpty,
          reason: 'Legacy providers forbidden in G0: $hits',);
    });

    test('No print() usage: logging must go through SafeLogger', () async {
      final files = await allSources();
      final hits = await grepPattern(files, RegExp(r'\bprint\s*\('),
          excludeSuffixes: selfExclude,);
      expect(hits, isEmpty, reason: 'print() forbidden: $hits');
    });

    test('Origin string literal outside origin_interceptor.dart → fail',
        () async {
      final files = await allSources();
      final hits = await grepPattern(files,
          RegExp(r'''['"]Origin['"]'''),
          excludeSuffixes: [...selfExclude, 'origin_interceptor.dart', 'origin_test.dart'],);
      expect(hits, isEmpty,
          reason: "'Origin' hardcoded outside origin_interceptor.dart: $hits",);
    });

    test('No legacy mobile_scanner/flutter_intl outside allowlist (SC-1/2 + COMPANY-02)', () async {
      final files = await allSources();
      final mobileScannerRegExp = RegExp(
        r'^\s*(import|export)\s+["\x27]package:(mobile_scanner|flutter_intl)["\x27]|^\s*flutter_intl:',
      );
      final hits = await grepPattern(files, mobileScannerRegExp,
          excludeSuffixes: [...selfExclude, 'architecture_platform_security_test.dart'],);
      final filtered = <String, List<String>>{};
      hits.forEach((path, lines) {
        final p = path.replaceAll('\\', '/');
        if (p.contains('/lib/features/company/presentation/') &&
            lines.every((l) => l.contains('package:mobile_scanner'))) {
          return;
        }
        filtered[path] = lines;
      });
      expect(filtered, isEmpty,
          reason:
              'Forbidden pkgs outside allowlist: mobile_scanner allow=/features/company/presentation only; flutter_intl forbidden. Found: $filtered',);
    });

    test('CJK characters outside l10n & catalog (ERR-01 CJK guard)', () async {
      final cjk = RegExp(r'[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]');
      final files = await allSources();
      final hits = await grepPattern(
        files,
        cjk,
        excludeSuffixes: [
          ...selfExclude,
          '/lib/l10n/',
          '/test/core/error/g1_error_mapping_test.dart',
          'server_message_catalog.dart',
          '/lib/app/',
        ],
      );
      final filtered = <String, List<String>>{};
      hits.forEach((path, lines) {
        final p = path.replaceAll('\\', '/');
        if (p.contains('arb')) return;
        filtered[path] = lines;
      });
      expect(filtered, isEmpty,
          reason: 'CJK text must live in l10n arb or server_message_catalog.dart: $filtered',);
    });

    test('No manual Cookie header construction (CF-0 §5.4 rule: jar-only transport)',
        () async {
      final files = await allSources();
      final dangerous = RegExp(r'''(headers\[['"]Cookie['"]\])|(Cookie\s*:\s*['"])''');
      final hits = await grepPattern(
        files,
        dangerous,
        excludeSuffixes: [
          ...selfExclude,
          'company_context_guard_interceptor.dart',
          'cookie_cf0_guard_test.dart',
          'origin_test.dart',
        ],
      );
      final filtered = <String, List<String>>{};
      hits.forEach((k, v) {
        final p = k.replaceAll('\\', '/');
        if (p.contains('/test/')) {
          if (v.any((line) => line.contains('Cookie') && line.contains('test('))) {
            return;
          }
        }
        filtered[k] = v;
      });
      expect(filtered, isEmpty,
          reason: 'Must not hand-write Cookie headers. Use WhitelistCookieJar: $filtered',);
    });
  });
}
