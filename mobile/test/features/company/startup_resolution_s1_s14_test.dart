import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/core/session/company_id.dart';
import 'package:khmerx_app/features/company/domain/company_link_parser.dart';
import 'package:khmerx_app/features/company/domain/company_resolver.dart';

CompanyId _cid(String raw) => CompanyId(raw);

Uri _link(String c) => Uri(
      scheme: 'https',
      host: 'khmerx.org',
      path: '/app',
      queryParameters: {'c': c},
    );

void main() {
  const resolver = CompanyResolver();

  group('P1-S-RES §31 zero-company → 0 preflight (no candidate at all)', () {
    test('no link + no persisted + no configured default → Unresolved noCandidate', () {
      final result = resolver.resolveForNormalStartup(
        incomingAppLink: null,
        persistedActive: null,
        configuredDefault: null,
        preflightResults: const {},
      );
      expect(result, isA<UnresolvedCompany>());
      expect((result as UnresolvedCompany).reason,
          CompanyUnresolvedReason.noCandidate,);
    });

    test('pickPreflightCandidate returns null → 0 network preflight calls', () {
      final c = resolver.pickPreflightCandidate(
        incomingAppLink: null,
        persistedActive: null,
        configuredDefault: null,
      );
      expect(c, isNull);
    });
  });

  group('P1-S-RES §32 persisted 403 → NO silent fallback to configuredDefault', () {
    final persisted = _cid('t_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    final configured = _cid('t_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    final result = resolver.resolveForNormalStartup(
      incomingAppLink: null,
      persistedActive: persisted,
      configuredDefault: configured,
      preflightResults: {persisted.raw: PreflightResult.unavailable},
    );
    test('returns Unresolved persistedCompanyUnavailable', () {
      expect(result, isA<UnresolvedCompany>());
      expect((result as UnresolvedCompany).reason,
          CompanyUnresolvedReason.persistedCompanyUnavailable,);
    });
    test('configured default was NOT consulted (not in preflightResults)', () {
      expect(result, isNot(isA<ResolvedCompany>()));
    });
  });

  group('P1-S-RES §33 invalid app link parse → NO silent fallback to R2/R3', () {
    final badLink = Uri(
      scheme: 'https',
      host: 'khmerx.org',
      path: '/app',
      queryParameters: const {'c': 'garbage-not-uuid'},
    );
    final persisted = _cid('t_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    final configured = _cid('t_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    final result = resolver.resolveForNormalStartup(
      incomingAppLink: badLink,
      persistedActive: persisted,
      configuredDefault: configured,
      preflightResults: const {},
    );
    test('returns Unresolved appLinkParseFailed (NOT Resolved from R2/R3)', () {
      expect(result, isA<UnresolvedCompany>());
      expect((result as UnresolvedCompany).reason,
          CompanyUnresolvedReason.appLinkParseFailed,);
    });
  });

  group('P1-S-RES §34 fresh + valid link B (no active A) → direct activate (bypass confirm)', () {
    final linkB = _link('t_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    final b = _cid('t_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    final result = resolver.resolveForNormalStartup(
      incomingAppLink: linkB,
      persistedActive: null,
      configuredDefault: null,
      preflightResults: {b.raw: PreflightResult.ok},
    );
    test('Resolved from incomingAppLink, requiresCandidateConfirm=false', () {
      expect(result, isA<ResolvedCompany>());
      final r = result as ResolvedCompany;
      expect(r.source, CompanyResolutionSource.incomingAppLink);
      expect(r.companyId.raw, b.raw);
      expect(r.requiresCandidateConfirm, isFalse);
    });
  });

  group('P1-S-RES §35 active A + valid link B → candidate confirm (no silent auth)', () {
    final activeA = _cid('t_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    final linkB = _link('t_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    final b = _cid('t_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    final result = resolver.resolveForNormalStartup(
      incomingAppLink: linkB,
      persistedActive: activeA,
      configuredDefault: null,
      preflightResults: {b.raw: PreflightResult.ok, activeA.raw: PreflightResult.ok},
    );
    test('Resolved, requiresCandidateConfirm=true', () {
      expect(result, isA<ResolvedCompany>());
      final r = result as ResolvedCompany;
      expect(r.source, CompanyResolutionSource.incomingAppLink);
      expect(r.companyId.raw, b.raw);
      expect(r.requiresCandidateConfirm, isTrue);
    });
  });

  group('P1-S-RES same company link vs active → no candidate confirm', () {
    final activeA = _cid('t_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    final linkA = _link('t_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    final result = resolver.resolveForNormalStartup(
      incomingAppLink: linkA,
      persistedActive: activeA,
      configuredDefault: null,
      preflightResults: {activeA.raw: PreflightResult.ok},
    );
    test('requiresCandidateConfirm=false (same company ignored)', () {
      final r = result as ResolvedCompany;
      expect(r.requiresCandidateConfirm, isFalse);
      expect(r.companyId.raw, activeA.raw);
    });
  });

  group('P1-S-RES link unavailable (403) → Recovery no fallback', () {
    final b = _cid('t_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    final linkB = _link('t_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    final persistedA = _cid('t_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    final result = resolver.resolveForNormalStartup(
      incomingAppLink: linkB,
      persistedActive: persistedA,
      configuredDefault: null,
      preflightResults: {b.raw: PreflightResult.unavailable, persistedA.raw: PreflightResult.ok},
    );
    test('Unresolved appLinkCompanyUnavailable (NOT fall back to persisted A)', () {
      expect(result, isA<UnresolvedCompany>());
      expect((result as UnresolvedCompany).reason,
          CompanyUnresolvedReason.appLinkCompanyUnavailable,);
    });
  });

  group('P1-S-RES S11 network error → StartupNetworkError (not Recovery)', () {
    final c = _cid('t_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    final result = resolver.resolveForNormalStartup(
      incomingAppLink: null,
      persistedActive: c,
      configuredDefault: null,
      preflightResults: {c.raw: PreflightResult.networkError},
    );
    test('returns StartupNetworkError', () {
      expect(result, isA<StartupNetworkError>());
      final n = result as StartupNetworkError;
      expect(n.source, CompanyResolutionSource.persistedActive);
      expect(n.companyId.raw, c.raw);
    });
  });

  group('P1-S-RES configured default used only when no link & no persisted', () {
    final d = _cid('t_cccccccc-cccc-cccc-cccc-cccccccccccc');
    final result = resolver.resolveForNormalStartup(
      incomingAppLink: null,
      persistedActive: null,
      configuredDefault: d,
      preflightResults: {d.raw: PreflightResult.ok},
    );
    test('Resolved from configuredDefault', () {
      final r = result as ResolvedCompany;
      expect(r.source, CompanyResolutionSource.configuredDefault);
      expect(r.companyId.raw, d.raw);
    });
    test('pickPreflightCandidate returns configuredDefault', () {
      final c = resolver.pickPreflightCandidate(
        incomingAppLink: null,
        persistedActive: null,
        configuredDefault: d,
      );
      expect(c?.raw, d.raw);
    });
  });

  group('P1-S-RES CompanyLinkParser → accepts t_ prefixed + reject empty/garbage', () {
    test('accepts t_<uuid v4>', () {
      final u = CompanyLinkParser.parseCompanyId(
          _link('t_12345678-1234-1234-1234-123456789012'),);
      expect(u, isNotNull);
      expect(u?.raw, 't_12345678-1234-1234-1234-123456789012');
    });
    test('rejects empty c param', () {
      final u = CompanyLinkParser.parseCompanyId(
          Uri(scheme: 'https', host: 'khmerx.org', path: '/app'),);
      expect(u, isNull);
    });
    test('rejects garbage c param value (no t_ prefix)', () {
      final u = CompanyLinkParser.parseCompanyId(
          _link('aaaa-bbb-ccc'),);
      expect(u, isNull);
    });
  });
}
