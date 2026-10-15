import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('P1-03A — Provider automatic retry = OFF', () {
    test('failing sync Provider: 1 read => 1 invocation (NOT auto-retried)', () {
      var invocations = 0;
      final failingProvider = Provider<int>((ref) {
        invocations += 1;
        throw Exception('boom-$invocations');
      });

      final container = ProviderContainer();
      addTearDown(container.dispose);

      try {
        container.read(failingProvider);
        fail('Expected exception');
      } catch (_) {}
      expect(invocations, equals(1),
          reason: 'Financial safety: failing Provider must NOT auto-retry. '
              'Riverpod 3.x auto-retry defaults must be OFF globally.',);
    });

    test('normal Provider never invokes body until read (lazy = true default)', () {
      var invocations = 0;
      final p = Provider<int>((ref) {
        invocations += 1;
        return 42;
      });
      final c = ProviderContainer();
      addTearDown(c.dispose);
      expect(invocations, equals(0), reason: 'Lazy build: body only runs on read.');
      expect(c.read(p), equals(42));
      expect(invocations, equals(1));
    });

    test('ProviderContainer sanity: normal value provider reads correctly', () {
      final p = Provider<int>((ref) => 42);
      final c = ProviderContainer();
      addTearDown(c.dispose);
      expect(c.read(p), equals(42));
    });
  });
}
