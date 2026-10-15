import 'dart:async';
import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/feature_flags/feature_flags.dart';
import '../../core/network/api_client_factory.dart';
import '../../core/network/network_notifier.dart';
import '../../core/network/network_state.dart';
import '../../core/session/company_cookie_store.dart';
import '../../core/session/company_id.dart';
import '../../core/session/session_manager.dart';
import '../../core/storage/secure_kv.dart';
import '../../features/auth/data/auth_repository.dart';
import '../../features/auth/domain/auth_gate_state.dart';
import '../../features/company/domain/active_company_store.dart';
import '../../features/customer_state/presentation/customer_state_notifier.dart';
import '../../l10n/app_localizations.dart';
import '../config/app_config.dart';
import '../router/router.dart';

final appConfigProvider = Provider<AppConfig>((ref) {
  throw UnimplementedError('Must be overridden at bootstrap');
});

final secureKvProvider = Provider<SecureKv>((ref) {
  throw UnimplementedError('Must be overridden at bootstrap');
});

final featureFlagsProvider = Provider<FeatureFlags>((ref) {
  final config = ref.watch(appConfigProvider);
  return config.flags;
});

final class ActiveCompanyIdNotifier extends Notifier<CompanyId?> {
  @override
  CompanyId? build() => null;
  Future<void> activate(CompanyId id) async {
    final current = state;
    if (current != null && current != id) {
      ref.read(customerStateProvider.notifier).invalidateForCompany(current);
      ref.read(authRepositoryProvider).invalidateFor(current);
    }
    state = id;
    await ref.read(activeCompanyStoreProvider).setActive(id);
    if (!id.isPublic) {
      await ref.read(activeCompanyStoreProvider).addCompany(id);
    }
    ref.read(authGateStateProvider.notifier).state = const AuthGateUnknown();
    await ref.read(knownCompaniesProvider.notifier).refresh();
  }

  Future<void> clear() async {
    final current = state;
    if (current != null) {
      ref.read(customerStateProvider.notifier).invalidateForCompany(current);
      ref.read(authRepositoryProvider).invalidateFor(current);
    }
    state = null;
    await ref.read(activeCompanyStoreProvider).clearActive();
    ref.read(authGateStateProvider.notifier).state = const AuthGateUnknown();
    await ref.read(knownCompaniesProvider.notifier).refresh();
  }

  Future<void> switchTo(CompanyId id) async {
    final current = state;
    if (current != null && current == id) return;
    ref.read(pendingCandidateCompanyProvider.notifier).set(id);
  }
}

final activeCompanyIdProvider =
    NotifierProvider<ActiveCompanyIdNotifier, CompanyId?>(
      ActiveCompanyIdNotifier.new,
    );

final class PendingCandidateCompanyNotifier extends Notifier<CompanyId?> {
  @override
  CompanyId? build() => null;
  void set(CompanyId? id) => state = id;
}

final pendingCandidateCompanyProvider =
    NotifierProvider<PendingCandidateCompanyNotifier, CompanyId?>(
      PendingCandidateCompanyNotifier.new,
    );

final class PendingOtpChallengeNotifier extends Notifier<OtpSendResponse?> {
  @override
  OtpSendResponse? build() => null;

  void set(OtpSendResponse? value) => state = value;
}

final pendingOtpChallengeProvider =
    NotifierProvider<PendingOtpChallengeNotifier, OtpSendResponse?>(
      PendingOtpChallengeNotifier.new,
    );

final class ReturnIntent {
  const ReturnIntent({
    required this.companyId,
    required this.location,
    required this.method,
    required this.isSafe,
    required this.createdAt,
  });
  final CompanyId companyId;
  final String location;
  final String method;
  final bool isSafe;
  final DateTime createdAt;
}

final class ReturnIntentNotifier extends Notifier<ReturnIntent?> {
  static const Set<String> safeLocations = {
    '/startup',
    '/home',
    '/loans',
    '/me',
    '/me/language',
    '/me/password',
  };

  static bool isSafeRoute(String location) {
    if (safeLocations.contains(location)) return true;
    if (location.startsWith('/loans/')) return true;
    if (location == '/kyc' || location.startsWith('/kyc/')) return true;
    return false;
  }

  @override
  ReturnIntent? build() => null;

  void saveSafe(CompanyId companyId, String location) {
    if (!isSafeRoute(location)) return;
    if (location.isEmpty) return;
    state = ReturnIntent(
      companyId: companyId,
      location: location,
      method: 'GET',
      isSafe: true,
      createdAt: DateTime.now(),
    );
  }

  void clear() => state = null;

  void clearForCompany(CompanyId id) {
    final s = state;
    if (s != null && s.companyId.raw == id.raw) {
      state = null;
    }
  }

  String? restoreFor(CompanyId companyId) {
    final s = state;
    if (s == null) return null;
    if (!s.isSafe) return null;
    if (s.companyId.raw != companyId.raw) return null;
    if (!isSafeRoute(s.location)) return null;
    final loc = s.location;
    state = null;
    return loc;
  }

  bool canRestore(CompanyId companyId) {
    final s = state;
    return s != null &&
        s.isSafe &&
        s.companyId.raw == companyId.raw &&
        isSafeRoute(s.location);
  }
}

final returnIntentProvider =
    NotifierProvider<ReturnIntentNotifier, ReturnIntent?>(
      ReturnIntentNotifier.new,
    );

final class SessionInvalidationCoordinator {
  SessionInvalidationCoordinator(this.ref);
  final Ref ref;

  void onHttp401({
    required CompanyId companyId,
    required String safeReturnLocation,
  }) {
    ref.read(returnIntentProvider.notifier).saveSafe(companyId, safeReturnLocation);
    _clearAuthenticatedState(companyId);
    ref.read(authGateStateProvider.notifier).markUnauthenticated();
  }

  void onLocalLogout({required CompanyId companyId}) {
    _clearAuthenticatedState(companyId);
    ref.read(returnIntentProvider.notifier).clearForCompany(companyId);
    ref.read(authGateStateProvider.notifier).markUnauthenticated();
    ref.read(activeCompanyIdProvider.notifier).clear();
  }

  void onCompanySwitchFrom(CompanyId previous) {
    ref.read(customerStateProvider.notifier).invalidateForCompany(previous);
    ref.read(authRepositoryProvider).invalidateFor(previous);
    ref.read(returnIntentProvider.notifier).clearForCompany(previous);
    ref.read(pendingOtpChallengeProvider.notifier).set(null);
  }

  void _clearAuthenticatedState(CompanyId cid) {
    ref.read(customerStateProvider.notifier).invalidateForCompany(cid);
    ref.read(authRepositoryProvider).invalidateFor(cid);
    ref.read(pendingOtpChallengeProvider.notifier).set(null);
  }
}

final sessionInvalidationCoordinatorProvider =
    Provider<SessionInvalidationCoordinator>((ref) {
  return SessionInvalidationCoordinator(ref);
});

final class LocaleNotifier extends Notifier<Locale> {
  @override
  Locale build() {
    final active = ref.watch(activeCompanyIdProvider);
    ref.listen<CompanyId?>(activeCompanyIdProvider, (prev, next) async {
      if (next == null) return;
      await _resolveFor(next);
    });
    final resolved = _resolveSync(active);
    if (active != null) unawaited(_resolveFor(active));
    return resolved;
  }

  Locale _fallback() {
    return AppLocalizations.supportedLocales.firstWhere(
      (l) => l.languageCode == 'en',
      orElse: () => const Locale('en'),
    );
  }

  Set<String> _enabledFor(CompanyId? id) {
    // The public app bundles km / en / zh; the choice is device-level and
    // does not depend on any server-side company language flags.
    if (id == null || id.isPublic) return const {'en', 'km', 'zh'};
    final out = <String>{'en', 'km'};
    final AuthRepository repo = ref.read(authRepositoryProvider);
    final snap = repo.snapshotFor(id);
    out
      ..clear()
      ..addAll(snap?.enabledLanguageCodes() ?? const ['en', 'km']);
    if (out.isEmpty) out.addAll(const ['en', 'km']);
    return out;
  }

  Locale _pickSupported(String code, Set<String> enabled) {
    if (!enabled.contains(code)) return _fallback();
    final matches = AppLocalizations.supportedLocales
        .where((l) => l.languageCode == code)
        .toList();
    if (matches.isEmpty) return _fallback();
    return matches.first;
  }

  Locale _resolveSync(CompanyId? id) {
    final enabled = _enabledFor(id);
    // First launch: follow the device language when supported, else English.
    final device = PlatformDispatcher.instance.locale.languageCode;
    return _pickSupported(enabled.contains(device) ? device : 'en', enabled);
  }

  Future<void> _resolveFor(CompanyId id) async {
    final enabled = _enabledFor(id);
    final saved = await ref.read(activeCompanyStoreProvider).loadLocalePref(id);
    if (saved != null && saved.isNotEmpty) {
      final candidate = _pickSupported(saved, enabled);
      if (enabled.contains(candidate.languageCode)) {
        state = candidate;
        return;
      }
    }
    // No saved preference: follow the device language when supported, else en.
    final device = PlatformDispatcher.instance.locale.languageCode;
    if (enabled.contains(device)) {
      state = _pickSupported(device, enabled);
      return;
    }
    if (enabled.contains('en')) {
      state = _pickSupported('en', enabled);
      return;
    }
    if (enabled.isNotEmpty) {
      state = _pickSupported(enabled.first, enabled);
      return;
    }
    state = _fallback();
  }

  void setLocale(Locale locale) {
    final active = ref.read(activeCompanyIdProvider);
    final enabled = _enabledFor(active);
    final code = locale.languageCode;
    if (!enabled.contains(code)) return;
    final candidate = _pickSupported(code, enabled);
    state = candidate;
    if (active != null) {
      unawaited(ref.read(activeCompanyStoreProvider).setLocalePref(active, code));
    }
  }

  List<Locale> get selectable {
    final active = ref.watch(activeCompanyIdProvider);
    final enabledCodes = <String>{
      if (active == null || active.isPublic)
        ...const ['en', 'km', 'zh']
      else
        ...(ref
                .read(authRepositoryProvider)
                .snapshotFor(active)
                ?.enabledLanguageCodes() ??
            const ['en', 'km']),
    };
    return AppLocalizations.supportedLocales
        .where((l) => enabledCodes.contains(l.languageCode))
        .toList(growable: false);
  }
}

final localeProvider = NotifierProvider<LocaleNotifier, Locale>(
  LocaleNotifier.new,
);

final class AuthGateStateNotifier extends Notifier<AuthGateState> {
  @override
  AuthGateState build() => const AuthGateUnknown();
  void markUnauthenticated() => state = const AuthGateUnauthenticated();
  void markIncomplete() => state = const AuthGateRegistrationIncomplete();
  void markAuthenticated(String accountId) =>
      state = AuthGateAuthenticated(accountId: accountId);
}

final authGateStateProvider =
    NotifierProvider<AuthGateStateNotifier, AuthGateState>(
      AuthGateStateNotifier.new,
    );

final companyCookieStoreProvider = Provider<CompanyCookieStore>((ref) {
  return CompanyCookieStore();
});

final sessionManagerProvider = Provider<SessionManager>((ref) {
  return SessionManager();
});

final apiClientFactoryProvider = Provider<ApiClientFactory>((ref) {
  return ApiClientFactory(
    config: ref.watch(appConfigProvider),
    store: ref.watch(companyCookieStoreProvider),
    secureKv: ref.watch(secureKvProvider),
    onSessionExpired: (id) {
      // Only react while we believe we are signed in; the router then
      // redirects to the login page (it listens to the auth gate).
      if (ref.read(authGateStateProvider).isAuthenticated) {
        ref
            .read(sessionInvalidationCoordinatorProvider)
            .onHttp401(companyId: id, safeReturnLocation: '/home');
      }
    },
  );
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    factory: ref.watch(apiClientFactoryProvider),
    sessionManager: ref.watch(sessionManagerProvider),
  );
});

final activeCompanyStoreProvider = Provider<ActiveCompanyStore>((ref) {
  return ActiveCompanyStore(secureKv: ref.watch(secureKvProvider));
});

final restoredActiveCompanyIdProvider = FutureProvider<CompanyId?>((ref) async {
  return ref.watch(activeCompanyStoreProvider).loadActive();
});

final knownCompaniesProvider =
    NotifierProvider<KnownCompaniesNotifier, List<CompanyId>>(
  KnownCompaniesNotifier.new,
);

final class KnownCompaniesNotifier extends Notifier<List<CompanyId>> {
  @override
  List<CompanyId> build() {
    _refresh();
    return [];
  }

  Future<void> _refresh() async {
    final store = ref.read(activeCompanyStoreProvider);
    final list = await store.loadCompanies();
    final active = ref.read(activeCompanyIdProvider);
    final out = List<CompanyId>.from(list);
    if (active != null && !out.contains(active)) {
      out.insert(0, active);
    }
    state = List.unmodifiable(out);
  }

  Future<void> refresh() => _refresh();
}

final networkStateProvider = NotifierProvider<NetworkNotifier, NetworkState>(
  NetworkNotifier.new,
);

final routerProvider = Provider<GoRouter>((ref) {
  return createRouter(ref);
});
