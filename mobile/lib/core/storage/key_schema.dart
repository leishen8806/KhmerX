final class KeySchema {
  KeySchema._();

  static const String _prefix = 'v1';
  static const String _companyPrefix = '$_prefix/co';

  static String companyPrefix(String companyIdRaw) =>
      '$_companyPrefix/$companyIdRaw';

  static String cookieJarPrefix(String companyIdRaw) =>
      '${companyPrefix(companyIdRaw)}/cookiejar';

  static String cookieStorageKey(String companyIdRaw, String subKey) =>
      '${cookieJarPrefix(companyIdRaw)}/$subKey';

  static String localePref(String companyIdRaw) =>
      '${companyPrefix(companyIdRaw)}/locale';

  static const String activeCompanyId = '$_prefix/app/activeCompanyId';
  static const String companies = '$_prefix/app/companies';
}
