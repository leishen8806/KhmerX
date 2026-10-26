import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart'
    show LengthLimitingTextInputFormatter, TextEditingValue, TextInputFormatter;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/error/failure_text.dart';
import '../../../shared/widgets/brand_loader.dart';
import '../../../l10n/app_localizations.dart';
import '../domain/kyc_case.dart';
import '../domain/kyc_requests.dart';
import '../domain/kyc_options.dart';
import '../domain/kyc_schema.dart';
import '../../../shared/widgets/keyboard_switch.dart';
import 'kyc_controller.dart';
import 'kyc_location.dart';
import 'kyc_labels.dart';

String _noticeText(AppLocalizations l, KycNotice n) => switch (n) {
      KycNotice.saved => l.kycSavedDraft,
      KycNotice.submitted => l.kycSubmittedOk,
      KycNotice.conflict => l.kycErrConflict,
      KycNotice.fileTooLarge => l.kycErrFileTooLarge,
      KycNotice.fileRejected => l.kycErrFileRejected,
      KycNotice.invalid => l.kycErrInvalid,
      KycNotice.unavailable => l.kycErrUnavailable,
      KycNotice.pickFailed => l.kycPickFailed,
      KycNotice.phoneFormat => l.kycErrPhoneFormat,
      KycNotice.duplicatePhone => l.kycProblemDupPhone,
      KycNotice.duplicateRelation => l.kycProblemDupRelation,
      KycNotice.locationDenied => l.kycLocDenied,
      KycNotice.locationServiceOff => l.kycLocServiceOff,
      KycNotice.locationFailed => l.kycLocFailed,
    };

/// Inline hint: while typing only a malformed phone number; once the user
/// pressed Next / Save ([all]) duplicates are named as well.
String? _issueText(AppLocalizations l, KycProblemKind? kind, {bool all = false}) =>
    switch (kind) {
      KycProblemKind.invalidPhone => l.kycErrPhoneFormat,
      KycProblemKind.duplicatePhone when all => l.kycProblemDupPhone,
      KycProblemKind.duplicateRelation when all => l.kycProblemDupRelation,
      _ => null,
    };

String _problemText(AppLocalizations l, KycProblem p) {
  String item() {
    if (p.field != null) return kycFieldLabel(l, p.field!);
    if (p.slot != null) return kycSlotLabel(l, p.slot!);
    return '';
  }

  return switch (p.kind) {
    KycProblemKind.missingField => l.kycProblemMissingField(item()),
    KycProblemKind.missingSlot => l.kycProblemMissingSlot(item()),
    KycProblemKind.invalidPhone => l.kycProblemInvalidPhone(item()),
    KycProblemKind.vehicleMaterial => l.kycProblemVehicle,
    KycProblemKind.contact3Incomplete => l.kycProblemContact3,
    KycProblemKind.supervisorIncomplete => l.kycProblemSupervisor,
    KycProblemKind.duplicateRelation => l.kycProblemDupRelation,
    KycProblemKind.duplicatePhone => l.kycProblemDupPhone,
    KycProblemKind.consentRequired => l.kycProblemConsent,
  };
}

String _statusTitle(AppLocalizations l, KycCaseStatus s) => switch (s) {
      KycCaseStatus.draft => l.kycStatusDraft,
      KycCaseStatus.submitted => l.kycStatusSubmitted,
      KycCaseStatus.needsInfo => l.kycStatusNeedsInfo,
      KycCaseStatus.approved => l.kycStatusApproved,
      KycCaseStatus.rejected => l.kycStatusRejected,
      KycCaseStatus.unknown => l.kycStatusUnknown,
    };

String? _statusBody(AppLocalizations l, KycCaseStatus s) => switch (s) {
      KycCaseStatus.submitted => l.kycStatusSubmittedBody,
      KycCaseStatus.needsInfo => l.kycStatusNeedsInfoBody,
      KycCaseStatus.approved => l.kycStatusApprovedBody,
      KycCaseStatus.rejected => l.kycStatusRejectedBody,
      _ => null,
    };

/// Shows each one-shot notice once.
void _listenNotices(WidgetRef ref, BuildContext context) {
  ref.listen<KycUiState>(kycControllerProvider, (prev, next) {
    final n = next.notice;
    if (n != null && n != prev?.notice) {
      final l = AppLocalizations.of(context);
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(_noticeText(l, n))));
      ref.read(kycControllerProvider.notifier).clearNotice();
    }
  });
}

// ---------------------------------------------------------------- overview

final class KycOverviewPage extends ConsumerStatefulWidget {
  const KycOverviewPage({super.key});

  @override
  ConsumerState<KycOverviewPage> createState() => _KycOverviewState();
}

class _KycOverviewState extends ConsumerState<KycOverviewPage> {
  bool _supplementOpened = false;
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(kycControllerProvider.notifier).load());
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    _listenNotices(ref, context);
    final s = ref.watch(kycControllerProvider);
    final ctl = ref.read(kycControllerProvider.notifier);

    final requests = s.serverCase?.activeRequests ?? const <KycRequest>[];
    if (!_supplementOpened && s.serverCase != null) {
      _supplementOpened = true;
      final section = requests.isEmpty ? null : requests.first.section;
      if (section != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) context.push('/kyc/${section.name}');
        });
      }
    }

    Widget body;
    if (s.phase == KycLoadPhase.loading && s.serverCase == null) {
      body = const Center(child: BrandLoader());
    } else if (s.phase == KycLoadPhase.error && s.serverCase == null) {
      body = Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                s.loadFailure == null ? l.errGeneric : describeFailure(l, s.loadFailure!),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              FilledButton(onPressed: ctl.load, child: Text(l.kycReload)),
            ],
          ),
        ),
      );
    } else {
      final problems = ctl.validate();
      bool sectionDone(KycSection sec) =>
          !problems.any((p) => p.section == sec);
      body = RefreshIndicator(
        onRefresh: ctl.load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
          children: [
            _StatusCard(state: s),
            for (final request in requests) _SupplementNotice(request: request),
            if (s.ruleMismatch) ...[
              const SizedBox(height: 12),
              _InfoCard(text: l.kycRuleMismatch, error: true),
            ],
            const SizedBox(height: 16),
            Builder(builder: (context) {
              final done = KycSection.values.where(sectionDone).length;
              final total = KycSection.values.length;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l.kycOverallProgress('$done', '$total'),
                    style: Theme.of(context).textTheme.labelLarge,
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(value: done / total, minHeight: 8),
                  ),
                  const SizedBox(height: 16),
                ],
              );
            }),
            for (final sec in KycSection.values)
              Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  minVerticalPadding: 12,
                  leading: Icon(
                    sectionDone(sec) ? Icons.check_circle : Icons.radio_button_unchecked,
                    color: sectionDone(sec) ? Colors.green : null,
                  ),
                  title: Text(kycSectionLabel(l, sec.name)),
                  subtitle: Text(requests.any((r) => r.section == sec)
                      ? l.kycNeedsSupplement : sectionDone(sec) ? l.kycSectionDone : l.kycSectionTodo),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/kyc/${sec.name}'),
                ),
              ),
            if (s.problems.isNotEmpty) ...[
              const SizedBox(height: 4),
              Card(
                color: Theme.of(context).colorScheme.errorContainer,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final p in s.problems.take(6))
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 2),
                          child: InkWell(
                            onTap: () => context.push('/kyc/${p.section.name}'),
                            child: Text('• ${_problemText(l, p)}'),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: 12),
            Text(l.kycScopeNote, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 16),
            if (s.editable)
              FilledButton(
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                onPressed: (s.busy || s.ruleMismatch)
                    ? null
                    : () async {
                        final ok = await ctl.submit();
                        if (ok && context.mounted) context.pop();
                      },
                child: s.busy
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(l.kycSubmit),
              )
            else
              Text(l.kycLockedNote, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(title: Text(l.kycTitle)),
      body: SafeArea(child: body),
    );
  }
}

final class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.state});
  final KycUiState state;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final status = state.status;
    final body = _statusBody(l, status);
    final reason = state.serverCase?.reviewReason;
    final color = switch (status) {
      KycCaseStatus.approved => Colors.green,
      KycCaseStatus.rejected => Theme.of(context).colorScheme.error,
      KycCaseStatus.needsInfo => Colors.orange,
      _ => Theme.of(context).colorScheme.primary,
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _statusTitle(l, status),
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700, color: color),
            ),
            if (body != null) ...[
              const SizedBox(height: 6),
              Text(body),
            ],
            if (reason != null &&
                (status == KycCaseStatus.needsInfo || status == KycCaseStatus.rejected)) ...[
              const SizedBox(height: 12),
              Text(l.kycReviewerNote, style: Theme.of(context).textTheme.labelMedium),
              const SizedBox(height: 4),
              // The reviewer writes this note; it is shown as written.
              Text(reason),
            ],
          ],
        ),
      ),
    );
  }
}

final class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.text, this.error = false});
  final String text;
  final bool error;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: error ? Theme.of(context).colorScheme.errorContainer : null,
      child: Padding(padding: const EdgeInsets.all(12), child: Text(text)),
    );
  }
}

// ----------------------------------------------------------------- section

final class KycSectionPage extends ConsumerStatefulWidget {
  const KycSectionPage({super.key, required this.sectionId});
  final String sectionId;

  @override
  ConsumerState<KycSectionPage> createState() => _KycSectionState();
}

class _KycSectionState extends ConsumerState<KycSectionPage> {
  final _requestedKey = GlobalKey();
  int _step = 0;
  bool _stepInit = false;
  bool _showErrors = false;

  KycSection? get _section {
    for (final s in KycSection.values) {
      if (s.name == widget.sectionId) return s;
    }
    return null;
  }

  @override
  void initState() {
    super.initState();
    // Deep entry (e.g. from the home screen) must still have data.
    Future.microtask(() {
      final s = ref.read(kycControllerProvider);
      if (s.serverCase == null) ref.read(kycControllerProvider.notifier).load();
    });
  }

  bool _stepIncomplete(KycStep step, KycUiState s) {
    for (final id in step.fieldIds) {
      final f = kycFieldById(id)!;
      if (f.required && (s.values[id] ?? '').trim().isEmpty) return true;
    }
    for (final id in step.slotIds) {
      if (kycSlotRequired(id, s.values) && !s.files.containsKey(id)) return true;
    }
    return false;
  }

  /// A step may be left when its required inputs are filled and nothing in it
  /// is malformed or duplicated.
  bool _stepOk(KycStep step, KycUiState s) {
    for (final id in step.fieldIds) {
      final f = kycFieldById(id)!;
      if (f.required && (s.values[id] ?? '').trim().isEmpty) return false;
      if (kycFieldIssue(s.values, id) != null) return false;
    }
    return true;
  }

  Future<void> _next(List<KycStep> steps) async {
    final s = ref.read(kycControllerProvider);
    final ctl = ref.read(kycControllerProvider.notifier);
    if (s.editable && !_stepOk(steps[_step], s)) {
      setState(() => _showErrors = true);
      return;
    }
    if (_step >= steps.length - 1) {
      if (!s.editable) {
        context.pop();
        return;
      }
      final ok = await ctl.saveDraft();
      if (ok && mounted) context.pop();
      return;
    }
    if (s.editable) await ctl.saveDraft(announce: false);
    if (!mounted) return;
    setState(() {
      _step++;
      _showErrors = false;
    });
  }

  void _back() {
    if (_step == 0) return;
    setState(() {
      _step--;
      _showErrors = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    _listenNotices(ref, context);
    final section = _section;
    final s = ref.watch(kycControllerProvider);
    final ctl = ref.read(kycControllerProvider.notifier);
    final options = ref.watch(kycOptionsProvider);
    if (section == null) {
      return Scaffold(appBar: AppBar(), body: Center(child: Text(l.errGeneric)));
    }

    final steps = kycStepsOf(section, s.values);
    final requests = (s.serverCase?.activeRequests ?? const <KycRequest>[])
        .where((r) => r.section == section).toList(growable: false);
    if (!_stepInit && s.serverCase != null) {
      // Resume at the first step that still needs something.
      _stepInit = true;
      final requested = requests.isEmpty ? -1 : steps.indexWhere(requests.first.matchesStep);
      final i = requested >= 0 ? requested : steps.indexWhere((st) => _stepIncomplete(st, s));
      _step = i < 0 ? 0 : i;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final target = _requestedKey.currentContext;
        if (mounted && target != null) Scrollable.ensureVisible(target, alignment: 0.2);
      });
    }
    if (_step >= steps.length) _step = steps.length - 1;
    final step = steps[_step];
    final isLast = _step == steps.length - 1;

    final children = <Widget>[];
    for (final request in requests.where((r) => r.target.startsWith('section:') || !r.matchesStep(step))) {
      children.add(_SupplementNotice(request: request));
    }
    if (s.serverCase == null) {
      children.add(const Padding(
        padding: EdgeInsets.all(32),
        child: Center(child: BrandLoader()),
      ));
    } else if (section == KycSection.consent) {
      children.addAll(_consent(context, l, s, ctl));
    } else {
      final opts = options.asData?.value;
      if (opts == null) {
        children.add(const Padding(
          padding: EdgeInsets.all(32),
          child: Center(child: BrandLoader()),
        ));
      } else {
        if (section == KycSection.contacts && step.fieldIds.contains('contact3Name')) {
          children.add(Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(l.kycContactOptional, style: Theme.of(context).textTheme.bodySmall),
          ));
        }
        for (final id in step.fieldIds) {
          for (final request in requests.where((r) => r.target == 'field:$id')) {
            children.add(_SupplementNotice(key: request == requests.first ? _requestedKey : null, request: request));
          }
          children.add(Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: _FieldWidget(
              field: kycFieldById(id)!,
              state: s,
              controller: ctl,
              options: opts,
              showErrors: _showErrors,
            ),
          ));
          if (id == 'address' && s.editable) {
            children.add(Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: s.locating
                    ? null
                    : () => ctl.fillAddressFromLocation(
                          Localizations.localeOf(context).languageCode,
                        ),
                icon: const Icon(Icons.my_location, size: 18),
                label: Text(s.locating ? l.kycLocating : l.kycUseLocation),
              ),
            ));
            if (s.locating) {
              children.add(Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2.5),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            s.locationStage == KycLocationStage.position
                                ? l.kycLocStagePosition
                                : l.kycLocStageAddress,
                            style: Theme.of(context).textTheme.labelLarge,
                          ),
                          Text(l.kycLocWait, style: Theme.of(context).textTheme.bodySmall),
                        ],
                      ),
                    ),
                  ],
                ),
              ));
            } else {
              children.add(Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(l.kycLocHint, style: Theme.of(context).textTheme.bodySmall),
              ));
            }
          }
        }
        if (step.slotIds.isNotEmpty) {
          if (section == KycSection.employment && kycHasVehicle(s.values)) {
            children.add(Text(l.kycVehicleMaterialHint,
                style: Theme.of(context).textTheme.bodySmall));
            children.add(const SizedBox(height: 8));
          }
          for (final id in step.slotIds) {
            for (final request in requests.where((r) => r.target == 'slot:$id')) {
              children.add(_SupplementNotice(key: request == requests.first ? _requestedKey : null, request: request));
            }
            final slot = kKycSlots.firstWhere((x) => x.id == id);
            children.add(_SlotTile(slot: slot, state: s, controller: ctl));
          }
        }
      }
    }

    final theme = Theme.of(context);
    return PopScope(
      canPop: _step == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          _back();
          return;
        }
        // Leaving a section keeps what was typed.
        if (s.editable && !s.busy) unawaited(ctl.saveDraft(announce: false));
      },
      child: Scaffold(
        appBar: AppBar(title: Text(kycSectionLabel(l, section.name))),
        body: SafeArea(
          child: Column(
            children: [
              if (steps.length > 1)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l.kycStepProgress('${_step + 1}', '${steps.length}'),
                        style: theme.textTheme.labelLarge
                            ?.copyWith(color: theme.colorScheme.primary),
                      ),
                      const SizedBox(height: 8),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: TweenAnimationBuilder<double>(
                          tween: Tween(end: (_step + 1) / steps.length),
                          duration: const Duration(milliseconds: 250),
                          builder: (_, v, __) => LinearProgressIndicator(
                            value: v,
                            minHeight: 6,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              Expanded(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 200),
                  child: ListView(
                    key: ValueKey('$section-$_step'),
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                    children: [
                      ...children,
                      if (s.serverCase != null && !s.editable)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(l.kycLockedNote, style: theme.textTheme.bodySmall),
                        ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
                child: Row(
                  children: [
                    if (_step > 0) ...[
                      Expanded(
                        child: OutlinedButton(
                          onPressed: s.busy ? null : _back,
                          child: Text(l.kycBack),
                        ),
                      ),
                      const SizedBox(width: 12),
                    ],
                    Expanded(
                      flex: 2,
                      child: FilledButton(
                        onPressed:
                            (s.busy || s.locating || s.serverCase == null) ? null : () => _next(steps),
                        child: s.busy
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Text(isLast ? (s.editable ? l.kycSaveDraft : l.kycBack) : l.kycNext),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _consent(
    BuildContext context,
    AppLocalizations l,
    KycUiState s,
    KycController ctl,
  ) {
    return [
      Text(l.kycConsentTitle, style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 8),
      Text(l.kycConsentBody),
      const SizedBox(height: 8),
      Text(l.kycConsentNotice, style: Theme.of(context).textTheme.bodySmall),
      const SizedBox(height: 8),
      CheckboxListTile(
        contentPadding: EdgeInsets.zero,
        controlAffinity: ListTileControlAffinity.leading,
        value: s.consent,
        onChanged: s.editable ? (v) => ctl.setConsent(v ?? false) : null,
        title: Text(l.kycConsentCheckbox),
      ),
    ];
  }
}

final class _FieldWidget extends StatelessWidget {
  const _FieldWidget({
    required this.field,
    required this.state,
    required this.controller,
    required this.options,
    this.showErrors = false,
  });

  final bool showErrors;
  final KycField field;
  final KycUiState state;
  final KycController controller;
  final KycOptions options;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final label = kycFieldLabel(l, field.id) + (field.required ? ' *' : '');
    final revision = state.serverCase?.revision ?? 0;
    final enabled = state.editable;
    final current = state.values[field.id];
    final issue = _issueText(l, kycFieldIssue(state.values, field.id), all: showErrors);
    final String? err = issue ??
        (showErrors && field.required && (current ?? '').trim().isEmpty
            ? l.kycFieldRequired
            : null);

    switch (field.kind) {
      case KycFieldKind.phone:
        return _PhoneField(
          key: ValueKey('${field.id}-$revision'),
          initial: current ?? '',
          label: label,
          enabled: enabled,
          errorText: err,
          onChanged: (v) => controller.setValue(field.id, v),
        );
      case KycFieldKind.text:
        return TextFormField(
          key: ValueKey('${field.id}-$revision-${state.addressEpoch}'),
          initialValue: current ?? '',
          enabled: enabled,
          keyboardType: TextInputType.text,
          textCapitalization:
              field.isPersonName ? TextCapitalization.characters : TextCapitalization.none,
          autocorrect: false,
          enableSuggestions: false,
          inputFormatters: [LengthLimitingTextInputFormatter(240)],
          decoration: InputDecoration(labelText: label, errorText: err),
          onChanged: (v) => controller.setValue(field.id, v),
        );
      case KycFieldKind.select:
      case KycFieldKind.province:
      case KycFieldKind.district:
        List<KycOption> list = switch (field.kind) {
          KycFieldKind.province => options.provinces(),
          KycFieldKind.district => options.districtsOf(state.values['province']),
          _ => options.optionsFor(field.options),
        };

        // Each emergency-contact relationship can be used once: hide the ones
        // another contact already took (the contact's own choice stays).
        final relMatch = RegExp(r'^contact([123])Relation$').firstMatch(field.id);
        if (relMatch != null) {
          final taken = <String>{
            for (final n in const ['1', '2', '3'])
              if (n != relMatch.group(1) &&
                  (state.values['contact${n}Relation'] ?? '').isNotEmpty)
                state.values['contact${n}Relation']!,
          };
          list = list.where((o) => o.value == current || !taken.contains(o.value)).toList();
        }
        final value = list.any((o) => o.value == current) ? current : null;
        return DropdownButtonFormField<String>(
          key: ValueKey('${field.id}-$revision-${state.values['province']}-$value'),
          initialValue: value,
          isExpanded: true,
          decoration: InputDecoration(
            labelText: label,
            errorText: err,
            errorMaxLines: 3,
          ),
          hint: Text(l.kycSelectPlaceholder),
          items: [
            for (final o in list)
              DropdownMenuItem(
                value: o.value,
                child: Text(
                  kycSourceIsFixed(field.options)
                      ? kycFixedValueLabel(l, o.value)
                      : o.labelFor(lang),
                  overflow: TextOverflow.ellipsis,
                  maxLines: 2,
                ),
              ),
          ],
          // Opening a menu must not bring the keyboard back for the text field
          // that had focus before.
          onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
          onChanged:
              enabled ? (v) => controller.setValue(field.id, v ?? '') : null,
        );
    }
  }
}

final class _SupplementNotice extends StatelessWidget {
  const _SupplementNotice({super.key, required this.request});
  final KycRequest request;
  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text(
      '${l.kycNeedsSupplement} · ${kycRequestReason(l, request.reasonCode)}${request.note.isEmpty ? '' : '\n${request.note}'}',
      style: TextStyle(color: Theme.of(context).colorScheme.error),
    ));
  }
}

final class _SlotTile extends StatelessWidget {
  const _SlotTile({required this.slot, required this.state, required this.controller});

  final KycSlot slot;
  final KycUiState state;
  final KycController controller;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final uploaded = state.files.containsKey(slot.id);
    final uploading = state.uploading.contains(slot.id);
    final required = kycSlotRequired(slot.id, state.values);
    final enabled = state.editable && !uploading;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    kycSlotLabel(l, slot.id),
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                Text(
                  required ? l.kycRequired : l.kycOptional,
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (uploading)
              Row(children: [
                const SizedBox(
                    height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                const SizedBox(width: 8),
                Expanded(child: Text(state.retrying.contains(slot.id) ? l.kycUploadRetrying : l.kycUploading)),
                TextButton(onPressed: () => controller.cancelUpload(slot.id), child: Text(l.kycUploadCancel)),
              ])
            else if (uploaded)
              Row(children: [
                const Icon(Icons.check_circle, color: Colors.green, size: 18),
                const SizedBox(width: 8),
                Text(l.kycUploaded),
              ]),
            if (state.uploadFailures[slot.id] != null)
              Text(describeFailure(l, state.uploadFailures[slot.id]!), style: TextStyle(color: Theme.of(context).colorScheme.error)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton.icon(
                  icon: const Icon(Icons.photo_camera_outlined),
                  label: Text(uploaded ? l.kycReplace : l.kycTakePhoto),
                  onPressed: enabled
                      ? () => controller.uploadSlot(slot.id, camera: true)
                      : null,
                ),
                OutlinedButton.icon(
                  icon: const Icon(Icons.photo_library_outlined),
                  label: Text(l.kycChooseGallery),
                  onPressed: enabled
                      ? () => controller.uploadSlot(slot.id, camera: false)
                      : null,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Keeps only characters a phone number can contain (digits, `+`, space,
/// `()-`), converts full-width forms typed with CJK input methods to ASCII and
/// limits the length. The server still validates the final international form.
final class KycPhoneInputFormatter extends TextInputFormatter {
  const KycPhoneInputFormatter();

  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final out = StringBuffer();
    for (final unit in newValue.text.runes) {
      var c = unit;
      // Full-width ASCII block (U+FF01..U+FF5E) -> ASCII.
      if (c >= 0xFF01 && c <= 0xFF5E) c = c - 0xFEE0;
      final ch = String.fromCharCode(c);
      if (RegExp(r'[0-9+() -]').hasMatch(ch)) out.write(ch);
    }
    var text = out.toString();
    if (text.length > 20) text = text.substring(0, 20);
    if (text == newValue.text) return newValue;
    final offset = newValue.selection.baseOffset.clamp(0, text.length);
    return TextEditingValue(text: text, selection: TextSelection.collapsed(offset: offset));
  }
}

/// Phone input: a number keypad by default (best on a phone), with a button to
/// switch to the full keyboard. Android's number keypad does not accept some
/// hardware keyboards and CJK input methods (and some emulators do not draw
/// it), so the full keyboard stays one tap away. The choice is remembered for
/// all phone fields and across app restarts. The formatter keeps only what a
/// phone number can contain.
class _PhoneField extends ConsumerWidget {
  const _PhoneField({
    super.key,
    required this.initial,
    required this.label,
    required this.enabled,
    required this.onChanged,
    this.errorText,
  });

  final String initial;
  final String label;
  final bool enabled;
  final String? errorText;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AppLocalizations.of(context);
    final full = ref.watch(fullKeyboardProvider);
    return TextFormField(
      initialValue: initial,
      enabled: enabled,
      keyboardType: full ? TextInputType.text : TextInputType.phone,
      autofillHints: const [AutofillHints.telephoneNumber],
      autocorrect: false,
      enableSuggestions: false,
      inputFormatters: const [KycPhoneInputFormatter()],
      decoration: InputDecoration(
        labelText: label,
        errorText: errorText,
        errorMaxLines: 3,
        suffixIcon: IconButton(
          tooltip: l.kycSwitchKeyboard,
          icon: Icon(full ? Icons.dialpad : Icons.keyboard_alt_outlined),
          onPressed: enabled
              ? () => ref.read(fullKeyboardProvider.notifier).toggle()
              : null,
        ),
      ),
      onChanged: onChanged,
    );
  }
}
