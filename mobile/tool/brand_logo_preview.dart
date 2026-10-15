import 'package:flutter/material.dart';

import 'package:khmerx_app/shared/widgets/brand_loader.dart';

void main() {
  runApp(const _PreviewApp());
}

final class _PreviewApp extends StatelessWidget {
  const _PreviewApp();

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData(scaffoldBackgroundColor: const Color(0xFFF7F9FC)),
      home: const Scaffold(body: Center(child: BrandLogoLoader(width: 260))),
    );
  }
}
