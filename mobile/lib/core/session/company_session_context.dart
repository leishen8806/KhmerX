import 'package:equatable/equatable.dart';

import 'company_context.dart';
import 'company_id.dart';

final class CompanySessionContext extends Equatable {
  final CompanyContext company;
  final bool hasSession;
  final bool hasBrowser;
  final bool hasVisitor;

  const CompanySessionContext({
    required this.company,
    required this.hasSession,
    required this.hasBrowser,
    required this.hasVisitor,
  });

  CompanyId get companyId => company.id;

  @override
  List<Object?> get props => [company, hasSession, hasBrowser, hasVisitor];
}
