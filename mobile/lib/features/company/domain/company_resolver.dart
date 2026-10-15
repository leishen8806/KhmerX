import 'package:equatable/equatable.dart';

import '../../../core/session/company_id.dart';
import 'company_link_parser.dart';

enum CompanyResolutionSource {
  incomingAppLink,
  persistedActive,
  configuredDefault,
}

enum CompanyUnresolvedReason {
  noCandidate,
  appLinkParseFailed,
  appLinkCompanyUnavailable,
  persistedCompanyUnavailable,
  defaultCompanyParseFailed,
  defaultCompanyUnavailable,
  startupNetworkError,
}

sealed class CompanyResolution extends Equatable {
  const CompanyResolution();
}

final class ResolvedCompany extends CompanyResolution {
  const ResolvedCompany({
    required this.companyId,
    required this.source,
    this.requiresCandidateConfirm = false,
  });

  final CompanyId companyId;
  final CompanyResolutionSource source;
  final bool requiresCandidateConfirm;

  @override
  List<Object?> get props => [companyId, source, requiresCandidateConfirm];
}

final class UnresolvedCompany extends CompanyResolution {
  const UnresolvedCompany({
    required this.reason,
    this.hint,
  });

  final CompanyUnresolvedReason reason;
  final String? hint;

  @override
  List<Object?> get props => [reason, hint];
}

final class StartupNetworkError extends CompanyResolution {
  const StartupNetworkError({required this.companyId, required this.source});

  final CompanyId companyId;
  final CompanyResolutionSource source;

  @override
  List<Object?> get props => [companyId, source];
}

final class CompanyResolver {
  const CompanyResolver();

  static bool _isSame(CompanyId? a, CompanyId? b) =>
      a != null && b != null && a.raw == b.raw;

  CompanyResolution resolveForNormalStartup({
    required Uri? incomingAppLink,
    required CompanyId? persistedActive,
    required CompanyId? configuredDefault,
    required Map<String, PreflightResult> preflightResults,
  }) {
    if (incomingAppLink != null) {
      final linkId = CompanyLinkParser.parseCompanyId(incomingAppLink);
      if (linkId == null) {
        return const UnresolvedCompany(reason: CompanyUnresolvedReason.appLinkParseFailed);
      }
      final pf = preflightResults[linkId.raw];
      if (pf == PreflightResult.unavailable) {
        return UnresolvedCompany(
          reason: CompanyUnresolvedReason.appLinkCompanyUnavailable,
          hint: linkId.raw,
        );
      }
      if (pf == PreflightResult.networkError) {
        return StartupNetworkError(
          companyId: linkId,
          source: CompanyResolutionSource.incomingAppLink,
        );
      }
      if (persistedActive != null && !_isSame(persistedActive, linkId)) {
        return ResolvedCompany(
          companyId: linkId,
          source: CompanyResolutionSource.incomingAppLink,
          requiresCandidateConfirm: true,
        );
      }
      return ResolvedCompany(
        companyId: linkId,
        source: CompanyResolutionSource.incomingAppLink,
      );
    }

    if (persistedActive != null) {
      final pf = preflightResults[persistedActive.raw];
      if (pf == PreflightResult.unavailable) {
        return UnresolvedCompany(
          reason: CompanyUnresolvedReason.persistedCompanyUnavailable,
          hint: persistedActive.raw,
        );
      }
      if (pf == PreflightResult.networkError) {
        return StartupNetworkError(
          companyId: persistedActive,
          source: CompanyResolutionSource.persistedActive,
        );
      }
      return ResolvedCompany(
        companyId: persistedActive,
        source: CompanyResolutionSource.persistedActive,
      );
    }

    if (configuredDefault != null) {
      final pf = preflightResults[configuredDefault.raw];
      if (pf == PreflightResult.unavailable) {
        return const UnresolvedCompany(
          reason: CompanyUnresolvedReason.defaultCompanyUnavailable,
        );
      }
      if (pf == PreflightResult.networkError) {
        return StartupNetworkError(
          companyId: configuredDefault,
          source: CompanyResolutionSource.configuredDefault,
        );
      }
      return ResolvedCompany(
        companyId: configuredDefault,
        source: CompanyResolutionSource.configuredDefault,
      );
    }

    return const UnresolvedCompany(reason: CompanyUnresolvedReason.noCandidate);
  }

  CompanyId? pickPreflightCandidate({
    required Uri? incomingAppLink,
    required CompanyId? persistedActive,
    required CompanyId? configuredDefault,
  }) {
    if (incomingAppLink != null) {
      return CompanyLinkParser.parseCompanyId(incomingAppLink);
    }
    if (persistedActive != null) return persistedActive;
    return configuredDefault;
  }
}

enum PreflightResult {
  ok,
  unavailable,
  networkError,
}
