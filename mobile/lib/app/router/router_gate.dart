import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../bootstrap/providers.dart';
import '../../core/feature_flags/feature_flags.dart';
import '../../core/session/company_id.dart';
import '../../features/auth/domain/auth_gate_state.dart';

final class RouterGate extends Notifier<void> {
  @override
  void build() {}

  bool startupReady() => true;
  CompanyId? activeCompanyId() => ref.read(activeCompanyIdProvider);
  AuthGateState authState() => ref.read(authGateStateProvider);
  FeatureFlags flags() => ref.read(featureFlagsProvider);
}

final routerGateProvider = NotifierProvider<RouterGate, void>(RouterGate.new);
