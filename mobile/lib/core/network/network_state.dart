sealed class NetworkState {
  const NetworkState();
  bool get isOnline => false;
  bool get isOffline => false;
}

final class NetworkUnknown extends NetworkState {
  const NetworkUnknown();
}

final class NetworkOnline extends NetworkState {
  const NetworkOnline();
  @override
  bool get isOnline => true;
}

final class NetworkOffline extends NetworkState {
  const NetworkOffline();
  @override
  bool get isOffline => true;
}
