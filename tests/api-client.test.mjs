import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

function loadApiClient(fetchImpl,events=[]){
  const source=readFileSync(new URL('../lib/api-client.ts',import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const exports={};
  const window={dispatchEvent:event=>events.push(event)};
  vm.runInNewContext(js,{exports,require:name=>{if(name==='./client-id')return {clientRequestId:()=> '00000000-0000-4000-8000-000000000001'};throw Error(`unexpected import ${name}`)},fetch:fetchImpl,window,CustomEvent,Headers,Response,AbortController,setTimeout,clearTimeout,console});
  return exports;
}

test('apiFetch uses client request ids and retries GET 503 twice',async()=>{
  const calls=[];let count=0;
  const api=loadApiClient(async(url,init)=>{calls.push({url,init});count++;return count<3?new Response('{}',{status:503,headers:{'content-type':'application/json'}}):Response.json({ok:true},{headers:{'x-request-id':'server-id'}})});
  const result=await api.apiFetch('/api/status');
  assert.equal(result.data.ok,true);assert.equal(calls.length,3);assert.equal(calls[0].init.headers.get('x-request-id'),'00000000-0000-4000-8000-000000000001');
});

test('apiFetch does not retry an unkeyed write but retries a keyed write',async()=>{
  let calls=0;const fetchImpl=async()=>{calls++;return new Response('{}',{status:503,headers:{'content-type':'application/json'}})};
  const api=loadApiClient(fetchImpl);
  await assert.rejects(api.apiFetch('/api/write',{method:'POST'}),{status:503});assert.equal(calls,1);
  calls=0;await assert.rejects(api.apiFetch('/api/write',{method:'POST',idempotencyKey:'same-key'}),{status:503});assert.equal(calls,3);
});

test('apiFetch retries GET network failures and sends the idempotency key',async()=>{
  let calls=0;let observed;
  const api=loadApiClient(async(_url,init)=>{calls++;observed=init.headers.get('x-idempotency-key');if(calls<3)throw new TypeError('network down');return Response.json({ok:true})});
  const result=await api.apiFetch('/api/retry',{method:'POST',idempotencyKey:'operation-1'});
  assert.equal(result.data.ok,true);assert.equal(calls,3);assert.equal(observed,'operation-1');
});

test('apiFetch applies the request-level timeout',async()=>{
  const api=loadApiClient((_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true})));
  await assert.rejects(api.apiFetch('/api/slow',{timeoutMs:10}),error=>error?.name==='AbortError');
});

test('AUTH_REQUIRED dispatches a global event and preserves params',async()=>{
  const events=[];const api=loadApiClient(async()=>Response.json({code:'AUTH_REQUIRED',error:'expired',requestId:'rid',params:{retryAfterSeconds:4}},{status:401,headers:{'x-request-id':'rid'}}),events);
  await assert.rejects(api.apiFetch('/api/private'),error=>{assert.equal(error.code,'AUTH_REQUIRED');assert.deepEqual(error.params,{retryAfterSeconds:4});return true});
  assert.equal(events.length,1);assert.equal(events[0].type,'khmerx:auth-required');
});

test('request id helper is available without crypto.randomUUID',()=>{assert.equal(typeof webcrypto.getRandomValues,'function')});
