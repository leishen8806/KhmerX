import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../l10n/app_localizations.dart';

enum ShellTab { home, loans, me }

final class AuthenticatedShell extends StatefulWidget {
  const AuthenticatedShell({
    super.key,
    required this.child,
    required this.currentTab,
  });

  final Widget child;
  final ShellTab currentTab;

  @override
  State<AuthenticatedShell> createState() => _AuthenticatedShellState();
}

class _AuthenticatedShellState extends State<AuthenticatedShell> {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final current = widget.currentTab;
    return Scaffold(
      body: widget.child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: switch (current) {
          ShellTab.home => 0,
          ShellTab.loans => 1,
          ShellTab.me => 2,
        },
        onDestinationSelected: (index) {
          final next = switch (index) {
            0 => ShellTab.home,
            1 => ShellTab.loans,
            _ => ShellTab.me,
          };
          if (next == current) return;
          switch (next) {
            case ShellTab.home:
              context.go('/home');
              break;
            case ShellTab.loans:
              context.go('/loans');
              break;
            case ShellTab.me:
              context.go('/me');
              break;
          }
        },
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            selectedIcon: const Icon(Icons.home),
            label: l10n.shellTabHome,
            tooltip: l10n.shellSemanticHome,
          ),
          NavigationDestination(
            icon: const Icon(Icons.receipt_long_outlined),
            selectedIcon: const Icon(Icons.receipt_long),
            label: l10n.shellTabLoans,
            tooltip: l10n.shellSemanticLoans,
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline),
            selectedIcon: const Icon(Icons.person),
            label: l10n.shellTabMe,
            tooltip: l10n.shellSemanticMe,
          ),
        ],
      ),
    );
  }
}

ShellTab shellTabFromLocation(String location) {
  if (location == '/home' || location.startsWith('/home/')) {
    return ShellTab.home;
  }
  if (location == '/loans' || location.startsWith('/loans/')) {
    return ShellTab.loans;
  }
  return ShellTab.me;
}
