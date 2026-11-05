import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../app/bootstrap/providers.dart';
import '../../../app/router/deep_link_handler.dart';
import '../../../core/error/failure.dart';
import '../../../core/session/company_id.dart';
import '../../../core/util/either.dart';
import '../../../shared/widgets/brand_loader.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/domain/auth_gate_state.dart';
import '../domain/company_link_parser.dart';
import '../domain/company_resolver.dart';

enum ScannerUiState {
  idle,
  permissionDenied,
  permissionPermanentlyDenied,
  error,
  detected,
}

Map<String, String> _tryQuery(BuildContext context) {
  try {
    final state = GoRouterState.of(context);
    return state.uri.queryParameters;
  } on Object catch (_) {
    return const {};
  }
}

final class CompanySelectPage extends ConsumerStatefulWidget {
  const CompanySelectPage({super.key});
  @override
  ConsumerState<CompanySelectPage> createState() => _CompanySelectState();
}

class _CompanySelectState extends ConsumerState<CompanySelectPage> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      final deep = ref.read(pendingDeepLinkCompanyProvider);
      if (deep != null) {
        ref.read(pendingCandidateCompanyProvider.notifier).set(deep);
        ref.read(pendingDeepLinkCompanyProvider.notifier).set(null);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          context.go('/company/candidate-confirm');
        });
      }
    });
  }

  CompanyUnresolvedReason _parseReason(String? raw) {
    if (raw == null || raw.isEmpty) return CompanyUnresolvedReason.noCandidate;
    for (final v in CompanyUnresolvedReason.values) {
      if (v.name == raw) return v;
    }
    return CompanyUnresolvedReason.noCandidate;
  }

  Future<void> _activateAndRoute(CompanyId id) async {
    final repo = ref.read(authRepositoryProvider);
    final pf = await repo.preflight(id);
    if (!mounted) return;
    final AppFailure? leftFail = pf is Left<AppFailure, AuthGateState> ? pf.value : null;
    final AuthGateState? rightState = pf is Right<AppFailure, AuthGateState> ? pf.value : null;
    if (leftFail is ForbiddenFailure) {
      ref.read(pendingCandidateCompanyProvider.notifier).set(id);
      context.go('/company/candidate-confirm');
      return;
    }
    await ref.read(activeCompanyIdProvider.notifier).activate(id);
    ref.read(pendingCandidateCompanyProvider.notifier).set(null);
    ref.read(pendingDeepLinkCompanyProvider.notifier).set(null);
    if (!mounted) return;
    final snap = repo.snapshotFor(id);
    final pending = snap?.pending;
    final chalId = pending is Map
        ? (pending as Map)['challengeId']?.toString()
        : null;
    final expiresAtMs = pending is Map ? (pending as Map)['expiresAt'] : null;
    final retryAtMs = pending is Map ? (pending as Map)['retryAt'] : null;
    final phoneMasked = pending is Map
        ? (pending as Map)['phoneMasked']?.toString() ?? ''
        : '';
    final authState = rightState ?? const AuthGateUnknown();
    if (authState.isAuthenticated || snap?.authenticated == true) {
      final accountId = authState is AuthGateAuthenticated ? authState.accountId : '';
      ref.read(authGateStateProvider.notifier).markAuthenticated(accountId);
      if (snap?.needsPassword == true) {
        context.go('/auth/set-password');
      } else {
        final ri = ref.read(returnIntentProvider);
        if (ri != null && ri.isSafe) {
          ref.read(returnIntentProvider.notifier).clear();
          context.go(ri.location);
        } else {
          context.go('/home');
        }
      }
      return;
    }
    if (authState.isRegistrationIncomplete ||
        snap?.needsPassword == true) {
      ref.read(authGateStateProvider.notifier).markIncomplete();
      context.go('/auth/set-password');
      return;
    }
    if (chalId != null && chalId.isNotEmpty) {
      final exp = expiresAtMs is int
          ? DateTime.fromMillisecondsSinceEpoch(expiresAtMs)
          : DateTime.now().add(const Duration(minutes: 5));
      final retry = retryAtMs is int
          ? DateTime.fromMillisecondsSinceEpoch(retryAtMs)
          : DateTime.now().add(const Duration(seconds: 60));
      final otp = OtpSendResponse(
        challengeId: chalId,
        phoneMasked: phoneMasked,
        expiresAt: exp,
        retryAt: retry,
      );
      ref.read(pendingOtpChallengeProvider.notifier).set(otp);
      context.go('/auth/phone-code');
      return;
    }
    context.go('/auth/login');
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final known = ref.watch(knownCompaniesProvider);
    final active = ref.watch(activeCompanyIdProvider);
    final query = _tryQuery(context);
    final reason = _parseReason(query['reason']);
    final hint = query['hint'];
    final isSwitch = active != null;
    final title = isSwitch ? l.companyRecoverySwitchTitle : l.companyRecoveryTitle;

    String body;
    switch (reason) {
      case CompanyUnresolvedReason.persistedCompanyUnavailable:
        body = l.companyRecoveryPersistedUnavailable;
      case CompanyUnresolvedReason.appLinkParseFailed:
      case CompanyUnresolvedReason.appLinkCompanyUnavailable:
        body = l.companyRecoveryLinkInvalid;
      case CompanyUnresolvedReason.defaultCompanyParseFailed:
      case CompanyUnresolvedReason.defaultCompanyUnavailable:
        body = l.companyRecoveryDefaultUnavailable;
      case CompanyUnresolvedReason.noCandidate:
      case CompanyUnresolvedReason.startupNetworkError:
        body = l.companyRecoveryBody;
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        automaticallyImplyLeading: false,
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(body),
                  if (hint != null && hint.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      l.companyRecoveryHint,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                    ),
                    onPressed: () => context.push('/company/paste-link'),
                    icon: const Icon(Icons.paste),
                    label: Text(l.companyRecoveryPasteCta),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                    ),
                    onPressed: () => context.push('/company/scan'),
                    icon: const Icon(Icons.qr_code_scanner),
                    label: Text(l.companyRecoveryScanCta),
                  ),
                  if (known.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    const Divider(),
                    const SizedBox(height: 12),
                    Text(
                      l.companyRecoveryRecentSection,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    for (final c in known.take(5))
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: OutlinedButton(
                          onPressed: () async {
                            if (active == null) {
                              unawaited(_activateAndRoute(c));
                            } else if (active.raw != c.raw) {
                              ref
                                  .read(pendingCandidateCompanyProvider.notifier)
                                  .set(c);
                              context.go('/company/candidate-confirm');
                            }
                          },
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size.fromHeight(48),
                            alignment: Alignment.centerLeft,
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.apartment),
                              const SizedBox(width: 12),
                              Expanded(child: Text(c.raw)),
                              if (active?.raw == c.raw)
                                const Icon(Icons.check, color: Colors.green),
                            ],
                          ),
                        ),
                      ),
                  ],
                  if (active != null) ...[
                    const SizedBox(height: 24),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton(
                        onPressed: () => context.go('/auth/login'),
                        child: Text(l.companyRecoveryGoLogin),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

final class CompanyCandidateConfirmationPage extends ConsumerStatefulWidget {
  const CompanyCandidateConfirmationPage({super.key});
  @override
  ConsumerState<CompanyCandidateConfirmationPage> createState() =>
      _CandidateState();
}

class _CandidateState extends ConsumerState<CompanyCandidateConfirmationPage> {
  bool loading = true;
  String? error;
  String? companyName;
  bool disabled = false;
  bool notFound = false;

  @override
  void initState() {
    super.initState();
    Future.microtask(_preflightCandidate);
  }

  Future<void> _preflightCandidate() async {
    final cand = ref.read(pendingCandidateCompanyProvider);
    if (cand == null) {
      setState(() {
        loading = false;
        error = 'No company selected';
      });
      return;
    }
    final repo = ref.read(authRepositoryProvider);
    final r = await repo.preflight(cand);
    if (!mounted) return;
    r.when(
      left: (f) {
        setState(() {
          loading = false;
          error = f.messageKey;
          if (f is ForbiddenFailure) {
            notFound = true;
          }
          disabled = true;
        });
      },
      right: (_) {
        final snap = repo.snapshotFor(cand);
        setState(() {
          loading = false;
          companyName = snap?.company;
          disabled = false;
        });
      },
    );
  }

  Future<void> _confirmAndRoute(CompanyId cand) async {
    final repo = ref.read(authRepositoryProvider);
    await ref.read(activeCompanyIdProvider.notifier).activate(cand);
    ref.read(pendingCandidateCompanyProvider.notifier).set(null);
    ref.read(pendingDeepLinkCompanyProvider.notifier).set(null);
    if (!mounted) return;
    final snap = repo.snapshotFor(cand);
    final pending = snap?.pending;
    final chalId = pending is Map
        ? (pending as Map)['challengeId']?.toString()
        : null;
    final expiresAtMs = pending is Map ? (pending as Map)['expiresAt'] : null;
    final retryAtMs = pending is Map ? (pending as Map)['retryAt'] : null;
    final phoneMasked = pending is Map
        ? (pending as Map)['phoneMasked']?.toString() ?? ''
        : '';
    if (snap?.authenticated == true) {
      ref.read(authGateStateProvider.notifier).markAuthenticated('');
      if (snap?.needsPassword == true) {
        context.go('/auth/set-password');
      } else {
        final ri = ref.read(returnIntentProvider);
        if (ri != null && ri.isSafe) {
          ref.read(returnIntentProvider.notifier).clear();
          context.go(ri.location);
        } else {
          context.go('/home');
        }
      }
      return;
    }
    if (snap?.needsPassword == true) {
      ref.read(authGateStateProvider.notifier).markIncomplete();
      context.go('/auth/set-password');
      return;
    }
    if (chalId != null && chalId.isNotEmpty) {
      final exp = expiresAtMs is int
          ? DateTime.fromMillisecondsSinceEpoch(expiresAtMs)
          : DateTime.now().add(const Duration(minutes: 5));
      final retry = retryAtMs is int
          ? DateTime.fromMillisecondsSinceEpoch(retryAtMs)
          : DateTime.now().add(const Duration(seconds: 60));
      final otp = OtpSendResponse(
        challengeId: chalId,
        phoneMasked: phoneMasked,
        expiresAt: exp,
        retryAt: retry,
      );
      ref.read(pendingOtpChallengeProvider.notifier).set(otp);
      context.go('/auth/phone-code');
      return;
    }
    context.go('/auth/login');
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cand = ref.watch(pendingCandidateCompanyProvider);
    return Scaffold(
      appBar: AppBar(title: Text(companyName ?? cand?.raw ?? l.commonConfirm)),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
            Text(l.companyRecoveryHint),
            const SizedBox(height: 20),
            if (loading) const LinearProgressIndicator(),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      companyName ?? 'Company',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      cand?.raw ?? '-',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    if (notFound) ...[
                      const SizedBox(height: 12),
                      Text(
                        l.companyRecoveryLinkInvalid,
                        style: TextStyle(color: Theme.of(context).colorScheme.error),
                      ),
                    ],
                    if (error != null && !notFound) ...[
                      const SizedBox(height: 12),
                      Text(
                        error!,
                        style: TextStyle(color: Theme.of(context).colorScheme.error),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            FilledButton(
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
              ),
              onPressed:
                  cand == null || loading || disabled
                      ? null
                      : () async {
                        setState(() => disabled = true);
                        await _confirmAndRoute(cand);
                      },
              child: Text(l.commonConfirm),
            ),
            TextButton(
              onPressed: () {
                ref.read(pendingCandidateCompanyProvider.notifier).set(null);
                ref.read(pendingDeepLinkCompanyProvider.notifier).set(null);
                context.go('/company/select');
              },
              child: Text(l.commonCancel),
            ),
          ],
        ),
      ),
    ),
    );
  }
}

final class CompanyPasteLinkPage extends ConsumerStatefulWidget {
  const CompanyPasteLinkPage({super.key});
  @override
  ConsumerState<CompanyPasteLinkPage> createState() => _PasteState();
}

class _PasteState extends ConsumerState<CompanyPasteLinkPage> {
  final c = TextEditingController();
  String? error;

  Future<void> _paste() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    if (data?.text != null && mounted) {
      setState(() => c.text = data!.text!);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Scaffold(
    appBar: AppBar(title: Text(l.companyRecoveryPasteCta)),
    body: Padding(
      padding: const EdgeInsets.all(20),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
          OutlinedButton.icon(
            onPressed: _paste,
            icon: const Icon(Icons.paste),
            label: const Text('Paste from clipboard'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: c,
            minLines: 2,
            maxLines: 6,
            decoration: const InputDecoration(
              labelText: 'Link',
              hintText: 'https://khmerx.org/app?c=t_<uuid>',
            ),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
          const SizedBox(height: 16),
          FilledButton(
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
            ),
            onPressed: () {
              final raw = c.text.trim();
              final id =
                  CompanyId.tryParse(raw) ??
                  CompanyLinkParser.parseCompanyId(
                    Uri.tryParse(raw) ?? Uri(),
                  );
              if (id == null) {
                setState(() => error = l.companyRecoveryLinkInvalid);
                return;
              }
              setState(() => error = null);
              ref.read(pendingCandidateCompanyProvider.notifier).set(id);
              context.go('/company/candidate-confirm');
            },
            child: Text(l.commonConfirm),
          ),
        ],
      ),
    ),
  ),
  );
  }
}

final class CompanyScanPage extends ConsumerStatefulWidget {
  const CompanyScanPage({super.key});
  @override
  ConsumerState<CompanyScanPage> createState() => _ScanState();
}

class _ScanState extends ConsumerState<CompanyScanPage> {
  ScannerUiState state = ScannerUiState.idle;
  String? errorText;
  final MobileScannerController controller = MobileScannerController(
    autoStart: false,
  );
  int? lastPerm;
  static const String _pasteFallbackLabel = 'Paste link instead';

  @override
  void initState() {
    super.initState();
    Future.microtask(_start);
  }

  Future<void> _start() async {
    if (!mounted) return;
    setState(() {
      state = ScannerUiState.idle;
      errorText = null;
    });
    try {
      await controller.start();
    } on MobileScannerException catch (e) {
      if (!mounted) return;
      if (e.errorCode.name == 'cameraPermission' ||
          e.errorCode == MobileScannerErrorCode.permissionDenied ||
          e.errorCode.name.contains('permission')) {
        if (lastPerm != null && lastPerm! > 1) {
          setState(() {
            state = ScannerUiState.permissionPermanentlyDenied;
            errorText =
                'Camera permission is disabled. Enable it in App Settings, or paste a link instead.';
          });
        } else {
          setState(() {
            state = ScannerUiState.permissionDenied;
            errorText =
                'Camera permission is required to scan QR codes. Tap Request permission.';
          });
        }
        lastPerm = (lastPerm ?? 0) + 1;
      } else {
        setState(() {
          state = ScannerUiState.error;
          errorText =
              e.errorDetails?.message?.toString() ?? 'Scanner error occurred.';
        });
      }
    } on Object catch (e) {
      if (!mounted) return;
      setState(() {
        state = ScannerUiState.error;
        errorText = e.toString();
      });
    }
  }

  @override
  void dispose() {
    unawaited(controller.dispose());
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (state == ScannerUiState.detected) return;
    final raw = capture.barcodes.firstOrNull?.rawValue;
    final id = CompanyLinkParser.parseCompanyId(
      Uri.tryParse(raw ?? '') ?? Uri(),
    );
    final l = AppLocalizations.of(context);
    if (id == null) {
      setState(() {
        state = ScannerUiState.error;
        errorText = l.companyRecoveryLinkInvalid;
      });
      return;
    }
    setState(() => state = ScannerUiState.detected);
    ref.read(pendingCandidateCompanyProvider.notifier).set(id);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.go('/company/candidate-confirm');
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l.companyRecoveryScanCta)),
      body: Column(
        children: [
          Expanded(
            child: switch (state) {
              ScannerUiState.permissionDenied => _PermissionSheet(
                title: 'Camera permission required',
                message:
                    errorText ??
                    'Camera permission is required to scan QR codes.',
                primary: 'Request permission',
                onPrimary: _start,
                fallback: l.companyRecoveryPasteCta,
                onFallback: () => context.push('/company/paste-link'),
              ),
              ScannerUiState.permissionPermanentlyDenied => _PermissionSheet(
                title: 'Camera permission disabled',
                message:
                    errorText ??
                    'Open Settings and grant camera permission to KhmerX, or paste the company link instead.',
                primary: l.companyRecoveryPasteCta,
                onPrimary: () => context.push('/company/paste-link'),
                fallback: _pasteFallbackLabel,
                onFallback: () => context.push('/company/paste-link'),
              ),
              ScannerUiState.error => _PermissionSheet(
                title: 'Cannot scan',
                message:
                    errorText ?? l.companyRecoveryLinkInvalid,
                primary: 'Scan again',
                onPrimary: _start,
                fallback: l.companyRecoveryPasteCta,
                onFallback: () => context.push('/company/paste-link'),
              ),
              ScannerUiState.detected => const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      BrandLoader(),
                      SizedBox(height: 16),
                      Text('Opening company…'),
                    ],
                  ),
                ),
              ),
              ScannerUiState.idle => MobileScanner(
                controller: controller,
                errorBuilder: (context, err) {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (!mounted) return;
                    if (state != ScannerUiState.error &&
                        state != ScannerUiState.detected) {
                      setState(() {
                        state = ScannerUiState.error;
                        errorText =
                            err.errorDetails?.message?.toString() ??
                                'Scanner error occurred.';
                      });
                    }
                  });
                  return _PermissionSheet(
                    title: 'Scanner error',
                    message:
                        err.errorDetails?.message?.toString() ??
                            'Scanner error occurred.',
                    primary: l.companyRecoveryPasteCta,
                    onPrimary: () => context.push('/company/paste-link'),
                    fallback: 'Try again',
                    onFallback: _start,
                  );
                },
                onDetect: _onDetect,
              ),
            },
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                ),
                onPressed: () => context.push('/company/paste-link'),
                icon: const Icon(Icons.paste),
                label: Text(l.companyRecoveryPasteCta),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

final class _PermissionSheet extends StatelessWidget {
  const _PermissionSheet({
    required this.title,
    required this.message,
    required this.primary,
    required this.onPrimary,
    required this.fallback,
    required this.onFallback,
  });
  final String title;
  final String message;
  final String primary;
  final VoidCallback onPrimary;
  final String fallback;
  final VoidCallback onFallback;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Icon(Icons.error_outline, size: 56, color: Colors.orange),
          const SizedBox(height: 16),
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text(message),
          const Spacer(),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            onPressed: onPrimary,
            child: Text(primary),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            onPressed: onFallback,
            child: Text(fallback),
          ),
        ],
      ),
    );
  }
}
