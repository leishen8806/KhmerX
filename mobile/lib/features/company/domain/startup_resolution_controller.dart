import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/bootstrap/providers.dart';
import '../../../core/error/failure.dart';
import '../../../core/logging/safe_logger.dart';
import '../../../core/session/company_id.dart';
import '../../../core/util/either.dart';
import '../../auth/domain/auth_gate_state.dart';
import 'company_resolver.dart';

enum StartupResolutionStage {
  initializing,
  resolvingCandidate,
  preflighting,
  awaitingCandidateConfirm,
  ready,
  failure,
}

enum StartupRedirectKind {
  home,
  authLogin,
  authPhoneCode,
  authSetPassword,
  candidateConfirm,
  recovery,
  startupFailure,
}

final class StartupResolutionResult {
  const StartupResolutionResult({
    required this.stage,
    required this.redirect,
    this.reason,
    this.hint,
    this.errorMessage,
  });

  final StartupResolutionStage stage;
  final StartupRedirectKind? redirect;
  final CompanyUnresolvedReason? reason;
  final String? hint;
  final String? errorMessage;
}

final class StartupResolutionController
    extends Notifier<StartupResolutionResult> {

  @override
  StartupResolutionResult build() {
    return const StartupResolutionResult(
      stage: StartupResolutionStage.initializing,
      redirect: null,
    );
  }

  Future<StartupResolutionResult> run({
    required Uri? incomingAppLink,
    bool runDry = false,
  }) async {
    try {
    // The page starts this from a widget life-cycle callback; never change
    // provider state synchronously from there.
    await Future<void>.delayed(Duration.zero);
    // Public context (docs 54): no company resolution, no deep link, no
    // default institution. The server owns workspace assignment.
    final active = ref.read(activeCompanyIdProvider);
    final repo = ref.read(authRepositoryProvider);
    const CompanyId candidate = CompanyId.publicWorkspace;
    final CompanyId? persistedActive = active;

    state = const StartupResolutionResult(
      stage: StartupResolutionStage.preflighting,
      redirect: null,
    );

    final preflightResults = <String, PreflightResult>{};

    final Either<AppFailure, AuthGateState> pf;
    try {
      pf = await repo.preflight(candidate);
    } on Object catch (_) {
      preflightResults[candidate.raw] = PreflightResult.networkError;
      state = const StartupResolutionResult(
        stage: StartupResolutionStage.failure,
        redirect: StartupRedirectKind.startupFailure,
      );
      return state;
    }

    final AppFailure? leftFail = pf is Left<AppFailure, AuthGateState> ? pf.value : null;
    final AuthGateState? rightState = pf is Right<AppFailure, AuthGateState> ? pf.value : null;

    // Any preflight failure (offline, 5xx, 403 "workspace unavailable") is a
    // generic startup failure with Retry. There is no company recovery page.
    if (leftFail != null) {
      preflightResults[candidate.raw] = PreflightResult.networkError;
      state = const StartupResolutionResult(
        stage: StartupResolutionStage.failure,
        redirect: StartupRedirectKind.startupFailure,
      );
      return state;
    }
    preflightResults[candidate.raw] = PreflightResult.ok;
    const CompanyId resolvedId = CompanyId.publicWorkspace;

    if (runDry) {
      state = const StartupResolutionResult(
        stage: StartupResolutionStage.ready,
        redirect: StartupRedirectKind.authLogin,
      );
      return state;
    }

    if (persistedActive == null || persistedActive != resolvedId) {
      await ref
          .read(activeCompanyIdProvider.notifier)
          .activate(resolvedId);
    } else if (active == null) {
      await ref
          .read(activeCompanyIdProvider.notifier)
          .activate(resolvedId);
    }


    final authState = rightState ?? const AuthGateUnknown();
    final snap = repo.snapshotFor(resolvedId);
    if (authState.isAuthenticated) {
      final accountId = authState is AuthGateAuthenticated ? authState.accountId : '';
      ref
          .read(authGateStateProvider.notifier)
          .markAuthenticated(accountId);
      final pending = snap?.pending;
      final chalId = pending is Map
          ? (pending as Map)['challengeId']?.toString()
          : null;
      final expiresAtMs = pending is Map ? (pending as Map)['expiresAt'] : null;
      final retryAtMs = pending is Map ? (pending as Map)['retryAt'] : null;
      final phoneMasked = pending is Map
          ? (pending as Map)['phoneMasked']?.toString() ?? ''
          : '';
      if (snap?.needsPassword == true) {
        state = const StartupResolutionResult(
          stage: StartupResolutionStage.ready,
          redirect: StartupRedirectKind.authSetPassword,
        );
        return state;
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
        state = const StartupResolutionResult(
          stage: StartupResolutionStage.ready,
          redirect: StartupRedirectKind.authPhoneCode,
        );
        return state;
      }
      state = const StartupResolutionResult(
        stage: StartupResolutionStage.ready,
        redirect: StartupRedirectKind.home,
      );
      return state;
    }

    if (authState.isRegistrationIncomplete || snap?.needsPassword == true) {
      state = const StartupResolutionResult(
        stage: StartupResolutionStage.ready,
        redirect: StartupRedirectKind.authSetPassword,
      );
      return state;
    }

    final pending = snap?.pending;
    final chalId = pending is Map
        ? (pending as Map)['challengeId']?.toString()
        : null;
    if (chalId != null && chalId.isNotEmpty) {
      final expiresAtMs = pending is Map ? (pending as Map)['expiresAt'] : null;
      final retryAtMs = pending is Map ? (pending as Map)['retryAt'] : null;
      final phoneMasked = pending is Map
          ? (pending as Map)['phoneMasked']?.toString() ?? ''
          : '';
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
      state = const StartupResolutionResult(
        stage: StartupResolutionStage.ready,
        redirect: StartupRedirectKind.authPhoneCode,
      );
      return state;
    }

    state = const StartupResolutionResult(
      stage: StartupResolutionStage.ready,
      redirect: StartupRedirectKind.authLogin,
    );
    return state;
    } on Object catch (e, st) {
      SafeLogger.e('startup failed: $e', st);
      state = const StartupResolutionResult(
        stage: StartupResolutionStage.failure,
        redirect: StartupRedirectKind.startupFailure,
      );
      return state;
    }
  }
}

final startupResolutionProvider =
    NotifierProvider<StartupResolutionController, StartupResolutionResult>(
  StartupResolutionController.new,
);
