// ignore_for_file: curly_braces_in_flow_control_structures
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/bootstrap/providers.dart';
import '../../../core/error/failure.dart';
import '../../../core/error/failure_text.dart';
import '../../../core/session/company_id.dart';
import '../domain/auth_gate_state.dart';
import '../domain/password_rules.dart';
import '../../../core/util/either.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/utils/regexp.dart';
import '../../../shared/widgets/keyboard_switch.dart';

CompanyId? _company(WidgetRef ref) => ref.read(activeCompanyIdProvider);
AppLocalizations _l(BuildContext c) => AppLocalizations.of(c);

/// Rebuilds the page whenever one of its text fields changes, so buttons that
/// depend on what was typed (enabled / disabled) follow the input no matter in
/// which order the user fills the form.
mixin _RebuildOnText<T extends StatefulWidget> on State<T> {
  List<TextEditingController> get watched;

  @override
  void initState() {
    super.initState();
    for (final c in watched) {
      c.addListener(_rebuild);
    }
  }

  // No removeListener: the page disposes its controllers itself, and a
  // disposed controller drops its listeners.
  void _rebuild() {
    if (mounted) setState(() {});
  }
}

final class AuthLoginPage extends ConsumerStatefulWidget {
  const AuthLoginPage({super.key});
  @override
  ConsumerState<AuthLoginPage> createState() => _AuthLoginState();
}

class _AuthLoginState extends ConsumerState<AuthLoginPage> {
  bool loading = true;
  String? error;
  bool resumed = false;

  @override
  void initState() {
    super.initState();
    Future.microtask(_preflight);
  }

  Future<void> _preflight() async {
    final id = _company(ref);
    if (id == null) return;
    final r = await ref.read(authRepositoryProvider).preflight(id);
    if (!mounted) return;
    r.when(
      left: (f) => setState(() {
        loading = false;
        error = _describe(_l(context), f);
      }),
      right: (s) {
        final snap = ref.read(authRepositoryProvider).snapshotFor(id);
        final pending = snap?.pending;
        final chalId =
            pending is Map ? (pending as Map)['challengeId']?.toString() : null;
        final expiresAtMs = pending is Map ? (pending as Map)['expiresAt'] : null;
        final retryAtMs = pending is Map ? (pending as Map)['retryAt'] : null;
        if (snap?.authenticated == true) {
          ref.read(authGateStateProvider.notifier).markAuthenticated(
            s is AuthGateAuthenticated ? s.accountId : '',
          );
          if (snap?.needsPassword == true) {
            context.go('/auth/set-password');
          } else {
            _maybeRestoreReturn('/home');
          }
          return;
        }
        if (s is AuthGateRegistrationIncomplete) {
          context.go('/auth/set-password');
          return;
        }
        setState(() {
          loading = false;
        });
        if (chalId != null && chalId.isNotEmpty && !resumed) {
          resumed = true;
          final resp = OtpSendResponse(
            challengeId: chalId,
            phoneMasked:
                pending is Map ? (pending as Map)['phoneMasked']?.toString() ?? '' : '',
            expiresAt:
                expiresAtMs is int
                    ? DateTime.fromMillisecondsSinceEpoch(expiresAtMs)
                    : DateTime.now().add(const Duration(minutes: 5)),
            retryAt:
                retryAtMs is int
                    ? DateTime.fromMillisecondsSinceEpoch(retryAtMs)
                    : DateTime.now().add(const Duration(seconds: 60)),
            mode:
                pending is Map ? (pending as Map)['mode']?.toString() ?? 'telegram' : 'telegram',
          );
          ref.read(pendingOtpChallengeProvider.notifier).set(resp);
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) context.go('/auth/telegram-code');
          });
        }
      },
    );
  }

  void _maybeRestoreReturn(String fallback) {
    final cid = _company(ref);
    final notifier = ref.read(returnIntentProvider.notifier);
    final location = cid == null ? null : notifier.restoreFor(cid);
    if (location != null && location.isNotEmpty) {
      context.go(location);
    } else {
      context.go(fallback);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, c) => SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: c.maxHeight),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 56),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Image.asset('assets/brand/khmerx-mark.png', height: 64),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              l.authBrandEyebrow,
                              maxLines: 2,
                              style: TextStyle(
                                color: theme.colorScheme.primary,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 1.2,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              l.authBrandSlogan,
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                                height: 1.3,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  Text(
                    _l(context).authSignInTitle,
                    style: theme.textTheme.headlineSmall?.copyWith(fontSize: 28),
                  ),
                  const SizedBox(height: 8),
                  Text(l.authLoginChooseMethod, style: theme.textTheme.bodyMedium),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 16,
                    runSpacing: 8,
                    children: [
                      for (final t in [
                        l.authTrustClear,
                        l.authTrustSecure,
                        l.authTrustProgress,
                      ])
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.check_circle, size: 16, color: theme.colorScheme.primary),
                            const SizedBox(width: 6),
                            Flexible(child: Text(t, style: theme.textTheme.bodySmall)),
                          ],
                        ),
                    ],
                  ),
                  const SizedBox(height: 40),
                  // Fixed-height slot: the buttons must not jump when loading starts/ends.
                  SizedBox(
                    height: 4,
                    child: loading ? const LinearProgressIndicator() : null,
                  ),
                  const SizedBox(height: 12),
                  if (error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(error!, style: TextStyle(color: theme.colorScheme.error)),
                    ),
                  FilledButton.icon(
                    icon: const Icon(Icons.send_rounded),
                    onPressed: loading ? null : () => context.push('/auth/telegram-consent'),
                    label: Text(_l(context).authContinueTelegram),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    icon: const Icon(Icons.lock_outline),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(52),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    onPressed: loading ? null : () => context.push('/auth/password'),
                    label: Text(_l(context).authUsePassword),
                  ),
                  const SizedBox(height: 8),
                  Center(
                    child: TextButton(
                      onPressed: loading ? null : () => context.push('/auth/recover'),
                      child: Text(_l(context).authForgotPassword),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

final class TelegramConsentPage extends ConsumerStatefulWidget {
  const TelegramConsentPage({super.key});
  @override
  ConsumerState<TelegramConsentPage> createState() => _ConsentState();
}

class _ConsentState extends ConsumerState<TelegramConsentPage> with _RebuildOnText<TelegramConsentPage> {
  @override
  List<TextEditingController> get watched => [phone];

  final phone = TextEditingController();
  bool consent = false;
  bool submitting = false;
  String? error;

  Future<void> _send() async {
    final id = _company(ref);
    if (id == null) return;
    final identity = KhmerXRegexp.normalizePhone(phone.text);
    if (!KhmerXRegexp.phoneInternational.hasMatch(identity)) {
      setState(() {
        submitting = false;
        error = _l(context).authPhoneInvalidE164;
      });
      return;
    }
    setState(() {
      submitting = true;
      error = null;
    });
    final repo = ref.read(authRepositoryProvider);
    final r = await repo.otpSend(
      id,
      identity: identity,
      consent: consent,
    );
    if (!mounted) return;
    r.when(
      left: (f) {
        setState(() {
          submitting = false;
          error = _describe(_l(context), f);
        });
      },
      right: (resp) {
        repo.setLastCanonicalPhone(id, identity);
        ref.read(pendingOtpChallengeProvider.notifier).set(resp);
        setState(() => submitting = false);
        context.go('/auth/telegram-code');
      },
    );
  }

  @override
  Widget build(BuildContext context) => _FormPage(
    title: _l(context).authTelegramVerificationTitle,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: phone,
          keyboardType: numericKeyboardType(ref),
          decoration: InputDecoration(
            labelText: _l(context).authPhoneLabel,
            suffixIcon: keyboardSwitchButton(context, ref),
          ),
        ),
        const SizedBox(height: 12),
        CheckboxListTile(
          value: consent,
          onChanged: submitting
              ? null
              : (v) => setState(() => consent = v ?? false),
          contentPadding: EdgeInsets.zero,
          title: Text(
            _l(context).authConsentTelegramCode,
          ),
          controlAffinity: ListTileControlAffinity.leading,
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(error!, style: const TextStyle(color: Colors.red)),
          ),
        const SizedBox(height: 12),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          onPressed:
              (consent && phone.text.trim().isNotEmpty && !submitting) ? _send : null,
          child: submitting
              ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
              : Text(_l(context).authSendCode),
        ),
      ],
    ),
  );
}

final class TelegramCodePage extends ConsumerStatefulWidget {
  const TelegramCodePage({super.key});
  @override
  ConsumerState<TelegramCodePage> createState() => _CodeState();
}

class _CodeState extends ConsumerState<TelegramCodePage> with _RebuildOnText<TelegramCodePage> {
  @override
  List<TextEditingController> get watched => [code];

  final code = TextEditingController();
  Timer? timer;
  Duration remaining = Duration.zero;
  bool submitting = false;
  bool resending = false;
  String? error;
  DateTime? expiresAt;
  int attemptsLeft = 5;

  @override
  void initState() {
    super.initState();
    final otp = ref.read(pendingOtpChallengeProvider);
    if (otp != null) expiresAt = otp.expiresAt;
    _tick();
    timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  @override
  void dispose() {
    timer?.cancel();
    code.dispose();
    super.dispose();
  }

  void _tick() {
    final otp = ref.read(pendingOtpChallengeProvider);
    final now = DateTime.now();
    final retryLeft =
        otp == null ? Duration.zero : otp.retryAt.difference(now);
    final expireLeft = expiresAt == null ? Duration.zero : expiresAt!.difference(now);
    final sel = retryLeft.isNegative ? expireLeft : retryLeft;
    final fin = sel.isNegative ? Duration.zero : sel;
    if (mounted) setState(() => remaining = fin);
  }

  bool get canSend =>
      remaining.inSeconds == 0 && !submitting && !resending && (expiresAt == null || expiresAt!.isAfter(DateTime.now()));

  Future<void> _resend() async {
    final id = _company(ref);
    final otp = ref.read(pendingOtpChallengeProvider);
    final canonical = id == null ? null : ref.read(authRepositoryProvider).lastCanonicalPhoneFor(id);
    if (id == null || otp == null || canonical == null || !KhmerXRegexp.phoneInternational.hasMatch(canonical)) {
      setState(() {
        error = _l(context).authPhoneMissing;
      });
      return;
    }
    setState(() {
      resending = true;
      error = null;
    });
    final r = await ref.read(authRepositoryProvider).otpSend(
      id,
      identity: canonical,
      consent: true,
    );
    if (!mounted) return;
    r.when(
      left: (f) {
        setState(() {
          resending = false;
          error = _describe(_l(context), f);
          if (f is RateLimitFailure && f.retryAfter != null) {
            final rl = f.retryAfter!;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (!mounted) return;
              setState(() {
                remaining = rl;
                timer?.cancel();
                timer = Timer.periodic(const Duration(seconds: 1), (_) {
                  if (remaining.inSeconds <= 0) {
                    timer?.cancel();
                    setState(() => remaining = Duration.zero);
                    return;
                  }
                  setState(() => remaining -= const Duration(seconds: 1));
                });
              });
            });
          }
        });
      },
      right: (resp) {
        ref.read(pendingOtpChallengeProvider.notifier).set(resp);
        setState(() {
          resending = false;
          expiresAt = resp.expiresAt;
          attemptsLeft = 5;
        });
        _tick();
      },
    );
  }

  Future<void> _verify() async {
    final id = _company(ref);
    final otp = ref.read(pendingOtpChallengeProvider);
    if (id == null || otp == null || code.text.length != 6) return;
    if (expiresAt != null && expiresAt!.isBefore(DateTime.now())) {
      setState(() => error = _l(context).authCodeExpiredResend);
      return;
    }
    setState(() {
      submitting = true;
      error = null;
    });
    final r = await ref.read(authRepositoryProvider).otpVerify(
      id,
      challengeId: otp.challengeId,
      code: code.text,
    );
    if (!mounted) return;
    r.when(
      left: (f) {
        int? attempts;
        if (f is ValidationFailure) {
          final k = f.messageKey;
          if (k == 'error.auth.otp_invalid' ||
              k == 'error.validation.invalid_otp' ||
              k.contains('invalid_otp') ||
              k.contains('wrong_otp')) {
            attempts = (attemptsLeft - 1).clamp(0, 5);
          }
          if (k.contains('expired') || k.contains('challenge_expired')) {
            expiresAt = DateTime.now().subtract(const Duration(seconds: 1));
          }
        }
        setState(() {
          submitting = false;
          error = _describe(_l(context), f);
          if (attempts != null) attemptsLeft = attempts;
          if (attemptsLeft <= 0) {
            error = '$error Too many attempts. Resend the code.';
            expiresAt = DateTime.now().subtract(const Duration(seconds: 1));
          }
          if (f is RateLimitFailure && f.retryAfter != null) {
            final rl = f.retryAfter!;
            remaining = rl;
          }
        });
      },
      right: (v) {
        ref.read(pendingOtpChallengeProvider.notifier).set(null);
        setState(() => submitting = false);
        final repo = ref.read(authRepositoryProvider);
        final snap = repo.snapshotFor(id);
        final gateState = v.authenticated
            ? AuthGateAuthenticated(
              accountId: (v.session?['customerId']?.toString()) ?? '',
            )
            : v.policy?['passwordSetup'] == true &&
                    (v.session?['hasPassword'] != true)
                ? const AuthGateRegistrationIncomplete()
                : const AuthGateUnauthenticated();
        if (gateState is AuthGateAuthenticated) {
          ref.read(authGateStateProvider.notifier).markAuthenticated(
            (v.session?['customerId']?.toString()) ?? '',
          );
        } else if (gateState is AuthGateRegistrationIncomplete) {
          ref.read(authGateStateProvider.notifier).markIncomplete();
        } else {
          ref.read(authGateStateProvider.notifier).markUnauthenticated();
        }
        if (snap?.needsPassword == true ||
            v.policy?['passwordSetup'] == true &&
                (v.session?['hasPassword'] != true)) {
          context.go('/auth/set-password');
          return;
        }
        final ri = ref.read(returnIntentProvider);
        if (ri != null && ri.isSafe) {
          ref.read(returnIntentProvider.notifier).clear();
          context.go(ri.location);
        } else {
          context.go('/home');
        }
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final otp = ref.watch(pendingOtpChallengeProvider);
    final mask = otp?.phoneMasked ?? '';
    final secs = remaining.inSeconds;
    final mins = secs ~/ 60;
    final rs = secs % 60;
    return _FormPage(
      title: _l(context).authEnterCodeTitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(_l(context).authCodeSentTo(mask.isEmpty ? _l(context).authYourPhone : mask)),
          const SizedBox(height: 12),
          TextField(
            controller: code,
            keyboardType: numericKeyboardType(ref, phone: false),
            maxLength: 6,
            decoration: InputDecoration(
              labelText: _l(context).authCodeLabel,
              suffixIcon: keyboardSwitchButton(context, ref),
            ),
            onSubmitted: (_) {
              if (code.text.length == 6 && !submitting) _verify();
            },
          ),
          const SizedBox(height: 4),
          if (secs > 0)
            Text(
              _l(context).authResendIn('${mins.toString().padLeft(2, '0')}:${rs.toString().padLeft(2, '0')}'),
            )
          else if (expiresAt != null && expiresAt!.isBefore(DateTime.now()))
            Text(
              _l(context).authCodeExpiredTapResend,
              style: const TextStyle(color: Colors.red),
            )
          else
            Text(_l(context).authTapResendHint),
          Text(_l(context).authAttemptsRemaining(attemptsLeft)),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(error!, style: const TextStyle(color: Colors.red)),
            ),
          const SizedBox(height: 16),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            onPressed:
                code.text.length == 6 && !submitting ? _verify : null,
            child: submitting
                ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
                : Text(_l(context).authVerify),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            onPressed: canSend ? _resend : null,
            child:
                resending
                    ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                    : Text(_l(context).authResendCode),
          ),
        ],
      ),
    );
  }
}

/// A phone-like account is sent in international form; anything else as typed.
String _accountOf(String raw) {
  final t = raw.trim();
  final n = KhmerXRegexp.normalizePhone(t);
  return KhmerXRegexp.phoneInternational.hasMatch(n) ? n : t;
}

final class PasswordLoginPage extends ConsumerStatefulWidget {
  const PasswordLoginPage({super.key});
  @override
  ConsumerState<PasswordLoginPage> createState() => _PasswordState();
}

class _PasswordState extends ConsumerState<PasswordLoginPage> with _RebuildOnText<PasswordLoginPage> {
  @override
  List<TextEditingController> get watched => [phone, pass];

  final phone = TextEditingController();
  final pass = TextEditingController();
  bool obscure = true;
  bool submitting = false;
  String? error;

  @override
  Widget build(BuildContext context) => _FormPage(
    title: _l(context).authPasswordSignInTitle,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: phone,
          keyboardType: numericKeyboardType(ref),
          decoration: InputDecoration(
            labelText: _l(context).authPhoneLabel,
            suffixIcon: keyboardSwitchButton(context, ref),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: pass,
          obscureText: obscure,
          decoration: InputDecoration(
            labelText: _l(context).authPasswordLabel,
            suffixIcon: IconButton(
              icon: Icon(obscure ? Icons.visibility : Icons.visibility_off),
              onPressed: () => setState(() => obscure = !obscure),
            ),
          ),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(error!, style: const TextStyle(color: Colors.red)),
          ),
        const SizedBox(height: 16),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          onPressed:
              phone.text.isNotEmpty && pass.text.isNotEmpty && !submitting
                  ? _submit
                  : null,
          child: submitting
              ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
              : Text(_l(context).authSignInTitle),
        ),
        TextButton(
          onPressed: submitting ? null : () => context.go('/auth/recover'),
          child: Text(_l(context).authForgotPassword),
        ),
      ],
    ),
  );

  Future<void> _submit() async {
    final id = _company(ref);
    if (id == null) return;
    setState(() {
      submitting = true;
      error = null;
    });
    final r = await ref.read(authRepositoryProvider).passwordLogin(
      id,
      account: _accountOf(phone.text),
      password: pass.text,
    );
    if (!mounted) return;
    r.when(
      left: (f) {
        setState(() {
          submitting = false;
          error = _describe(_l(context), f);
          if (f is RateLimitFailure && f.retryAfter != null) {
            error = '$error (locked for ${f.retryAfter!.inSeconds}s)';
          }
        });
      },
      right: (_) {
        final repo = ref.read(authRepositoryProvider);
        final snap = repo.snapshotFor(id);
        if (snap?.needsPassword == true) {
          setState(() => submitting = false);
          ref.read(authGateStateProvider.notifier).markIncomplete();
          context.go('/auth/set-password');
          return;
        }
        ref.read(authGateStateProvider.notifier).markAuthenticated(
          snap?.session?['customerId']?.toString() ?? '',
        );
        setState(() => submitting = false);
        final ri = ref.read(returnIntentProvider);
        if (ri != null && ri.isSafe) {
          ref.read(returnIntentProvider.notifier).clear();
          context.go(ri.location);
        } else {
          context.go('/home');
        }
      },
    );
  }
}

final class SetPasswordPage extends ConsumerStatefulWidget {
  const SetPasswordPage({super.key});
  @override
  ConsumerState<SetPasswordPage> createState() => _SetPasswordState();
}

class _SetPasswordState extends ConsumerState<SetPasswordPage> with _RebuildOnText<SetPasswordPage> {
  @override
  List<TextEditingController> get watched => [p, c];

  final p = TextEditingController();
  final c = TextEditingController();
  bool obscureP = true;
  bool obscureC = true;
  bool submitting = false;
  String? error;

  Future<void> _save() async {
    final id = _company(ref);
    if (id == null) return;
    final l10n = AppLocalizations.of(context);
    const min = PasswordRules.minLength;
    const max = PasswordRules.maxLength;
    final check = PasswordRules.validate(p.text, confirm: c.text);
    if (check.tooShort) {
      setState(() => error = l10n.passwordTooShort(min));
      return;
    }
    if (check.tooLong) {
      setState(() => error = l10n.passwordTooLong(max));
      return;
    }
    if (!check.matchesConfirm) {
      setState(() => error = l10n.passwordMismatch);
      return;
    }
    setState(() {
      submitting = true;
      error = null;
    });
    final r = await ref.read(authRepositoryProvider).setPassword(
      id,
      password: p.text,
    );
    if (!mounted) return;
    r.when(
      left: (f) => setState(() {
        submitting = false;
        error = _describe(_l(context), f);
      }),
      right: (_) {
        setState(() => submitting = false);
        ref.read(authGateStateProvider.notifier).markAuthenticated('');
        context.go('/home');
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return _FormPage(
    title: l10n.passwordSetTitle,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: p,
          obscureText: obscureP,
          decoration: InputDecoration(
            labelText: l10n.passwordNewLabel,
            helperText: '${PasswordRules.minLength}–${PasswordRules.maxLength}',
            suffixIcon: IconButton(
              icon: Icon(obscureP ? Icons.visibility : Icons.visibility_off),
              onPressed: () => setState(() => obscureP = !obscureP),
            ),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: c,
          obscureText: obscureC,
          decoration: InputDecoration(
            labelText: l10n.passwordConfirmLabel,
            suffixIcon: IconButton(
              icon: Icon(obscureC ? Icons.visibility : Icons.visibility_off),
              onPressed: () => setState(() => obscureC = !obscureC),
            ),
          ),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ),
        const SizedBox(height: 16),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          onPressed: submitting ? null : _save,
          child: submitting
              ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
              : Text(l10n.passwordSetSubmit),
        ),
      ],
    ),
  );
  }
}

final class RecoverySendPage extends ConsumerStatefulWidget {
  const RecoverySendPage({super.key});
  @override
  ConsumerState<RecoverySendPage> createState() => _RecoverySendState();
}

class _RecoverySendState extends ConsumerState<RecoverySendPage> with _RebuildOnText<RecoverySendPage> {
  @override
  List<TextEditingController> get watched => [phone];

  final phone = TextEditingController();
  bool consent = false;
  bool submitting = false;
  String? error;
  Duration? locked;
  Timer? _t;

  @override
  void dispose() {
    _t?.cancel();
    phone.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final id = _company(ref);
    if (id == null) return;
    final identity = KhmerXRegexp.normalizePhone(phone.text);
    if (!KhmerXRegexp.phoneInternational.hasMatch(identity)) {
      setState(() {
        submitting = false;
        error = _l(context).authPhoneInvalidE164;
      });
      return;
    }
    setState(() {
      submitting = true;
      error = null;
    });
    final repo = ref.read(authRepositoryProvider);
    final r = await repo.recoverySend(
      id,
      identity: identity,
      consent: consent,
    );
    if (!mounted) return;
    r.when(
      left: (f) {
        setState(() {
          submitting = false;
          error = _describe(_l(context), f);
          if (f is RateLimitFailure && f.retryAfter != null) {
            locked = f.retryAfter;
            _t = Timer.periodic(const Duration(seconds: 1), (_) {
              if (!mounted) {
                _t?.cancel();
                return;
              }
              if (locked!.inSeconds <= 0) {
                _t?.cancel();
                setState(() => locked = Duration.zero);
                return;
              }
              setState(() => locked = locked! - const Duration(seconds: 1));
            });
          }
        });
      },
      right: (resp) {
        repo.setLastCanonicalPhone(id, identity);
        ref.read(pendingOtpChallengeProvider.notifier).set(resp);
        setState(() => submitting = false);
        context.go('/auth/recover/code');
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final canSend = consent && phone.text.trim().isNotEmpty && !submitting &&
        (locked == null || locked!.inSeconds <= 0);
    return _FormPage(
      title: _l(context).authRecoverTitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: phone,
            keyboardType: numericKeyboardType(ref),
            decoration: InputDecoration(
              labelText: _l(context).authPhoneLabel,
              suffixIcon: keyboardSwitchButton(context, ref),
            ),
          ),
          const SizedBox(height: 12),
          CheckboxListTile(
            value: consent,
            onChanged:
                submitting ? null : (v) => setState(() => consent = v ?? false),
            contentPadding: EdgeInsets.zero,
            title: Text(
              _l(context).authConsentResetCode,
            ),
            controlAffinity: ListTileControlAffinity.leading,
          ),
          if (locked != null && locked!.inSeconds > 0)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_l(context).authRateLimited(locked!.inSeconds)),
            ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(error!, style: const TextStyle(color: Colors.red)),
            ),
          const SizedBox(height: 12),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            onPressed: canSend ? _send : null,
            child: submitting
                ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
                : Text(_l(context).authSendResetCode),
          ),
        ],
      ),
    );
  }
}

final class RecoveryCodePage extends ConsumerStatefulWidget {
  const RecoveryCodePage({super.key});
  @override
  ConsumerState<RecoveryCodePage> createState() => _RecoveryCodeState();
}

class _RecoveryCodeState extends ConsumerState<RecoveryCodePage> with _RebuildOnText<RecoveryCodePage> {
  @override
  List<TextEditingController> get watched => [code, pass, confirm];

  final code = TextEditingController();
  final pass = TextEditingController();
  final confirm = TextEditingController();
  bool obscureP = true;
  bool obscureC = true;
  bool submitting = false;
  String? error;

  Future<void> _reset() async {
    final id = _company(ref);
    final otp = ref.read(pendingOtpChallengeProvider);
    if (id == null || otp == null) return;
    if (pass.text.length < 12) {
      setState(() => error = _l(context).authPasswordMin12);
      return;
    }
    if (pass.text != confirm.text) {
      setState(() => error = _l(context).authPasswordsMismatch);
      return;
    }
    setState(() {
      submitting = true;
      error = null;
    });
    final r = await ref.read(authRepositoryProvider).recoveryReset(
      id,
      challengeId: otp.challengeId,
      code: code.text,
      password: pass.text,
      confirmPassword: confirm.text,
    );
    if (!mounted) return;
    r.when(
      left: (f) => setState(() {
        submitting = false;
        error = _describe(_l(context), f);
      }),
      right: (_) {
        ref.read(pendingOtpChallengeProvider.notifier).set(null);
        setState(() => submitting = false);
        context.go('/auth/login');
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final otp = ref.watch(pendingOtpChallengeProvider);
    return _FormPage(
      title: _l(context).authResetTitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            _l(context).authEnterResetCode(otp?.phoneMasked ?? _l(context).authYourPhone),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: code,
            keyboardType: numericKeyboardType(ref, phone: false),
            maxLength: 6,
            decoration: InputDecoration(
              labelText: _l(context).authResetCodeLabel,
              suffixIcon: keyboardSwitchButton(context, ref),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: pass,
            obscureText: obscureP,
            decoration: InputDecoration(
              labelText: _l(context).authNewPasswordLabel,
              suffixIcon: IconButton(
                icon: Icon(obscureP ? Icons.visibility : Icons.visibility_off),
                onPressed: () => setState(() => obscureP = !obscureP),
              ),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: confirm,
            obscureText: obscureC,
            decoration: InputDecoration(
              labelText: _l(context).authConfirmPasswordLabel,
              suffixIcon: IconButton(
                icon: Icon(obscureC ? Icons.visibility : Icons.visibility_off),
                onPressed: () => setState(() => obscureC = !obscureC),
              ),
            ),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(error!, style: const TextStyle(color: Colors.red)),
            ),
          const SizedBox(height: 16),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            onPressed: submitting ? null : _reset,
            child: submitting
                ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
                : Text(_l(context).authResetTitle),
          ),
        ],
      ),
    );
  }
}

String _describe(AppLocalizations l, AppFailure f) => describeFailure(l, f);

final class _FormPage extends StatelessWidget {
  const _FormPage({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          physics: const AlwaysScrollableScrollPhysics(),
          child: SafeArea(
            child: child,
          ),
        ),
      ),
    );
  }
}

typedef AuthLoginPlaceholder = AuthLoginPage;
typedef AuthSetPasswordPlaceholder = SetPasswordPage;
