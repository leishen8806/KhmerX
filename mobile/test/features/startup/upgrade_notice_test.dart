import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/features/startup/domain/upgrade_notice.dart';

void main() {
  test('channel upgrade config separates forced and optional updates', () {
    final required = UpgradeNotice.fromChannelJson({'latest_version': '2.0.0', 'force_upgrade': 1, 'download_url': 'https://testapi.khmerx.org/app/latest'}, '1.0.0');
    expect(required.kind, UpgradeKind.required);
    final optional = UpgradeNotice.fromChannelJson({'latestVersion': '2.0.0'}, '1.0.0');
    expect(optional.kind, UpgradeKind.available);
  });

  test('invalid upgrade download URL fails closed', () {
    expect(() => UpgradeNotice.fromChannelJson({'latest_version': '2.0.0', 'download_url': 'javascript:alert(1)'}, '1.0.0'), throwsFormatException);
  });
}
