import 'package:equatable/equatable.dart';

import 'active_company.dart';
import 'company_id.dart';

final class CompanyContext extends Equatable {
  final CompanyId id;
  final ActiveCompany active;

  const CompanyContext({
    required this.id,
    required this.active,
  });

  @override
  List<Object?> get props => [id, active];
}
