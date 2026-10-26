import type {Bill} from '@/lib/pricing';
import {staff,guardKyc,ensureAssignment} from '@/lib/team/server';
import {kycFieldGroupFor,kycFieldGroups,type KycFieldGroup} from '@/lib/team/policy';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {customer,json} from '@/lib/h5-auth';
import {AuthError} from '@/lib/h5-auth-core';
import {loanTerms} from '@/lib/agreements/loan-terms';
import {cleanProfile,emptyProfile,missing,completeness,validateReview,fields,KycError,RULE_VERSION,type Profile,type KycStatus,type FileRef,type Slot} from './core';
import {assertAllowedOrigin} from '@/lib/request-security';
import {channelForAccount,claimPublicIdentifier} from '@/lib/public-id-store';
import {errorResponse} from '@/lib/http/route';
import {requestIdOf,resolveRequestId} from '@/lib/http/request-id';
import {isTestMode} from '@/lib/runtime-guards';
import {ApiError} from '@/lib/http/api-error';
import {KYC_CUSTOMER_MAX_BYTES,KYC_CUSTOMER_MAX_FILES,kycFileMaxBytes} from './limits';
import {parseRequests,requestSection,type KycRequest} from './requests';
export {json,KycError};
export type CasePayload={profile:Profile;phoneVerified:boolean;ruleVersion:string;submittedAt?:string;signedLoan?:{billing?:Bill;borrowerName:string;profileHash:string;loanId:string;signatureId:string;signatureHash:string;termsVersion:string;termsHash:string;termsSnapshot:typeof loanTerms.blocks;principal:number;fee:number;currency:string;termDays:number;signedAt:string;contractHash:string};review?:{requests?:KycRequest[];decision:string;reason:string;checklist:Record<string,boolean>;actor:string;at:string;revision:number}};
export type CaseRow={id:string;owner:string;customer_id:string;revision:number;status:KycStatus;payload:string;updated_at:string;public_ref?:string|null;source_channel?:string|null};
export const settings=()=>env as unknown as Record<string,string>;
export function db(){if(!env.DB)throw new KycError('KYC 数据库暂不可用',503);return env.DB}
export function bucket(){if(!env.BUCKET)throw new KycError('私有材料存储尚未配置',503);return env.BUCKET}
let scansInFlight=0;
const positiveLimit=(value:unknown,fallback:number)=>Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):fallback;
const scanUnavailable=()=>new ApiError(503,'SERVICE_UNAVAILABLE','File scanning is temporarily unavailable',undefined,3);
export async function scanFile(bytes:Uint8Array){
 const values=settings(),url=values.KYC_SCAN_URL?.trim();
 if(!url){if(isTestMode())return;throw scanUnavailable()}
 if(scansInFlight>=positiveLimit(values.KYC_SCAN_MAX_CONCURRENCY,8))throw scanUnavailable();
 scansInFlight++;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{
  const scanHeaders:Record<string,string>={'content-type':'application/octet-stream','cache-control':'no-store'};if(values.KYC_SCAN_TOKEN)scanHeaders.authorization='Bearer '+values.KYC_SCAN_TOKEN;
  const response=await fetch(url,{method:'POST',headers:scanHeaders,body:bytes as BodyInit,signal:controller.signal});
  let result:{clean?:boolean;status?:string};try{result=await response.json() as {clean?:boolean;status?:string}}catch{throw scanUnavailable()}
  if(response.status===422&&result.clean===false)throw new KycError('文件未通过安全扫描，请更换文件后重试',422);
  if(!response.ok)throw scanUnavailable();
  if(result.clean!==true)throw new KycError('文件未通过安全扫描，请更换文件后重试',422);
 }catch(e){if(e instanceof KycError||e instanceof ApiError)throw e;throw scanUnavailable()}finally{clearTimeout(timer);scansInFlight--}
}
const encoder=new TextEncoder();
export async function digest(s:string|Uint8Array){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof s==='string'?encoder.encode(s):s as BufferSource))].map(x=>x.toString(16).padStart(2,'0')).join('')}
/** Keyed profile fingerprint: prevents offline guessing of names/IDs from a contract hash. */
export async function profileDigest(value:unknown){
 const secret=String(settings().PAYEASE_AUTH_SECRET||'');
 if(secret.length<32)throw new AuthError('身份资料校验密钥尚未配置',503);
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const mac=await crypto.subtle.sign('HMAC',key,encoder.encode(JSON.stringify(value)));
 return 'v2:'+Array.from(new Uint8Array(mac),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function profileDigestMatches(value:unknown,stored:string){return stored===await profileDigest(value)||stored===await digest(JSON.stringify(value))}
const KYC_ENVELOPE=0x4b, KYC_ENVELOPE_VERSION=0x02, DEFAULT_KEY_ID='v2';
function activeKeyId(){const id=settings().KYC_DATA_KEY_ID?.trim()||DEFAULT_KEY_ID;if(!/^[A-Za-z0-9._-]{1,64}$/.test(id))throw new KycError('KYC 加密密钥编号配置无效，请联系管理员',503);return id}
async function legacyKey(){const secret=settings().KYC_DATA_SECRET;if(!secret||secret.length<32)throw new KycError('KYC 加密服务尚未配置，请联系管理员',503);return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode('payease-kyc-v1:'+secret)),{name:'AES-GCM'},false,['encrypt','decrypt'])}
async function derivedKey(keyId:string){const secret=settings().KYC_DATA_SECRET;if(!secret||secret.length<32)throw new KycError('KYC 加密服务尚未配置，请联系管理员',503);const base=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HKDF'},false,['deriveKey']);return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:encoder.encode('payease-kyc-salt:'+keyId),info:encoder.encode('payease-kyc-aes-gcm-v2')},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
export async function encryptBytes(bytes:Uint8Array,context:string){const keyId=activeKeyId(),id=encoder.encode(keyId),iv=crypto.getRandomValues(new Uint8Array(12));const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(context)},await derivedKey(keyId),bytes as BufferSource));const out=new Uint8Array(3+id.length+iv.length+cipher.length);out.set([KYC_ENVELOPE,KYC_ENVELOPE_VERSION,id.length]);out.set(id,3);out.set(iv,3+id.length);out.set(cipher,15+id.length);return out}
export async function decryptBytes(bytes:Uint8Array,context:string){if(bytes[0]===KYC_ENVELOPE&&bytes[1]===KYC_ENVELOPE_VERSION&&bytes[2]>0&&bytes[2]<=64&&bytes.length>15+bytes[2]){const length=bytes[2],keyId=new TextDecoder().decode(bytes.slice(3,3+length)),offset=3+length,iv=bytes.slice(offset,offset+12);return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:encoder.encode(context)},await derivedKey(keyId),bytes.slice(offset+12)))}const iv=bytes.slice(0,12);return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:encoder.encode(context)},await legacyKey(),bytes.slice(12)))}
async function seal(value:unknown,context:string){const b=await encryptBytes(encoder.encode(JSON.stringify(value)),context);return btoa(String.fromCharCode(...b))}
async function unseal<T>(value:string,context:string){const b=Uint8Array.from(atob(value),c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(await decryptBytes(b,context))) as T}
export async function reviewer(){const team=await staff();if(team){if(!['admin','kyc','dept_admin','audit'].includes(team.member.role))throw new KycError('当前岗位没有 KYC 材料查看权限',403);return {...team.user,userId:team.tenant.id,actorId:team.user.userId,team}}if(!isTestMode())throw new KycError('生产环境必须使用管理后台 KYC 审核岗位',403);const u=await getChatGPTUser();if(!u)throw new KycError('请先登录工作区',401);const allowed=(settings().KYC_REVIEWER_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);if(!allowed.includes(u.email.toLowerCase()))throw new KycError('当前账号未获 KYC 审核授权',403);return {...u,actorId:u.userId,team:null}}
export async function context(request:Request){const c=await customer(request);return {owner:c.ownerId,customerId:c.session.customerId,verified:c.session.phoneVerified===true}}
export function origin(request:Request){try{assertAllowedOrigin(request,true)}catch{throw new KycError('不允许跨站操作',403,'CROSS_SITE_REQUEST')}}
export async function boundedBody(request:Request,max:number){if(Number(request.headers.get('content-length')||0)>max)throw new ApiError(413,'PAYLOAD_TOO_LARGE','Upload exceeds the size limit',{maxBytes:max});const reader=request.body?.getReader();if(!reader)return new Uint8Array();const chunks:Uint8Array[]=[];let size=0;while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>max){await reader.cancel();throw new ApiError(413,'PAYLOAD_TOO_LARGE','Upload exceeds the size limit',{maxBytes:max})}chunks.push(r.value)}const out=new Uint8Array(size);let offset=0;for(const c of chunks){out.set(c,offset);offset+=c.length}return out}
export async function body(request:Request){origin(request);if(!request.headers.get('content-type')?.startsWith('application/json'))throw new KycError('请求格式无效',415);try{const value=JSON.parse(new TextDecoder().decode(await boundedBody(request,50000)));if(!value||typeof value!=='object'||Array.isArray(value))throw new KycError('请求格式无效');return value}catch(e){if(e instanceof KycError)throw e;throw new KycError('请求格式无效')}}
export function failed(e:unknown,request?:Request){
 return errorResponse(e,request?requestIdOf(request)??resolveRequestId(request):crypto.randomUUID());
}
export async function findCase(owner:string,customerId:string){return db().prepare('SELECT * FROM kyc_cases WHERE owner=? AND customer_id=?').bind(owner,customerId).first<CaseRow>()}
export async function getCase(owner:string,id:string){const row=await db().prepare('SELECT * FROM kyc_cases WHERE owner=? AND id=?').bind(owner,id).first<CaseRow>();if(!row)throw new KycError('资料不存在或不可访问',404);return row}
export async function payload(row:CaseRow){return unseal<CasePayload>(row.payload,'case:'+row.id)}
export async function storedContract(owner:string,customerId:string,signatureId:string){
 const row=await db().prepare('SELECT payload FROM kyc_contracts WHERE signature_id=? AND owner=? AND customer_id=?').bind(signatureId,owner,customerId).first<{payload:string}>();
 if(!row)throw new KycError('签名合同不可访问',409);
 return unseal<NonNullable<CasePayload['signedLoan']>>(row.payload,'contract:'+signatureId);
}
export async function contractHashValid(contract:NonNullable<CasePayload['signedLoan']>){
 const {contractHash,...terms}=contract;
 return typeof contractHash==='string'&&contractHash===await digest(JSON.stringify(terms));
}
export async function initialize(owner:string,customerId:string,verified:boolean){await ensureAssignment(owner,customerId);let row=await findCase(owner,customerId);if(!row){const id=await digest(owner+'\0'+customerId),data:CasePayload={profile:emptyProfile(),phoneVerified:verified,ruleVersion:RULE_VERSION};await db().prepare('INSERT OR IGNORE INTO kyc_cases (id,owner,customer_id,revision,status,payload,updated_at) VALUES (?,?,?,0,?,?,?)').bind(id,owner,customerId,'draft',await seal(data,'case:'+id),new Date().toISOString()).run();row=(await findCase(owner,customerId))!}if(!row.public_ref){const account=await db().prepare('SELECT mode,channel_id FROM h5_accounts WHERE owner=? AND customer_id=?').bind(owner,customerId).first<{mode:string;channel_id:string|null}>();const channel=channelForAccount(account?.mode,account?.channel_id);const ref=await claimPublicIdentifier(db(),'K',channel,row.id,owner,row.updated_at);await db().prepare('UPDATE kyc_cases SET public_ref=?,source_channel=? WHERE id=? AND owner=? AND public_ref IS NULL').bind(ref,channel,row.id,owner).run();row={...row,public_ref:ref,source_channel:channel}}return row}
function fileContext(row:{id:string;owner:string;customer_id:string}){return `file:${row.owner}:${row.customer_id}:${row.id}`}
function blobContext(row:{id:string;owner:string;customer_id:string}){return `blob:${row.owner}:${row.customer_id}:${row.id}`}
export async function metadata(row:{id:string;metadata:string;owner?:string;customer_id?:string}){if(row.owner&&row.customer_id){try{return await unseal<FileRef>(row.metadata,fileContext({id:row.id,owner:row.owner,customer_id:row.customer_id}))}catch{}}return unseal<FileRef>(row.metadata,'file:'+row.id)}
export async function decryptFileObject(bytes:Uint8Array,row:{id:string;owner:string;customer_id:string}){try{return await decryptBytes(bytes,blobContext(row))}catch{return decryptBytes(bytes,'blob:'+row.id)}}
export async function fileRow(owner:string,id:string,customerId?:string){const row=await db().prepare('SELECT * FROM kyc_files WHERE id=? AND owner=? AND ready=1').bind(id,owner).first<{id:string;owner:string;customer_id:string;slot:Slot;metadata:string}>();if(!row||customerId&&row.customer_id!==customerId)throw new KycError('材料不存在或不可访问',404);return row}
export async function resolveFiles(owner:string,customerId:string,profile:Profile){for(const [slot,ref] of Object.entries(profile.files)){const row=await fileRow(owner,ref.id,customerId);if(row.slot!==slot)throw new KycError('材料类型不匹配');profile.files[slot as Slot]=await metadata(row)}return profile}
export async function transition(row:CaseRow,status:KycStatus,data:CasePayload,action:string,actor:string){
 const team=action.startsWith('review:')?await staff():null;const now=new Date().toISOString(),cipher=await seal(data,'case:'+row.id),historyId=crypto.randomUUID();
 const results=await db().batch([
 db().prepare('UPDATE kyc_cases SET revision=revision+1,status=?,payload=?,updated_at=? WHERE id=? AND owner=? AND revision=? AND (? IS NULL OR EXISTS (SELECT 1 FROM team_members m JOIN team_assignments a ON a.tenant_id=m.tenant_id WHERE m.id=? AND m.active=1 AND m.version=? AND (m.role=\'admin\' OR (m.role=\'kyc\' AND a.department_id=m.unit_id AND a.reviewer_id=m.id)) AND a.customer_id=kyc_cases.customer_id AND a.tenant_id=kyc_cases.owner))').bind(status,cipher,now,row.id,row.owner,row.revision,team?.member.id||null,team?.member.id||null,team?.member.version??0),
 db().prepare('INSERT INTO kyc_history (id,case_id,revision,owner,action,actor,snapshot,created_at) SELECT ?,id,revision,owner,?,?,payload,? FROM kyc_cases WHERE id=? AND revision=? AND payload=?').bind(historyId,action,actor,now,row.id,row.revision+1,cipher)]);
 if(results[0].meta.changes!==1)throw new KycError('资料已被其他操作更新，请重新加载后核对',409);
 return {...row,revision:row.revision+1,status,payload:cipher,updated_at:now};
}
export async function loanForSignature(owner:string,customerId:string){const row=await db().prepare('SELECT payload FROM demo_workspaces WHERE owner=?').bind(owner).first<{payload:string}>();if(!row)return null;return JSON.parse(row.payload).loans.find((l:any)=>l.customerId===customerId&&!['rejected','closed'].includes(l.status))||null}
export async function signedContract(row:CaseRow,profile:Profile,old:CasePayload){
 if(!profile.consent||!profile.files.signature)return undefined;
 const loan=await loanForSignature(row.owner,row.customer_id);if(!loan)throw new KycError('请先创建贷款申请，再手写签名');
 const profileHash=await profileDigest(profile.values);if(old.signedLoan?.signatureId===profile.files.signature.id){if(old.signedLoan.loanId!==loan.id||old.signedLoan.principal!==loan.amount||old.signedLoan.fee!==loan.fee||!(await profileDigestMatches(profile.values,old.signedLoan.profileHash))||(loan.billing&&old.signedLoan.billing?.quoteId!==loan.billing.quoteId))throw new KycError('个人资料或贷款条件已变化，请重新手写签名');return old.signedLoan}
 if(!loan.billConfirmedAt)throw new KycError('请先在我的贷款确认测算费用，再手写签约');
 const file=await db().prepare('SELECT created_at FROM kyc_files WHERE id=? AND owner=? AND customer_id=?').bind(profile.files.signature.id,row.owner,row.customer_id).first<{created_at:string}>();if(!file||file.created_at<loan.createdAt||file.created_at<loan.billConfirmedAt)throw new KycError('请为当前申请重新手写签名');
 const terms={...(loan.billing?{billing:loan.billing}:{}),borrowerName:[profile.values.surname,profile.values.givenName].filter(Boolean).join(' '),profileHash,loanId:loan.id,signatureId:profile.files.signature.id,signatureHash:profile.files.signature.sha256,termsVersion:profile.declarationVersion,termsHash:await digest(JSON.stringify(loanTerms.blocks)),termsSnapshot:loanTerms.blocks,principal:loan.amount,fee:loan.fee,currency:'USD',termDays:loan.billing?.termDays??14,signedAt:file.created_at};const contract={...terms,contractHash:await digest(JSON.stringify(terms))};await db().prepare('INSERT OR IGNORE INTO kyc_contracts (signature_id,owner,customer_id,payload,created_at) VALUES (?,?,?,?,?)').bind(terms.signatureId,row.owner,row.customer_id,await seal(contract,'contract:'+terms.signatureId),new Date().toISOString()).run();const stored=await db().prepare('SELECT payload FROM kyc_contracts WHERE signature_id=? AND owner=? AND customer_id=?').bind(terms.signatureId,row.owner,row.customer_id).first<{payload:string}>();if(!stored)throw new KycError('签名合同不可访问');const immutable=await unseal<typeof contract>(stored.payload,'contract:'+terms.signatureId);if(immutable.loanId!==loan.id||immutable.profileHash!==profileHash||immutable.principal!==loan.amount||immutable.fee!==loan.fee)throw new KycError('此签名已绑定其他资料或贷款条件，请重新手写签名');return immutable;
}
export async function view(row:CaseRow){const data=await payload(row),loan=await loanForSignature(row.owner,row.customer_id);return {loanOffer:loan?{billConfirmedAt:loan.billConfirmedAt,id:loan.id,amount:loan.amount,fee:loan.fee,termDays:loan.billing?.termDays??14,billing:loan.billing}:null,id:row.id,revision:row.revision,status:row.status,updatedAt:row.updated_at,...data,score:completeness(data.profile,data.phoneVerified),missing:missing(data.profile),external:{identity:'未接入身份证核验',liveness:'未接入活体检测',bank:'未接入 KESS；银行手机号未获取',telegram:'未接入 Telegram 账号会话'},scope:'人工资料审核；不代表外部实名、银行账户验证或贷款批准'}}
export async function staffView(row:CaseRow,role:string){const result=await view(row);if(role!=='audit')return result;return {...result,profile:{...result.profile,values:{},files:{}},signedLoan:undefined,external:{identity:'仅显示审核状态',liveness:'仅显示审核状态',bank:'仅显示审核状态',telegram:'仅显示审核状态'},scope:'审计只读摘要；敏感资料由 KYC 审核岗位查看'}}
export async function save(request:Request){const c=await context(request),p=await body(request),row=await initialize(c.owner,c.customerId,c.verified);if(!['draft','needs_info'].includes(row.status))throw new KycError('当前资料已锁定，不能直接修改',409);if(p.revision!==row.revision)throw new KycError('资料版本已变化，请重新加载',409);if(!['save','submit'].includes(p.action))throw new KycError('操作无效');const profile=await resolveFiles(c.owner,c.customerId,cleanProfile(p.profile)),old=await payload(row);if(p.action==='submit'){const problems=missing(profile);if(problems.length)throw new KycError('请补全：'+problems.join('、'))}
 delete profile.files.signature;const signedLoan=undefined;const data:CasePayload={profile,signedLoan,phoneVerified:c.verified,ruleVersion:RULE_VERSION,review:old.review,...(p.action==='submit'?{submittedAt:new Date().toISOString()}:{})};return view(await transition(row,p.action==='submit'?'submitted':row.status,data,p.action,c.customerId));}
export async function decide(request:Request){
 const u=await reviewer(),p=await body(request),row=await getCase(u.userId,String(p.id));
 if(u.team)await guardKyc(u.userId,row.customer_id,true);
 if(u.team?.member.role==='admin'&&(p.action==='amend'||p.decision!=='approved'))throw new KycError('Admin 当前仅可确认审核通过',403);
 if(row.revision!==p.revision)throw new KycError('资料已更新，请重新读取后审核',409);
 const data=await payload(row),reason=typeof p.reason==='string'?p.reason.trim():'';
 if(p.action==='amend'){
  if(!['submitted','needs_info'].includes(row.status))throw new KycError('仅待审核或待补件资料可代修改');
  if(!reason||reason.length>1000)throw new KycError('请填写代修改原因');
  if(!p.values||typeof p.values!=='object'||Array.isArray(p.values))throw new KycError('代修改资料格式无效');
  const normalized=cleanProfile({...data.profile,values:p.values,consent:false,files:{...data.profile.files,signature:undefined}}),changed=fields.map(f=>f.id).filter(id=>String(data.profile.values[id]??'')!==String(normalized.values[id]??''));
  if(!changed.length)throw new KycError('没有检测到资料变化');
  const groups=[...new Set(changed.map(kycFieldGroupFor))] as KycFieldGroup[];
  if(u.team){
   if(!['admin','kyc','dept_admin'].includes(u.team.member.role))throw new KycError('当前岗位没有 KYC 修改权限',403);
   const permitted=(await db().prepare('SELECT field_group FROM team_kyc_field_permissions WHERE tenant_id=? AND member_id=? AND active=1').bind(u.team.tenant.id,u.team.member.id).all()).results.map((x:any)=>x.field_group);
   const denied=groups.filter(group=>!permitted.includes(group));
   if(denied.length)throw new KycError('未授予字段级修改权限：'+denied.map(group=>kycFieldGroups[group]).join('、'),403);
  }
  const mask=(value:unknown)=>{const text=String(value??'');return text.length>4?'***'+text.slice(-4):text};
  const before=Object.fromEntries(changed.map(id=>[id,mask(data.profile.values[id])]));
  const after=Object.fromEntries(changed.map(id=>[id,mask(normalized.values[id])]));
  const next=await transition(row,'needs_info',{...data,profile:await resolveFiles(row.owner,row.customer_id,normalized),signedLoan:undefined,review:{decision:'needs_info',reason:'审核员代修改，待客户确认：'+reason,checklist:{},actor:u.actorId,at:new Date().toISOString(),revision:row.revision}},'review:amend',u.actorId);
  if(u.team)await db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),u.team.tenant.id,u.actorId,'kyc_field_amend',JSON.stringify({caseId:row.id,fields:changed,groups,before,after,reason,requiresResubmission:true,revision:next.revision}),new Date().toISOString()).run();
  return view(next);
 }
 const checklist=Object.fromEntries(['identity','contacts','employment','income','assets','bank','consent'].map(k=>[k,p.checklist?.[k]===true]));validateReview(row.status,p.decision,checklist,reason,data.profile);const requests=parseRequests(p.requests,data.profile);
 if(p.decision!=='needs_info'&&requests?.length)throw new KycError('只有退回补件可以包含补件项目');
 if(p.decision==='needs_info')for(const request of requests||[])checklist[requestSection(request.target)!]=true;
 data.review={...(requests===undefined?{}:{requests}),decision:p.decision,reason,checklist,actor:u.actorId,at:new Date().toISOString(),revision:row.revision};return view(await transition(row,p.decision,data,'review:'+p.decision,u.actorId));
}
export async function recordFile(owner:string,customerId:string,slot:Slot,bytes:Uint8Array,type:string,requestId?:string){
 const started=Date.now();let scanDurationMs=0;
 try{
 if(bytes.length>kycFileMaxBytes(type))throw new ApiError(413,'PAYLOAD_TOO_LARGE','File exceeds the upload limit',{maxBytes:kycFileMaxBytes(type)});
 const sha256=await digest(bytes);
 // A retry or a double-click must not create another evidence row. Keep older
 // versions for audit, and reuse an identical ready object for this slot.
 const existing=await db().prepare('SELECT id,owner,customer_id,metadata FROM kyc_files WHERE owner=? AND customer_id=? AND slot=? AND ready=1 AND superseded_at IS NULL').bind(owner,customerId,slot).all<{id:string;owner:string;customer_id:string;metadata:string}>();
 // A signature is evidence for one loan and one signing event. Never reuse a
 // byte-identical signature across loans; other KYC slots may safely dedupe.
 if(slot!=='signature')for(const row of existing.results||[]){try{const old=await metadata(row);if(old.sha256===sha256)return old}catch(e){if(e instanceof KycError)throw e}}
 const id=crypto.randomUUID(),ref:FileRef={id,slot,name:slot+(type==='image/png'?'.png':type==='image/jpeg'?'.jpg':'.pdf'),type,size:bytes.length,sha256};
 const active=(await db().prepare('SELECT id,owner,customer_id,slot,metadata,ready FROM kyc_files WHERE owner=? AND customer_id=? AND superseded_at IS NULL').bind(owner,customerId).all<{id:string;owner:string;customer_id:string;slot:string;metadata:string;ready:number}>()).results;
 const counted=active.filter(row=>slot==='signature'||row.slot!==slot||row.ready!==1);
 let totalBytes=bytes.length;
 for(const row of counted){const saved=await metadata(row);if(!Number.isSafeInteger(saved.size)||saved.size<0)throw new Error('Invalid file size metadata');totalBytes+=saved.size}
 const maxFiles=positiveLimit(settings().KYC_CUSTOMER_MAX_FILES,KYC_CUSTOMER_MAX_FILES),maxBytes=positiveLimit(settings().KYC_CUSTOMER_MAX_BYTES,KYC_CUSTOMER_MAX_BYTES);
 if(counted.length+1>maxFiles||totalBytes>maxBytes)throw new ApiError(409,'CONFLICT','Customer file quota exceeded',{maxFiles,maxBytes});
 const rowContext={id,owner,customer_id:customerId};
 // Pending rows reserve quota. A changed ID set forces a retry before writing.
 const inserted=await db().prepare('INSERT INTO kyc_files (id,owner,customer_id,slot,metadata,ready,created_at) SELECT ?,?,?,?,?,0,? WHERE (SELECT COUNT(*) FROM kyc_files WHERE owner=? AND customer_id=? AND superseded_at IS NULL)=? AND NOT EXISTS (SELECT 1 FROM kyc_files WHERE owner=? AND customer_id=? AND superseded_at IS NULL AND id NOT IN (SELECT value FROM json_each(?)))').bind(id,owner,customerId,slot,await seal(ref,fileContext(rowContext)),new Date().toISOString(),owner,customerId,active.length,owner,customerId,JSON.stringify(active.map(row=>row.id))).run();
 if(!inserted.meta.changes)throw new ApiError(409,'CONFLICT','Uploads changed; retry the request',{maxFiles,maxBytes});
 try{
  const scanStarted=Date.now();try{await scanFile(bytes)}finally{scanDurationMs=Date.now()-scanStarted}
  await bucket().put('kyc/'+id,await encryptBytes(bytes,blobContext(rowContext)),{httpMetadata:{contentType:'application/octet-stream'}});const account=await db().prepare('SELECT mode,channel_id FROM h5_accounts WHERE owner=? AND customer_id=?').bind(owner,customerId).first<{mode:string;channel_id:string|null}>(),channel=channelForAccount(account?.mode,account?.channel_id),publicRef=await claimPublicIdentifier(db(),'F',channel,id,owner,new Date().toISOString());ref.publicRef=publicRef;await db().batch([db().prepare('UPDATE kyc_files SET ready=1,public_ref=?,source_channel=? WHERE id=?').bind(publicRef,channel,id),...(slot!=='signature'?[db().prepare("UPDATE kyc_files SET superseded_at=? WHERE owner=? AND customer_id=? AND slot=? AND id<>? AND ready=1 AND superseded_at IS NULL").bind(new Date().toISOString(),owner,customerId,slot,id)]:[])]);return ref;
 }catch(e){await bucket().delete('kyc/'+id).catch(()=>{});await db().prepare('DELETE FROM kyc_files WHERE id=? AND ready=0').bind(id).run();throw e}
 }finally{console.info('[kyc-upload]',{durationMs:Date.now()-started,scanDurationMs,...(requestId?{requestId}:{})})}
}
