import '../../../core/session/company_id.dart';

final class CompanyLinkParser {
  CompanyLinkParser._();

  static const String _scheme = 'https';
  static const String _host = 'khmerx.org';
  static const String _path = '/app';

  static CompanyId? parseCompanyId(Uri uri) {
    if (uri.scheme != _scheme) return null;
    if (uri.host != _host) return null;
    if (uri.path != _path) return null;

    final cParams = uri.queryParametersAll['c'];
    if (cParams == null || cParams.length != 1) return null;
    return CompanyId.tryParse(cParams.single);
  }
}
