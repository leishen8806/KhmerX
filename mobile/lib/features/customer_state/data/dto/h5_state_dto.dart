import 'package:equatable/equatable.dart';

class H5StateBillingDto {
  const H5StateBillingDto({
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
    this.deductionBps,
    this.annualInterestBps,
    this.monthlyInterestBps,
    this.interestTiming,
    this.serviceTiming,
    this.serviceBps,
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
  final Object? deductionBps;
  final Object? annualInterestBps;
  final Object? monthlyInterestBps;
  final Object? interestTiming;
  final Object? serviceTiming;
  final Object? serviceBps;
  final Object? version;

  static int? _int(Object? v) {
    if (v == null) return null;
    if (v is int) return v;
    if (v is num) return v.toInt();
    final s = v.toString().trim();
    if (s.isEmpty) return null;
    return int.tryParse(s);
  }

  static H5StateBillingDto fromJson(Object? data) {
    if (data is! Map) return const H5StateBillingDto();
    final map = Map<String, dynamic>.from(data);
    return H5StateBillingDto(
      quoteId: map['quoteId']?.toString(),
      principal: _int(map['principal']),
      deduction: _int(map['deduction']),
      interest: _int(map['interest']),
      service: _int(map['service']),
      upfront: _int(map['upfront']),
      net: _int(map['net']),
      total: _int(map['total']),
      currency: map['currency']?.toString(),
      termDays: _int(map['termDays']),
      deductionBps: map['deductionBps'],
      annualInterestBps: map['annualInterestBps'],
      monthlyInterestBps: map['monthlyInterestBps'],
      interestTiming: map['interestTiming'],
      serviceTiming: map['serviceTiming'],
      serviceBps: map['serviceBps'],
      version: map['version'],
    );
  }
}

class H5StateLoanDto {
  const H5StateLoanDto({
    required this.raw,
    this.id,
    this.status,
    this.amount,
    this.fee,
    this.paid,
    this.wallet,
    this.createdAt,
    this.dueAt,
    this.signedAt,
    this.billing,
    this.billConfirmedAt,
    this.contract,
    this.name,
  });

  final Map<String, dynamic> raw;
  final String? id;
  final String? status;
  final int? amount;
  final int? fee;
  final int? paid;
  final int? wallet;
  final String? createdAt;
  final String? dueAt;
  final String? signedAt;
  final H5StateBillingDto? billing;
  final String? billConfirmedAt;
  final String? contract;
  final String? name;

  static int? _int(Object? v) {
    if (v == null) return null;
    if (v is int) return v;
    if (v is num) return v.toInt();
    final s = v.toString().trim();
    if (s.isEmpty) return null;
    return int.tryParse(s);
  }

  static H5StateLoanDto fromJson(Object? data) {
    if (data is! Map) {
      return const H5StateLoanDto(raw: {});
    }
    final map = Map<String, dynamic>.from(data);
    final billingRaw = map['billing'] ?? map['bill'];
    return H5StateLoanDto(
      raw: map,
      id: map['id']?.toString(),
      status: map['status']?.toString(),
      amount: _int(map['amount']),
      fee: _int(map['fee']),
      paid: _int(map['paid']),
      wallet: _int(map['wallet']),
      createdAt: map['createdAt']?.toString(),
      dueAt: map['dueAt']?.toString(),
      signedAt: map['signedAt']?.toString(),
      billing: billingRaw == null
          ? null
          : H5StateBillingDto.fromJson(billingRaw),
      billConfirmedAt: map['billConfirmedAt']?.toString(),
      contract: map['contract']?.toString(),
      name: map['name']?.toString(),
    );
  }
}

class H5StateEventDto {
  const H5StateEventDto({
    required this.raw,
    this.loanId,
    this.action,
    this.at,
    this.timestamp,
    this.createdAt,
  });

  final Map<String, dynamic> raw;
  final String? loanId;
  final String? action;
  final String? at;
  final String? timestamp;
  final String? createdAt;

  static H5StateEventDto fromJson(Object? data) {
    if (data is! Map) return const H5StateEventDto(raw: {});
    final map = Map<String, dynamic>.from(data);
    return H5StateEventDto(
      raw: map,
      loanId: map['loanId']?.toString(),
      action: map['action']?.toString(),
      at: map['at']?.toString(),
      timestamp: map['timestamp']?.toString(),
      createdAt: map['createdAt']?.toString(),
    );
  }
}

class H5StateKycDto {
  const H5StateKycDto({this.status});
  final String? status;

  static H5StateKycDto fromJson(Object? data) {
    if (data is! Map) return const H5StateKycDto();
    final map = Map<String, dynamic>.from(data);
    return H5StateKycDto(status: map['status']?.toString());
  }
}

class H5StateEnvelopeDto extends Equatable {
  const H5StateEnvelopeDto({
    this.state,
    this.kyc,
    this.revision,
    this.pricing,
    this.rawBody = const <String, dynamic>{},
  });

  final Map<String, dynamic>? state;
  final H5StateKycDto? kyc;
  final Object? revision;
  final Object? pricing;
  final Map<String, dynamic> rawBody;

  static H5StateEnvelopeDto fromJson(Object? data) {
    final raw =
        data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
    final stateRaw = raw['state'];
    return H5StateEnvelopeDto(
      state: stateRaw is Map
          ? Map<String, dynamic>.from(stateRaw)
          : null,
      kyc: raw['kyc'] == null ? null : H5StateKycDto.fromJson(raw['kyc']),
      revision: raw['revision'],
      pricing: raw['pricing'],
      rawBody: raw,
    );
  }

  @override
  List<Object?> get props => [state, kyc, revision, pricing, rawBody];
}
