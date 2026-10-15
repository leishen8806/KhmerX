import 'package:flutter/material.dart';

final class FeatureDisabledPage extends StatelessWidget {
  final String featureName;

  const FeatureDisabledPage({
    super.key,
    required this.featureName,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Feature Disabled')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Text(
            featureName,
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}
