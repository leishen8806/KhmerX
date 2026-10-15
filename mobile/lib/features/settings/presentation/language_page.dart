import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/bootstrap/providers.dart';
import '../../../core/error/server_message_catalog.dart';
import '../../../l10n/app_localizations.dart';

/// Device-level language choice (km / en / zh). Independent of any server-side
/// company flags: the app bundles all three locales.
final class LanguagePage extends ConsumerWidget {
  const LanguagePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final current = ref.watch(localeProvider);
    final selectable = ref.watch(localeProvider.notifier).selectable;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.languagePageTitle)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final l in selectable)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  alignment: Alignment.centerLeft,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                ),
                onPressed: current.languageCode == l.languageCode
                    ? null
                    : () {
                        ref.read(localeProvider.notifier).setLocale(l);
                        context.pop();
                      },
                child: Row(
                  children: [
                    const SizedBox(width: 4),
                    Expanded(child: Text(_label(l.languageCode))),
                    if (current.languageCode == l.languageCode)
                      const Icon(Icons.check, color: Colors.green),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  static String _label(String code) {
    return switch (code) {
      'en' => 'English',
      'km' => 'ខ្មែរ (Khmer)',
      'zh' => LocalizedLabel.zhNative,
      _ => code,
    };
  }
}
