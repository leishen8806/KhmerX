enum UpgradeKind { required, available }

final class UpgradeNotice {
  const UpgradeNotice({
    required this.kind,
    required this.currentVersion,
    required this.latestVersion,
    this.downloadUrl,
  });

  final UpgradeKind kind;
  final String currentVersion;
  final String latestVersion;
  final Uri? downloadUrl;

  factory UpgradeNotice.fromChannelJson(Map<String, dynamic> json, String currentVersion) {
    final latest = (json['latestVersion'] ?? json['latest_version'] ?? '').toString().trim();
    if (latest.isEmpty) throw const FormatException('upgrade version is missing');
    final force = json['forceUpgrade'] == true || json['force_upgrade'] == 1;
    final rawUrl = (json['downloadUrl'] ?? json['download_url'] ?? '').toString().trim();
    final url = rawUrl.isEmpty ? null : Uri.tryParse(rawUrl);
    if (rawUrl.isNotEmpty && (url == null || !{'http', 'https'}.contains(url.scheme) || url.host.isEmpty)) {
      throw const FormatException('upgrade download URL is invalid');
    }
    return UpgradeNotice(
      kind: force ? UpgradeKind.required : UpgradeKind.available,
      currentVersion: currentVersion,
      latestVersion: latest,
      downloadUrl: url,
    );
  }
}
