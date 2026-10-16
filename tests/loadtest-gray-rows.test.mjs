import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {EventEmitter} from 'node:events';
import {createServer,request} from 'node:https';
import {spawn} from 'node:child_process';
import {fixture,applied} from './loadtest-fixture.test.mjs';
import {preflight,rowsTarget,declaredScales,grayLabel} from '../scripts/loadtest/rows-preflight.mjs';
const env={ORIGIN_IP:'159.223.77.134',LOADTEST_ALLOWED_HOSTS:'testapi.khmerx.org,159.223.77.134',DECLARED_SCALES:JSON.stringify({PAYEASE_GATEWAY_RATE_SCALE:30,PAYEASE_LIMIT_SCALE:1})};
function grayManifest(){const f=fixture();try{const m=applied({...f.options,dataset:'smoke',count:undefined});m.target={...m.target,profile:'gray-config',env:'gray',authMode:'telegram',baseUrl:'https://testapi.khmerx.org',hosts:['testapi.khmerx.org']};return m}finally{f.close()}}
function flow(m,e){
 class Metric{add(){}}
 const source=readFileSync('scripts/loadtest/rows-flow.js','utf8').replace(/^import .*;$/gm,'').replace('export default function()','function run()').replace(/^export /gm,'');
 return runInNewContext(source+';({options,handleSummary})',{__ENV:{...e,BASE_URL:m.target.baseUrl,ROWS_MANIFEST:'unused',VUS:'3',START_AT:String(Date.now()+15000),ROWS_SUMMARY:'summary'},open:()=>JSON.stringify(m),Trend:Metric,Counter:Metric,sleep:()=>{},crypto:{randomBytes:n=>Uint8Array.from(randomBytes(n)).buffer},http:{}});
}
test('G2 Node and k6 require every gray guard; TLS skip remains exclusive to direct gray',()=>{
 const m=grayManifest(),base=m.target.baseUrl,p={vus:3,baseUrl:base,mode:'on',dataset:'smoke',env};assert.equal(preflight(m,p).customers,3);
 assert.equal(rowsTarget(m,base,env).hosts['testapi.khmerx.org'],env.ORIGIN_IP);assert.equal(flow(m,env).options.insecureSkipTLSVerify,true);
 for(const e of [{...env,ORIGIN_IP:undefined},{...env,ORIGIN_IP:'127.0.0.1'},{...env,ORIGIN_IP:'999.1.1.1'},{...env,LOADTEST_ALLOWED_HOSTS:'testapi.khmerx.org'},{...env,LOADTEST_ALLOWED_HOSTS:env.ORIGIN_IP}]){assert.throws(()=>preflight(m,{...p,env:e}));assert.throws(()=>flow(m,e))}
 for(const baseUrl of ['https://api.khmerx.org','http://testapi.khmerx.org','https://unapproved.example.test','https://testapi.khmerx.org/path']){const x={...m,target:{...m.target,baseUrl}};assert.throws(()=>preflight(x,{...p,baseUrl}));assert.throws(()=>flow(x,env))}
 for(const change of [{env:'production'},{profile:'local-harness'},{authMode:'demo'},{hosts:[]}]){const x={...m,target:{...m.target,...change}};assert.throws(()=>preflight(x,p));assert.throws(()=>flow(x,env))}
 for(const raw of [undefined,'null','{}','{"PAYEASE_GATEWAY_RATE_SCALE":0,"PAYEASE_LIMIT_SCALE":1}'])assert.throws(()=>declaredScales(raw));
 const summary=JSON.parse(flow(m,env).handleSummary({metrics:{rows_result_completed:{values:{count:3}}}}).summary);assert(summary.label.startsWith(grayLabel));assert.equal(summary.env,'gray');assert.equal(summary.declaredScales.PAYEASE_GATEWAY_RATE_SCALE,30);for(const c of m.customers)assert(!JSON.stringify(summary).includes(c.sessionToken));
 const local={...m,target:{...m.target,profile:'local-harness',env:'local',baseUrl:'http://127.0.0.1:8796'}};assert.throws(()=>flow(local,{K6_INSECURE_SKIP_TLS_VERIFY:'true'}));assert.throws(()=>rowsTarget(local,local.target.baseUrl,{K6_INSECURE_SKIP_TLS_VERIFY:'true'}));
});
test('G2 offline self-signed HTTPS: real k6 smoke, hosts mapping, Origin/Cookies and sanitized report',{skip:!process.env.L1G_K6_BIN},async()=>{
 const m=grayManifest(),dir=mkdtempSync(join(tmpdir(),'l1g-smoke-')),manifest=join(dir,'private.json'),summary=join(dir,'summary.json'),wrapper=join(dir,'smoke.js'),calls=[],states=new Map();
 const server=createServer({key:readFileSync('/tools/key.pem'),cert:readFileSync('/tools/cert.pem')},(req,res)=>{
  const cookie=String(req.headers.cookie),customer=m.customers.find(c=>cookie.includes('payease_h5_session='+c.sessionToken));calls.push({origin:req.headers.origin,host:req.headers.host,cookie,path:req.url});
  if(!customer||!cookie.includes('payease_company='+m.target.tenantId)||cookie.includes('payease_visitor')||req.headers.origin!==m.target.baseUrl){res.writeHead(403);res.end('{}');return}
  let body='';req.on('data',b=>body+=b);req.on('end',()=>{
   const state=states.get(customer.index)||{revision:0,kyc:{status:'approved'},state:{loans:[]}};
   if(body){const input=JSON.parse(body);if(input.action==='create'){state.state.loans=[{id:'synthetic-loan-'+customer.index,customerId:customer.customerId,status:'kyc_approved',billing:{quoteId:'synthetic-quote'}}];state.revision++}else if(input.action==='confirm_bill'){state.state.loans[0].billConfirmedAt='synthetic-confirmed';state.revision++}states.set(customer.index,state)}
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(state));
  });
 });
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
  await assert.rejects(new Promise((resolve,reject)=>{const r=request({host:'127.0.0.1',port,method:'GET'},resolve);r.on('error',reject);r.end()}),/self-signed certificate/);
  writeFileSync(manifest,JSON.stringify(m),{mode:0o600});
  // Only this disposable test wrapper substitutes loopback after the real target guard.
  writeFileSync(wrapper,`import run,{options as sourceOptions,handleSummary} from '/app/scripts/loadtest/rows-flow.js'; export const options={...sourceOptions,hosts:{'testapi.khmerx.org':'127.0.0.1:${port}'}}; export default run; export {handleSummary};`);
  const result=await new Promise((resolve,reject)=>{const child=spawn(process.env.L1G_K6_BIN,['run',wrapper],{env:{...process.env,...env,BASE_URL:m.target.baseUrl,ROWS_MANIFEST:manifest,VUS:'3',START_AT:String(Date.now()+5000),ROWS_SUMMARY:summary,K6_NO_USAGE_REPORT:'true',K6_WEB_DASHBOARD:'false'},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.on('error',reject);child.on('close',code=>resolve({code,output}))});
  assert.equal(result.code,0,result.output);const report=JSON.parse(readFileSync(summary,'utf8'));assert.equal(report.counts.completed,3);assert(report.label.startsWith(grayLabel));assert.equal(states.size,3);assert.equal(calls.length,18);assert(calls.every(c=>c.host==='testapi.khmerx.org'&&c.origin===m.target.baseUrl&&c.path==='/api/h5/state'));for(const c of m.customers)assert(!JSON.stringify(report).includes(c.sessionToken)&&!result.output.includes(c.sessionToken));
 }finally{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true})}
});

test('G2 gray verifier uses pinned HTTPS for all checks and accepts only sanitized matching db counts',async()=>{
 const f=fixture();let manifests;try{
  manifests=Object.fromEntries(['main','timeout','aux','wrong-owner'].map(dataset=>{const m=applied({...f.options,runId:'gray-verify-'+dataset,dataset,count:dataset==='main'?3:undefined});m.target={...m.target,profile:'gray-config',env:'gray',authMode:'telegram',baseUrl:'https://testapi.khmerx.org',hosts:['testapi.khmerx.org']};return [dataset,m]}));
 }finally{f.close()}
 const {main,aux,timeout}=manifests,wrongOwner=manifests['wrong-owner'],calls=[],states=new Map();
 for(const c of main.customers)states.set(c.customerId,{revision:2,state:{loans:[{id:c.customerId,customerId:c.customerId,status:'kyc_approved',billConfirmedAt:'synthetic',billing:{quoteId:'synthetic'}}]}});
 const httpsRequest=(url,options,callback)=>{
  assert.equal(url,'https://testapi.khmerx.org/api/h5/state');assert.equal(options.rejectUnauthorized,false);assert.equal(options.family,4);options.lookup('unused',{},(_err,ip)=>assert.equal(ip,env.ORIGIN_IP));assert.equal(options.headers.Origin,main.target.baseUrl);assert(!options.headers.Cookie.includes('payease_visitor'));calls.push(options);
  const req=new EventEmitter();req.setTimeout=()=>{};req.destroy=()=>{};req.end=body=>{
   const c=[...main.customers,...aux.customers,...timeout.customers].find(c=>options.headers.Cookie.includes(c.sessionToken)),wrong=options.headers.Cookie.includes(wrongOwner.target.tenantId),input=body?JSON.parse(body):null;
   let status=200,state=states.get(c?.customerId)||{revision:0,state:{loans:[]}};
   if(wrong||aux.customers.includes(c)){status=401;state={code:'AUTH_REQUIRED'}}
   else if(input?.action==='create'){if(state.state.loans.length){status=409;state={code:'CONFLICT',error:'请先完成当前申请'}}else{state={revision:1,state:{loans:[{id:c.customerId,customerId:c.customerId,status:'kyc_approved'}]}};states.set(c.customerId,state)}}
   else if(input?.loanId!==undefined&&input.loanId!==c.customerId){status=404;state={}}
   queueMicrotask(()=>{req.emit('finish');const res=new EventEmitter();res.statusCode=status;res.destroy=()=>{};res.setEncoding=()=>{};callback(res);res.emit('data',JSON.stringify(state));res.emit('end')});
  };return req;
 };
 const raw={customer_workspaces:3,loan_index:3,legacyLoans:0,assignments:3,audit:3,modeMatches:true,uniqueOps:true,foreignCustomers:false,assignmentsMatch:true};
 const source=readFileSync('scripts/loadtest/verify-rows.mjs','utf8').split('if(process.argv[1]&&resolve')[0].replaceAll('import.meta.url',"'file:///not-cli'").replace(/^import .*;$/gm,'').replace(/^export /gm,'');
 const sandbox={httpsRequest,readFileSync:()=>JSON.stringify(raw),check:(ok,message)=>assert(ok,message),validateManifest:m=>m,rowsTarget:(m,b)=>rowsTarget(m,b,env),declaredScales,grayLabel,DatabaseSync:class{constructor(){throw Error('Gray verifier opened a database')}},resolve:()=>'/not-cli',dirname:()=>'/app',fileURLToPath:()=>'/not-cli',process:{env,argv:[]},URL,AbortSignal,randomUUID:()=> '00000000-0000-4000-8000-000000000001',setTimeout,clearTimeout,setImmediate,Date};
 const v=runInNewContext(source+';({verify,databaseEvidence})',sandbox);
 const result=await v.verify({main,aux,wrongOwner,timeout,dbCheckFile:'synthetic-counts.json',scales:env.DECLARED_SCALES});assert.equal(result.pass,true);assert(result.label.startsWith(grayLabel));assert(calls.length>20);assert(!JSON.stringify(result).includes(main.customers[0].sessionToken));
 assert.throws(()=>v.databaseEvidence({...raw,token:'synthetic-not-allowed'},main));assert.throws(()=>v.databaseEvidence({...raw,audit:0},main));assert.throws(()=>v.databaseEvidence({...raw,modeMatches:'true'},main));
});
