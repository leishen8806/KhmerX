import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/core/feature_flags/feature_flags.dart';

void main() {
  group('Feature Flags G0 defaults', () {
    test('withdraw defaults to false', () {
      const flags = FeatureFlags();
      expect(flags.withdraw, isFalse);
    });

    test('repay defaults to false', () {
      const flags = FeatureFlags();
      expect(flags.repay, isFalse);
    });

    test('explicit false matches default', () {
      const a = FeatureFlags();
      const b = FeatureFlags(withdraw: false, repay: false);
      expect(a, equals(b));
    });
  });
}
