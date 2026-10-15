import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../l10n/app_localizations.dart';
import '../shared/widgets/keyboard_switch.dart';
import 'theme/khmerx_theme.dart';
import 'bootstrap/providers.dart';

class KhmerXApp extends ConsumerWidget {
  const KhmerXApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final GoRouter router = ref.watch(routerProvider);
    final Locale locale = ref.watch(localeProvider);
    return MaterialApp.router(
      title: 'KhmerX',
      debugShowCheckedModeBanner: false,
      theme: KhmerXTheme.light(),
      darkTheme: KhmerXTheme.dark(),
      themeMode: ThemeMode.system,
      locale: locale,
      routerConfig: router,
      builder: (context, child) => KeyboardFallbackHost(child: child ?? const SizedBox.shrink()),
      localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
    );
  }
}
