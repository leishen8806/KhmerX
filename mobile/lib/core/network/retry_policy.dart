import 'dart:io';

sealed class RetryPolicy {
  const RetryPolicy._();

  const factory RetryPolicy.none() = _NoneRetryPolicy;

  const factory RetryPolicy.boundedGet({
    int maxAttempts,
    Duration initialDelay,
  }) = BoundedGetRetryPolicy;

  bool shouldRetry(int attempt, int? statusCode, Object error);
}

final class _NoneRetryPolicy extends RetryPolicy {
  const _NoneRetryPolicy() : super._();

  @override
  bool shouldRetry(int attempt, int? statusCode, Object error) => false;
}

final class BoundedGetRetryPolicy extends RetryPolicy {
  final int maxAttempts;
  final Duration initialDelay;

  const BoundedGetRetryPolicy({
    this.maxAttempts = 2,
    this.initialDelay = const Duration(milliseconds: 500),
  }) : super._();

  @override
  bool shouldRetry(int attempt, int? statusCode, Object error) {
    if (attempt >= maxAttempts) return false;

    if (statusCode != null) {
      if (statusCode >= 400 && statusCode < 500) return false;
      if (statusCode == 429) return false;
      if (statusCode == 503) return true;
      return false;
    }

    if (error is SocketException ||
        error is HttpException ||
        error is WebSocketException ||
        error.toString().contains('Connection') ||
        error.toString().contains('Socket') ||
        error.toString().contains('DNS') ||
        error.toString().contains('Handshake')) {
      return true;
    }

    return false;
  }
}
