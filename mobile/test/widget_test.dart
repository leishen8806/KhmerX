import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/core/error/failure.dart';

void main() {
  group('Smoke tests', () {
    test('OfflineFailure has correct messageKey', () {
      final failure = OfflineFailure();
      expect(failure.messageKey, equals('error.offline'));
    });
  });
}
