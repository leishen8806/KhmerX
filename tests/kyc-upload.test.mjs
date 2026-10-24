import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {retryAfterMs} from '../lib/image-compress.ts';

function uploader(){
 const requests=[],events=[];
 class Xhr{upload={};status=200;responseText='{"id":"stored"}';open(method,url){this.method=method;this.url=url}setRequestHeader(){}getResponseHeader(){return null}send(body){this.body=body;requests.push(this)}}
 const exports={};const context=vm.createContext({XMLHttpRequest:Xhr,CustomEvent:class{},window:{dispatchEvent:e=>events.push(e)},Math,JSON,Error});
 const source=ts.transpileModule(readFileSync('lib/kyc/upload.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInContext('(function(exports,require){'+source+'\n})',context)(exports,n=>n==='../api-client'?{apiUrl:p=>'https://api.example.test'+p,ApiClientError:class extends Error{constructor(message,status,body){super(message);Object.assign(this,body,{status})}}}:n==='../client-id'?{clientRequestId:()=> 'synthetic-request'}:{currentErrorLocale:()=> 'en',messageForError:()=> 'Upload failed'});
 return {upload:exports.uploadKycFile,request:()=>requests.at(-1),events};
}
test('upload progress comes from bytes sent, unknown length stays indeterminate, success waits for response',async()=>{
 const h=uploader(),progress=[],body=new Blob(['synthetic']);let done=false;const result=h.upload(body,{'X-KYC-Slot':'idFront'},v=>progress.push(v)).then(v=>{done=true;return v});const r=h.request();assert.equal(r.method,'POST');assert.equal(r.url,'https://api.example.test/api/kyc/files');assert.equal(r.withCredentials,true);assert.equal(r.body,body);r.upload.onprogress({lengthComputable:true,loaded:37,total:100});r.upload.onprogress({lengthComputable:false});assert.deepEqual(progress,[37,undefined]);assert.equal(done,false);r.onload();assert.equal((await result).id,'stored');
});
test('failed uploads preserve status and Retry-After for the existing retry policy',async()=>{
 const h=uploader();const pending=h.upload(new Blob(),{},()=>{});const r=h.request();r.status=429;r.responseText='{"code":"RATE_LIMITED"}';r.getResponseHeader=name=>name==='Retry-After'?'4':null;r.onload();await assert.rejects(pending,e=>e.status===429&&retryAfterMs(e,0)===4000);
});
