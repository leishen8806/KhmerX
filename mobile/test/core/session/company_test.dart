import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/core/session/company_id.dart';
import 'package:khmerx_app/core/session/session_manager.dart';
import 'package:khmerx_app/core/storage/key_schema.dart';

void main() {
  group('CompanyId', () {
    test('Company A != Company B', () {
      final a = CompanyId('t_aaaaaaaa-1234-1234-1234-123456789012');
      final b = CompanyId('t_bbbbbbbb-1234-1234-1234-123456789012');
      expect(a, isNot(equals(b)));
      expect(a.raw, isNot(equals(b.raw)));
    });

    test('CompanyId invalid format throws FormatException', () {
      expect(() => CompanyId('invalid'), throwsFormatException);
      expect(() => CompanyId('v_aaaa'), throwsFormatException);
      expect(CompanyId.tryParse('invalid'), isNull);
    });

    test('tryParse valid format returns CompanyId', () {
      const raw = 't_00000000-0000-0000-0000-000000000000';
      final c = CompanyId.tryParse(raw);
      expect(c, isNotNull);
      expect(c?.raw, equals(raw));
    });
  });

  group('KeySchema isolation prefixes', () {
    test('storage prefix A != prefix B (triple isolation P4)', () {
      final a = CompanyId('t_aaaaaaaa-1234-1234-1234-123456789012');
      final b = CompanyId('t_bbbbbbbb-1234-1234-1234-123456789012');
      final prefixA = KeySchema.companyPrefix(a.raw);
      final prefixB = KeySchema.companyPrefix(b.raw);
      expect(prefixA, isNot(equals(prefixB)));
      expect(prefixB.startsWith(prefixA), isFalse);
      expect(prefixA.startsWith(prefixB), isFalse);
    });
  });

  group('Logout foundation — SessionManager', () {
    test('clearSession(A) retains other companies sessions', () {
      final sm = SessionManager();
      const idA = 't_aaaaaaaa-1234-1234-1234-123456789012';
      const idB = 't_bbbbbbbb-1234-1234-1234-123456789012';
      sm.markSessionPresent(idA);
      sm.markSessionPresent(idB);
      expect(sm.hasSession(idA), isTrue);
      expect(sm.hasSession(idB), isTrue);

      sm.clearSessionOnly(idA);
      expect(sm.hasSession(idA), isFalse);
      expect(sm.hasSession(idB), isTrue,
          reason: 'Company B session must survive Company A logout',);
    });

    test('removeCompany(A) does not touch Company B', () {
      final sm = SessionManager();
      const idA = 't_aaaaaaaa-1234-1234-1234-123456789012';
      const idB = 't_bbbbbbbb-1234-1234-1234-123456789012';
      sm.markSessionPresent(idA);
      sm.markSessionPresent(idB);
      sm.removeCompany(idA);
      expect(sm.hasSession(idA), isFalse);
      expect(sm.hasSession(idB), isTrue);
    });
  });
}
