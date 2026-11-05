import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/app/theme/khmerx_theme.dart';

void main() {
  testWidgets('light theme keeps web tokens and 48px controls', (tester) async {
    final theme = KhmerXTheme.light();
    await tester.pumpWidget(
      MaterialApp(
        theme: theme,
        home: Scaffold(
          body: FilledButton(onPressed: () {}, child: const Text('Continue')),
        ),
      ),
    );
    expect(theme.colorScheme.primary, const Color(0xFF1677FF));
    expect(theme.colorScheme.onSurface, const Color(0xFF172033));
    expect(theme.colorScheme.secondary, const Color(0xFF667085));
    expect(theme.filledButtonTheme.style?.minimumSize?.resolve({})?.height, 48);
    expect(theme.inputDecorationTheme.constraints?.minHeight, 48);
    expect(tester.getSize(find.byType(FilledButton)).height, greaterThanOrEqualTo(48));
  });
}
