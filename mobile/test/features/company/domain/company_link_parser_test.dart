import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/core/session/company_id.dart';
import 'package:khmerx_app/features/company/domain/company_link_parser.dart';

void main() {
  group('P1-05 — App Link parser (CompanyLinkParser)', () {
    const validUuid = 'aaaaaaaa-1234-1234-1234-123456789012';
    const validRaw = 't_$validUuid';

    test('https://khmerx.org/app?c=t_<uuid> parses correctly', () {
      final uri = Uri.parse('https://khmerx.org/app?c=$validRaw');
      final c = CompanyLinkParser.parseCompanyId(uri);
      expect(c, isNotNull);
      expect(c, isA<CompanyId>());
      expect(c!.raw, equals(validRaw));
    });

    test('different scheme (http) returns null', () {
      final uri = Uri.parse('http://khmerx.org/app?c=$validRaw');
      expect(CompanyLinkParser.parseCompanyId(uri), isNull);
    });

    test('wrong host returns null', () {
      final uri = Uri.parse('https://payease.khmerx.org/app?c=$validRaw');
      expect(CompanyLinkParser.parseCompanyId(uri), isNull);
    });

    test('wrong path returns null', () {
      final uri = Uri.parse('https://khmerx.org/login?c=$validRaw');
      expect(CompanyLinkParser.parseCompanyId(uri), isNull);
    });

    test('missing c= returns null', () {
      final uri = Uri.parse('https://khmerx.org/app');
      expect(CompanyLinkParser.parseCompanyId(uri), isNull);
    });

    test('malformed t_ prefix returns null', () {
      final uri = Uri.parse('https://khmerx.org/app?c=garbage');
      expect(CompanyLinkParser.parseCompanyId(uri), isNull);
    });

    test('multiple c= values returns null (not first-wins)', () {
      final uri = Uri.parse('https://khmerx.org/app?c=$validRaw&c=t_bbbbbbbb-1234-1234-1234-123456789012');
      expect(CompanyLinkParser.parseCompanyId(uri), isNull);
    });
  });
}
