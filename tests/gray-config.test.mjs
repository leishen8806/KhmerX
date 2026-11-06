import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {checkConfig} from '../deploy/standalone/gray/check-config.mjs';
const composeAvailable=spawnSync('docker',['compose','version'],{encoding:'utf8'}).status===0,daemonAvailable=spawnSync('docker',['info','--format','{{.OSType}}'],{encoding:'utf8',timeout:5000}).status===0;
const sample=()=>JSON.parse(readFileSync('deploy/standalone/gray/config.json.example','utf8'));
function configured(){const c=sample(),secret=()=>randomBytes(32).toString('hex');for(const key of ['accessUser','accessPassword','sessionSecret'])c[key]=secret();for(const [key,value]of Object.entries(c.bindings))if(value.startsWith('replace-with-'))c.bindings[key]=secret();c.companies[0].id='t_'+randomUUID();c.customerCompanyId=c.companies[0].id;c.companies[0].accounts[0].hash='v2:600000:'+secret()+':'+secret();return c}
test('Q4 sample documents the real schema but is never deployable unchanged',()=>{
 assert.equal(checkConfig(sample(),{example:true}).deployable,false);assert.throws(()=>checkConfig(sample()),/accessUser/);
 assert.deepEqual(checkConfig(configured()),{schema:'gray',deployable:true,companies:1,authMode:'telegram',customerRows:'off'});const c=configured();for(const mode of ['shadow','on']){c.bindings.CUSTOMER_ROWS=mode;assert.equal(checkConfig(c).customerRows,mode)}
});
test('Q4 preflight refuses all known boot/auth blockers and unsafe gray settings',()=>{
 const cases=[c=>delete c.companies[0].slug,c=>delete c.companies[0].accounts,c=>c.companies[0].id='gray-public-company',c=>c.companies[0].id='t_'+'-'.repeat(36),c=>c.companies.push(c.companies[0]),c=>c.companies[0].accounts=[],c=>c.companies[0].accounts[0].hash='plaintext',c=>c.bindings.PAYEASE_ENV='production',c=>c.bindings.KHMERX_TEST_MODE='true',c=>c.bindings.PAYEASE_IDENTITY_PROOF_REQUIRED='false',c=>c.bindings.PAYEASE_AUTH_MODE='demo',c=>c.bindings.PAYEASE_H5_AUTH_MODE='telegram',c=>delete c.bindings.PAYEASE_AUTH_MODE,c=>delete c.bindings.KYC_DATA_SECRET,c=>delete c.bindings.TELEGRAM_GATEWAY_TOKEN,c=>delete c.bindings.TELEGRAM_BOT_TOKEN_1,c=>c.bindings.CUSTOMER_ROWS='invalid',c=>c.bindings.KYC_SCAN_URL='https://scanner.example.test/scan',c=>c.publicClientHosts=['testpayease.khmerx.org'],c=>c.apiHosts=['api.khmerx.org'],c=>c.bindings.PAYEASE_GATEWAY_RATE_SCALE='NaN'];
 for(const [index,change] of cases.entries()){const c=configured();change(c);assert.throws(()=>checkConfig(c),/Invalid gray configuration/,`case ${index} did not fail`)}
});
test('Q4 CLI is read-only, masks secrets even on failure, rejects invalid JSON',()=>{
 const dir=mkdtempSync(join(tmpdir(),'khmerx-q4-')),file=join(dir,'config.json'),c=configured(),secret=c.bindings.PAYEASE_AUTH_SECRET;
 try{writeFileSync(file,JSON.stringify(c));const before=readFileSync(file),cmd=args=>spawnSync(process.execPath,['deploy/standalone/gray/check-config.mjs',...args],{encoding:'utf8'});let r=cmd([file]);assert.equal(r.status,0);assert(!r.stdout.includes(secret));assert.deepEqual(readFileSync(file),before);c.bindings.PAYEASE_H5_AUTH_MODE='telegram';writeFileSync(file,JSON.stringify(c));r=cmd([file]);assert.equal(r.status,1);assert(!r.stderr.includes(secret));writeFileSync(file,'{"secret":"'+secret+'",');r=cmd([file]);assert.equal(r.status,1);assert(!r.stderr.includes(secret));assert.equal(cmd(['--unknown',file]).status,1)}finally{assert(dir.startsWith(join(tmpdir(),'khmerx-q4-')));rmSync(dir,{recursive:true,force:true})}
});
test('Q4 Compose resolves app build root and permits only app writes to scanner secrets',{skip:!composeAvailable},()=>{
 const r=spawnSync('docker',['compose','-f','deploy/standalone/gray/compose.gray.yaml','config','--format','json'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);const {services}=JSON.parse(r.stdout),app=services.payease;
 assert.equal(resolve(app.build.context),resolve('.'));assert.equal(app.build.dockerfile,'deploy/standalone/Dockerfile');assert.equal(app.user,'node');assert.equal(Number(app.mem_limit),1610612736);
 const token=service=>service.volumes.find(v=>v.target==='/run/scanner-secrets');assert(!token(app).read_only);assert.equal(token(services.scanner).read_only,true);assert.equal(app.ports[0].host_ip,'127.0.0.1');assert(!services.scanner.ports?.length);
 const boot=readFileSync('deploy/standalone/gray/bootstrap-gray.sh','utf8');assert.match(boot,/chown 1000:1000 \/opt\/payease\/data/);assert.match(boot,/chown 1000:65534 \/opt\/payease\/scanner-secrets/);assert.match(boot,/chmod 2750 \/opt\/payease\/scanner-secrets/);
});
test('Q4 bootstrap metadata repairs are idempotent in a disposable Linux fixture',{skip:!daemonAvailable},()=>{
 const r=spawnSync('docker',['run','--rm','--network','none','-v',resolve('.')+':/src:ro','node:22-bookworm','bash','-c',"tr -d '\\r' < /src/tests/gray-bootstrap.test.sh | bash"],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/bootstrap repeat PASS/);
});
