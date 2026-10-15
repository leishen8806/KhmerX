import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';

import '../../app/config/app_config.dart';
import '../error/failure.dart';
import '../session/company_id.dart';
import '../session/whitelist_cookie_jar.dart';
import 'dio_factory.dart';
import 'endpoints.dart';
import 'interceptors/base_headers_interceptor.dart';
import 'interceptors/company_cookie_interceptor.dart';
import 'interceptors/company_context_guard_interceptor.dart';
import 'interceptors/error_mapping_interceptor.dart';
import 'interceptors/origin_interceptor.dart';
import 'interceptors/retry_interceptor.dart';
import 'interceptors/safe_logging_interceptor.dart';
import 'interceptors/trace_id_interceptor.dart';
import 'network_config.dart';

final class ApiClient {
  final CompanyId companyId;
  final NetworkConfig config;
  final WhitelistCookieJar cookieJar;
  final Dio dio;

  ApiClient._({
    required this.companyId,
    required this.config,
    required this.cookieJar,
    required this.dio,
  });

  factory ApiClient.forCompany(
    CompanyId companyId,
    AppConfig appConfig,
    WhitelistCookieJar cookieJar, {
    void Function()? onSessionExpired,
  }) {
    final config = appConfig.networkConfig;
    final Dio dio = DioFactory.create(config);
    dio.interceptors.addAll([
      BaseHeadersInterceptor(config),
      OriginInterceptor(config),
      CompanyCookieInterceptor(
        companyId: companyId,
        config: config,
        cookieJar: cookieJar,
      ),
      CookieManager(cookieJar),
      CompanyContextGuardInterceptor(companyId),
      TraceIdInterceptor(),
      SafeLoggingInterceptor(),
      RetryInterceptor(dio),
      ErrorMappingInterceptor(onSessionExpired: onSessionExpired),
    ]);
    return ApiClient._(
      companyId: companyId,
      config: config,
      cookieJar: cookieJar,
      dio: dio,
    );
  }

  Future<Response<T>> request<T>(Endpoint endpoint, {
    Map<String, dynamic>? queryParameters,
    Object? data,
    Map<String, String>? headers,
    String? contentType,
  }) async {
    final Endpoint resolved;
    if (endpoint.companyId != null && endpoint.companyId != companyId) {
      resolved = endpoint;
    } else if (endpoint.companyId == null) {
      resolved = endpoint.withCompanyId(companyId);
    } else {
      resolved = endpoint;
    }
    final effectiveData = _enforceBodyLimits(resolved, data);
    try {
      return await dio.request<T>(
        resolved.path,
        queryParameters: queryParameters,
        data: effectiveData,
        options: Options(
          method: resolved.method.name.toUpperCase(),
          headers: headers,
          contentType: contentType,
          extra: {
            'endpoint': resolved,
            'companyId': resolved.companyId?.raw ?? companyId.raw,
          },
          sendTimeout: resolved.timeoutOverride ?? config.sendTimeout,
          receiveTimeout: resolved.timeoutOverride ?? config.receiveTimeout,
        ),
      );
    } on DioException {
      rethrow;
    }
  }

  static Object? _enforceBodyLimits(Endpoint endpoint, Object? data) {
    if (data == null) return null;
    final limit = endpoint.bodyLimitBytes;
    if (limit == null || limit <= 0) return data;
    final bytes = _estimateBytes(data);
    if (bytes > limit) {
      throw DioException(
        requestOptions: RequestOptions(path: endpoint.path),
        error: ValidationFailure.bodyTooLarge(
          limitBytes: limit,
          actualBytes: bytes,
        ),
      );
    }
    return data;
  }

  static int _estimateBytes(Object data) {
    try {
      if (data is String) return utf8.encode(data).length;
      if (data is List<int>) return data.length;
      final encoded = jsonEncode(data);
      return utf8.encode(encoded).length;
    } catch (_) {
      return 1 << 30;
    }
  }
}
