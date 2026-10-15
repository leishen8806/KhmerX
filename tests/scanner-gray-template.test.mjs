import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const compose='deploy/clamav-gateway/gray/compose.yaml';
const available=spawnSync('docker',['compose','version'],{encoding:'utf8'}).status===0;
test('gray scanner Compose requires credentials and exposes only the TLS perimeter',{skip:!available},()=>{
 const env={...process.env,KYC_SCAN_TOKEN:'synthetic-configuration-test',SCANNER_HOST:'scanner.example.test'};
 const result=spawnSync('docker',['compose','-f',compose,'config','--format','json'],{env,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const {services}=JSON.parse(result.stdout);
 for(const name of ['clamd-a','clamd-b']){assert.equal(Number(services[name].mem_limit),3221225472);assert.equal(services[name].environment.FRESHCLAM_CHECKS,'1');assert(!services[name].ports?.length)}
 for(const name of ['gateway-a','gateway-b']){assert.equal(services[name].ports[0].host_ip,'127.0.0.1');assert.match(services[name].command.join(' '),/assert.*SCAN_TOKEN/)}
 assert.equal(services.tls.network_mode,'host');assert.notEqual(services['clamd-a'].volumes[0].source,services['clamd-b'].volumes[0].source);
 delete env.KYC_SCAN_TOKEN;const missing=spawnSync('docker',['compose','-f',compose,'config','-q'],{env,encoding:'utf8'});assert.notEqual(missing.status,0);
 const caddy=readFileSync('deploy/clamav-gateway/gray/Caddyfile','utf8');assert.match(caddy,/remote_ip 159\.223\.77\.134/);assert.match(caddy,/respond 403/);assert.match(caddy,/tls \/run\/tls\/scanner.crt \/run\/tls\/scanner.key/);
});
