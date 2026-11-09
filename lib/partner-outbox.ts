import {env} from 'cloudflare:workers';
import {signInstitutionCallback} from '@/lib/institution-callback';
import {institutionMode} from '@/lib/runtime-guards';
import type {Loan} from '@/lib/domain';

type DB=Pick<D1Database,'prepare'|'batch'>;
type OutboxInput={tenantId:string;institutionId:string;eventType:string;idempotencyKey:string;payload:string;payloadSha256:string;createdAt:string};
const values=()=>env as unknown as Record<string,string>;
const mode=()=>institutionMode()==='external';
const sha256=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');

function configMap(name:string){try{const value=values()[name]?.trim();const parsed=value?JSON.parse(value):{};return parsed&&typeof parsed==='object'?parsed as Record<string,string>:{};}catch{return {};}}
function outboundSecret(institutionId:string){const map=configMap('PARTNER_OUTBOUND_SECRETS_JSON');return typeof map[institutionId]==='string'?map[institutionId]:'';}
function endpoint(institutionId:string){const raw=configMap('PARTNER_ENDPOINTS_JSON')[institutionId];if(typeof raw!=='string')return null;try{const url=new URL(raw),safe=!url.username&&!url.password,local=values().PAYEASE_ENV==='local',loopback=url.hostname==='127.0.0.1'||url.hostname==='localhost';if(!safe)return null;if(url.protocol==='https:')return url;if(local&&url.protocol==='http:'&&loopback)return url;return null;}catch{return null;}}

export async function deriveCustomerRef(secret:string,tenantId:string,institutionId:string,customerId:string){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${tenantId}|${institutionId}|${customerId}`));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('').slice(0,32);
}

export async function buildPartnerEvent(input:{tenantId:string;institutionId:string;eventType:'application.submitted'|'agreement.signed'|'application.withdrawn';loan:Loan;customerId:string;database:DB;createdAt?:string}){
 const secret=outboundSecret(input.institutionId);if(!secret||!endpoint(input.institutionId))throw new Error('PARTNER_NOT_CONFIGURED');
 const applicationId=input.loan.publicRef;if(!applicationId)throw new Error('APPLICATION_PUBLIC_REF_MISSING');
 const customerRef=await deriveCustomerRef(secret,input.tenantId,input.institutionId,input.customerId);
 const files=(await input.database.prepare('SELECT public_ref,slot,metadata FROM kyc_files WHERE owner=? AND customer_id=? AND ready=1 AND superseded_at IS NULL ORDER BY slot').bind(input.tenantId,input.customerId).all<{public_ref:string|null;slot:string;metadata:string}>()).results.map(file=>{let metadata:any={};try{metadata=JSON.parse(file.metadata)}catch{}return {fileRef:file.public_ref||undefined,type:file.slot,sha256:typeof metadata.sha256==='string'?metadata.sha256:undefined};});
 const payload=input.eventType==='application.submitted'?{eventType:input.eventType,applicationId,customerRef,amountCents:input.loan.amount,termDays:(input.loan.billing?.termDays??input.loan.demoDays??14),billing:input.loan.billing?{currency:input.loan.billing.currency,principal:input.loan.billing.principal,fee:input.loan.billing.total-input.loan.billing.principal,total:input.loan.billing.total}:undefined,kyc:{files}}:input.eventType==='application.withdrawn'?{eventType:input.eventType,applicationId,customerRef}:{eventType:input.eventType,applicationId,customerRef,agreement:{version:'arc04-v0',signedAt:input.loan.signedAt||null,sha256:await sha256(input.loan.contract||'')}};
 const body=JSON.stringify(payload),createdAt=input.createdAt||new Date().toISOString();
 return {tenantId:input.tenantId,institutionId:input.institutionId,eventType:input.eventType,idempotencyKey:`${input.eventType}:${applicationId}`,payload:body,payloadSha256:await sha256(body),createdAt};
}

export function partnerOutboxInsert(db:DB,input:OutboxInput){
 return db.prepare("INSERT OR IGNORE INTO partner_outbox(id,tenant_id,institution_id,event_type,idempotency_key,payload,payload_sha256,status,attempts,next_attempt_at,lease_until,last_error,created_at,delivered_at) SELECT ?,?,?,?,?,?,?, 'pending',0,0,NULL,NULL,?,NULL WHERE ?='external' AND changes()=1").bind(crypto.randomUUID(),input.tenantId,input.institutionId,input.eventType,input.idempotencyKey,input.payload,input.payloadSha256,input.createdAt,institutionMode());
}

export async function dispatchPartnerOutbox(now=new Date().toISOString(),fetcher:typeof fetch=fetch){
 if(!mode()||String(values().PARTNER_OUTBOX||'').toLowerCase()!=='on'||!env.DB)return {sent:0,dead:0};
 const db=env.DB as DB,nowMs=Date.parse(now);await db.prepare("UPDATE partner_outbox SET status='pending',lease_until=NULL WHERE status='sending' AND lease_until IS NOT NULL AND lease_until<=?").bind(nowMs).run();const rows=(await db.prepare("SELECT * FROM partner_outbox WHERE status='pending' AND next_attempt_at<=? ORDER BY next_attempt_at,id LIMIT 20").bind(nowMs).all<any>()).results;let sent=0,dead=0;
 for(const row of rows){const claim=await db.prepare("UPDATE partner_outbox SET status='sending',attempts=attempts+1,lease_until=? WHERE id=? AND status='pending' AND attempts=?").bind(nowMs+5*60*1000,row.id,row.attempts).run();if(!claim.meta.changes)continue;const url=endpoint(row.institution_id),secret=outboundSecret(row.institution_id);if(!url||!secret){await db.prepare("UPDATE partner_outbox SET status='dead',lease_until=NULL,last_error=? WHERE id=? AND status='sending'").bind(!url?'PARTNER_ENDPOINT_INVALID':'PARTNER_OUTBOUND_SECRET_MISSING',row.id).run();dead++;continue}
  const nonceBytes=new Uint8Array(12);crypto.getRandomValues(nonceBytes);const nonce=btoa(String.fromCharCode(...nonceBytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''),timestamp=String(Math.floor(nowMs/1000)),signature=await signInstitutionCallback(secret,{institutionId:row.institution_id,timestamp,nonce,body:row.payload,idempotencyKey:row.idempotency_key});const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);let status=0;try{const response=await fetcher(url,{method:'POST',headers:{'content-type':'application/json','x-partner-id':row.institution_id,'x-timestamp':timestamp,'x-nonce':nonce,'x-idempotency-key':row.idempotency_key,'x-signature':signature},body:row.payload,signal:controller.signal});status=response.status;}catch{status=0}finally{clearTimeout(timer)}
  if((status>=200&&status<300)||status===409){await db.prepare("UPDATE partner_outbox SET status='delivered',lease_until=NULL,last_error=?,delivered_at=? WHERE id=? AND status='sending'").bind(status===409?'HTTP_409':null,now,row.id).run();sent++;continue}
  const expired=Date.parse(row.created_at)+24*60*60*1000<=nowMs;if(expired){await db.prepare("UPDATE partner_outbox SET status='dead',lease_until=NULL,last_error=? WHERE id=? AND status='sending'").bind(status?`HTTP_${status}`:'TIMEOUT',row.id).run();dead++;continue}const delay=Math.min(3600,30*2**Math.max(0,row.attempts-1));await db.prepare("UPDATE partner_outbox SET status='pending',lease_until=NULL,last_error=?,next_attempt_at=? WHERE id=? AND status='sending'").bind(status?`HTTP_${status}`:'TIMEOUT',nowMs+delay*1000,row.id).run();
 }
 return {sent,dead};
}
