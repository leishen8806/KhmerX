import 'package:dio/dio.dart';

import '../../error/failure.dart';
import '../../session/company_id.dart';
import '../endpoints.dart';

final class CompanyContextGuardInterceptor extends Interceptor {
  final CompanyId expectedCompanyId;

  CompanyContextGuardInterceptor(this.expectedCompanyId);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final Object? raw =
        options.extra['_companyId'] ?? options.extra['companyId'];
    CompanyId? requestCompanyId;
    if (raw is CompanyId) {
      requestCompanyId = raw;
    } else if (raw is String) {
      requestCompanyId = CompanyId.tryParse(raw);
    }
    requestCompanyId ??= (options.extra['endpoint'] as Endpoint?)?.companyId;

    if (requestCompanyId == null) {
      handler.reject(
        DioException(
          requestOptions: options,
          error: TenantContextFailure(
            clientCompanyId: expectedCompanyId,
            reason: 'missing companyId on outgoing request',
          ),
        ),
      );
      return;
    }

    if (expectedCompanyId != requestCompanyId) {
      handler.reject(
        DioException(
          requestOptions: options,
          error: TenantContextFailure(
            clientCompanyId: expectedCompanyId,
            transportCompanyId: requestCompanyId.raw,
            companyCount: null,
            reason:
                'ApiClient bound to ${expectedCompanyId.raw} but outgoing request declares companyId ${requestCompanyId.raw}',
          ),
        ),
      );
      return;
    }

    final cookieHeader = options.headers['Cookie'];
    if (requestCompanyId.isPublic) {
      final String publicHeader = (cookieHeader is List)
          ? cookieHeader.whereType<String>().join('; ')
          : (cookieHeader is String)
              ? cookieHeader
              : '';
      if (_parseCompanyCookie(publicHeader).matches.isNotEmpty) {
        handler.reject(
          DioException(
            requestOptions: options,
            error: TenantContextFailure(
              clientCompanyId: expectedCompanyId,
              companyCount: 1,
              reason: 'public context must not send payease_company',
            ),
          ),
        );
        return;
      }
      handler.next(options);
      return;
    }

    final String ch = (cookieHeader is List)
        ? cookieHeader.whereType<String>().join('; ')
        : (cookieHeader is String)
            ? cookieHeader
            : '';
    final parsed = _parseCompanyCookie(ch);

    if (parsed.matches.length != 1 || parsed.values.first != requestCompanyId.raw) {
      handler.reject(
        DioException(
          requestOptions: options,
          error: TenantContextFailure(
            clientCompanyId: expectedCompanyId,
            transportCompanyId: parsed.values.isEmpty ? null : parsed.values.first,
            companyCount: parsed.matches.length,
            cookieHeader: ch.isEmpty ? null : ch,
            reason: 'payease_company cookie count!=1 or mismatch',
          ),
        ),
      );
      return;
    }

    handler.next(options);
  }

  static ({List<RegExpMatch> matches, List<String> values}) _parseCompanyCookie(
    String header,
  ) {
    final regex = RegExp(r'payease_company=([^;]+)', multiLine: false);
    final matches = regex.allMatches(header).toList();
    final values = matches.map((m) => m.group(1)?.trim()).whereType<String>().toList();
    return (matches: matches, values: values);
  }
}
