import 'package:equatable/equatable.dart';

final class AuthPreflightSnapshot extends Equatable {
  const AuthPreflightSnapshot({
    this.company,
    this.authenticated = false,
    this.session,
    this.pending,
    this.policy = const <String, dynamic>{},
    this.languages = const <String, bool>{},
  });
  final String? company;
  final bool authenticated;
  final Map<String, dynamic>? session;
  final Map<String, dynamic>? pending;
  final Map<String, dynamic> policy;
  final Map<String, bool> languages;

  bool get needsPassword =>
      policy['passwordSetup'] == true && session?['hasPassword'] == false;

  List<String> enabledLanguageCodes() {
    final out = <String>[];
    if (languages.isEmpty) {
      return const ['en', 'km'];
    }
    for (final e in languages.entries) {
      if (e.value == true) out.add(e.key);
    }
    if (out.isEmpty) return const ['en', 'km'];
    return out;
  }

  @override
  List<Object?> get props => [
    company,
    authenticated,
    session,
    pending,
    policy,
    languages,
  ];
}

final class OtpSendResponse extends Equatable {
  const OtpSendResponse({
    required this.challengeId,
    required this.phoneMasked,
    required this.expiresAt,
    required this.retryAt,
    this.mode = 'telegram',
    this.message,
  });
  final String challengeId;
  final String phoneMasked;
  final DateTime expiresAt;
  final DateTime retryAt;
  final String mode;
  final String? message;

  @override
  List<Object?> get props =>
      [challengeId, phoneMasked, expiresAt, retryAt, mode, message];
}

final class OtpVerifyResponse extends Equatable {
  const OtpVerifyResponse({
    required this.authenticated,
    this.session,
    this.policy,
  });
  final bool authenticated;
  final Map<String, dynamic>? session;
  final Map<String, dynamic>? policy;

  @override
  List<Object?> get props => [authenticated, session, policy];
}

sealed class AuthGateState extends Equatable {
  const AuthGateState();

  bool get isUnknown => this is AuthGateUnknown;
  bool get isUnauthenticated => this is AuthGateUnauthenticated;
  bool get isRegistrationIncomplete => this is AuthGateRegistrationIncomplete;
  bool get isAuthenticated => this is AuthGateAuthenticated;

  @override
  List<Object?> get props => const [];
}

final class AuthGateUnknown extends AuthGateState {
  const AuthGateUnknown();
}

final class AuthGateUnauthenticated extends AuthGateState {
  const AuthGateUnauthenticated();
}

final class AuthGateRegistrationIncomplete extends AuthGateState {
  const AuthGateRegistrationIncomplete();
}

final class AuthGateAuthenticated extends AuthGateState {
  final String accountId;

  const AuthGateAuthenticated({required this.accountId});

  @override
  List<Object?> get props => [accountId];
}
