import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';

import 'error_mapper_extensions.dart';
import 'failure.dart';
import 'server_message_catalog.dart';

final class ErrorMapper {
  ErrorMapper._();

  static AppFailure fromDioException(DioException e) {
    final traceId = _serverTraceId(e.response) ??
        e.requestOptions.headers['X-Trace-Id']?.toString();
    final statusCode = e.response?.statusCode;

    if (e.error is AppFailure) {
      return e.error as AppFailure;
    }

    if (e.type == DioExceptionType.connectionTimeout) {
      return NetworkFailure.connectionTimeout(traceId: traceId, statusCode: statusCode);
    }
    if (e.type == DioExceptionType.sendTimeout) {
      return NetworkFailure.sendTimeout(traceId: traceId, statusCode: statusCode);
    }
    if (e.type == DioExceptionType.receiveTimeout) {
      return NetworkFailure.receiveTimeout(traceId: traceId, statusCode: statusCode);
    }

    if (e.type == DioExceptionType.connectionError ||
        e.error is SocketException ||
        e.type == DioExceptionType.unknown &&
            (e.error is SocketException ||
                e.toString().contains('Connection failed') ||
                e.toString().contains('Failed host lookup') ||
                e.toString().contains('SocketException'))) {
      return OfflineFailure(traceId: traceId, originalError: e);
    }

    if (statusCode == null) {
      return UnknownFailure(originalError: e, stackTrace: e.stackTrace, traceId: traceId);
    }

    final (code, message, _) = _extractPayload(e.response);
    final effectiveStatusCode = statusCode;
    final requestId = _payload(e.response)?.caseInsensitiveString(['requestId']) ??
        e.response?.headers.value('X-Request-Id');
    final key = switch ((statusCode, code?.toUpperCase())) {
      (500, 'INTERNAL_ERROR') => 'error.internal_error',
      (400, 'VALIDATION_FAILED') => 'error.validation_failed',
      (409, 'ACCOUNT_ALREADY_REGISTERED') => 'error.account_registered',
      (413, 'PAYLOAD_TOO_LARGE') => 'error.payload_too_large',
      _ => null,
    };
    if (key != null) {
      return ServerMessageFailure(messageKey: key,
          statusCode: statusCode, traceId: traceId, requestId: requestId);
    }
    if (statusCode == 503) {
      return ServiceUnavailableFailure(statusCode: statusCode,
          traceId: traceId, requestId: requestId,
          retryAfter: Duration(seconds: retryAfterSeconds(e.response)));
    }

    if (statusCode == 429) {
      final seconds = retryAfterSeconds(e.response);
      return RateLimitFailure(
        retryAfter: Duration(seconds: seconds),
        traceId: traceId,
        statusCode: statusCode,
      );
    }

    final fallback = _statusFallback(effectiveStatusCode, traceId);
    return ServerMessageCatalog.from(
      effectiveStatusCode,
      code: code,
      message: message,
      traceId: traceId,
      fallback: ({traceId, statusCode}) => fallback,
    );
  }

  /// Server-generated trace id: error envelope `traceId` first, then the
  /// `X-Request-Id` response header (docs 61 §2.2). The locally generated
  /// `X-Trace-Id` is only a last resort.
  static String? _serverTraceId(Response? response) {
    if (response == null) return null;
    final data = response.data;
    Map<String, Object?>? json;
    if (data is Map<String, Object?>) {
      json = data;
    } else if (data is String) {
      try {
        final decoded = jsonDecode(data);
        if (decoded is Map<String, Object?>) json = decoded;
      } catch (_) {}
    }
    final fromBody = json?.caseInsensitiveString(['traceId', 'trace_id']);
    if (fromBody != null) return fromBody;
    final header = response.headers.value('X-Request-Id');
    if (header != null && header.isNotEmpty) return header;
    return response.headers.value('X-Trace-Id');
  }

  static AppFailure _statusFallback(int statusCode, String? traceId) {
    return switch (statusCode) {
      400 => AuthFailure.invalidCredentials(traceId: traceId, statusCode: statusCode),
      401 => AuthFailure.unauthenticated(traceId: traceId, statusCode: statusCode),
      403 => ForbiddenFailure.server(traceId: traceId, statusCode: statusCode),
      409 => ConflictFailure.dataChanged(traceId: traceId, statusCode: statusCode),
      422 => ValidationFailure.passwordInvalid(traceId: traceId, statusCode: statusCode),
      503 => ServiceUnavailableFailure(traceId: traceId, statusCode: statusCode),
      _ => UnknownFailure(traceId: traceId, statusCode: statusCode),
    };
  }

  static (String? code, String? message, int? bodyRetryAfter) _extractPayload(Response? response) {
    final data = response?.data;
    String? code;
    String? message;
    int? bodyRetryAfter;
    Map<String, Object?>? json;
    if (data is Map<String, Object?>) {
      json = data;
    } else if (data is String) {
      try {
        final decoded = jsonDecode(data);
        if (decoded is Map<String, Object?>) json = decoded;
      } catch (_) {}
    }
    if (json != null) {
      code = json.caseInsensitiveString(['error_code', 'errorCode', 'code', 'error']);
      message = json.caseInsensitiveString(['message', 'error_message', 'errorMessage', 'detail']);
      bodyRetryAfter = json.caseInsensitiveInt(['retryAfter', 'retry_after']);
    }
    return (code, message, bodyRetryAfter);
  }

  static int _normalizeRetrySeconds(int? raw) {
    if (raw == null) return 60;
    if (raw <= 0) return 60;
    if (raw <= 3600) return raw;
    return 3600;
  }

  static Map<String, Object?>? _payload(Response? response) {
    final data = response?.data;
    if (data is Map<String, Object?>) {return data;}
    if (data is String) {try {final decoded = jsonDecode(data);
      if (decoded is Map<String, Object?>) {return decoded;}
    } catch (_) {}}
    return null;
  }

  /// ARC-00: header, params, legacy fields; invalid selected values default to 60.
  static int retryAfterSeconds(Response? response) {
    final body = _payload(response), params = body?['params'];
    final raw = response?.headers.value('Retry-After') ??
        (params is Map ? params['retryAfterSeconds'] : null) ??
        body?['retryAfter'] ?? body?['retry_after'];
    return _normalizeRetrySeconds(raw is int ? raw :
        raw is String ? int.tryParse(raw.trim()) : null);
  }
}
