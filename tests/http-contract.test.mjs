// Run: node --experimental-vm-modules --test tests/http-contract.test.mjs
// ARC-00 §8 contract tests for the shared http/ wrapper (S2) and the five
// migrated routes. Uses the same in-process harness as team-integration.test.mjs:
// real SQLite + unchanged application TS sources, synthetic platform bindings.
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

const http=await mod('@/lib/http/route');
const {ApiError}=await mod('@/lib/http/api-error');
const codes=await mod('@/lib/error-codes');
const {AuthError}=await mod('@/lib/h5-auth-core');
const {KycError}=await mod('@/lib/kyc/core');
const {failure:authFailure,json:authJson}=await mod('@/lib/h5-auth');
const {failed:kycFailed}=await mod('@/lib/kyc/server');
const routes={
 state:await mod('@/app/api/state/route'),
 bots:await mod('@/app/api/bots/route'),
 h5state:await mod('@/app/api/h5/state/route'),
 products:await mod('@/app/api/team/products/route'),
 kyc:await mod('@/app/api/kyc/route'),
};
const REQUEST_ID_HEADER='x-request-id';

// Every failure fails closed when the body shape is broken.
function assertEnvelope(r,b,{code:expectCode}={}){
 assert.equal(typeof b.code,'string','envelope.code');
 assert.equal(typeof b.error,'string','envelope.error');
 assert.equal(typeof b.requestId,'string','envelope.requestId');
 assert.equal(r.headers.get(REQUEST_ID_HEADER),b.requestId,'X-Request-Id must equal body.requestId');
 if(expectCode!==undefined)assert.equal(b.code,expectCode,`code expected ${expectCode}`);
}

test('ARC-00 §2/§8.2: a client UUID is reused for the header and the failure body',async()=>{
 const clientId='18e6a8f2-1c2b-4a91-9f68-3a6e5d4c7a21';
 const handled=http.route({handler:async()=>{throw new ApiError(409,'CONFLICT','产品不存在')}});
 const r=await handled(new Request('http://localhost/api/x',{method:'POST',headers:{[REQUEST_ID_HEADER]:clientId,'content-type':'application/json'}}));
 const b=await r.json();
 assert.equal(r.status,409);
 assertEnvelope(r,b);
 assert.equal(b.requestId,clientId,'client-supplied valid UUID must be reused');
 assert.equal(r.headers.get(REQUEST_ID_HEADER),clientId);
 assert.match(b.requestId,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('S2: route-attached request id is reused by auth and KYC failure helpers without client header',async()=>{
 const handled=http.route({handler:async(request)=>authFailure(new ApiError(409,'CONFLICT','冲突'),request)});
 const r=await handled(new Request('http://localhost/api/x'));
 const b=await r.json();assertEnvelope(r,b,{code:'CONFLICT'});
 const direct=authJson({error:'冲突',code:'CONFLICT'},409,{},new Request('http://localhost/api/x'));
 const directBody=await direct.json();assert.equal(direct.headers.get(REQUEST_ID_HEADER),directBody.requestId);
 const kyc=await kycFailed(new ApiError(409,'CONFLICT','冲突'),new Request('http://localhost/api/x')).json();
 assert.match(kyc.requestId,/^[0-9a-f-]{36}$/);
});

test('ARC-00 §8.3: unknown exceptions become 500 INTERNAL_ERROR without leaking text; stack lands in the log',async()=>{
 const logs=[];const original=console.error;console.error=(...a)=>logs.push(a.join(' '));
 try{
  const handled=http.route({handler:async()=>{throw new Error('LEAK_TOP_SECRET_CANARY_7f3l')}});
  const r=await handled(new Request('http://localhost/api/x',{method:'POST'}));
  const b=await r.json();
  assert.equal(r.status,500);
  assert.equal(b.code,'INTERNAL_ERROR');
  assert.equal(b.error,'服务暂时不可用，请稍后重试');
  assert.ok(!JSON.stringify(b).includes('LEAK_TOP_SECRET_CANARY_7f3l'),'no exception text in response');
  assertEnvelope(r,b);
  const logged=logs.find(l=>l.includes('LEAK_TOP_SECRET_CANARY_7f3l'));
  assert.ok(logged,'stack text must reach the server log');
  assert.ok(logged.includes(b.requestId),'log must correlate the stack with requestId');
 }finally{console.error=original}
});

test('ARC-00 §8.4: known business errors keep status/code and are never 503',async()=>{
 const cases=[
  [new ApiError(403,'BOT_ACCESS_FORBIDDEN','无权查看机器人状态'),403,'BOT_ACCESS_FORBIDDEN'],
  [new ApiError(409,'ACCOUNT_ALREADY_REGISTERED','请使用验证码或密码登录'),409,'ACCOUNT_ALREADY_REGISTERED'],
  [new AuthError('请先进入有权访问的私有测试工作区',401),401,'AUTH_REQUIRED'],
  [new KycError('当前岗位没有 KYC 材料查看权限',403),403,'FORBIDDEN'],
 ];
 for(const [error,status,code] of cases){
  const r=await http.route({handler:async()=>{throw error}})(new Request('http://localhost/api/x'));
  const b=await r.json();
  assert.notEqual(r.status,503,'business errors must not become 503');
  assertEnvelope(r,b,{code});
  assert.equal(r.status,status);
 }
});

test('ARC-00 §3/§5: RATE_LIMITED exposes retryAfterSeconds in body params and Retry-After header',async()=>{
 const r=await http.route({handler:async()=>{throw new ApiError(429,'RATE_LIMITED','登录请求过于频繁，请稍后重试',undefined,60)}})(new Request('http://localhost/api/x'));
 const b=await r.json();
 assert.equal(r.status,429);
 assert.equal(b.code,'RATE_LIMITED');
 assert.equal(b.retryAfter,60);
 assert.deepEqual(b.params,{retryAfterSeconds:60});
 assert.equal(r.headers.get('retry-after'),'60');
 assertEnvelope(r,b);
});

test('readJsonBody: origin, content-type, size and JSON shape guards',async()=>{
 const handled=http.route({origin:'required',handler:async(request)=>{await http.readJsonBody(request,10);return Response.json({ok:true})}});
 // Missing Origin on a write interface
 let r=await handled(new Request('http://localhost/api/x',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}));
 let b=await r.json();assert.equal(r.status,403);assertEnvelope(r,b,{code:'CROSS_SITE_REQUEST'});
 // Unsupported content-type
 r=await handled(new Request('http://localhost/api/x',{method:'POST',headers:{origin:'http://localhost','content-type':'text/plain'},body:'{}'}));
 b=await r.json();assert.equal(r.status,415);assertEnvelope(r,b,{code:'INVALID_REQUEST'});
 // Body larger than the route limit
 r=await handled(new Request('http://localhost/api/x',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify({x:'a'.repeat(10)})}));
 assert.equal(r.status,413);b=await r.json();assertEnvelope(r,b,{code:'PAYLOAD_TOO_LARGE'});
 // Malformed JSON
 r=await handled(new Request('http://localhost/api/x',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:'{not json'}));
 b=await r.json();assert.equal(r.status,400);assertEnvelope(r,b,{code:'INVALID_REQUEST'});
 // Non-object JSON
 r=await handled(new Request('http://localhost/api/x',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:'[]'}));
 b=await r.json();assert.equal(r.status,400);assertEnvelope(r,b,{code:'INVALID_REQUEST'});
});

test('S2: all five migrated write routes reject missing Origin with 403 CROSS_SITE_REQUEST envelopes',async()=>{
 const writers={state:routes.state.POST,bots:routes.bots.POST,h5state:routes.h5state.POST,products:routes.products.POST,kyc:routes.kyc.POST};
 for(const [name,fn] of Object.entries(writers)){
  const r=await fn(new Request('http://localhost/api/'+name,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}));
  const b=await r.json();
  assert.equal(r.status,403,`${name} missing Origin`);
  assertEnvelope(r,b,{code:'CROSS_SITE_REQUEST'});
 }
});

test('S2: all five migrated routes shape known failures as envelopes, never 503',async()=>{
 // state: unsupported content-type is a request-local validation error
 let r=await routes.state.POST(new Request('http://localhost/api/state',{method:'POST',headers:{origin:'http://localhost','content-type':'text/plain'},body:'{}'}));
 let b=await r.json();assert.notEqual(r.status,503);assertEnvelope(r,b,{code:'INVALID_REQUEST'});
 // bots: unknown/unconfigured bot is an unexpected server failure
 r=await routes.bots.POST(new Request('http://localhost/api/bots',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:'{}'}));
 b=await r.json();assert.equal(r.status,500);assertEnvelope(r,b,{code:'INTERNAL_ERROR'});
 // h5/state: unauthenticated customer is 401, not 503
 r=await routes.h5state.POST(new Request('http://localhost/api/h5/state',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:'{}'}));
 b=await r.json();assert.notEqual(r.status,503);assertEnvelope(r,b,{code:'AUTH_REQUIRED'});
 // team/products: business permission error (no company selected) is 403
 r=await routes.products.GET(new Request('http://localhost/api/team/products'));
 b=await r.json();assert.notEqual(r.status,503);assertEnvelope(r,b,{code:'FORBIDDEN'});assert.equal(b.error,'请先选择公司');
 // kyc: unauthenticated customer is 401, not 503
 r=await routes.kyc.GET(new Request('http://localhost/api/kyc'));
 b=await r.json();assert.notEqual(r.status,503);assertEnvelope(r,b,{code:'AUTH_REQUIRED'});
});

test('S2: account-already-exists registration maps to 409 ACCOUNT_ALREADY_REGISTERED (ARC-00 §7)',async()=>{
 assert.equal(codes.INTERNAL_ERROR,'INTERNAL_ERROR');
 assert.equal(codes.VALIDATION_FAILED,'VALIDATION_FAILED');
 assert.equal(codes.ACCOUNT_ALREADY_REGISTERED,'ACCOUNT_ALREADY_REGISTERED');
 // registerPhone throws exactly this AuthError (lib/h5-auth-core.ts), which
 // falls back to codeForError because no explicit code is passed.
 const duplicate=new AuthError('请使用验证码或密码登录；无法仅凭手机号进入已有账号',409);
 assert.equal(duplicate.code,'ACCOUNT_ALREADY_REGISTERED');
 const r=await http.route({handler:async()=>{throw duplicate}})(new Request('http://localhost/api/h5/auth/verify'));
 const b=await r.json();
 assert.equal(r.status,409);
 assertEnvelope(r,b,{code:'ACCOUNT_ALREADY_REGISTERED'});
});
