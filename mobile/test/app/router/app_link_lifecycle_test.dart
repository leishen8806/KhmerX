import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/app/bootstrap/providers.dart';
import 'package:khmerx_app/app/router/deep_link_handler.dart';
import 'package:khmerx_app/core/session/company_id.dart';
import 'package:khmerx_app/features/company/domain/company_link_parser.dart';

final CompanyId cidA = CompanyId('t_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
final CompanyId cidB = CompanyId('t_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

ProviderContainer buildContainer() {
  return ProviderContainer(
    overrides: const [],
  );
}

void main() {
  group('§24 AppLink Parser: canonical strict semantics', () {
    test('Parser-01 valid https://khmerx.org/app?c=t_UUID → CompanyId', () {
      final u = Uri.parse('https://khmerx.org/app?c=t_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      final r = CompanyLinkParser.parseCompanyId(u);
      expect(r, isNotNull, reason: 'valid scheme+host+path+single c param → parsed');
      expect(r!.raw, 't_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    });

    test('Parser-02 wrong scheme (http) → null', () {
      final u = Uri.parse('http://khmerx.org/app?c=t_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      expect(CompanyLinkParser.parseCompanyId(u), isNull);
    });

    test('Parser-03 wrong host (app.khmerx.org) → null', () {
      final u = Uri.parse('https://app.khmerx.org/app?c=t_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      expect(CompanyLinkParser.parseCompanyId(u), isNull);
    });

    test('Parser-04 wrong path (/join) → null', () {
      final u = Uri.parse('https://khmerx.org/join?c=t_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      expect(CompanyLinkParser.parseCompanyId(u), isNull);
    });

    test('Parser-05 missing c query param → null', () {
      final u = Uri.parse('https://khmerx.org/app');
      expect(CompanyLinkParser.parseCompanyId(u), isNull);
    });

    test('Parser-06 duplicate c params (c=X&c=Y) → null', () {
      final u = Uri.parse('https://khmerx.org/app?c=t_a&c=t_b');
      expect(CompanyLinkParser.parseCompanyId(u), isNull);
    });

    test('Parser-07 bad UUID format (t_xyz-not-uuid) → null', () {
      final u = Uri.parse('https://khmerx.org/app?c=t_notvaliduuid');
      expect(CompanyLinkParser.parseCompanyId(u), isNull);
    });

    test('Parser-08 empty c value → null', () {
      final u = Uri.parse('https://khmerx.org/app?c=');
      expect(CompanyLinkParser.parseCompanyId(u), isNull);
    });

    test('Parser-09 valid link B round-trip', () {
      final u = Uri.parse('https://khmerx.org/app?c=${cidB.raw}');
      expect(CompanyLinkParser.parseCompanyId(u)?.raw, cidB.raw);
    });

    test('Parser-10 empty Uri() → null', () {
      expect(CompanyLinkParser.parseCompanyId(Uri()), isNull);
    });

    test('Parser-11 Dart Uri RFC 3986 scheme/host lowercase normalization → still parses', () {
      final u = Uri.parse('HTTPS://KHMERX.ORG/app?c=${cidA.raw}');
      // Dart Uri automatically lowercases scheme + host per RFC 3986 (scheme/host case-insensitive)
      expect(u.scheme, 'https');
      expect(u.host, 'khmerx.org');
      expect(u.path, '/app');
      final r = CompanyLinkParser.parseCompanyId(u);
      expect(r?.raw, cidA.raw,
          reason: 'post-canonicalization by Dart Uri → contract exact match → passes');
    });
  });

  group('§24 DeepLinkHandler sets both pendingDeepLink AND pendingCandidate', () {
    test('DLink-01 handle valid URI sets BOTH pendingDeepLinkCompany and pendingCandidateCompany',
        () {
      final c = buildContainer();
      addTearDown(c.dispose);
      final handler = DeepLinkHandlerForTesting(c);
      handler.publicHandle(Uri.parse('https://khmerx.org/app?c=${cidA.raw}'));
      expect(c.read(pendingDeepLinkCompanyProvider), equals(cidA),
          reason: 'pendingDeepLinkProvider populated (router refresh uses this)');
      expect(c.read(pendingCandidateCompanyProvider), equals(cidA),
          reason: 'pendingCandidateCompanyProvider populated (candidate page reads it)');
    });

    test('DLink-02 handle invalid URI → BOTH providers remain null (never silent polluted state)',
        () {
      final c = buildContainer();
      addTearDown(c.dispose);
      final handler = DeepLinkHandlerForTesting(c);
      handler.publicHandle(Uri.parse('https://evil.example/phish?c=${cidA.raw}'));
      expect(c.read(pendingDeepLinkCompanyProvider), isNull);
      expect(c.read(pendingCandidateCompanyProvider), isNull);
    });
  });

  group('§25 Warm AppLink Cases (unit semantics: never silent activate)', () {
    test('Warm-01 same-company link A → A still triggers confirm NOT silent activate', () {
      final c = buildContainer();
      addTearDown(c.dispose);
      c.read(activeCompanyIdProvider.notifier).state = cidA;
      final handler = DeepLinkHandlerForTesting(c);
      // simulate same-co app link while running
      handler.publicHandle(Uri.parse('https://khmerx.org/app?c=${cidA.raw}'));
      // Contract (§24): activation only after confirm. pendingDeepLink MUST be set → triggers redirect to confirm.
      expect(c.read(pendingDeepLinkCompanyProvider), equals(cidA),
          reason: 'same-co warm link must still surface confirm; never silent switch/authenticate');
    });

    test('Warm-02 different-company link B while A active → confirm candidate B set', () {
      final c = buildContainer();
      addTearDown(c.dispose);
      c.read(activeCompanyIdProvider.notifier).state = cidA;
      final handler = DeepLinkHandlerForTesting(c);
      handler.publicHandle(Uri.parse('https://khmerx.org/app?c=${cidB.raw}'));
      expect(c.read(pendingDeepLinkCompanyProvider), equals(cidB));
      expect(c.read(pendingCandidateCompanyProvider), equals(cidB));
      expect(c.read(activeCompanyIdProvider), equals(cidA),
          reason: 'active A untouched until user hits Confirm on candidate page (no silent switch)');
    });

    test('Warm-03 cancel candidate clears BOTH providers → no redirect loop', () {
      final c = buildContainer();
      addTearDown(c.dispose);
      final handler = DeepLinkHandlerForTesting(c);
      handler.publicHandle(Uri.parse('https://khmerx.org/app?c=${cidA.raw}'));
      // Simulate Cancel button (mimics what candidate page does)
      c.read(pendingCandidateCompanyProvider.notifier).set(null);
      c.read(pendingDeepLinkCompanyProvider.notifier).set(null);
      expect(c.read(pendingDeepLinkCompanyProvider), isNull,
          reason: 'after cancel: pendingDeepLink cleared → router will NOT redirect again (no loop)');
      expect(c.read(pendingCandidateCompanyProvider), isNull);
    });

    test('Warm-04 preflight failure (candidate disabled) → cancel still clears BOTH providers', () {
      final c = buildContainer();
      addTearDown(c.dispose);
      c.read(pendingCandidateCompanyProvider.notifier).set(cidB);
      c.read(pendingDeepLinkCompanyProvider.notifier).set(cidB);
      // Simulate: Candidate page ran preflight, got ForbiddenFailure → disabled=true, user clicks "Choose another"
      c.read(pendingCandidateCompanyProvider.notifier).set(null);
      c.read(pendingDeepLinkCompanyProvider.notifier).set(null);
      expect(c.read(pendingDeepLinkCompanyProvider), isNull,
          reason: 'preflight fail + choose-another must clear deep link state too (otherwise stuck redirect loop)');
      expect(c.read(pendingCandidateCompanyProvider), isNull);
    });

    test('Warm-05 invalid warm link → providers untouched (user stays at current screen, no confirm)', () {
      final c = buildContainer();
      addTearDown(c.dispose);
      // user is somewhere in app, pre-existing state clean
      expect(c.read(pendingDeepLinkCompanyProvider), isNull);
      final handler = DeepLinkHandlerForTesting(c);
      handler.publicHandle(Uri.parse('https://khmerx.org/something-else'));
      expect(c.read(pendingDeepLinkCompanyProvider), isNull,
          reason: 'invalid warm link must NOT trigger confirm/redirect; user stays on current view');
    });

    test('Warm-06 confirm activation clears BOTH providers → ready for future warm links', () {
      final c = buildContainer();
      addTearDown(c.dispose);
      c.read(pendingCandidateCompanyProvider.notifier).set(cidA);
      c.read(pendingDeepLinkCompanyProvider.notifier).set(cidA);
      // Simulate Confirm button success path
      c.read(pendingCandidateCompanyProvider.notifier).set(null);
      c.read(pendingDeepLinkCompanyProvider.notifier).set(null);
      expect(c.read(pendingDeepLinkCompanyProvider), isNull);
      expect(c.read(pendingCandidateCompanyProvider), isNull);
      // Now send another warm link B → should populate correctly (not blocked by stale)
      final handler = DeepLinkHandlerForTesting(c);
      handler.publicHandle(Uri.parse('https://khmerx.org/app?c=${cidB.raw}'));
      expect(c.read(pendingDeepLinkCompanyProvider), equals(cidB));
    });
  });
}

class DeepLinkHandlerForTesting {
  final ProviderContainer _c;
  DeepLinkHandlerForTesting(this._c);
  void publicHandle(Uri uri) {
    final companyId = CompanyLinkParser.parseCompanyId(uri);
    if (companyId == null) return;
    _c.read(pendingDeepLinkCompanyProvider.notifier).set(companyId);
    _c.read(pendingCandidateCompanyProvider.notifier).set(companyId);
  }
}
