import 'package:flutter/material.dart';

import '../../../../l10n/app_localizations.dart';
import '../../../customer_state/domain/home_viewmodel.dart';

class FreshnessBanner extends StatelessWidget {
  const FreshnessBanner({super.key, required this.freshness});

  final HomeFreshness freshness;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final (:bg, :fg, :icon, :message) = _resolve(freshness, l10n);
    if (message.isEmpty) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: fg),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: fg,
                    fontWeight: FontWeight.w500,
                  ),
            ),
          ),
        ],
      ),
    );
  }

  static ({Color bg, Color fg, IconData icon, String message}) _resolve(
    HomeFreshness f,
    AppLocalizations l10n,
  ) {
    return switch (f) {
      HomeFreshness.refreshFailed => (
          bg: Colors.orange.shade50,
          fg: Colors.orange.shade800,
          icon: Icons.cloud_off_outlined,
          message: l10n.home_freshness_refresh_failed,
        ),
      HomeFreshness.offlineWithSnapshot => (
          bg: Colors.grey.shade200,
          fg: Colors.grey.shade800,
          icon: Icons.signal_wifi_off_outlined,
          message: l10n.home_freshness_stale_offline,
        ),
      HomeFreshness.sessionInvalid => (
          bg: Colors.red.shade50,
          fg: Colors.red.shade800,
          icon: Icons.lock_outline,
          message: l10n.home_freshness_session_invalid,
        ),
      HomeFreshness.firstLoad ||
      HomeFreshness.live ||
      HomeFreshness.offlineNoSnapshot =>
        (bg: Colors.transparent, fg: Colors.transparent, icon: Icons.circle, message: ''),
    };
  }
}
