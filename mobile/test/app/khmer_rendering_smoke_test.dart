import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/app/theme/khmerx_theme.dart';

void main() {
  group('P2-02 — Khmer rendering smoke (សូមស្វាគមន៍)', () {
    const khmerHello = 'សូមស្វាគមន៍';

    testWidgets('widget builds; khmer text exists; no exception', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: KhmerXTheme.light(),
          home: const Scaffold(
            body: Center(child: Text(khmerHello)),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text(khmerHello), findsOneWidget);
    });

    testWidgets('mixed english + khmer renders', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: KhmerXTheme.light(),
          home: const Scaffold(
            body: Column(
              children: <Widget>[
                Text('KhmerX — Virtual AI Office'),
                SizedBox(height: 8),
                Text(khmerHello),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text(khmerHello), findsOneWidget);
      expect(find.textContaining('KhmerX'), findsOneWidget);
    });
  });
}
