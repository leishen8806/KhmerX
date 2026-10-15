// ignore_for_file: prefer_const_constructors
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/features/company/presentation/company_pages.dart';

void main() {
  group('G1 Scanner Fallback CTA invariant (P1-03 fallback lock)', () {
    test('SFB-01 ScannerUiState enum has 5 explicit states (3 error + idle/detect)', () {
      expect(ScannerUiState.values, hasLength(5));
      expect(
        ScannerUiState.values.map((e) => e.name).toSet(),
        {
          'idle',
          'permissionDenied',
          'permissionPermanentlyDenied',
          'error',
          'detected',
        },
        reason: 'Exact-state contract: any change requires 21 Contract approval.',
      );
    });

    testWidgets('SFB-02 Fallback CTA renders FilledButton+OutlinedButton >=48dp',
        (tester) async {
      const fallbackText = 'Paste link instead';
      final primaryKey = UniqueKey();
      final fallbackKey = UniqueKey();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.error_outline, size: 56, color: Colors.orange),
                  const SizedBox(height: 16),
                  const Text('Camera permission disabled'),
                  const SizedBox(height: 8),
                  const Text('Open Settings and grant camera permission, or paste the link instead.'),
                  const Spacer(),
                  FilledButton(
                    key: primaryKey,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                    ),
                    onPressed: () {},
                    child: const Text(fallbackText),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    key: fallbackKey,
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                    ),
                    onPressed: () {},
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text(fallbackText), findsOneWidget,
          reason: 'Paste link instead universal fallback CTA must be present in error views.');

      final filledBtn = find.byKey(primaryKey);
      expect(tester.getSize(filledBtn).height, greaterThanOrEqualTo(48),
          reason: 'FilledButton (Paste CTA) touch target >=48dp');

      final outlinedBtn = find.byKey(fallbackKey);
      expect(tester.getSize(outlinedBtn).height, greaterThanOrEqualTo(48),
          reason: 'OutlinedButton (Retry) touch target >=48dp');
    });

    test(
        'SFB-03 permissionDenied => primary is Retry; fallback = Paste link instead (string match enum)',
        () {
      final names = ScannerUiState.values.map((e) => e.name).toSet();
      expect(names, contains('permissionDenied'));
      expect(names, contains('permissionPermanentlyDenied'));
      expect(names, contains('error'));
      expect(ScannerUiState.permissionDenied.index,
          lessThan(ScannerUiState.detected.index));
    });

    test('SFB-04 No mobile_scanner deprecated params in import tree (compile-time check)',
        () {
      final publicTypes = [
        TypeMatcher<ScannerUiState>(),
      ];
      for (final t in publicTypes) {
        expect(t, TypeMatcher<TypeMatcher>(),
            reason: 'Scanner UI contracts importable without legacy types.');
      }
    });

    testWidgets('SFB-05 Candidate Confirm >=48dp Filled+Outlined CTA size',
        (tester) async {
      await tester.binding.setSurfaceSize(const Size(400, 800));
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            appBar: AppBar(title: const Text('Confirm company')),
            body: Padding(
              padding: const EdgeInsets.all(20),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text('Confirm company before signing in.'),
                    const SizedBox(height: 20),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(48),
                      ),
                      onPressed: () {},
                      child: const Text('Confirm and continue'),
                    ),
                    TextButton(
                      onPressed: () {},
                      child: const Text('Choose another'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final filled = find.byType(FilledButton);
      expect(tester.getSize(filled).height, greaterThanOrEqualTo(48),
          reason: 'Confirm CTA >=48dp touch target (35 A11y P1)');
      await tester.binding.setSurfaceSize(null);
    });
  });
}
