import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/bootstrap/providers.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/session/company_id.dart';
import '../../../../core/util/either.dart';
import '../../../../l10n/app_localizations.dart';

final class MePage extends ConsumerStatefulWidget {
  const MePage({super.key});

  @override
  ConsumerState<MePage> createState() => _MePageState();
}

class _MePageState extends ConsumerState<MePage> {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final langCode = ref.watch(localeProvider).languageCode;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.meTitle)),
      body: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l10n.meAccountSummaryTitle,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          )),
                  const SizedBox(height: 12),
                  _SummaryLine(label: l10n.meLanguageLabel, value: _languageLabel(langCode, l10n)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(l10n.meSectionActionsTitle,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  )),
          const SizedBox(height: 8),
          Card(
            clipBehavior: Clip.antiAlias,
            margin: EdgeInsets.zero,
            child: Column(
              children: [
                _ActionTile(
                  icon: Icons.language_outlined,
                  title: l10n.meActionLanguageTitle,
                  subtitle: l10n.meActionLanguageSubtitle,
                  onTap: () => context.push('/me/language'),
                ),
                const Divider(height: 1, indent: 56, endIndent: 0),
                _ActionTile(
                  icon: Icons.lock_outline,
                  title: l10n.meActionPasswordTitle,
                  subtitle: l10n.meActionPasswordSubtitle,
                  onTap: () => context.push('/me/password'),
                ),
                const Divider(height: 1, indent: 56, endIndent: 0),
                _ActionTile(
                  icon: Icons.logout_outlined,
                  title: l10n.meActionLogoutTitle,
                  subtitle: l10n.meActionLogoutSubtitle,
                  onTap: () => _confirmLogout(context),
                  isDestructive: true,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmLogout(BuildContext context) async {
    final l10n = AppLocalizations.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.logoutConfirmTitle),
        content: Text(l10n.logoutConfirmBody),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: Text(MaterialLocalizations.of(ctx).cancelButtonLabel)),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error,
              foregroundColor: Theme.of(ctx).colorScheme.onError,
              minimumSize: const Size(0, 48),
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.logoutConfirmConfirm),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await _doLogout();
  }

  Future<void> _doLogout() async {
    final l10n = AppLocalizations.of(context);
    final id = ref.read(activeCompanyIdProvider);
    if (id == null) {
      _afterLogoutCleanup(CompanyId.publicWorkspace);
      return;
    }
    final scaffold = ScaffoldMessenger.of(context);
    final Either<AppFailure, void> r = await ref.read(authRepositoryProvider).logout(id);
    if (!mounted) return;
    // Local sign-out always completes: if the server call fails (offline,
    // 5xx) the device session is still cleared and the server session simply
    // expires on its own.
    r.when(left: (f) {
      if ((f.statusCode ?? 0) != 401) {
        scaffold.showSnackBar(SnackBar(content: Text(l10n.logoutFailed)));
      }
    }, right: (_) {});
    if (mounted) {
      _afterLogoutCleanup(id);
    }
  }

  void _afterLogoutCleanup(CompanyId id) {
    ref
        .read(sessionInvalidationCoordinatorProvider)
        .onLocalLogout(companyId: id);
    if (mounted) {
      while (GoRouter.of(context).canPop()) {
        context.pop();
      }
      context.go('/auth/login');
    }
  }

  String _languageLabel(String code, AppLocalizations l10n) {
    return switch (code) {
      'zh' => l10n.languageZh,
      'km' => l10n.languageKm,
      _ => l10n.languageEn,
    };
  }
}

final class _SummaryLine extends StatelessWidget {
  const _SummaryLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Flexible(
          flex: 3,
          child: Text(
            label,
            style: theme.textTheme.bodySmall,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const SizedBox(width: 8),
        Flexible(
          flex: 4,
          child: Text(
            value,
            style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
            textAlign: TextAlign.end,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

final class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.isDestructive = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final bool isDestructive;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final labelColor = isDestructive ? theme.colorScheme.error : null;
    return Semantics(
      button: true,
      label: '$title $subtitle',
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64),
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Icon(icon, color: labelColor),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: theme.textTheme.bodyLarge?.copyWith(
                              fontWeight: FontWeight.w600,
                              color: labelColor,
                            ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: theme.textTheme.bodySmall,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Icon(Icons.chevron_right,
                      color: theme.colorScheme.onSurfaceVariant),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
