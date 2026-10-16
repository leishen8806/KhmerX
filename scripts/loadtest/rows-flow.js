import http from 'k6/http';
import crypto from 'k6/crypto';
import {sleep} from 'k6';
import {Trend,Counter} from 'k6/metrics';

const manifest=JSON.parse(open(__ENV.ROWS_MANIFEST)),base=String(__ENV.BASE_URL||''),vus=Number(__ENV.VUS||50),startAt=Number(__ENV.START_AT);
if(!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)||manifest.target.baseUrl!==base||manifest.target.profile!=='local-harness'||manifest.target.env!=='local')throw Error('Only matching local harness targets are authorized');
if(!['main','smoke'].includes(manifest.dataset)||manifest.customers.length<vus||!Number.isSafeInteger(vus)||vus<1||!Number.isFinite(startAt))throw Error('Invalid rows manifest or barrier');
const duration=new Trend('rows_request_ms',true),outcomes=new Counter('rows_outcome'),retries=new Counter('rows_retries');
const categories=['completed','not_started','aborted','create_failed','confirm_failed','create_ok_after_replay','create_missing','duplicate_loans','wrong_owner_loan','status_mismatch','bill_not_confirmed'];
const categoryMetrics=Object.fromEntries(categories.map(k=>[k,new Counter('rows_result_'+k)]));
export const options={scenarios:{rows:{executor:'per-vu-iterations',vus,iterations:1,maxDuration:'5m'}},maxRedirects:0,summaryTrendStats:['p(50)','p(95)','p(99)']};
export function classify(body,id){
 const loans=body?.state?.loans;
 if(!Array.isArray(loans)||!loans.length)return 'create_missing';
 if(loans.length>1)return 'duplicate_loans';
 if(loans[0].customerId!==id)return 'wrong_owner_loan';
 if(loans[0].status!=='kyc_approved')return 'status_mismatch';
 return loans[0].billConfirmedAt?'completed':'bill_not_confirmed';
}
export function retryKind(res,body){
 if(!res.status)return 'network';
 if(res.status===409&&String(body.error||'').includes('其他操作刚刚更新了记录'))return 'conflict';
 if([502,503,504].includes(res.status))return 'service';
 return null;
}
function uuid(){const b=new Uint8Array(crypto.randomBytes(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`}
function request(c,method,payload,endpoint,attempt=0){
 const started=Date.now(),r=http.request(method,base+'/api/h5/state',payload===undefined?undefined:JSON.stringify(payload),{timeout:'15s',redirects:0,headers:{Origin:base,Accept:'application/json','Content-Type':'application/json','X-Request-Id':uuid(),Cookie:`payease_company=${manifest.target.tenantId}; payease_h5_session=${c.sessionToken}`,'oai-authenticated-user-id':'synthetic-rows-runner','oai-authenticated-user-email':'synthetic-rows@example.test'},tags:{name:endpoint}});
 let body={};try{body=r.json()||{}}catch{/* response bodies are never logged */}
 const code=/^[A-Z][A-Z0-9_]{0,63}$/.test(body.code||'')?body.code:'NONE',kind=retryKind(r,body);
 duration.add(Date.now()-started,{endpoint,index:String(c.index),attempt:String(attempt),status:String(r.status),code,start_ms:String(started),barrier_ms:String(startAt),kind:kind||'none'});
 return {response:r,body};
}
function write(c,input,endpoint){
 let attempt=0,conflicts=0,transient=0;
 while(true){
  const result=request(c,'POST',input,endpoint,attempt);
  if(result.response.status===200)return {...result,replayed:attempt>0};
  if(endpoint==='create'&&attempt>0&&result.response.status===409&&String(result.body.error||'').includes('请先完成当前申请')){
   const checked=request(c,'GET',undefined,'replay_get');
   if(checked.response.status===200&&['completed','bill_not_confirmed'].includes(classify(checked.body,c.customerId)))return {...checked,replayed:true};
   return {...checked,failure:checked.response.status===200?classify(checked.body,c.customerId):'create_failed'};
  }
  const kind=retryKind(result.response,result.body);
  if(!kind||(kind==='conflict'?conflicts++>=3:transient++>=2))return {...result,failure:endpoint==='create'?'create_failed':'confirm_failed'};
  const raw=result.response.headers?.['Retry-After'],seconds=Number(raw??result.body.params?.retryAfterSeconds);
  const delay=kind==='service'&&Number.isFinite(seconds)&&seconds>0?Math.min(5,seconds):Math.min(1,0.1*2**attempt+Math.random()*0.1);
  retries.add(1,{reason:kind});attempt++;sleep(delay);
 }
}
export default function(){
 const c=manifest.customers[__VU-1];let outcome='aborted';
 try{
  const initial=request(c,'GET',undefined,'preflight');
  if(initial.response.status!==200||initial.body.kyc?.status!=='approved'||initial.body.state?.loans?.length!==0||initial.body.revision!==0){outcome='not_started';return}
  if(Date.now()>startAt){outcome='not_started';return}sleep(Math.max(0,(startAt-Date.now())/1000));
  const created=write(c,{action:'create',role:'mini',amount:5000,name:'SYNTH '+c.index,consent:true,termDays:14,requestId:`${manifest.runId}-${c.index}-create`},'create');
  if(created.failure){outcome=created.failure;return}
  const state=classify(created.body,c.customerId);if(!['completed','bill_not_confirmed'].includes(state)){outcome=state;return}
  const loan=created.body.state.loans[0];if(!loan.billing?.quoteId){outcome='create_failed';return}
  const confirmed=write(c,{action:'confirm_bill',role:'mini',loanId:loan.id,billConfirmed:true,quoteId:loan.billing.quoteId,requestId:`${manifest.runId}-${c.index}-bill`},'confirm_bill');
  if(confirmed.failure){outcome=confirmed.failure;return}
  outcome=classify(confirmed.body,c.customerId);const revision=confirmed.body.revision,billAt=confirmed.body.state?.loans?.[0]?.billConfirmedAt;
  for(let i=0;i<3;i++){sleep(1);const result=request(c,'GET',undefined,'state_get');const read=classify(result.body,c.customerId);if(result.response.status!==200){outcome='aborted';break}if(read!=='completed'){outcome=read;break}if(result.body.revision<revision||result.body.state.loans[0].billConfirmedAt!==billAt){outcome='status_mismatch';break}}
  if(outcome==='completed'&&created.replayed)outcome='create_ok_after_replay';
 }finally{outcomes.add(1,{category:outcome,index:String(c.index)});categoryMetrics[outcome].add(1)}
}
export function handleSummary(data){
 const counts=Object.fromEntries(categories.map(k=>[k,data.metrics['rows_result_'+k]?.values?.count||0]));
 const delivered=Object.values(counts).reduce((a,b)=>a+b,0);counts.not_started+=Math.max(0,vus-delivered);
 const result={label:'本地 harness，非灰度、非 600 客户实测',scene:'rows',runId:manifest.runId,dataset:manifest.dataset,customers:vus,vus,startAt,mode:manifest.target.customerRows,gitHead:__ENV.GIT_HEAD,authMode:manifest.target.authMode,env:'local',authFixture:'synthetic fixture: not Telegram registration or authentication benchmark',counts,scriptRetries:data.metrics.rows_retries?.values?.count||0,serverOptimisticRetries:'unavailable'};
 return {stdout:result.label+'\n'+JSON.stringify(counts)+'\n',[__ENV.ROWS_SUMMARY]:JSON.stringify(result,null,2)};
}
