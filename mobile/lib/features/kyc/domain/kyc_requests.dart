import 'kyc_schema.dart';

final class KycRequest {
  const KycRequest(this.target, this.reasonCode, this.note);
  final String target;
  final String reasonCode;
  final String note;
  KycSection? get section => null;
  bool matchesStep(KycStep step) => false;
}

List<KycRequest>? parseKycRequests(Object? review) => null;
