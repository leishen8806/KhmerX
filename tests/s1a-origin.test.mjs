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
import {createHash,timingSafeEqual} from 'node:crypto';

const root=path.resolve('.');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+f,'utf8'));
let effects=0;
const DB={
 prepare(query){effects++;return {bind(...args){const s=sql.prepare(query);return {
  async first(){return s.get(...args)||null},
  async all(){return {results:s.all(...args)}},
  async run(){const r=s.run(...args);return {meta:{changes:Number(r.changes)}}}
 }}}},
 async batch(statements){sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}
};
const blobs=new Map();
const env={DB,BUCKET:{async put(k,v){blobs.set(k,v)},async get(k){const v=blobs.get(k);return v?{async arrayBuffer(){return v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength)}}:null},async delete(k){blobs.delete(k)}},KYC_DATA_SECRET:'synthetic-only-'.repeat(5),KYC_REVIEWER_EMAILS:'owner@example.test',PAYEASE_AUTH_SECRET:'synthetic-auth-'.repeat(5),PAYEASE_AUTH_MODE:'demo',KHMERX_TEST_MODE:'true',TELEGRAM_BOT_TOKEN:''};
const user={userId:'owner',email:'owner@example.test'};
const context=vm.createContext({console,crypto,TextEncoder,TextDecoder,Headers,Request,Response,URL,URLSearchParams,AbortSignal,Uint8Array,ArrayBuffer,Buffer,Date,structuredClone,atob,btoa,setTimeout,clearTimeout,fetch:async()=>{effects++;return Response.json({ok:false})}});
const cache=new Map();
function synth(id,values){const m=new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v)},{context,identifier:id});cache.set(id,m);return m}
synth('cloudflare:workers',{env});
synth('node:crypto',{createHash,timingSafeEqual});
synth('next/headers',{headers:async()=>new Headers({})});
synth(path.join(root,'app/chatgpt-auth.ts'),{getChatGPTUser:async()=>{effects++;return user}});
function getModule(spec,base=root+'/entry.ts'){let id=spec;if(spec.startsWith('@/'))id=path.join(root,spec.slice(2));else if(spec.startsWith('.'))id=path.resolve(path.dirname(base),spec);if(!cache.has(id)&&!path.extname(id)&&fs.existsSync(id+'.ts'))id+='.ts';if(cache.has(id))return cache.get(id);if(id.endsWith('.json'))return synth(id,{default:JSON.parse(fs.readFileSync(id,'utf8'))});const source=ts.transpileModule(fs.readFileSync(id,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;const m=new vm.SourceTextModule(source,{context,identifier:id});cache.set(id,m);return m}
async function mod(name){const m=getModule(name);if(m.status==='unlinked')await m.link((s,p)=>getModule(s,p.identifier));if(m.status==='linked')await m.evaluate();return m.namespace}


const paths=['h5/auth/account','h5/auth/logout','h5/auth/recovery','h5/auth/send','h5/auth/verify','h5/auth/telegram','h5/locale','analytics/events'];
for(const routePath of paths)test('S1a rejects before auth/database/upstream: '+routePath,async()=>{
 const handler=await mod('@/app/api/'+routePath+'/route');
 for(const origin of [undefined,'https://foreign.example']){
  const before=effects,headers={'content-type':'application/json','x-request-id':'18e6a8f2-1c2b-4a91-9f68-3a6e5d4c7a21'};
  if(origin)headers.origin=origin;
  const response=await handler.POST(new Request('https://payease.khmerx.org/api/'+routePath,{method:'POST',headers,body:'{}'}));
  const body=await response.json();
  assert.equal(response.status,403);assert.equal(body.code,'CROSS_SITE_REQUEST');
  assert.equal(effects,before,'rejected origin must not touch auth/database/upstream');
  assert.equal(body.requestId,headers['x-request-id']);assert.equal(response.headers.get('x-request-id'),body.requestId);
 }
});
test('S1a Telegram existing bodyless client is not forced to send JSON',async()=>{
 const handler=await mod('@/app/api/h5/auth/telegram/route');
 const response=await handler.POST(new Request('https://payease.khmerx.org/api/h5/auth/telegram',{method:'POST',headers:{origin:'https://payease.khmerx.org'}}));
 assert.equal(response.status,401);assert.notEqual((await response.json()).code,'CROSS_SITE_REQUEST');
});
