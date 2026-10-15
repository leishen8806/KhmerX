final class SessionManager {
  final Map<String, bool> _companyHasSession = {};

  bool hasSession(String companyRaw) => _companyHasSession[companyRaw] ?? false;

  void markSessionPresent(String companyRaw) {
    _companyHasSession[companyRaw] = true;
  }

  void clearSessionOnly(String companyRaw) {
    _companyHasSession[companyRaw] = false;
  }

  void removeCompany(String companyRaw) {
    _companyHasSession.remove(companyRaw);
  }
}
