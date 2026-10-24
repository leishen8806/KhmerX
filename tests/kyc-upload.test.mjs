import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {retryAfterMs} from '../lib/image-compress.ts';

function uploader(){
 const requests=[],events=[],timers=new Map();let clock=0,nextTimer=0;
 class Xhr{upload={};status=200;responseText='{"id":"stored"}';open(method,url){this.method=method;this.url=url}setRequestHeader(){}getResponseHeader(){return null}send(body){this.body=body;requests.push(this)}}
 Xhr.prototype.abort=function(){this.aborted=true;this.onabort?.()};
 const advance=ms=>{const end=clock+ms;for(;;){const due=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;clock=due[1].at;timers.delete(due[0]);due[1].fn()}clock=end};
 const exports={};const context=vm.createContext({XMLHttpRequest:Xhr,setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,at:clock+ms});return id},clearTimeout:id=>timers.delete(id),CustomEvent:class{},window:{dispatchEvent:e=>events.push(e)},Math,JSON,Error});
 const source=ts.transpileModule(readFileSync('lib/kyc/upload.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInContext('(function(exports,require){'+source+'\n})',context)(exports,n=>n==='../api-client'?{apiUrl:p=>'https://api.example.test'+p,ApiClientError:class extends Error{constructor(message,status,body){super(message);Object.assign(this,body,{status})}}}:n==='../client-id'?{clientRequestId:()=> 'synthetic-request'}:{currentErrorLocale:()=> 'en',messageForError:()=> 'Upload failed'});
 return {upload:exports.uploadKycFile,request:()=>requests.at(-1),events,advance,timers};
}
test('upload progress comes from bytes sent, unknown length stays indeterminate, success waits for response',async()=>{
 const h=uploader(),progress=[],body=new Blob(['synthetic']);let done=false;const result=h.upload(body,{'X-KYC-Slot':'idFront'},v=>progress.push(v)).then(v=>{done=true;return v});const r=h.request();assert.equal(r.method,'POST');assert.equal(r.url,'https://api.example.test/api/kyc/files');assert.equal(r.withCredentials,true);assert.equal(r.body,body);r.upload.onprogress({lengthComputable:true,loaded:37,total:100});r.upload.onprogress({lengthComputable:false});assert.deepEqual(progress,[37,undefined]);assert.equal(done,false);r.onload();assert.equal((await result).id,'stored');
});
test('progress resets the 30 second stall deadline; idle upload aborts and clears timers',async()=>{
 const h=uploader();let failed=false;const result=h.upload(new Blob(),{},()=>{}).catch(e=>{failed=true;return e});h.advance(29000);h.request().upload.onprogress({loaded:1,total:10,lengthComputable:true});h.advance(29000);await Promise.resolve();assert.equal(failed,false);h.advance(1000);const error=await result;assert.equal(error.status,0);assert.equal(error.code,'KYC_UPLOAD_INTERRUPTED');assert.equal(h.request().aborted,true);assert.equal(h.timers.size,0);
});
test('180 second native total timeout rejects even with continuing progress; network errors share explicit code',async()=>{
 for(const event of ['ontimeout','onerror']){const h=uploader();const result=h.upload(new Blob(),{},()=>{});const r=h.request();assert.equal(r.timeout,180000);for(let i=0;i<8;i++){h.advance(20000);r.upload.onprogress({loaded:i,total:10,lengthComputable:true})}r[event]();await assert.rejects(result,e=>e.status===0&&e.code==='KYC_UPLOAD_INTERRUPTED');assert.equal(h.timers.size,0)}
});
test('failed uploads preserve status and Retry-After for the existing retry policy',async()=>{
 const h=uploader();const pending=h.upload(new Blob(),{},()=>{});const r=h.request();r.status=429;r.responseText='{"code":"RATE_LIMITED"}';r.getResponseHeader=name=>name==='Retry-After'?'4':null;r.onload();await assert.rejects(pending,e=>e.status===429&&retryAfterMs(e,0)===4000);
});
