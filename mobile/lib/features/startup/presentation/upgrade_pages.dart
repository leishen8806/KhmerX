import 'package:flutter/material.dart';

import '../../../l10n/app_localizations.dart';
import '../domain/upgrade_notice.dart';

final class UpgradeRequiredPage extends StatelessWidget {
  const UpgradeRequiredPage({required this.notice, super.key});
  final UpgradeNotice notice;

  @override
  Widget build(BuildContext context) => _UpgradeScaffold(notice: notice, required: true);
}

final class UpgradeAvailablePage extends StatelessWidget {
  const UpgradeAvailablePage({required this.notice, super.key});
  final UpgradeNotice notice;

  @override
  Widget build(BuildContext context) => _UpgradeScaffold(notice: notice, required: false);
}

final class _UpgradeScaffold extends StatelessWidget {
  const _UpgradeScaffold({required this.notice, required this.required});
  final UpgradeNotice notice;
  final bool required;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(required ? l.commonConfirm : l.commonContinue)),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Icon(required ? Icons.system_update_alt : Icons.system_update, size: 48),
                    const SizedBox(height: 20),
                    Text(required ? 'Update required' : 'Update available', textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 12),
                    Text('${notice.currentVersion} → ${notice.latestVersion}', textAlign: TextAlign.center),
                    const SizedBox(height: 24),
                    FilledButton(onPressed: notice.downloadUrl == null ? null : () {}, child: Text(l.commonContinue)),
                    if (!required) ...[const SizedBox(height: 8), TextButton(onPressed: () {}, child: Text(l.commonCancel))],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
