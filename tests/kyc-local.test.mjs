// Opt-in localhost integration test. Creates only fictional QA records and a 1px PNG.
import {LOAN_TERMS_VERSION} from '../lib/agreements/loan-terms.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fields,slots,regions,sections,emptyProfile} from '../lib/kyc/core.ts';
const base=process.env.KYC_TEST_URL;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jLPsAAAAASUVORK5CYII=','base64');
function client(userId='synthetic-qa-owner',email=`${userId}@example.test`){let cookies={__sites_local_auth:'1',payease_h5_browser:'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'};return async(path,body,extra={})=>{const r=await fetch(base+path,{redirect:'manual',...extra,method:body===undefined?'GET':'POST',headers:{Cookie:Object.entries(cookies).map(([k,v])=>k+'='+v).join('; '),'oai-authenticated-user-id':userId,'oai-authenticated-user-email':email,Origin:base,...(body!==undefined?{'Content-Type':Buffer.isBuffer(body)?'image/png':'application/json'}:{}),...extra.headers},body:body===undefined?undefined:Buffer.isBuffer(body)?body:JSON.stringify(body)});for(const c of r.headers.getSetCookie()){const [k,v]=c.split(';')[0].split('=');cookies[k]=v}const raw=await r.text();let d;try{d=JSON.parse(raw)}catch{d=raw}return {status:r.status,d,headers:r.headers}}}
async function login(c,phone){
 const bootstrap=await c('/api/h5/auth');
 assert.equal(bootstrap.status,200,JSON.stringify(bootstrap.d));
 const sent=await c('/api/h5/auth/send',{phone,consent:true});
 assert.equal(sent.status,200,JSON.stringify(sent.d));
 const auth=await c('/api/h5/auth/verify',{challengeId:sent.d.challengeId,code:sent.d.demoCode});
 assert.equal(auth.status,200,JSON.stringify(auth.d));
 // The local demo bot defaults to requiring a password. Complete that
 // registration step here so the fixture reaches KYC instead of failing with
 // a misleading 401 from requireRegistrationComplete().
 if(auth.d?.session&&!auth.d.session.hasPassword){
  const password=await c('/api/h5/auth/account',{action:'set_password',password:'Synthetic-KYC-QA-1234'});
  assert.equal(password.status,200,JSON.stringify(password.d));
 }
}
function profile(){const p=emptyProfile();p.consent=true;for(const f of fields.filter(f=>f.required))p.values[f.id]=f.options?.[0].value||(f.kind==='phone'?'+1202555010'+(f.id.includes('1')?'1':'2'):'SYNTHETIC KYC QA');p.values.contact2Relation='朋友';p.values.district=regions[0].districts[0].value;return p}
test('local KYC: draft → submit → supplement → resubmit → approval → loan; isolation and stale review', {skip:!base},async()=>{
 assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Local test only');const a=client('synthetic-qa-a'),b=client('synthetic-qa-b'),staff=client('synthetic-qa-a','synthetic-qa-staff@example.test'),staffB=client('synthetic-qa-b','synthetic-qa-staff@example.test');
 await login(a,process.env.KYC_TEST_PHONE_A||'+12025550180');await login(b,process.env.KYC_TEST_PHONE_B||'+12025550181');
 assert.equal((await client()('/api/kyc')).status,401);
 assert.equal((await a('/api/kyc',{}, {headers:{Origin:'https://invalid.test'}})).status,403);
 let record=(await a('/api/kyc')).d;assert.equal(record.status,'draft','Use unused fictional phone on reruns');
 // Loan creation is intentionally blocked until KYC is approved. Keep this
 // assertion here so the fixture verifies the real precondition instead of
 // creating an invalid pre-KYC loan record.
 const blockedLoan=await a('/api/h5/state',{action:'create',requestId:crypto.randomUUID(),name:'SYNTHETIC KYC QA',amount:5000,botId:'bot-1',consent:true});
 assert.equal(blockedLoan.status,409,JSON.stringify(blockedLoan.d));
 assert.equal((await a('/api/kyc',{action:'submit',revision:record.revision,profile:emptyProfile()})).status,400);
 const p=profile();for(const slot of slots.filter(s=>s.required)){const up=await a('/api/kyc/files',png,{headers:{'X-KYC-Slot':slot.id,'X-KYC-Consent':'true','X-KYC-Agreement-Version':LOAN_TERMS_VERSION}});assert.equal(up.status,200,JSON.stringify(up.d));p.files[slot.id]=up.d}
 assert.equal((await b('/api/kyc/files?id='+p.files.idFront.id)).status,404);
 assert.equal((await staff('/api/kyc/files?id='+p.files.idFront.id+'&review=1')).status,200);
 const bad=profile();bad.files=p.files;const bCase=(await b('/api/kyc')).d;assert.equal((await b('/api/kyc',{action:'save',revision:bCase.revision,profile:bad})).status,404);
 let saved=await a('/api/kyc',{action:'save',revision:record.revision,profile:p});assert.equal(saved.status,200);record=saved.d;
 assert.equal((await a('/api/kyc')).d.profile.values.surname,'SYNTHETIC KYC QA');
 assert.equal((await a('/api/kyc',{action:'save',revision:record.revision-1,profile:p})).status,409);
 saved=await a('/api/kyc',{action:'submit',revision:record.revision,profile:p});assert.equal(saved.status,200);record=saved.d;
 assert.equal((await a('/api/kyc/files',png,{headers:{'X-KYC-Slot':'selfie','X-KYC-Consent':'true','X-KYC-Agreement-Version':LOAN_TERMS_VERSION}})).status,409);
 assert.equal((await staff('/api/kyc/review',{id:record.id,revision:record.revision,decision:'approved',reason:'QA',checklist:{}})).status,400);
 let decision=await staff('/api/kyc/review',{id:record.id,revision:record.revision,decision:'needs_info',reason:'QA 补件：补充详细地址',checklist:{}});assert.equal(decision.status,200);record=decision.d;
 const amended=await staff('/api/kyc/review',{action:'amend',id:record.id,revision:record.revision,values:{...p.values,address:'SYNTHETIC reviewer amendment'},reason:'QA 代修改：统一地址格式'});assert.equal(amended.status,200);assert.equal(amended.d.status,'needs_info');record=amended.d;
 p.values.address='SYNTHETIC KYC QA address revised';p.consent=true;p.declarationVersion='kyc-data-consent-v2';record=(await a('/api/kyc',{action:'submit',revision:record.revision,profile:p})).d;assert.equal(record.status,'submitted');
 const review={id:record.id,revision:record.revision,decision:'approved',reason:'仅合成材料验收：逐项核对完成',checklist:Object.fromEntries(sections.map(s=>[s.id,true]))};
 const race=await Promise.all([staff('/api/kyc/review',review),staff('/api/kyc/review',review)]);assert.deepEqual(race.map(x=>x.status).sort(),[200,409]);
 const approved=(await a('/api/kyc')).d;assert.equal(approved.status,'approved');
 const history=(await staff('/api/kyc/review?id='+record.id)).d.history;assert.equal(history.filter(h=>h.action==='review:approved').length,1);assert(history.some(h=>h.review?.reason.includes('补件')));
 assert.equal((await a('/api/kyc',{action:'save',revision:approved.revision,profile:p})).status,409);
 const loanResult=await a('/api/h5/state',{action:'create',requestId:crypto.randomUUID(),name:'SYNTHETIC KYC QA',amount:5000,botId:'bot-1',consent:true});
 assert.equal(loanResult.status,200,JSON.stringify(loanResult.d));
 const loanId=loanResult.d.state.loans[0].id;
 const act=(action,more={})=>a('/api/h5/state',{action,loanId,requestId:crypto.randomUUID(),...more});
 let r=loanResult;let loan=r.d.state.loans.find(x=>x.id===loanId);assert.equal(loan.status,'kyc_approved');assert.equal(loan.kycRevision,approved.revision);assert.equal(loan.kycCaseId,approved.id);
 r=await act('confirm_bill',{billConfirmed:true,...(loan.billing?.quoteId?{quoteId:loan.billing.quoteId}:{})});assert.equal(r.status,200,JSON.stringify(r.d));
 const signature=await a('/api/loan/sign',png,{headers:{'X-Loan-Id':loanId,'X-Loan-Consent':'true','X-Loan-Terms':LOAN_TERMS_VERSION}});assert.equal(signature.status,200,JSON.stringify(signature.d));
 r=await act('apply',{billConfirmed:true,...(loan.billing?.quoteId?{quoteId:loan.billing.quoteId}:{})});assert.equal(r.status,200,JSON.stringify(r.d));assert.equal(r.d.state.loans.find(l=>l.id===loanId).status,'decision_pending');
 // A second case exercises the manual rejection branch.
 const q=profile();for(const slot of slots.filter(s=>s.required)){q.files[slot.id]=(await b('/api/kyc/files',png,{headers:{'X-KYC-Slot':slot.id,'X-KYC-Consent':'true','X-KYC-Agreement-Version':LOAN_TERMS_VERSION}})).d}
 const submitted=(await b('/api/kyc',{action:'submit',revision:bCase.revision,profile:q})).d;assert.equal(submitted.status,'submitted');
 const rejected=await staffB('/api/kyc/review',{id:submitted.id,revision:submitted.revision,decision:'rejected',reason:'合成材料拒绝分支验收',checklist:{}});assert.equal(rejected.status,200);assert.equal(rejected.d.status,'rejected');
 console.log('Synthetic QA case',approved.id.slice(0,8),'revision',approved.revision,'and rejection branch verified');
});
