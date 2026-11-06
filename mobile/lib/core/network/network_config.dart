final class NetworkConfig {
  const NetworkConfig({
    required this.baseUrl,
    required this.connectTimeout,
    required this.sendTimeout,
    required this.receiveTimeout,
    required this.logoutTimeout,
    this.cookieHosts = const <String>[],
  });

  final Uri baseUrl;
  final Duration connectTimeout;
  final Duration sendTimeout;
  final Duration receiveTimeout;
  final Duration logoutTimeout;
  final List<String> cookieHosts;

  String get origin => baseUrl.origin;

  NetworkConfig copyWith({Uri? baseUrl,List<String>? cookieHosts}) => NetworkConfig(
    baseUrl: baseUrl ?? this.baseUrl,
    connectTimeout: connectTimeout,
    sendTimeout: sendTimeout,
    receiveTimeout: receiveTimeout,
    logoutTimeout: logoutTimeout,
    cookieHosts: cookieHosts ?? this.cookieHosts,
  );
}
