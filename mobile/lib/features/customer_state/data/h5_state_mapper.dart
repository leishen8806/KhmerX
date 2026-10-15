import '../../../../core/session/company_id.dart';
import '../domain/billing.dart';
import '../domain/customer_snapshot.dart';
import '../domain/kyc_status.dart';
import '../domain/loan_event.dart';
import '../domain/loan_status.dart';
import '../domain/loan_summary.dart';
import 'dto/h5_state_dto.dart';

final class H5StateMapper {
  H5StateMapper._();

  static DateTime? _parseAt(String? s) {
    if (s == null) return null;
    final trimmed = s.trim();
    if (trimmed.isEmpty) return null;
    return DateTime.tryParse(trimmed);
  }

  static Billing? _billing(H5StateBillingDto? dto) {
    if (dto == null) return null;
    return Billing(
      quoteId: dto.quoteId,
      principal: dto.principal,
      deduction: dto.deduction,
      interest: dto.interest,
      service: dto.service,
      upfront: dto.upfront,
      net: dto.net,
      total: dto.total,
      currency: dto.currency,
      termDays: dto.termDays,
      version: dto.version,
    );
  }

  static LoanSummary? _loan(H5StateLoanDto dto) {
    final id = dto.id;
    if (id == null || id.isEmpty) return null;
    final amount = dto.amount;
    if (amount == null) return null;
    if (amount < 0) return null;
    return LoanSummary(
      id: id,
      status: LoanStatusParser.parse(dto.status),
      amount: amount,
      fee: dto.fee ?? 0,
      paid: dto.paid ?? 0,
      wallet: dto.wallet,
      createdAt: _parseAt(dto.createdAt),
      dueAt: _parseAt(dto.dueAt),
      signedAt: _parseAt(dto.signedAt),
      bill: _billing(dto.billing),
      billConfirmedAt: _parseAt(dto.billConfirmedAt),
      name: dto.name,
      contract: dto.contract,
    );
  }

  static List<LoanSummary> _loans(List<Object?> rawLoans) {
    final out = <LoanSummary>[];
    for (final r in rawLoans) {
      final dto = H5StateLoanDto.fromJson(r);
      final mapped = _loan(dto);
      if (mapped != null) out.add(mapped);
    }
    return List.unmodifiable(out);
  }

  static List<LoanEvent> _events(List<Object?> rawEvents) {
    final out = <LoanEvent>[];
    for (final r in rawEvents) {
      final dto = H5StateEventDto.fromJson(r);
      final ev = _event(dto);
      out.add(ev);
    }
    return List.unmodifiable(out);
  }

  static LoanEvent _event(H5StateEventDto dto) {
    final normalized = <String, dynamic>{
      if (dto.loanId != null) 'loanId': dto.loanId,
      if (dto.action != null) 'action': dto.action,
      if ((dto.at ?? dto.timestamp ?? dto.createdAt) != null)
        'at': dto.at ?? dto.timestamp ?? dto.createdAt,
      ...dto.raw,
    };
    return LoanEventParser.parse(normalized);
  }

  static CustomerSnapshot toSnapshot(
    CompanyId companyId,
    H5StateEnvelopeDto envelope,
  ) {
    final kycStatus = envelope.kyc == null
        ? const KycNone()
        : KycStatusParser.parse(envelope.kyc!.status);

    final state = envelope.state ?? const <String, dynamic>{};
    final rawLoans = state['loans'] is List
        ? List<Object?>.unmodifiable(state['loans'] as List)
        : const <Object?>[];
    final rawEvents = state['events'] is List
        ? List<Object?>.unmodifiable(state['events'] as List)
        : const <Object?>[];

    final loans = _loans(rawLoans);
    final events = _events(rawEvents);

    return CustomerSnapshot(
      companyId: companyId,
      kycStatus: kycStatus,
      loans: loans,
      events: events,
      revision: envelope.revision,
      fetchedAt: DateTime.now(),
    );
  }
}
