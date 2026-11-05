import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../l10n/app_localizations.dart';
import '../../../shared/widgets/brand_loader.dart';
import '../../company/domain/startup_resolution_controller.dart';

final class StartupPage extends ConsumerStatefulWidget {
  const StartupPage({super.key});

  @override
  ConsumerState<StartupPage> createState() => _StartupPageState();
}

final class _StartupPageState extends ConsumerState<StartupPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _motion = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1800),
  );
  bool _started = false;
  bool _motionStarted = false;
  bool _reducedMotion = false;
  bool _retryAllowed = false;

  @override
  void dispose() {
    _motion.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_motionStarted) {
      _motionStarted = true;
      _reducedMotion = MediaQuery.disableAnimationsOf(context);
      if (_reducedMotion) {
        _motion.value = 1;
      } else {
        unawaited(_motion.forward());
      }
    }
    if (_started) return;
    _started = true;
    unawaited(_run());
  }

  Future<void> _run() async {
    // Deep links are not enabled in P1.
    await _resolve();
  }

  Future<void> _resolve() async {
    final started = DateTime.now();
    try {
      final StartupResolutionResult result = await ref
          .read(startupResolutionProvider.notifier)
          .run(incomingAppLink: null);
      if (result.stage == StartupResolutionStage.failure && !_reducedMotion) {
        await _motion.forward();
      } else if (result.redirect != null && !_reducedMotion) {
        final left =
            const Duration(milliseconds: 1800) -
            DateTime.now().difference(started);
        if (left > Duration.zero) await Future<void>.delayed(left);
      }
      if (!mounted) return;
      setState(() {
        _retryAllowed = result.stage == StartupResolutionStage.failure;
      });
      final r = result.redirect;
      if (r == null) return;
      switch (r) {
        case StartupRedirectKind.home:
          context.go('/home');
        case StartupRedirectKind.authLogin:
          context.go('/auth/login');
        case StartupRedirectKind.authPhoneCode:
          context.go('/auth/phone-code');
        case StartupRedirectKind.authSetPassword:
          context.go('/auth/set-password');
        case StartupRedirectKind.candidateConfirm:
        case StartupRedirectKind.recovery:
          setState(() => _retryAllowed = true);
        case StartupRedirectKind.startupFailure:
          break;
      }
    } on Object catch (_) {
      if (!mounted) return;
      if (!_reducedMotion) await _motion.forward();
      setState(() => _retryAllowed = true);
    }
  }

  void _retry() {
    setState(() => _retryAllowed = false);
    if (!_reducedMotion) {
      _motion
        ..value = 0
        ..forward();
    }
    unawaited(_resolve());
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final result = ref.watch(startupResolutionProvider);
    final failed = result.stage == StartupResolutionStage.failure;
    final media = MediaQuery.of(context);
    final width = media.size.width;
    final logoWidth = (width * 0.78).clamp(200.0, 380.0);
    return Scaffold(
      backgroundColor: const Color(0xFFF7F9FC),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
          child: Column(
            children: [
              const Spacer(flex: 3),
              AnimatedBuilder(
                animation: _motion,
                builder: (context, _) {
                  final logo = Curves.easeOutCubic.transform(
                    const Interval(0, 0.58).transform(_motion.value),
                  );
                  final support = Curves.easeOut.transform(
                    const Interval(0.36, 0.78).transform(_motion.value),
                  );
                  final tagline = Curves.easeOut.transform(
                    const Interval(0.52, 0.9).transform(_motion.value),
                  );
                  return Column(
                    children: [
                      Opacity(
                        opacity: logo,
                        child: Transform.translate(
                          offset: Offset(0, 10 * (1 - logo)),
                          child: Transform.scale(
                            scale: 0.96 + 0.04 * logo,
                            child: Image.asset(
                              'assets/brand/khmerx-logo.png',
                              width: logoWidth,
                              semanticLabel: 'KhmerX',
                            ),
                          ),
                        ),
                      ),
                      Opacity(
                        opacity: support,
                        child: Transform.translate(
                          offset: Offset(0, -18 + 6 * (1 - support)),
                          child: const Text.rich(
                            TextSpan(
                              style: TextStyle(
                                color: _brand,
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 3,
                              ),
                              children: [
                                TextSpan(text: 'FAST'),
                                TextSpan(
                                  text: '  ·  ',
                                  style: TextStyle(color: _ink),
                                ),
                                TextSpan(text: 'SIMPLE'),
                                TextSpan(
                                  text: '  ·  ',
                                  style: TextStyle(color: _ink),
                                ),
                                TextSpan(text: 'CLEAR'),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Opacity(
                        opacity: tagline,
                        child: ConstrainedBox(
                          constraints: BoxConstraints(maxWidth: width * 0.84),
                          child: Text(
                            l.startupTagline,
                            textAlign: TextAlign.center,
                            style: Theme.of(
                              context,
                            ).textTheme.bodySmall?.copyWith(height: 1.45),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
              const Spacer(flex: 2),
              if (failed) ...[
                Text(
                  l.startupFailureBody,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _retryAllowed ? _retry : null,
                  child: Text(l.commonRetry),
                ),
              ] else
                AnimatedBuilder(
                  animation: _motion,
                  builder: (context, child) {
                    final v = Curves.easeOut.transform(
                      const Interval(0.72, 1).transform(_motion.value),
                    );
                    return Opacity(opacity: v, child: child);
                  },
                  child: const BrandLoader(size: 40, mark: false, dots: false),
                ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

const Color _brand = Color(0xFF1677FF);
const Color _ink = Color(0xFF071631);
