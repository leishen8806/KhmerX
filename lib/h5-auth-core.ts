import {validateInitData,canonicalInitData} from './telegram.ts';
import {codeForError} from './error-codes.ts';
import {attachCustomerRef} from './public-id-store.ts';
/** App-owned customer verification inside the existing private Sites workspace. */
export type AuthMode='demo'|'telegram';
export type AuthConfig={mode:AuthMode;secret:string;gatewayToken?:string;allowDemo?:boolean};
type Result={meta:{changes:number}};
export interface AuthDB {prepare(sql:string):{bind(...args:unknown[]):{first<T=Record<string,unknown>>():Promise<T|null>;run():Promise<Result>}}}
export type AuthRuntime={db:AuthDB;config:AuthConfig;now?:()=>number;transport?:typeof fetch};
export class AuthError extends Error {status:number;retryAfter?:number;code:string;constructor(message:string,status=400,retryAfter?:number,code?:string){super(message);this.status=status;this.retryAfter=retryAfter;this.code=code||codeForError(message,status)}}
type Challenge={id:string;owner:string;phone_key:string;phone_mask:string;mode:AuthMode;code_hash:string|null;provider_request:string|null;browser_hash:string;expires_at:number;attempts:number;status:string;consumed:number;locked_until:number};
export type CustomerSession={customerId:string;phoneMasked:string;mode:AuthMode;expiresAt:number;phoneVerified?:boolean;verificationCompleted?:boolean;hasPassword?:boolean};
const encoder=new TextEncoder();
export const AUTH_TTL=300,SESSION_TTL=86400,RESEND_DELAY=60,MAX_ATTEMPTS=5;
const PASSWORD_VERSION='v2',PASSWORD_ITERATIONS=600000,LEGACY_PASSWORD_ITERATIONS=100000;
export const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),v=>v.toString(16).padStart(2,'0')).join('')}
export async function keyed(secret:string,value:string){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value))),v=>v.toString(16).padStart(2,'0')).join('')}
function equal(a:string,b:string){let mismatch=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)mismatch|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return mismatch===0}
export function normalizePhone(value:unknown,mode:AuthMode){
 if(typeof value!=='string'||value.length>32)throw new AuthError('请输入带国家区号的手机号');
 const phone=value.replace(/[\s()-]/g,'');
 if(!/^\+[1-9]\d{7,14}$/.test(phone))throw new AuthError('手机号须包含 + 和国家区号，例如 +855…');
 return phone;
}
const maskPhone=(phone:string)=>phone.slice(0,4)+' •••• '+phone.slice(-4);
function config(r:AuthRuntime,requireGateway=false){if(!['demo','telegram'].includes(r.config.mode)||r.config.secret.length<32)throw new AuthError('登录服务尚未配置，请联系管理员',503);if(r.config.mode==='demo'&&r.config.allowDemo!==true)throw new AuthError('生产环境禁止使用模拟认证模式，请配置 Telegram 验证',503,undefined,'AUTH_DEMO_FORBIDDEN');if(requireGateway&&r.config.mode==='telegram'&&!r.config.gatewayToken)throw new AuthError('Telegram Gateway 尚未配置，暂不能发送验证码',503);return r.config}
const now=(r:AuthRuntime)=>Math.floor((r.now?.()??Date.now())/1000);
const customerKey=(r:AuthRuntime,owner:string,phone:string)=>keyed(r.config.secret,'customer|'+r.config.mode+'|'+owner+'|'+phone);
const telegramCustomerKey=(r:AuthRuntime,owner:string,userId:number)=>keyed(r.config.secret,'telegram-customer|'+owner+'|'+userId);
async function limit(r:AuthRuntime,key:string,max:number,window:number,delay:number){const t=now(r);const row=await r.db.prepare(`INSERT INTO h5_limits (key,window_start,count,next_allowed) VALUES (?, ?, 1, ?)
 ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start+?<=? THEN 1 ELSE count+1 END,
 window_start=CASE WHEN window_start+?<=? THEN ? ELSE window_start END,next_allowed=?
 WHERE (window_start+?<=? OR count<?) AND next_allowed<=? RETURNING key`).bind(key,t,t+delay,window,t,window,t,t,t+delay,window,t,max,t).first();if(!row)throw new AuthError('请求过于频繁，请稍后再试',429,Math.max(delay,60))}
async function gateway(r:AuthRuntime,method:string,body:Record<string,unknown>){
 let response:Response;try{response=await (r.transport??fetch)('https://gatewayapi.telegram.org/'+method,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+r.config.gatewayToken},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)})}catch{throw new AuthError('Telegram 暂时未响应，请稍后重试；不会自动切换为模拟验证码',503)}
 let payload:any;try{payload=await response.json()}catch{throw new AuthError('验证码服务暂不可用，请稍后重试',503)}
 if(!response.ok||!payload?.ok||!payload.result){const code=payload?.error;if(code==='PHONE_NUMBER_INVALID'||code==='PHONE_NUMBER_NOT_FOUND')throw new AuthError('该号码暂不能接收 Telegram 验证码，请核对已注册 Telegram 的手机号');throw new AuthError('验证码服务暂不可用，请稍后重试或联系管理员',503)}
 return payload.result;
}
export async function sendCode(r:AuthRuntime,owner:string,browserToken:string,input:{phone?:unknown;consent?:unknown},purpose:'login'|'reset'='login'){
 const c=config(r,true);if(input.consent!==true)throw new AuthError('请先同意接收本次手机号验证码');const phone=normalizePhone(input.phone,c.mode);
 const phoneKey=await customerKey(r,owner,phone),browserHash=await digest(browserToken),t=now(r);
 await limit(r,'send-phone|'+phoneKey,5,3600,RESEND_DELAY);
 await limit(r,'send-browser|'+owner+'|'+browserHash,10,3600,0);
 await limit(r,'send-owner|'+owner,30,3600,0);
 await r.db.prepare('DELETE FROM h5_challenges WHERE owner=? AND expires_at<?').bind(owner,t-86400).run();
 await r.db.prepare('DELETE FROM h5_sessions WHERE owner=? AND expires_at<?').bind(owner,t).run();
 const id=randomToken(),code=c.mode==='demo'?'123456':null;
 const codeHash=code?await keyed(c.secret,id+'|'+code):null;
 await r.db.prepare('INSERT INTO h5_challenges (id,owner,phone_key,phone_mask,mode,code_hash,provider_request,browser_hash,created_at,expires_at,attempts,consumed,status,locked_until,purpose) VALUES (?,?,?,?,?,?,NULL,?,?,?,0,0,?,0,?)').bind(id,owner,phoneKey,maskPhone(phone),c.mode,codeHash,browserHash,t,t+AUTH_TTL,'sending',purpose).run();
 let provider:string|null=null;
 try{if(c.mode==='telegram'){const data=await gateway(r,'sendVerificationMessage',{phone_number:phone,code_length:6,ttl:AUTH_TTL});if(typeof data.request_id!=='string'||!data.request_id||data.phone_number!==phone)throw new AuthError('验证码服务响应无效，请稍后重试',503);provider=data.request_id}
  await r.db.prepare('UPDATE h5_challenges SET status=?,provider_request=? WHERE id=?').bind('ready',provider,id).run();
  await r.db.prepare('UPDATE h5_challenges SET consumed=1,status=? WHERE owner=? AND phone_key=? AND id<>? AND consumed=0').bind('replaced',owner,phoneKey,id).run();
 }catch(e){await r.db.prepare('UPDATE h5_challenges SET status=?,consumed=1 WHERE id=?').bind('failed',id).run();throw e}
 return {challengeId:id,phoneMasked:maskPhone(phone),expiresAt:(t+AUTH_TTL)*1000,retryAt:(t+RESEND_DELAY)*1000,mode:c.mode,...(code?{demoCode:code}:{}),message:c.mode==='demo'?'模拟验证码已生成，未向 Telegram 发送消息':'验证码请求已提交，请查看 Telegram 的 Verification Codes 会话'};
}
export async function pendingChallenge(r:AuthRuntime,owner:string,browserToken:string){config(r);const row=await r.db.prepare(`SELECT id,phone_mask,expires_at,created_at FROM h5_challenges WHERE owner=? AND browser_hash=? AND mode=? AND consumed=0 AND status=? AND purpose='login' AND expires_at>? ORDER BY created_at DESC LIMIT 1`).bind(owner,await digest(browserToken),r.config.mode,'ready',now(r)).first<{id:string;phone_mask:string;expires_at:number;created_at:number}>();return row?{challengeId:row.id,phoneMasked:row.phone_mask,expiresAt:row.expires_at*1000,retryAt:(row.created_at+RESEND_DELAY)*1000,mode:r.config.mode}:null}
async function consumeCode(r:AuthRuntime,owner:string,browserToken:string,input:{challengeId?:unknown;code?:unknown},expectedCustomerId?:string,purpose:'login'|'reset'='login'){
 config(r,true);if(typeof input.challengeId!=='string'||!/^[a-f0-9]{64}$/.test(input.challengeId)||typeof input.code!=='string'||!/^\d{6}$/.test(input.code))throw new AuthError('请输入 6 位数字验证码');
 const id=input.challengeId,t=now(r),browserHash=await digest(browserToken);
 await limit(r,'verify-browser|'+owner+'|'+browserHash,30,600,0);
 await r.db.prepare('UPDATE h5_challenges SET status=? WHERE id=? AND owner=? AND browser_hash=? AND status=? AND locked_until<? AND consumed=0').bind('ready',id,owner,browserHash,'verifying',t).run();
 const row=await r.db.prepare('UPDATE h5_challenges SET attempts=attempts+1,status=?,locked_until=? WHERE id=? AND owner=? AND browser_hash=? AND mode=? AND purpose=? AND status=? AND consumed=0 AND expires_at>? AND attempts<? RETURNING *').bind('verifying',t+20,id,owner,browserHash,r.config.mode,purpose,'ready',t,MAX_ATTEMPTS).first<Challenge>();
 if(!row)throw new AuthError('验证码已失效、正在核验或尝试次数已用完，请稍后重新获取',409);
 let valid=false;
 try{if(row.mode==='demo'){valid=equal(row.code_hash||'',await keyed(r.config.secret,id+'|'+input.code))}else{const data=await gateway(r,'checkVerificationStatus',{request_id:row.provider_request,code:input.code});if(data.request_id!==row.provider_request||typeof data.phone_number!=='string'||await customerKey(r,owner,data.phone_number)!==row.phone_key)throw new AuthError('验证码服务响应无效',503);valid=data.verification_status?.status==='code_valid'}
 }catch(e){await r.db.prepare('UPDATE h5_challenges SET status=? WHERE id=? AND attempts=? AND consumed=0').bind('ready',id,row.attempts).run();throw e}
 if(!valid){await r.db.prepare('UPDATE h5_challenges SET status=? WHERE id=? AND attempts=? AND consumed=0').bind('ready',id,row.attempts).run();throw new AuthError(row.attempts>=MAX_ATTEMPTS?'尝试次数已用完，请重新获取验证码':'验证码不正确，请重新输入',400)}
 const used=await r.db.prepare('UPDATE h5_challenges SET consumed=1,status=? WHERE id=? AND status=? AND attempts=? AND consumed=0 AND expires_at>?').bind('used',id,'verifying',row.attempts,now(r)).run();
 if(used.meta.changes!==1)throw new AuthError('验证码已失效，请重新获取',409);
 return row;
}
export async function verifyCode(r:AuthRuntime,owner:string,browserToken:string,input:{challengeId?:unknown;code?:unknown},expectedCustomerId?:string){
 const row=await consumeCode(r,owner,browserToken,input,expectedCustomerId),browserHash=await digest(browserToken);
 // Bind the Gateway-verified phone to the Telegram identity that opened this
 // Mini App. initData alone is not phone proof; only this step may set
 // phone_verified. A collision is rejected instead of silently merging KYC or
 // loan records belonging to two different accounts.
 const current=expectedCustomerId?await r.db.prepare('SELECT * FROM h5_accounts WHERE customer_id=? AND owner=?').bind(expectedCustomerId,owner).first<Account>():null;
 if(current?.phone_key&&current.phone_key!==row.phone_key)throw new AuthError('请验证当前账号注册时填写的手机号',409);
 const phoneAccount=await r.db.prepare('SELECT * FROM h5_accounts WHERE owner=? AND (phone_key=? OR customer_id=?)').bind(owner,row.phone_key,row.phone_key).first<Account>();
 if(current&&phoneAccount&&current.customer_id!==phoneAccount.customer_id)throw new AuthError('该手机号已绑定其他账号，请联系客服完成账号合并',409);
 const canonical=current||phoneAccount;
 const customerId=canonical?.customer_id||row.phone_key;
 const account=canonical;
 await r.db.prepare(`INSERT INTO h5_accounts (customer_id,owner,phone_key,telegram_user_hash,telegram_verified,phone_mask,mode,browser_hash,phone_verified,password_hash,created_at,verification_completed,channel_id)
 VALUES (?,?,?,?,0,?,?,?,?,NULL,?,1,?) ON CONFLICT(customer_id) DO UPDATE SET phone_key=excluded.phone_key,phone_mask=excluded.phone_mask,browser_hash=excluded.browser_hash,phone_verified=excluded.phone_verified,verification_completed=1,channel_id=COALESCE(h5_accounts.channel_id,excluded.channel_id),password_hash=h5_accounts.password_hash`).bind(customerId,owner,row.phone_key,current?.telegram_user_hash||null,row.phone_mask,row.mode,browserHash,row.mode==='telegram'?1:0,now(r),row.mode==='telegram'?(current?.channel_id||null):null).run();
 await attachCustomerRef(r.db,owner,customerId,row.mode,row.mode==='telegram'?(current?.channel_id||null):null,new Date().toISOString());
 if(!account?.verification_completed)await r.db.prepare('DELETE FROM h5_sessions WHERE owner=? AND customer_id=?').bind(owner,customerId).run();
 const generation=await r.db.prepare('SELECT credential_version FROM h5_accounts WHERE customer_id=? AND owner=?').bind(customerId,owner).first<{credential_version:number}>();
 const token=randomToken(),expiresAt=now(r)+SESSION_TTL;
 await r.db.prepare('INSERT INTO h5_sessions (token_hash,owner,customer_id,phone_mask,mode,expires_at,credential_version) VALUES (?,?,?,?,?,?,?)').bind(await digest(token),owner,customerId,row.phone_mask,row.mode,expiresAt,generation?.credential_version||0).run();
 return {token,session:{customerId,phoneMasked:row.phone_mask,mode:row.mode,expiresAt:expiresAt*1000,phoneVerified:row.mode==='telegram',verificationCompleted:true,hasPassword:!!(await r.db.prepare('SELECT password_hash FROM h5_accounts WHERE customer_id=? AND owner=?').bind(customerId,owner).first<{password_hash:string|null}>())?.password_hash} satisfies CustomerSession};
}
export async function getSession(r:AuthRuntime,owner:string,token:string|undefined):Promise<CustomerSession|null>{config(r);if(!token||!/^[a-f0-9]{64}$/.test(token))return null;const row=await r.db.prepare('SELECT s.customer_id,s.phone_mask,s.mode,s.expires_at,a.phone_verified,a.verification_completed,a.password_hash FROM h5_sessions s LEFT JOIN h5_accounts a ON a.customer_id=s.customer_id AND a.owner=s.owner WHERE s.token_hash=? AND s.owner=? AND s.mode=? AND s.expires_at>? AND s.credential_version=COALESCE(a.credential_version,0)').bind(await digest(token),owner,r.config.mode,now(r)).first<any>();return row?{customerId:row.customer_id,phoneMasked:row.phone_mask,mode:row.mode,expiresAt:row.expires_at*1000,phoneVerified:row.phone_verified==null?row.mode==='telegram':!!row.phone_verified,verificationCompleted:row.verification_completed==null?true:!!row.verification_completed,hasPassword:!!row.password_hash}:null}
export async function revokeSession(r:AuthRuntime,owner:string,token:string|undefined){if(token)await r.db.prepare('DELETE FROM h5_sessions WHERE token_hash=? AND owner=?').bind(await digest(token),owner).run()}

type Account={credential_version:number;customer_id:string;owner:string;phone_mask:string;mode:AuthMode;browser_hash:string|null;phone_verified:number;verification_completed:number;password_hash:string|null;phone_key?:string|null;telegram_user_hash?:string|null;telegram_verified?:number;channel_id?:string|null};
async function issueAccountSession(r:AuthRuntime,a:Account){const token=randomToken(),expires=now(r)+SESSION_TTL;await r.db.prepare('INSERT INTO h5_sessions (token_hash,owner,customer_id,phone_mask,mode,expires_at,credential_version) VALUES (?,?,?,?,?,?,?)').bind(await digest(token),a.owner,a.customer_id,a.phone_mask,a.mode,expires,a.credential_version).run();return {token,session:{customerId:a.customer_id,phoneMasked:a.phone_mask,mode:a.mode,expiresAt:expires*1000,phoneVerified:!!a.phone_verified,verificationCompleted:!!a.verification_completed,hasPassword:!!a.password_hash} satisfies CustomerSession}}
export async function registerPhone(r:AuthRuntime,owner:string,browserToken:string,input:{phone?:unknown},channelId?:string,allowPhoneOnly=false){
 config(r);const phone=normalizePhone(input.phone,'telegram'),id=await customerKey(r,owner,phone),browserHash=await digest(browserToken);
 if(r.config.mode==='telegram'&&allowPhoneOnly)throw new AuthError('Telegram 模式请先验证手机号，不能仅凭手机号注册',409);
 await limit(r,'register-browser|'+owner+'|'+browserHash,10,3600,1);await limit(r,'register-owner|'+owner,60,3600,0);
 // Preserve legacy accounts: entering a number never grants access to their stored records.
 await r.db.prepare(`INSERT OR IGNORE INTO h5_accounts (customer_id,owner,phone_key,phone_mask,mode,browser_hash,phone_verified,password_hash,created_at,channel_id)
 SELECT ?,?,?,?,?,?,0,NULL,?,? WHERE NOT EXISTS(SELECT 1 FROM h5_sessions WHERE owner=? AND customer_id=?) AND NOT EXISTS(SELECT 1 FROM kyc_cases WHERE owner=? AND customer_id=?) AND NOT EXISTS(SELECT 1 FROM team_assignments WHERE tenant_id=? AND customer_id=?) AND NOT EXISTS(SELECT 1 FROM demo_workspaces w,json_each(w.payload,'$.loans') l WHERE w.owner=? AND json_extract(l.value,'$.customerId')=?)`).bind(id,owner,id,maskPhone(phone),r.config.mode,browserHash,now(r),channelId||null,owner,id,owner,id,owner,id,owner,id).run();
 const a=await r.db.prepare('SELECT * FROM h5_accounts WHERE customer_id=? AND owner=?').bind(id,owner).first<Account>();
 if(!a)throw new AuthError('账号创建失败，请稍后重试',409);
 await attachCustomerRef(r.db,owner,id,a.mode,channelId||null,new Date().toISOString());
 if(a.browser_hash!==browserHash&&!allowPhoneOnly)throw new AuthError('请使用验证码或密码登录；无法仅凭手机号进入已有账号',409);
 return issueAccountSession(r,a);
}
export async function loginTelegram(r:AuthRuntime,owner:string,browserToken:string,initData:string,botToken:string,channelId?:string){
 config(r);
 if(r.config.mode!=='telegram')throw new AuthError('当前渠道未启用 Telegram 登录',409);
 if(!botToken)throw new AuthError('Telegram Bot 登录尚未配置，请联系管理员',503);
 let identity:{id:number;firstName:string};
 try{identity=await validateInitData(initData,botToken)}catch(e){throw new AuthError(e instanceof Error?e.message:'Telegram 身份校验失败',401)}
 const customerId=await telegramCustomerKey(r,owner,identity.id),browserHash=await digest(browserToken),nowValue=now(r);
 await r.db.prepare('DELETE FROM telegram_initdata_nonces WHERE auth_date<?').bind(nowValue-600).run();
 const nonce=await digest(canonicalInitData(initData)),claimed=await r.db.prepare('INSERT OR IGNORE INTO telegram_initdata_nonces (initdata_hash,owner,channel_id,auth_date,consumed_at) VALUES (?,?,?,?,?)').bind(nonce,owner,channelId||null,nowValue,nowValue).run();
 if(claimed.meta.changes!==1)throw new AuthError('Telegram 登录凭证已使用，请重新打开 Mini App',409,undefined,'TELEGRAM_INITDATA_REPLAY');
 await limit(r,'telegram-login|'+owner+'|'+identity.id,30,3600,0);
 await r.db.prepare(`INSERT OR IGNORE INTO h5_accounts (customer_id,owner,telegram_user_hash,telegram_verified,phone_mask,mode,browser_hash,phone_verified,password_hash,created_at,verification_completed,channel_id) VALUES (?,?,?,1,?,?,?,0,NULL,?,0,?)`).bind(customerId,owner,customerId,'Telegram · '+identity.firstName,r.config.mode,browserHash,nowValue,channelId||null).run();
 await r.db.prepare('UPDATE h5_accounts SET browser_hash=?,telegram_user_hash=?,telegram_verified=1,channel_id=COALESCE(channel_id,?),verification_completed=CASE WHEN phone_verified=1 THEN verification_completed ELSE 0 END WHERE customer_id=? AND owner=?').bind(browserHash,customerId,channelId||null,customerId,owner).run();
 const account=await r.db.prepare('SELECT * FROM h5_accounts WHERE customer_id=? AND owner=?').bind(customerId,owner).first<Account>();
 if(!account)throw new AuthError('Telegram 账号创建失败，请稍后重试',409);
 await attachCustomerRef(r.db,owner,customerId,account.mode,account.channel_id||channelId||null,new Date().toISOString());
 return issueAccountSession(r,account);
}
async function passwordHash(password:string,salt:string,iterations=PASSWORD_ITERATIONS){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);return Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations,hash:'SHA-256'},key,256)),x=>x.toString(16).padStart(2,'0')).join('')}
function passwordParts(stored:string|null){const parts=(stored||'').split(':');if(parts.length===4&&parts[0]===PASSWORD_VERSION){const iterations=Number(parts[1]);return Number.isSafeInteger(iterations)&&iterations>=100000&&iterations<=2000000?{version:parts[0],iterations,salt:parts[2],hash:parts[3]}:null}if(parts.length===2)return {version:'legacy',iterations:LEGACY_PASSWORD_ITERATIONS,salt:parts[0],hash:parts[1]};return null}
async function passwordMatches(password:unknown,stored:string|null){const valid=typeof password==='string'&&password.length<=128,parts=passwordParts(stored);const candidate=await passwordHash(valid?password:'',parts?.salt||'0'.repeat(64),parts?.iterations||LEGACY_PASSWORD_ITERATIONS);return valid&&!!parts&&equal(candidate,parts.hash)}
export async function loginPassword(r:AuthRuntime,owner:string,browserToken:string,input:{phone?:unknown;password?:unknown}){
 config(r);const phone=normalizePhone(input.phone,'telegram'),id=await customerKey(r,owner,phone),bh=await digest(browserToken);
 await limit(r,'password-phone|'+id,5,900,0);await limit(r,'password-browser|'+owner+'|'+bh,10,900,0);await limit(r,'password-owner|'+owner,60,900,0);
 const a=await r.db.prepare('SELECT * FROM h5_accounts WHERE customer_id=? AND owner=?').bind(id,owner).first<Account>();
 if(!await passwordMatches(input.password,a?.password_hash||null))throw new AuthError('手机号或密码不正确，请重试或使用验证码',401);
 const parts=passwordParts(a?.password_hash||null);if(a&&parts?.version==='legacy'&&typeof input.password==='string'){const salt=randomToken(),upgraded=`${PASSWORD_VERSION}:${PASSWORD_ITERATIONS}:${salt}:${await passwordHash(input.password,salt)}`;await r.db.prepare('UPDATE h5_accounts SET password_hash=? WHERE customer_id=? AND owner=? AND password_hash=?').bind(upgraded,a.customer_id,owner,a.password_hash).run()}
 // Password login grants a session, never a phone-only recovery capability.
 return issueAccountSession(r,a!);
}
export async function setPassword(r:AuthRuntime,owner:string,token:string|undefined,input:{password?:unknown;currentPassword?:unknown}){
 const session=await getSession(r,owner,token);if(!session)throw new AuthError('请先登录账号',401);
 await limit(r,'set-password|'+owner+'|'+session.customerId,5,900,0);
 if(typeof input.password!=='string'||input.password.length<12||input.password.length>128)throw new AuthError('密码需为 12–128 个字符');
 const a=await r.db.prepare('SELECT * FROM h5_accounts WHERE customer_id=? AND owner=?').bind(session.customerId,owner).first<Account>();
 if(!a)throw new AuthError('请先通过验证码登录，再设置密码',409);
 if(a.password_hash&&!await passwordMatches(input.currentPassword,a.password_hash))throw new AuthError('当前密码不正确',401);
 const salt=randomToken(),hash=`${PASSWORD_VERSION}:${PASSWORD_ITERATIONS}:${salt}:${await passwordHash(input.password,salt)}`;
 const changed=await r.db.prepare('UPDATE h5_accounts SET password_hash=? WHERE customer_id=? AND owner=? AND password_hash IS ? AND EXISTS(SELECT 1 FROM h5_sessions WHERE token_hash=? AND owner=? AND expires_at>?)').bind(hash,a.customer_id,owner,a.password_hash,await digest(token!),owner,now(r)).run();
 if(!changed.meta.changes)throw new AuthError('账号状态已变化，请重新登录',409);
 await r.db.prepare('DELETE FROM h5_sessions WHERE owner=? AND customer_id=? AND token_hash<>?').bind(owner,a.customer_id,await digest(token!)).run();
 return {ok:true};
}
export async function forgetBrowser(r:AuthRuntime,owner:string,browserToken:string){await r.db.prepare('UPDATE h5_accounts SET browser_hash=NULL WHERE owner=? AND browser_hash=?').bind(owner,await digest(browserToken)).run()}

export async function resetPassword(r:AuthRuntime,owner:string,browserToken:string,input:{challengeId?:unknown;code?:unknown;password?:unknown;confirmPassword?:unknown}){
 config(r,true);
 if(typeof input.password!=='string'||input.password.length<12||input.password.length>128)throw new AuthError('新密码需为 12–128 个字符');
 if(input.password!==input.confirmPassword)throw new AuthError('两次输入的新密码不一致');
 await limit(r,'reset-browser|'+owner+'|'+await digest(browserToken),10,900,0);
 // Verification grants only this one reset operation, never a general customer session.
 const row=await consumeCode(r,owner,browserToken,input,undefined,'reset');
 const account=await r.db.prepare('SELECT credential_version FROM h5_accounts WHERE customer_id=? AND owner=?').bind(row.phone_key,owner).first<{credential_version:number}>();if(!account)throw new AuthError('当前公司下未找到此手机号账号，请返回注册',404);
 const salt=randomToken(),hash=`${PASSWORD_VERSION}:${PASSWORD_ITERATIONS}:${salt}:${await passwordHash(input.password,salt)}`;
 const changed=await r.db.prepare('UPDATE h5_accounts SET password_hash=?,credential_version=credential_version+1,browser_hash=NULL,verification_completed=1,phone_verified=? WHERE customer_id=? AND owner=? AND mode=? AND credential_version=?').bind(hash,row.mode==='telegram'?1:0,row.phone_key,owner,row.mode,account.credential_version).run();
 if(!changed.meta.changes)throw new AuthError('账号已被更新，请重新获取验证码',409);
 return {ok:true,message:'密码已重置，旧登录会话已失效，请使用新密码登录'};
}
