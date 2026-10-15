final class NetworkConfig {
  const NetworkConfig({
    required this.baseUrl,
    required this.connectTimeout,
    required this.sendTimeout,
    required this.receiveTimeout,
    required this.logoutTimeout,
  });

  final Uri baseUrl;
  final Duration connectTimeout;
  final Duration sendTimeout;
  final Duration receiveTimeout;
  final Duration logoutTimeout;

  String get origin => baseUrl.origin;
}
