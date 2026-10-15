import 'package:equatable/equatable.dart';

final class Billing extends Equatable {
  const Billing({
    this.quoteId,
    this.principal,
    this.deduction,
    this.interest,
    this.service,
    this.upfront,
    this.net,
    this.total,
    this.currency,
    this.termDays,
    this.version,
  });

  final String? quoteId;
  final int? principal;
  final int? deduction;
  final int? interest;
  final int? service;
  final int? upfront;
  final int? net;
  final int? total;
  final String? currency;
  final int? termDays;
  final Object? version;

  Billing copyWith({
    String? quoteId,
    int? principal,
    int? deduction,
    int? interest,
    int? service,
    int? upfront,
    int? net,
    int? total,
    String? currency,
    int? termDays,
    Object? version,
  }) {
    return Billing(
      quoteId: quoteId ?? this.quoteId,
      principal: principal ?? this.principal,
      deduction: deduction ?? this.deduction,
      interest: interest ?? this.interest,
      service: service ?? this.service,
      upfront: upfront ?? this.upfront,
      net: net ?? this.net,
      total: total ?? this.total,
      currency: currency ?? this.currency,
      termDays: termDays ?? this.termDays,
      version: version ?? this.version,
    );
  }

  @override
  List<Object?> get props => [
        quoteId,
        principal,
        deduction,
        interest,
        service,
        upfront,
        net,
        total,
        currency,
        termDays,
        version,
      ];
}
