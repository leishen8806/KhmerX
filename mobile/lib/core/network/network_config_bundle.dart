import '../feature_flags/feature_flags.dart';
import 'network_config.dart';

final class NetworkConfigBundle {
  const NetworkConfigBundle({
    required this.network,
    required this.flags,
  });

  final NetworkConfig network;
  final FeatureFlags flags;
}
