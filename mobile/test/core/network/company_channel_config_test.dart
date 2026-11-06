import 'package:flutter_test/flutter_test.dart';
import 'package:khmerx_app/core/network/company_channel_config.dart';
import 'package:khmerx_app/core/network/network_config.dart';

void main(){
 test('dynamic cookie_hosts are normalized and applied without secrets',(){
  final channel=CompanyChannelConfig.fromJson({'type':'h5','hosts':['H5.Example.test'],'origins':['h5.example.test'],'cookie_hosts':['Api.Example.test','api.example.test'],'api_base_url':'https://api.example.test'});
  expect(channel.cookieHosts,['api.example.test']);
  final cfg=NetworkConfig(baseUrl:Uri.parse('https://api.khmerx.org'),connectTimeout:Duration.zero,sendTimeout:Duration.zero,receiveTimeout:Duration.zero,logoutTimeout:Duration.zero);
  expect(channel.applyTo(cfg).cookieHosts,['api.example.test']);
  expect(channel.applyTo(cfg).baseUrl,Uri.parse('https://api.example.test'));
 });
 test('incomplete dynamic channel config fails closed',(){expect(()=>CompanyChannelConfig.fromJson({'type':'app','hosts':[],'origins':[]}),throwsFormatException);});
 test('invalid dynamic API base URL fails closed',(){expect(()=>CompanyChannelConfig.fromJson({'type':'h5','hosts':['h5.example.test'],'origins':['https://h5.example.test'],'api_base_url':'javascript:alert(1)'}),throwsFormatException);});
}
