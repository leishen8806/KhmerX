import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/bootstrap/providers.dart';
import '../../../core/error/failure.dart';
import '../../../core/session/company_id.dart';
import '../../../core/util/either.dart';
import '../data/customer_state_repository.dart';
import '../domain/customer_snapshot.dart';

enum CustomerStateFetchStatus {
  idle,
  loading,
  refreshing,
  loaded,
  error,
  offline,
  sessionInvalid,
}

final class CustomerStateValue {
  const CustomerStateValue({
    this.snapshot,
    this.status = CustomerStateFetchStatus.idle,
    this.failure,
    this.lastAttempt,
  });

  final CustomerSnapshot? snapshot;
  final CustomerStateFetchStatus status;
  final AppFailure? failure;
  final DateTime? lastAttempt;

  CustomerStateValue copyWith({
    CustomerSnapshot? snapshot,
    bool clearSnapshot = false,
    CustomerStateFetchStatus? status,
    AppFailure? failure,
    bool clearFailure = false,
    DateTime? lastAttempt,
  }) {
    return CustomerStateValue(
      snapshot: clearSnapshot ? null : (snapshot ?? this.snapshot),
      status: status ?? this.status,
      failure: clearFailure ? null : (failure ?? this.failure),
      lastAttempt: lastAttempt ?? this.lastAttempt,
    );
  }
}

final class CustomerStateNotifier extends Notifier<CustomerStateValue> {
  static const Duration _globalThrottle = Duration(seconds: 15);
  final Map<String, DateTime> _lastFetchByCompany = {};

  static Future<CustomerStateValue> Function(
    CustomerStateNotifier,
    CompanyId, {
    bool force,
    bool isBackgroundRefresh,
  })? testingLoadOverride;

  @override
  CustomerStateValue build() {
    return const CustomerStateValue();
  }

  CustomerStateRepository get _repo => ref.read(customerStateRepositoryProvider);

  DateTime? _lastAttemptFor(CompanyId id) => _lastFetchByCompany[id.raw];

  bool _isThrottled(CompanyId id) {
    final last = _lastAttemptFor(id);
    if (last == null) return false;
    return DateTime.now().difference(last) < _globalThrottle;
  }

  Future<CustomerStateValue> load({
    required CompanyId companyId,
    bool force = false,
    bool isBackgroundRefresh = false,
  }) async {
    final override = testingLoadOverride;
    if (override != null) {
      return override(this, companyId, force: force, isBackgroundRefresh: isBackgroundRefresh);
    }
    if (!force && _isThrottled(companyId) && state.snapshot != null) {
      return state;
    }
    _lastFetchByCompany[companyId.raw] = DateTime.now();

    final currentSnap = state.snapshot;
    if (!isBackgroundRefresh) {
      final loadingStatus = currentSnap == null
          ? CustomerStateFetchStatus.loading
          : CustomerStateFetchStatus.refreshing;
      state = state.copyWith(
        status: loadingStatus,
        clearFailure: true,
        lastAttempt: DateTime.now(),
      );
    }

    final Either<AppFailure, CustomerSnapshot> result =
        await _repo.fetchState(companyId);
    if (result.isLeft) {
      final f = (result as Left<AppFailure, CustomerSnapshot>).value;
      final snap = state.snapshot;
      final isOffline = f is OfflineFailure ||
          f is NetworkFailure ||
          f is ServiceUnavailableFailure;
      final isSessionExpired = f is AuthFailure &&
          f.messageKey == 'error.auth.session_expired';
      if (isSessionExpired) {
        state = state.copyWith(
          status: CustomerStateFetchStatus.sessionInvalid,
          failure: f,
          clearSnapshot: true,
          lastAttempt: DateTime.now(),
        );
      } else if (isOffline && snap != null) {
        state = state.copyWith(
          status: CustomerStateFetchStatus.offline,
          failure: f,
          lastAttempt: DateTime.now(),
        );
      } else {
        state = state.copyWith(
          status: snap == null
              ? CustomerStateFetchStatus.error
              : CustomerStateFetchStatus.refreshing,
          failure: f,
          lastAttempt: DateTime.now(),
        );
      }
      return state;
    }
    final snap = (result as Right<AppFailure, CustomerSnapshot>).value;
    state = CustomerStateValue(
      snapshot: snap,
      status: CustomerStateFetchStatus.loaded,
      lastAttempt: DateTime.now(),
    );
    return state;
  }

  void invalidateLocal() {
    _lastFetchByCompany.clear();
    state = const CustomerStateValue();
  }

  void invalidateForCompany(CompanyId id) {
    _lastFetchByCompany.remove(id.raw);
    final current = state.snapshot;
    if (current != null && current.companyId.raw == id.raw) {
      state = const CustomerStateValue();
    }
  }
}

final customerStateProvider =
    NotifierProvider<CustomerStateNotifier, CustomerStateValue>(
  CustomerStateNotifier.new,
);

final customerStateRepositoryProvider = Provider<CustomerStateRepository>((ref) {
  return CustomerStateRepository(
    factory: ref.watch(apiClientFactoryProvider),
  );
});
