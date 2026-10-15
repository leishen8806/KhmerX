// Run: node --experimental-vm-modules --test tests/*.test.mjs
// S3 安全收口 tests: strict Origin on the four staff write interfaces, no
// shared 'unknown' rate-limit bucket when the edge address is missing, the
// production/test-mode runtime guard (boot + readiness), and token redaction
// in Telegram bot-credential logs. Uses the same in-process harness as
// team-integration.test.mjs: real SQLite + unchanged application TS sources,
// synthetic platform bindings.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root=path.resolve('.');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+f,'utf8'));
const DB={
 prepare(query){return {bind(...args){const s=sql.prepare(query);return {
  async first(){return s.get(...args)||null},
  async all(){return {results:s.all(...args)}},
  async run(){const r=s.run(...args);return {meta:{changes:Number(r.changes)}}}
 }}}},
 async batch(statements){sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}
};
const blobs=new Map();
const env={DB,BUCKET:{async put(k,v){blobs.set(k,v)},async get(k){const v=blobs.get(k);return v?{async arrayBuffer(){return v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength)}}:null},async delete(k){blobs.delete(k)}},KYC_DATA_SECRET:'synthetic-only-'.repeat(5),KYC_REVIEWER_EMAILS:'owner@example.test',PAYEASE_AUTH_SECRET:'synthetic-auth-'.repeat(5),PAYEASE_AUTH_MODE:'demo',KHMERX_TEST_MODE:'true',TELEGRAM_BOT_TOKEN:''};
const user={userId:'owner',email:'owner@example.test'};
const context=vm.createContext({console,crypto,TextEncoder,TextDecoder,Headers,Request,Response,URL,URLSearchParams,AbortSignal,Uint8Array,ArrayBuffer,Buffer,Date,structuredClone,atob,btoa,setTimeout,clearTimeout,fetch:async()=>Response.json({ok:false})});
const cache=new Map();
function synth(id,values){const m=new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v)},{context,identifier:id});cache.set(id,m);return m}
synth('cloudflare:workers',{env});
synth('next/headers',{headers:async()=>new Headers({})});
synth(path.join(root,'app/chatgpt-auth.ts'),{getChatGPTUser:async()=>user});
function getModule(spec,base=root+'/entry.ts'){let id=spec;if(spec.startsWith('@/'))id=path.join(root,spec.slice(2));else if(spec.startsWith('.'))id=path.resolve(path.dirname(base),spec);if(!cache.has(id)&&!path.extname(id)&&fs.existsSync(id+'.ts'))id+='.ts';if(cache.has(id))return cache.get(id);if(id.endsWith('.json'))return synth(id,{default:JSON.parse(fs.readFileSync(id,'utf8'))});const source=ts.transpileModule(fs.readFileSync(id,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;const m=new vm.SourceTextModule(source,{context,identifier:id});cache.set(id,m);return m}
async function mod(name){const m=getModule(name);if(m.status==='unlinked')await m.link((s,p)=>getModule(s,p.identifier));if(m.status==='linked')await m.evaluate();return m.namespace}

const guards=await mod('@/lib/runtime-guards');
const auth=await mod('@/lib/h5-auth');
const core=await mod('@/lib/h5-auth-core');
const routes={
 state:await mod('@/app/api/state/route'),
 bots:await mod('@/app/api/bots/route'),
 customerTags:await mod('@/app/api/team/customer-tags/route'),
 tickets:await mod('@/app/api/team/tickets/route'),
};
const REQUEST_ID_HEADER='x-request-id';
const writeRequest=(url)=>new Request(url,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
const assertEnvelope=(r,b,code)=>{assert.equal(typeof b.code,'string');assert.equal(typeof b.error,'string');assert.equal(typeof b.requestId,'string');assert.equal(r.headers.get(REQUEST_ID_HEADER),b.requestId);if(code!==undefined)assert.equal(b.code,code)};

test('S3: the four staff write interfaces reject a missing Origin with 403 CROSS_SITE_REQUEST',async()=>{
 const writers={state:routes.state.POST,bots:routes.bots.POST,customerTags:routes.customerTags.POST,tickets:routes.tickets.POST};
 for(const [name,fn] of Object.entries(writers)){
  const r=await fn(writeRequest('http://localhost/api/'+name));
  const b=await r.json();
  assert.equal(r.status,403,`${name} missing Origin must be 403`);
  assertEnvelope(r,b,'CROSS_SITE_REQUEST');
 }
});

test('S3: a foreign Origin is rejected with the same 403 envelope',async()=>{
 for(const [name,fn] of Object.entries({state:routes.state.POST,bots:routes.bots.POST,customerTags:routes.customerTags.POST,tickets:routes.tickets.POST})){
  const r=await fn(new Request('http://localhost/api/'+name,{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{}'}));
  const b=await r.json();
  assert.equal(r.status,403,`${name} foreign Origin`);
  assertEnvelope(r,b,'CROSS_SITE_REQUEST');
 }
});

test('S3: no-edge requests never share a global "unknown" rate-limit bucket',async()=>{
 const withIp=new Request('http://localhost/api/h5/auth',{headers:{'CF-Connecting-IP':'203.0.113.7'}});
 const noIp1=new Request('http://localhost/api/h5/auth'),noIp2=new Request('http://localhost/api/h5/auth');
 assert.equal(auth.browserTokenSource(withIp),'203.0.113.7','trusted edge address is used as-is');
 const s1=auth.browserTokenSource(noIp1),s2=auth.browserTokenSource(noIp2);
 assert.ok(s1.startsWith('noedge:'),'missing address falls back to a per-request marker');
 assert.ok(s2.startsWith('noedge:'));
 assert.notEqual(s1,s2,'each no-edge request gets its own bucket, never a shared one');

 await auth.issueBrowserToken(withIp);
 await auth.issueBrowserToken(noIp1);
 await auth.issueBrowserToken(noIp2);
 const rows=(await DB.prepare('SELECT source_hash FROM h5_browser_tokens').bind().all()).results;
 assert.equal(rows.length,3,'three inserts tracked');
 const hashes=new Set(rows.map(r=>r.source_hash));
 assert.equal(hashes.size,3,'three distinct rate-limit buckets');
 const unknownHash=await core.digest('unknown');
 assert.ok(!hashes.has(unknownHash),'no visitor is pooled into the old shared "unknown" bucket');
});

test('S3: runtime guards centralize the test-mode switch and block production+testMode',async()=>{
 try{
  assert.equal(guards.isTestMode(),true);
  assert.equal(guards.isProduction(),false);
  assert.doesNotThrow(()=>guards.assertProductionSafe(),'test mode without the production marker is allowed');
  env.PAYEASE_IDENTITY_PROOF_REQUIRED='true';
  assert.equal(guards.isProduction(),true);
  assert.throws(()=>guards.assertProductionSafe(),/KHMERX_TEST_MODE must be disabled/,'production + testMode must fail closed');
  // Cross-realm objects keep distinct prototypes, so assert field by field
  // instead of deepEqual (vm.SyntheticModule exports come from another realm).
  const blocked=guards.runtimeGuardStatus();
  assert.equal(blocked.testMode,true);
  assert.equal(blocked.production,true);
  assert.equal(blocked.blocked,true);
 }finally{
  delete env.PAYEASE_IDENTITY_PROOF_REQUIRED;
 }
 const released=guards.runtimeGuardStatus();
 assert.equal(released.testMode,true);
 assert.equal(released.production,false);
 assert.equal(released.blocked,false);
});

test('S3: standalone gateway refuses a production boot with test mode on and reports guards on /readyz',()=>{
 const source=fs.readFileSync('deploy/standalone/server.mjs','utf8');
 assert.match(source,/must be disabled for standalone production boot/,'test-mode boot gate exists');
 assert.match(source,/PAYEASE_IDENTITY_PROOF_REQUIRED must be true for standalone production boot/);
 assert.match(source,/guards:\{\.\.\.guards,blocked:guards\.testMode&&guards\.production\}/,'/readyz advertises the runtime-guard state');
 assert.match(source,/'cf-connecting-ip',clientIp\)/,'gateway injects the socket-derived edge address');
});

test('S3: Telegram bot-credential failure logs redact the token and mask URLs',()=>{
 const source=fs.readFileSync('lib/bot-credentials.ts','utf8');
 assert.ok(source.includes("console.error('telegram_getme_connection'"),'connection failures are logged');
 assert.ok(source.includes("replaceAll(token,'[redacted]')"),'the token is scrubbed from the error text');
 assert.ok(source.includes("'[url]'"),'URLs in errors are masked');
 assert.ok(!source.includes("console.error('telegram_getme_connection',error"),'the raw error object never reaches the logger');
});