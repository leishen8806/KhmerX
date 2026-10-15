import 'package:flutter/material.dart';

import '../../../../l10n/app_localizations.dart';
import '../../../customer_state/domain/home_viewmodel.dart';

class StatusExplanationPanel {
  StatusExplanationPanel._();

  static Future<void> show(
    BuildContext context,
    HomeStatusPanelId? id,
  ) {
    final panelId = id ?? HomeStatusPanelId.panelUnknown;
    return showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => _PanelSheetBody(id: panelId),
    );
  }
}

class _PanelSheetBody extends StatelessWidget {
  const _PanelSheetBody({required this.id});
  final HomeStatusPanelId id;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final (:status, :meaning, :available, :notAvailable) = _content(id, l10n);
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (ctx, scrollController) {
        return SingleChildScrollView(
          controller: scrollController,
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Center(
                child: Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      l10n.home_status_panel_title,
                      style: Theme.of(ctx).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(ctx).pop(),
                    tooltip: l10n.home_status_panel_close,
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              _Section(
                heading: l10n.home_status_panel_section_current,
                body: status,
                emphasized: true,
              ),
              const SizedBox(height: 16),
              _Section(
                heading: l10n.home_status_panel_section_meaning,
                body: meaning,
              ),
              const SizedBox(height: 16),
              _Section(
                heading: l10n.home_status_panel_section_available,
                body: available,
                color: Colors.green.shade800,
                bulletColor: Colors.green.shade600,
              ),
              const SizedBox(height: 16),
              _Section(
                heading: l10n.home_status_panel_section_not_available,
                body: notAvailable,
                color: Colors.red.shade800,
                bulletColor: Colors.red.shade400,
              ),
            ],
          ),
        );
      },
    );
  }

  static ({
    String status,
    String meaning,
    String available,
    String notAvailable,
  }) _content(HomeStatusPanelId id, AppLocalizations l10n) {
    return switch (id) {
      HomeStatusPanelId.panelNone => (
          status: l10n.panel_none_status,
          meaning: l10n.panel_none_meaning,
          available: l10n.panel_none_available,
          notAvailable: l10n.panel_none_not_available,
        ),
      HomeStatusPanelId.panelDraft => (
          status: l10n.panel_draft_status,
          meaning: l10n.panel_draft_meaning,
          available: l10n.panel_draft_available,
          notAvailable: l10n.panel_draft_not_available,
        ),
      HomeStatusPanelId.panelSubmitted => (
          status: l10n.panel_submitted_status,
          meaning: l10n.panel_submitted_meaning,
          available: l10n.panel_submitted_available,
          notAvailable: l10n.panel_submitted_not_available,
        ),
      HomeStatusPanelId.panelNeedsInfo => (
          status: l10n.panel_needs_info_status,
          meaning: l10n.panel_needs_info_meaning,
          available: l10n.panel_needs_info_available,
          notAvailable: l10n.panel_needs_info_not_available,
        ),
      HomeStatusPanelId.panelRejected => (
          status: l10n.panel_rejected_status,
          meaning: l10n.panel_rejected_meaning,
          available: l10n.panel_rejected_available,
          notAvailable: l10n.panel_rejected_not_available,
        ),
      HomeStatusPanelId.panelApprovedNoLoan => (
          status: l10n.panel_approved_noloan_status,
          meaning: l10n.panel_approved_noloan_meaning,
          available: l10n.panel_approved_noloan_available,
          notAvailable: l10n.panel_approved_noloan_not_available,
        ),
      HomeStatusPanelId.panelUnknown => (
          status: l10n.panel_unknown_status,
          meaning: l10n.panel_unknown_meaning,
          available: l10n.panel_unknown_available,
          notAvailable: l10n.panel_unknown_not_available,
        ),
    };
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.heading,
    required this.body,
    this.emphasized = false,
    this.color,
    this.bulletColor,
  });

  final String heading;
  final String body;
  final bool emphasized;
  final Color? color;
  final Color? bulletColor;

  @override
  Widget build(BuildContext context) {
    final bodyColor = color ??
        (emphasized
            ? Theme.of(context).colorScheme.onSurface
            : Theme.of(context).textTheme.bodyMedium?.color);
    final bullet = bulletColor ?? (color ?? Colors.grey.shade600);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          heading,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: Colors.grey.shade700,
              ),
        ),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: bullet,
                  shape: BoxShape.circle,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                body,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: bodyColor,
                      fontWeight:
                          emphasized ? FontWeight.w600 : FontWeight.w400,
                    ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
