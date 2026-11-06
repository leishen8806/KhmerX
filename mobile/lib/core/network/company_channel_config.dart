import 'network_config.dart';

final class CompanyChannelConfig {
  const CompanyChannelConfig({required this.type,required this.hosts,required this.origins,required this.cookieHosts, this.apiBaseUrl});
  final String type;
  final List<String> hosts;
  final List<String> origins;
  final List<String> cookieHosts;
  final Uri? apiBaseUrl;

  factory CompanyChannelConfig.fromJson(Map<String,dynamic> json){
    final type=(json['type'] ?? '').toString();
    if(!{'telegram','h5','app'}.contains(type))throw const FormatException('invalid company channel type');
    List<String> list(Object? value)=>value is List?value.map((x)=>x.toString().trim().toLowerCase()).where((x)=>x.isNotEmpty).toSet().toList(growable:false):const <String>[];
    final hosts=list(json['hosts']),origins=list(json['origins']),cookies=list(json['cookieHosts']??json['cookie_hosts']);
    final rawApi=json['apiBaseUrl']??json['api_base_url'];
    Uri? api;
    if (rawApi != null && rawApi.toString().trim().isNotEmpty) {
      api=Uri.tryParse(rawApi.toString().trim());
      if (api == null || !{'http','https'}.contains(api.scheme) || api.host.isEmpty || api.userInfo.isNotEmpty || api.query.isNotEmpty || api.fragment.isNotEmpty) {
        throw const FormatException('invalid company channel api base url');
      }
    }
    if(type!='telegram'&&(hosts.isEmpty||origins.isEmpty))throw const FormatException('company channel hosts are incomplete');
    return CompanyChannelConfig(type:type,hosts:hosts,origins:origins,cookieHosts:cookies,apiBaseUrl:api);
  }

  NetworkConfig applyTo(NetworkConfig config)=>config.copyWith(baseUrl:apiBaseUrl,cookieHosts:cookieHosts);
}
