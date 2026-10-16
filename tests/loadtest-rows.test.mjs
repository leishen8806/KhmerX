import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,csvRows,concurrency} from '../scripts/loadtest/analyze-rows.mjs';
test('rows analysis parses quoted CSV, measures real intervals and separates conflict denominator',()=>{
 const header='metric_name,timestamp,metric_value,extra_tags';
 const row=(start,ms,endpoint,attempt,status,kind='none')=>`rows_request_ms,0,${ms},"start_ms=${start}&endpoint=${endpoint}&attempt=${attempt}&status=${status}&code=CONFLICT&kind=${kind}&index=1"`;
 const data=[header,row(1000,50,'create',0,409,'conflict'),row(1010,100,'create',0,200),row(1051,20,'create',1,200),row(1111,30,'confirm_bill',0,200),row(2200,10,'state_get',0,200)].join('\n');
 const result=analyze(data,{vus:50,startAt:1000});assert.equal(result.maxInFlightWrites,2);assert.equal(result.firstWrites,3);assert.equal(result.optimisticConflictRate,1/3);assert.equal(result.totalRequests,5);assert(result.concurrencyWarning);assert.equal(result.latency.create.p95,100);assert.equal(result.windows.readback.requests,1);
 assert.deepEqual(csvRows('a,b\n"x,y","z""w"\n'),[{a:'x,y',b:'z"w'}]);assert.throws(()=>csvRows('a\n"unfinished'));
 assert.equal(concurrency([[1,2],[2,3]]),1);assert.throws(()=>analyze('metric_name\nother',{}));
});
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {randomBytes} from 'node:crypto';
function flow(responses=[],base='http://127.0.0.1:8796'){
 const manifest={runId:'synthetic-unit',dataset:'main',target:{baseUrl:base,profile:'local-harness',env:'local',customerRows:'on'},customers:[{index:1,customerId:'fictional-customer',sessionToken:'synthetic-not-a-token'}]},calls=[],samples=[];
 class Metric{constructor(name){this.name=name}add(value,tags){samples.push({name:this.name,value,tags})}}
 const source=readFileSync(new URL('../scripts/loadtest/rows-flow.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace('export default function()','function run()').replace(/^export /gm,'');
 const functions=runInNewContext(source+';({run,write,classify,retryKind,handleSummary})',{__ENV:{ROWS_MANIFEST:'unused',BASE_URL:base,VUS:'1',START_AT:String(Date.now()+15000),ROWS_SUMMARY:'summary'},__VU:1,open:()=>JSON.stringify(manifest),Trend:Metric,Counter:Metric,sleep:()=>{},crypto:{randomBytes:n=>Uint8Array.from(randomBytes(n)).buffer},http:{request:(method,url,body,options)=>{calls.push({method,url,body,options});const r=responses.shift();assert(r,'Unexpected request');return {...r,headers:r.headers||{},json:()=>r.body||{}}}}});
 return {...functions,calls,samples,customer:manifest.customers[0]};
}
test('rows retries keep write identity, rotate trace IDs, respect budgets and never retry 429',()=>{
 const conflict={status:409,body:{error:'其他操作刚刚更新了记录'}},f=flow([conflict,conflict,conflict,conflict]);
 const p={action:'create',requestId:'synthetic-1-create'};assert.equal(f.write(f.customer,p,'create').failure,'create_failed');assert.equal(f.calls.length,4);assert(f.calls.every(c=>JSON.parse(c.body).requestId===p.requestId));assert.equal(new Set(f.calls.map(c=>c.options.headers['X-Request-Id'])).size,4);assert(f.calls.every(c=>/^[a-f\d-]{36}$/.test(c.options.headers['X-Request-Id'])));
 for(const status of [400,401,403,404,409,413,429,500]){const x=flow([{status}]);x.write(x.customer,p,'create');assert.equal(x.calls.length,1)}
 for(const status of [0,502,503,504]){const x=flow([{status},{status},{status}]);x.write(x.customer,p,'create');assert.equal(x.calls.length,3)}
});
test('rows create replay requires own single approved loan; complete outcome denominator retained',()=>{
 const state={state:{loans:[{customerId:'fictional-customer',status:'kyc_approved'}]}},f=flow([{status:0},{status:409,body:{error:'请先完成当前申请'}},{status:200,body:state}]);
 assert.equal(f.write(f.customer,{requestId:'synthetic-1-create'},'create').replayed,true);assert.equal(f.calls[2].method,'GET');
 assert.equal(f.classify({state:{loans:[]}},'x'),'create_missing');assert.equal(f.classify({state:{loans:[{},{}]}},'x'),'duplicate_loans');assert.equal(f.classify(state,'other'),'wrong_owner_loan');assert.equal(f.classify({state:{loans:[{customerId:'x',status:'unknown'}]}},'x'),'status_mismatch');
 const summary=JSON.parse(f.handleSummary({metrics:{}}).summary);assert.equal(summary.counts.not_started,1);assert.equal(Object.values(summary.counts).reduce((a,b)=>a+b,0),1);assert.equal(summary.serverOptimisticRetries,'unavailable');
 assert.throws(()=>flow([],'https://testapi.khmerx.org'),/local/);
});
test('rows analysis rejects incomplete intervals and marks rate limited results invalid',()=>{
 const header='metric_name,metric_value,extra_tags',row='rows_request_ms,2,start_ms=1&endpoint=create&attempt=0&status=429&code=RATE_LIMITED';
 assert.match(analyze(header+'\n'+row,{vus:1,startAt:1}).invalid,/INVALID/);assert.throws(()=>analyze(header+'\nrows_request_ms,2,start_ms=bad',{}),/interval/);assert.throws(()=>analyze(header+'\nrows_request_ms,2,start_ms=1&endpoint=preflight',{}),/No writes/);
});
