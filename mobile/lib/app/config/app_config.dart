import 'package:equatable/equatable.dart';
import 'package:flutter/foundation.dart' show kReleaseMode;

import '../../core/feature_flags/feature_flags.dart';
import '../../core/network/network_config.dart';
import '../../core/session/company_id.dart';
import 'environment.dart';

final class AppConfig extends Equatable {
  const AppConfig._({
    required this.buildEnvironment,
    required this.networkConfig,
    required this.flags,
    required this.defaultCompanyId,
  });

  factory AppConfig.production() {
    return AppConfig._(
      buildEnvironment: Environment.production,
      networkConfig: NetworkConfig(
        baseUrl: Uri.parse(
          const String.fromEnvironment('API_BASE_URL', defaultValue: 'https://api.khmerx.org'),
        ),
        connectTimeout: const Duration(milliseconds: 10000),
        sendTimeout: const Duration(milliseconds: 15000),
        receiveTimeout: const Duration(milliseconds: 20000),
        logoutTimeout: const Duration(milliseconds: 5000),
      ),
      flags: const FeatureFlags(
        withdraw: false,
        repay: false,
      ),
      defaultCompanyId: _parseDefaultCompanyId(),
    );
  }

  factory AppConfig.dev() {
    return AppConfig._(
      buildEnvironment: Environment.dev,
      networkConfig: NetworkConfig(
        baseUrl: Uri.http('10.0.2.2', ''),
        connectTimeout: const Duration(milliseconds: 10000),
        sendTimeout: const Duration(milliseconds: 15000),
        receiveTimeout: const Duration(milliseconds: 20000),
        logoutTimeout: const Duration(milliseconds: 5000),
      ),
      flags: const FeatureFlags(
        withdraw: false,
        repay: false,
      ),
      defaultCompanyId: _parseDefaultCompanyId(),
    );
  }

  factory AppConfig.staging() {
    throw UnsupportedError('Staging environment is not configured yet');
  }

  factory AppConfig.fromEnvironment() {
    // Debug/profile builds default to dev. A release build must name its
    // environment explicitly (`--dart-define=APP_ENV=production`), so it can
    // never silently point at the emulator address.
    const envString = String.fromEnvironment('APP_ENV');
    if (envString.isEmpty && kReleaseMode) {
      throw StateError(
        'APP_ENV must be set for release builds '
        '(--dart-define=APP_ENV=production).',
      );
    }
    final environment = switch (envString) {
      '' || 'dev' => Environment.dev,
      'staging' => Environment.staging,
      'production' => Environment.production,
      _ => throw StateError('Unknown APP_ENV "$envString"'),
    };

    return switch (environment) {
      Environment.production => AppConfig.production(),
      Environment.dev => AppConfig.dev(),
      Environment.staging => AppConfig.staging(),
    };
  }

  static CompanyId? _parseDefaultCompanyId() {
    const raw = String.fromEnvironment('DEFAULT_COMPANY_ID', defaultValue: '');
    if (raw.isEmpty) return null;
    return CompanyId.tryParse(raw);
  }

  final Environment buildEnvironment;
  final NetworkConfig networkConfig;
  final FeatureFlags flags;
  final CompanyId? defaultCompanyId;

  AppConfig copyWith({
    Environment? buildEnvironment,
    NetworkConfig? networkConfig,
    FeatureFlags? flags,
    CompanyId? defaultCompanyId,
    bool clearDefaultCompanyId = false,
  }) {
    return AppConfig._(
      buildEnvironment: buildEnvironment ?? this.buildEnvironment,
      networkConfig: networkConfig ?? this.networkConfig,
      flags: flags ?? this.flags,
      defaultCompanyId: clearDefaultCompanyId
          ? null
          : defaultCompanyId ?? this.defaultCompanyId,
    );
  }

  @override
  List<Object?> get props => [buildEnvironment, networkConfig, flags, defaultCompanyId];
}
