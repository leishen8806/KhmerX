import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';

const source=await readFile(new URL('../lib/partner-outbox.ts',import.meta.url),'utf8');
const migration=await readFile(new URL('../drizzle/0064_partner_outbox.sql',import.meta.url),'utf8');

test('partner outbox schema keeps delivery state and unique idempotency',()=>{
 assert.match(migration,/idempotency_key TEXT NOT NULL UNIQUE/);
 assert.match(migration,/status TEXT NOT NULL CHECK .*pending.*sending.*delivered.*dead/s);
 assert.match(migration,/attempts INTEGER NOT NULL DEFAULT 0/);
 assert.match(migration,/next_attempt_at INTEGER NOT NULL DEFAULT 0/);
  assert.match(migration,/lease_until INTEGER/);
 assert.match(migration,/last_error TEXT/);
});

test('outbox payload derives a partner reference and contains no customer identifiers',()=>{
 assert.match(source,/deriveCustomerRef/);
 assert.match(source,/tenantId}\|\$\{institutionId}\|\$\{customerId}/);
 assert.match(source,/applicationId/);
 assert.doesNotMatch(source,/phoneMasked/);
});

test('outbox writes are external-mode gated and idempotent',()=>{
 assert.match(source,/INSERT OR IGNORE INTO partner_outbox/);
 assert.match(source,/WHERE \?='external'/);
  assert.match(source,/changes\(\)=1/);
 assert.match(source,/idempotencyKey/);
});

test('missing external configuration uses the safe client-facing error',async()=>{
 assert.match(source,/PARTNER_NOT_CONFIGURED/);
 assert.match(await readFile(new URL('../lib/store.ts',import.meta.url),'utf8'),/申请暂时无法提交，请稍后再试/);
});

test('dispatcher claims at most twenty pending rows and uses bounded retries',()=>{
 assert.match(source,/LIMIT 20/);
 assert.match(source,/status='sending'/);
 assert.match(source,/Math\.min\(300,30\*2\*\*/);
 assert.match(source,/24\*60\*60\*1000/);
});

test('dispatcher treats 2xx and 409 as delivered and keeps error codes only',()=>{
 assert.match(source,/status>=200&&status<300\)\|\|status===409/);
 assert.match(source,/HTTP_409/);
 assert.match(source,/TIMEOUT/);
 assert.doesNotMatch(source,/response\.text\(|row\.payload.*console/);
});

test('outbound requests are signed, HTTPS-only, and time out after ten seconds',()=>{
 assert.match(source,/url\.protocol==='https:'/);
 assert.match(source,/x-partner-id/);
 assert.match(source,/x-idempotency-key/);
 assert.match(source,/x-signature/);
 assert.match(source,/setTimeout\(\(\)=>controller\.abort\(\),10000\)/);
});

test('dispatcher behavior covers delivery, retry, timeout, expiry, lease reclaim, concurrency, and HTTPS gate',async()=>{
  const env={PAYEASE_INSTITUTION_MODE:'external',PARTNER_OUTBOX:'on',PARTNER_OUTBOUND_SECRETS_JSON:JSON.stringify({inst:'synthetic-secret'}),PARTNER_ENDPOINTS_JSON:JSON.stringify({inst:'https://mock.test/events'}),DB:null};
  const context=vm.createContext({console,crypto:webcrypto,TextEncoder,TextDecoder,URL,btoa,atob,AbortController,setTimeout,clearTimeout});
  const modules=new Map();
  const load=async(name)=>{
    if(modules.has(name))return modules.get(name);
    if(name==='cloudflare:workers'){const m=new vm.SourceTextModule('export const env=globalThis.__env',{context,identifier:name});context.__env=env;modules.set(name,m);await m.link(()=>{throw new Error('unexpected')});await m.evaluate();return m;}
    const file=name==='@/lib/partner-outbox'?'lib/partner-outbox.ts':name==='@/lib/runtime-guards'?'lib/runtime-guards.ts':'lib/institution-callback.ts';
    const code=ts.transpileModule(await readFile(new URL(`../${file}`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll("from 'cloudflare:workers'","from 'cloudflare:workers'").replaceAll("from '@/lib/institution-callback'","from '@/lib/institution-callback'");
    const m=new vm.SourceTextModule(code,{context,identifier:name});modules.set(name,m);await m.link((specifier)=>load(specifier));await m.evaluate();return m;
  };
  const outbox=await load('@/lib/partner-outbox');
  const makeDb=(row)=>{const rows=[row];let fetches=0;const stmt=(sql,args)=>({bind(...bound){return stmt(sql,bound)},async run(){let changes=0;if(sql.startsWith("UPDATE partner_outbox SET status='pending',lease_until=NULL WHERE status='sending'")){for(const r of rows)if(r.status==='sending'&&r.lease_until<=args[0]){r.status='pending';r.lease_until=null;changes++}}else if(sql.startsWith("UPDATE partner_outbox SET status='sending'")){const r=rows.find(x=>x.id===args[1]&&x.status==='pending'&&x.attempts===args[2]);if(r){r.status='sending';r.attempts++;r.lease_until=args[0];changes=1}}else if(sql.startsWith("UPDATE partner_outbox SET status='delivered'")){const r=rows.find(x=>x.id===args[2]&&x.status==='sending');if(r){r.status='delivered';r.lease_until=null;r.delivered_at=args[1];changes=1}}else if(sql.startsWith("UPDATE partner_outbox SET status='dead'")){const r=rows.find(x=>x.id===args[1]&&x.status==='sending');if(r){r.status='dead';r.lease_until=null;r.last_error=args[0];changes=1}}else if(sql.startsWith("UPDATE partner_outbox SET status='pending',lease_until=NULL,last_error")){const r=rows.find(x=>x.id===args[2]&&x.status==='sending');if(r){r.status='pending';r.lease_until=null;r.last_error=args[0];r.next_attempt_at=args[1];changes=1}}return {meta:{changes}}},async all(){return {results:sql.startsWith('SELECT *')?rows.filter(r=>r.status==='pending'&&r.next_attempt_at<=args[0]):[]}},async first(){return null}});return {db:{prepare:(sql)=>stmt(sql,[]),batch:async()=>[]},rows,get fetches(){return fetches},bump(){fetches++}}};
  const now='2026-11-07T00:00:00.000Z';
  const base={id:'1',institution_id:'inst',status:'pending',attempts:0,next_attempt_at:0,created_at:now,lease_until:null,payload:'{}',idempotency_key:'k'};
  let f=makeDb({...base});env.DB=f.db;let result=await outbox.namespace.dispatchPartnerOutbox(now,async()=>{f.bump();return {status:202}});assert.equal(result.sent,1);assert.equal(f.rows[0].status,'delivered');assert.equal(f.fetches,1);
  f=makeDb({...base});env.DB=f.db;await outbox.namespace.dispatchPartnerOutbox(now,async()=>({status:500}));assert.equal(f.rows[0].status,'pending');const retryAt=f.rows[0].next_attempt_at;await outbox.namespace.dispatchPartnerOutbox(new Date(retryAt).toISOString(),async()=>({status:200}));assert.equal(f.rows[0].attempts,2);assert.equal(f.rows[0].status,'delivered');
  f=makeDb({...base,attempts:5});env.DB=f.db;await outbox.namespace.dispatchPartnerOutbox(now,async()=>({status:500}));assert.equal(f.rows[0].attempts,6);assert.equal(f.rows[0].next_attempt_at,Date.parse(now)+300000);
  f=makeDb({...base});env.DB=f.db;await outbox.namespace.dispatchPartnerOutbox(now,async()=>{throw new Error('timeout')});assert.equal(f.rows[0].status,'pending');assert.ok(f.rows[0].next_attempt_at>Date.parse(now));
  f=makeDb({...base,created_at:'2026-11-05T00:00:00.000Z'});env.DB=f.db;await outbox.namespace.dispatchPartnerOutbox(now,async()=>({status:500}));assert.equal(f.rows[0].status,'dead');
  f=makeDb({...base,status:'sending',attempts:1,lease_until:Date.parse(now)-1});env.DB=f.db;await outbox.namespace.dispatchPartnerOutbox(now,async()=>({status:200}));assert.equal(f.rows[0].status,'delivered');
  f=makeDb({...base});env.DB=f.db;await Promise.all([outbox.namespace.dispatchPartnerOutbox(now,async()=>{f.bump();return {status:200}}),outbox.namespace.dispatchPartnerOutbox(now,async()=>{f.bump();return {status:200}})]);assert.equal(f.fetches,1);
  env.PARTNER_ENDPOINTS_JSON=JSON.stringify({inst:'http://mock.test/events'});f=makeDb({...base});env.DB=f.db;await outbox.namespace.dispatchPartnerOutbox(now,async()=>{throw new Error('must not call')});assert.equal(f.rows[0].status,'dead');
  env.PAYEASE_ENV='local';env.PARTNER_ENDPOINTS_JSON=JSON.stringify({inst:'http://127.0.0.1:8799/events'});f=makeDb({...base});env.DB=f.db;await outbox.namespace.dispatchPartnerOutbox(now,async()=>({status:202}));assert.equal(f.rows[0].status,'delivered');
  for(const value of ['http://10.0.0.5/events','http://example.test/events']){env.PARTNER_ENDPOINTS_JSON=JSON.stringify({inst:value});f=makeDb({...base});env.DB=f.db;await outbox.namespace.dispatchPartnerOutbox(now,async()=>{throw new Error('must not call')});assert.equal(f.rows[0].status,'dead');}
  for(const value of ['gray','production',undefined]){if(value===undefined)delete env.PAYEASE_ENV;else env.PAYEASE_ENV=value;env.PARTNER_ENDPOINTS_JSON=JSON.stringify({inst:'http://127.0.0.1:8799/events'});f=makeDb({...base});env.DB=f.db;await outbox.namespace.dispatchPartnerOutbox(now,async()=>{throw new Error('must not call')});assert.equal(f.rows[0].status,'dead');}
});
