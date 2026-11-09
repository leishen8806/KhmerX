import {DatabaseSync} from 'node:sqlite';

if (process.env.PAYEASE_ENV !== 'local') throw new Error('PAYEASE_ENV must be local');
const required=['KHMERX_BASE_URL','LICENSED_BASE_URL','KHMERX_DB_PATH','LICENSED_DB_PATH','CUSTOMER_COOKIE','LOAN_ID','PARTNER_ID','LICENSED_COOKIE','LENDER_VERSION','CHECKER_VERSION','KHMERX_JOB_SECRET','LICENSED_JOB_KEY'];
for (const key of required) if (!process.env[key]) throw new Error(`missing ${key}`);
const khmerx=process.env.KHMERX_BASE_URL.replace(/\/$/,'');
const licensed=process.env.LICENSED_BASE_URL.replace(/\/$/,'');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jLPsAAAAASUVORK5CYII=','base64');

async function request(base,path,{method='GET',body,headers={}}={}){
 const h=new Headers({origin:base,...headers});
 if(body!==undefined){h.set('content-type','application/json');}
 const response=await fetch(base+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)});
 let json=null;try{json=await response.json();}catch{}
 return {status:response.status,json};
}
async function binary(base,path,headers){
 const h=new Headers({origin:base,...headers,'content-type':'image/png'});h.set('content-length',String(png.length));
 return fetch(base+path,{method:'POST',headers:h,body:png});
}
function query(path,sql){const db=new DatabaseSync(path,{readOnly:true});try{return db.prepare(sql).all();}finally{db.close();}}
function safeQuery(path,sql){try{return query(path,sql);}catch{return [];}}
function printDb(label,path){
 const out={partnerOutbox:safeQuery(path,"SELECT status,COUNT(*) AS count FROM partner_outbox GROUP BY status"),received:safeQuery(path,"SELECT COUNT(*) AS count FROM institution_callback_events")};
 console.log(JSON.stringify({database:label,...out}));
}

const customerHeaders={cookie:process.env.CUSTOMER_COOKIE};
const terms=await request(khmerx,`/api/loan/sign?loan=${encodeURIComponent(process.env.LOAN_ID)}`,{headers:customerHeaders});
if(terms.status!==200) throw new Error(`sign terms HTTP ${terms.status}`);
const sign=await binary(khmerx,'/api/loan/sign',{...customerHeaders,'x-loan-id':process.env.LOAN_ID,'x-loan-consent':'true','x-loan-terms':terms.json.termsVersion});
console.log(JSON.stringify({step:'sign',status:sign.status,bytes:png.length,first8:png.subarray(0,8).toString('hex'),contentType:'image/png'}));
if(!sign.ok) throw new Error(`sign HTTP ${sign.status}`);
const apply=await request(khmerx,'/api/h5/state',{method:'POST',body:{action:'apply',loanId:process.env.LOAN_ID,billConfirmed:true,requestId:`w2-6-apply-${Date.now()}`},headers:customerHeaders});
console.log(JSON.stringify({step:'apply',status:apply.status,code:apply.json?.code??null}));
const khJob=await request(khmerx,'/api/jobs/partner-outbox',{method:'POST',headers:{authorization:`Bearer ${process.env.KHMERX_JOB_SECRET}`}});
console.log(JSON.stringify({step:'khmerx-outbox',status:khJob.status,sent:khJob.json?.sent??0,dead:khJob.json?.dead??0}));
const apps=await request(licensed,`/api/institution/applications?partnerId=${encodeURIComponent(process.env.PARTNER_ID)}`,{headers:{cookie:process.env.LICENSED_COOKIE}});
console.log(JSON.stringify({step:'licensed-list',status:apps.status,count:apps.json?.applications?.length??0}));
const app=apps.json?.applications?.find(x=>x.id===process.env.PUBLIC_REF);
if(app){
 const approve=await request(licensed,'/api/institution/applications',{method:'POST',headers:{cookie:process.env.LICENSED_COOKIE},body:{action:'approve',partnerId:process.env.PARTNER_ID,applicationId:app.id,version:Number(process.env.LENDER_VERSION),requestId:`w2-6-approve-${Date.now()}`}});
 console.log(JSON.stringify({step:'approve',status:approve.status,code:approve.json?.code??null}));
 const review=await request(licensed,'/api/institution/applications',{method:'POST',headers:{cookie:process.env.LICENSED_COOKIE},body:{action:'review_approve',partnerId:process.env.PARTNER_ID,applicationId:app.id,version:Number(process.env.CHECKER_VERSION),requestId:`w2-6-review-${Date.now()}`}});
 console.log(JSON.stringify({step:'review',status:review.status,code:review.json?.code??null}));
}
const licJob=await request(licensed,'/api/jobs/partner-outbox',{method:'POST',headers:{'x-job-key':process.env.LICENSED_JOB_KEY}});
console.log(JSON.stringify({step:'licensed-outbox',status:licJob.status,sent:licJob.json?.sent??0,dead:licJob.json?.dead??0}));
printDb('khmerx',process.env.KHMERX_DB_PATH);printDb('licensed',process.env.LICENSED_DB_PATH);
