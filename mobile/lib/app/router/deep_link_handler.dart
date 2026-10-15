import 'package:app_links/app_links.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/session/company_id.dart';
import '../../features/company/domain/company_link_parser.dart';
import '../bootstrap/providers.dart';

final class DeepLinkHandler {
  final WidgetRef _ref;

  DeepLinkHandler._(this._ref);

  static Future<DeepLinkHandler> register(WidgetRef ref) async {
    final appLinks = AppLinks();
    final handler = DeepLinkHandler._(ref);
    try {
      final initial = await appLinks.getInitialLink();
      if (initial != null) handler._handle(initial);
    } catch (_) {}
    appLinks.uriLinkStream.listen(handler._handle);
    return handler;
  }

  void _handle(Uri uri) {
    final companyId = CompanyLinkParser.parseCompanyId(uri);
    if (companyId == null) return;
    _ref.read(pendingDeepLinkCompanyProvider.notifier).set(companyId);
    _ref.read(pendingCandidateCompanyProvider.notifier).set(companyId);
  }
}

final class PendingDeepLinkCompanyNotifier extends Notifier<CompanyId?> {
  @override
  CompanyId? build() => null;
  void set(CompanyId? id) => state = id;
}

final pendingDeepLinkCompanyProvider =
    NotifierProvider<PendingDeepLinkCompanyNotifier, CompanyId?>(
      PendingDeepLinkCompanyNotifier.new,
    );
