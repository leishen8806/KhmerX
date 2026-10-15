import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'network_state.dart';

final class NetworkNotifier extends Notifier<NetworkState> {
  final Connectivity _connectivity = Connectivity();

  @override
  NetworkState build() {
    _init();
    return const NetworkUnknown();
  }

  Future<void> _init() async {
    _connectivity.onConnectivityChanged.listen(_onResult);
    try {
      final result = await _connectivity.checkConnectivity();
      _onResult(result);
    } catch (_) {}
  }

  void _onResult(List<ConnectivityResult> result) {
    final hasConnection = result.isNotEmpty &&
        !result.every((r) => r == ConnectivityResult.none);
    state = hasConnection ? const NetworkOnline() : const NetworkOffline();
  }
}
