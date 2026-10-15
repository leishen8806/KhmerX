abstract interface class RemoteFeatureConfig {
  Future<Map<String, bool>> fetch();
}
