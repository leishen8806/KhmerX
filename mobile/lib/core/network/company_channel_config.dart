import 'network_config.dart';

final class CompanyChannelConfig {
  const CompanyChannelConfig({required this.type,required this.hosts,required this.origins,required this.cookieHosts});
  final String type;
  final List<String> hosts;
  final List<String> origins;
  final List<String> cookieHosts;

  factory CompanyChannelConfig.fromJson(Map<String,dynamic> json){
    final type=String(json['type']??'');
    if(!{'telegram','h5','app'}.contains(type))throw const FormatException('invalid company channel type');
    List<String> list(Object? value)=>value is List?value.map((x)=>String(x).trim().toLowerCase()).where((x)=>x.isNotEmpty).toSet().toList(growable:false):const <String>[];
    final hosts=list(json['hosts']),origins=list(json['origins']),cookies=list(json['cookieHosts']??json['cookie_hosts']);
    if(type!='telegram'&&(hosts.isEmpty||origins.isEmpty))throw const FormatException('company channel hosts are incomplete');
    return CompanyChannelConfig(type:type,hosts:hosts,origins:origins,cookieHosts:cookies);
  }

  NetworkConfig applyTo(NetworkConfig config)=>config.copyWith(cookieHosts:cookieHosts);
}
