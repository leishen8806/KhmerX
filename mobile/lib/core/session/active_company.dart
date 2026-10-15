import 'package:equatable/equatable.dart';

import '../session/company_id.dart';

final class ActiveCompany extends Equatable {
  final CompanyId id;
  final String displayName;

  const ActiveCompany({
    required this.id,
    required this.displayName,
  });

  @override
  List<Object?> get props => [id, displayName];
}
