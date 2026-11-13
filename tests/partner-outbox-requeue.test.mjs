import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const migration=await readFile(new URL('../drizzle/0066_partner_outbox_requeue.sql',import.meta.url),'utf8');
const route=await readFile(new URL('../app/api/team/partner-outbox/route.ts',import.meta.url),'utf8');
const client=await readFile(new URL('../app/team/partner-outbox-client.tsx',import.meta.url),'utf8');

test('0066 adds requeue metadata and dead-letter route is admin-only',()=>{
 assert.match(migration,/ADD COLUMN requeued_at TEXT/);
 assert.match(migration,/ADD COLUMN requeue_count INTEGER NOT NULL DEFAULT 0/);
 assert.match(route,/s\.member\.role!==['"]admin/);
 assert.match(route,/p\.action!=='requeue'/);
 assert.match(route,/REASON_REQUIRED/);
 assert.match(route,/status='dead'/);
 assert.match(route,/requeue_count=requeue_count\+1/);
 assert.match(route,/partner_outbox_requeue/);
 assert.doesNotMatch(route,/SELECT .*payload/);
 assert.match(client,/window\.confirm/);
});

test('requeue preserves payload and idempotency key while resetting delivery state',()=>{
 assert.match(route,/SET status='pending',attempts=0,next_attempt_at=\?,lease_until=NULL,requeued_at=\?,requeue_count=requeue_count\+1/);
 assert.doesNotMatch(route,/UPDATE partner_outbox SET .*payload/);
 assert.doesNotMatch(route,/UPDATE partner_outbox SET .*idempotency_key/);
});

async function requeueFixture(){
 const audits=[];
 let batches=0;
 const db={
  prepare:sql=>({bind:(...args)=>({args,first:async()=>{
   assert.match(sql,/tenant_id=\? AND action='partner_outbox_requeue' AND json_extract\(detail,'\$\.requestId'\)=\? LIMIT 1/);
   const detail=audits.find(row=>row.tenant===args[0]&&row.action==='partner_outbox_requeue'&&row.detail.requestId===args[1])?.detail;
   return detail?{detail:JSON.stringify(detail)}:null;
  }})}),
  batch:async([update,audit])=>{
   assert.equal(update.args[2],audit.detail.recordId);
   batches++;
   audits.push(audit);
   return [{meta:{changes:1}}];
  }
 };
 const context=vm.createContext();
 const routeModule=new vm.SourceTextModule(ts.transpileModule(route,{compilerOptions:{
  module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
 }}).outputText,{context});
 const mocks={
  '@/lib/http/route':{requireOrigin(){}},
  '@/lib/team/server':{
   db:()=>db,
   staff:async()=>({tenant:{id:'tenant'},member:{role:'admin'},user:{userId:'admin'}}),
   auditInsertSql:(tenant,_user,action,detail)=>({tenant,action,detail})
  },
  '@/lib/h5-auth':{
   input:request=>request.json(),
   json:body=>Response.json(body),
   failure:error=>{if(!(error instanceof AuthError))throw error;return Response.json({code:error.code},{status:error.status})}
  },
  '@/lib/h5-auth-core':{AuthError:class AuthError extends Error{
   constructor(message,status,_details,code){super(message);this.status=status;this.code=code}
  }}
 };
 const {AuthError}=mocks['@/lib/h5-auth-core'];
 await routeModule.link(name=>new vm.SyntheticModule(Object.keys(mocks[name]),function(){
  for(const [key,value] of Object.entries(mocks[name]))this.setExport(key,value);
 },{context}));
 await routeModule.evaluate();
 return {
  post:id=>routeModule.namespace.POST(new Request('https://example.test/api/team/partner-outbox',{
   method:'POST',body:JSON.stringify({action:'requeue',id,reason:'retry',requestId:'request-123'})
  })),
  batches:()=>batches
 };
}

test('same request ID and record return idempotent success and requeue once',async()=>{
 const {post,batches}=await requeueFixture();
 assert.equal((await post('record-a')).status,200);
 const replay=await post('record-a');
 assert.equal(replay.status,200);
 assert.deepEqual(await replay.json(),{ok:true,idempotent:true,requestId:'request-123'});
 assert.equal(batches(),1);
});

test('same request ID and a different record return 409 REQUEST_ID_REUSED',async()=>{
 const {post,batches}=await requeueFixture();
 assert.equal((await post('record-a')).status,200);
 const replay=await post('record-b');
 assert.equal(replay.status,409);
 assert.deepEqual(await replay.json(),{code:'REQUEST_ID_REUSED'});
 assert.equal(batches(),1);
});
