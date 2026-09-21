/** App-owned customer verification inside the existing private Sites workspace. */
export type AuthMode='demo'|'telegram';
export type AuthConfig={mode:AuthMode;secret:string;gatewayToken?:string};
type Result={meta:{changes:number}};
export interface AuthDB {prepare(sql:string):{bind(...args:unknown[]):{first<T=Record<string,unknown>>():Promise<T|null>;run():Promise<Result>}}}
export type AuthRuntime={db:AuthDB;config:AuthConfig;now?:()=>number;transport?:typeof fetch};
export class AuthError extends Error {status:number;retryAfter?:number;constructor(message:string,status=400,retryAfter?:number){super(message);this.status=status;this.retryAfter=retryAfter}}
type Challenge={id:string;owner:string;phone_key:string;phone_mask:string;mode:AuthMode;code_hash:string|null;provider_request:string|null;browser_hash:string;expires_at:number;attempts:number;status:string;consumed:number;locked_until:number};
export type CustomerSession={customerId:string;phoneMasked:string;mode:AuthMode;expiresAt:number};
const encoder=new TextEncoder();
export const AUTH_TTL=300,SESSION_TTL=86400,RESEND_DELAY=60,MAX_ATTEMPTS=5;
export const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),v=>v.toString(16).padStart(2,'0')).join('')}
export async function keyed(secret:string,value:string){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value))),v=>v.toString(16).padStart(2,'0')).join('')}
function equal(a:string,b:string){let mismatch=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)mismatch|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return mismatch===0}
export function normalizePhone(value:unknown,mode:AuthMode){
 if(typeof value!=='string'||value.length>32)throw new AuthError('请输入带国家区号的手机号');
 const phone=value.replace(/[\s()-]/g,'');
 if(!/^\+[1-9]\d{7,14}$/.test(phone))throw new AuthError('手机号须包含 + 和国家区号，例如 +855…');
 if(mode==='demo'&&!/^\+120255501\d{2}$/.test(phone))throw new AuthError('测试模式仅接受 +12025550100 至 +12025550199 的预留号码');
 return phone;
}
const maskPhone=(phone:string)=>phone.slice(0,4)+' •••• '+phone.slice(-4);
function config(r:AuthRuntime){if(!['demo','telegram'].includes(r.config.mode)||r.config.secret.length<32)throw new AuthError('登录服务尚未配置，请联系管理员',503);if(r.config.mode==='telegram'&&!r.config.gatewayToken)throw new AuthError('Telegram Gateway 尚未配置，暂不能发送验证码',503);return r.config}
const now=(r:AuthRuntime)=>Math.floor((r.now?.()??Date.now())/1000);
const customerKey=(r:AuthRuntime,owner:string,phone:string)=>keyed(r.config.secret,'customer|'+r.config.mode+'|'+owner+'|'+phone);
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
export async function sendCode(r:AuthRuntime,owner:string,browserToken:string,input:{phone?:unknown;consent?:unknown}){
 const c=config(r);if(input.consent!==true)throw new AuthError('请先同意接收本次登录验证码');const phone=normalizePhone(input.phone,c.mode);
 const phoneKey=await customerKey(r,owner,phone),browserHash=await digest(browserToken),t=now(r);
 await limit(r,'send-phone|'+phoneKey,5,3600,RESEND_DELAY);
 await limit(r,'send-browser|'+owner+'|'+browserHash,10,3600,0);
 await limit(r,'send-owner|'+owner,30,3600,0);
 await r.db.prepare('DELETE FROM h5_challenges WHERE owner=? AND expires_at<?').bind(owner,t-86400).run();
 await r.db.prepare('DELETE FROM h5_sessions WHERE owner=? AND expires_at<?').bind(owner,t).run();
 const id=randomToken(),code=c.mode==='demo'?String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0'):null;
 const codeHash=code?await keyed(c.secret,id+'|'+code):null;
 await r.db.prepare('INSERT INTO h5_challenges (id,owner,phone_key,phone_mask,mode,code_hash,provider_request,browser_hash,created_at,expires_at,attempts,consumed,status,locked_until) VALUES (?,?,?,?,?,?,NULL,?,?,?,0,0,?,0)').bind(id,owner,phoneKey,maskPhone(phone),c.mode,codeHash,browserHash,t,t+AUTH_TTL,'sending').run();
 let provider:string|null=null;
 try{if(c.mode==='telegram'){const data=await gateway(r,'sendVerificationMessage',{phone_number:phone,code_length:6,ttl:AUTH_TTL});if(typeof data.request_id!=='string'||!data.request_id||data.phone_number!==phone)throw new AuthError('验证码服务响应无效，请稍后重试',503);provider=data.request_id}
  await r.db.prepare('UPDATE h5_challenges SET status=?,provider_request=? WHERE id=?').bind('ready',provider,id).run();
  await r.db.prepare('UPDATE h5_challenges SET consumed=1,status=? WHERE owner=? AND phone_key=? AND id<>? AND consumed=0').bind('replaced',owner,phoneKey,id).run();
 }catch(e){await r.db.prepare('UPDATE h5_challenges SET status=?,consumed=1 WHERE id=?').bind('failed',id).run();throw e}
 return {challengeId:id,phoneMasked:maskPhone(phone),expiresAt:(t+AUTH_TTL)*1000,retryAt:(t+RESEND_DELAY)*1000,mode:c.mode,...(code?{demoCode:code}:{}),message:c.mode==='demo'?'模拟验证码已生成，未向 Telegram 发送消息':'验证码请求已提交，请查看 Telegram 的 Verification Codes 会话'};
}
export async function pendingChallenge(r:AuthRuntime,owner:string,browserToken:string){config(r);const row=await r.db.prepare('SELECT id,phone_mask,expires_at,created_at FROM h5_challenges WHERE owner=? AND browser_hash=? AND mode=? AND consumed=0 AND status=? AND expires_at>? ORDER BY created_at DESC LIMIT 1').bind(owner,await digest(browserToken),r.config.mode,'ready',now(r)).first<{id:string;phone_mask:string;expires_at:number;created_at:number}>();return row?{challengeId:row.id,phoneMasked:row.phone_mask,expiresAt:row.expires_at*1000,retryAt:(row.created_at+RESEND_DELAY)*1000,mode:r.config.mode}:null}
export async function verifyCode(r:AuthRuntime,owner:string,browserToken:string,input:{challengeId?:unknown;code?:unknown}){
 config(r);if(typeof input.challengeId!=='string'||!/^[a-f0-9]{64}$/.test(input.challengeId)||typeof input.code!=='string'||!/^\d{6}$/.test(input.code))throw new AuthError('请输入 6 位数字验证码');
 const id=input.challengeId,t=now(r),browserHash=await digest(browserToken);
 await limit(r,'verify-browser|'+owner+'|'+browserHash,30,600,0);
 await r.db.prepare('UPDATE h5_challenges SET status=? WHERE id=? AND owner=? AND browser_hash=? AND status=? AND locked_until<? AND consumed=0').bind('ready',id,owner,browserHash,'verifying',t).run();
 const row=await r.db.prepare('UPDATE h5_challenges SET attempts=attempts+1,status=?,locked_until=? WHERE id=? AND owner=? AND browser_hash=? AND mode=? AND status=? AND consumed=0 AND expires_at>? AND attempts<? RETURNING *').bind('verifying',t+20,id,owner,browserHash,r.config.mode,'ready',t,MAX_ATTEMPTS).first<Challenge>();
 if(!row)throw new AuthError('验证码已失效、正在核验或尝试次数已用完，请稍后重新获取',409);
 let valid=false;
 try{if(row.mode==='demo'){valid=equal(row.code_hash||'',await keyed(r.config.secret,id+'|'+input.code))}else{const data=await gateway(r,'checkVerificationStatus',{request_id:row.provider_request,code:input.code});if(data.request_id!==row.provider_request||typeof data.phone_number!=='string'||await customerKey(r,owner,data.phone_number)!==row.phone_key)throw new AuthError('验证码服务响应无效',503);valid=data.verification_status?.status==='code_valid'}
 }catch(e){await r.db.prepare('UPDATE h5_challenges SET status=? WHERE id=? AND attempts=? AND consumed=0').bind('ready',id,row.attempts).run();throw e}
 if(!valid){await r.db.prepare('UPDATE h5_challenges SET status=? WHERE id=? AND attempts=? AND consumed=0').bind('ready',id,row.attempts).run();throw new AuthError(row.attempts>=MAX_ATTEMPTS?'尝试次数已用完，请重新获取验证码':'验证码不正确，请重新输入',400)}
 const used=await r.db.prepare('UPDATE h5_challenges SET consumed=1,status=? WHERE id=? AND status=? AND attempts=? AND consumed=0 AND expires_at>?').bind('used',id,'verifying',row.attempts,now(r)).run();
 if(used.meta.changes!==1)throw new AuthError('验证码已失效，请重新获取',409);
 const token=randomToken(),expiresAt=now(r)+SESSION_TTL;
 await r.db.prepare('INSERT INTO h5_sessions (token_hash,owner,customer_id,phone_mask,mode,expires_at) VALUES (?,?,?,?,?,?)').bind(await digest(token),owner,row.phone_key,row.phone_mask,row.mode,expiresAt).run();
 return {token,session:{customerId:row.phone_key,phoneMasked:row.phone_mask,mode:row.mode,expiresAt:expiresAt*1000} satisfies CustomerSession};
}
export async function getSession(r:AuthRuntime,owner:string,token:string|undefined):Promise<CustomerSession|null>{config(r);if(!token||!/^[a-f0-9]{64}$/.test(token))return null;const row=await r.db.prepare('SELECT customer_id,phone_mask,mode,expires_at FROM h5_sessions WHERE token_hash=? AND owner=? AND mode=? AND expires_at>?').bind(await digest(token),owner,r.config.mode,now(r)).first<{customer_id:string;phone_mask:string;mode:AuthMode;expires_at:number}>();return row?{customerId:row.customer_id,phoneMasked:row.phone_mask,mode:row.mode,expiresAt:row.expires_at*1000}:null}
export async function revokeSession(r:AuthRuntime,owner:string,token:string|undefined){if(token)await r.db.prepare('DELETE FROM h5_sessions WHERE token_hash=? AND owner=?').bind(await digest(token),owner).run()}
