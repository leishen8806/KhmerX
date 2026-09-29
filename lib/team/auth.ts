import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {AuthError,randomToken,digest} from '@/lib/h5-auth-core';
export const STAFF_SESSION='payease_staff_session',STAFF_MODE='payease_staff_mode',STAFF_COMPANY='payease_staff_company';
const db=()=>{if(!env.DB)throw new AuthError('员工登录服务暂不可用',503);return env.DB};
export function value(raw:string|null,name:string){return raw?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)}
export async function makePassword(password:string,salt=randomToken()){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},k,256);return salt+':'+Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join('')}
function equal(a:string,b:string){let d=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)d|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return d===0}
export async function staffIdentity(){
 const outer=await getChatGPTUser();if(!outer)throw new AuthError('请先登录私有测试站点',401);
 const raw=(await headers()).get('cookie'),mode=value(raw,STAFF_MODE),token=value(raw,STAFF_SESSION);
 if(mode==='out')throw new AuthError('员工已退出，请重新登录',401);
 if(mode==='password'||token){
  if(!token||!/^[a-f0-9]{64}$/.test(token))throw new AuthError('员工登录已失效，请重新登录',401);
  const m=await db().prepare(`SELECT m.user_id,m.email,m.tenant_id FROM team_staff_sessions s JOIN team_members m ON m.id=s.member_id JOIN team_companies c ON c.id=m.tenant_id JOIN team_staff_credentials p ON p.member_id=m.id WHERE s.token_hash=? AND s.site_user_id=? AND s.expires_at>? AND m.active=1 AND c.active=1 AND m.version=s.member_version AND p.version=s.credential_version`).bind(await digest(token),outer.userId,Date.now()).first<any>();
  if(!m)throw new AuthError('员工登录已失效，请重新登录',401);
  return {userId:m.user_id,email:m.email,displayName:m.email,fullName:null,staffTenantId:m.tenant_id as string};
 }
 return {...outer,staffTenantId:null};
}
export async function passwordLogin(p:any,siteUserId:string){
 const slug=typeof p.company==='string'?p.company.trim().toLowerCase():'',email=typeof p.email==='string'?p.email.trim().toLowerCase():'',password=typeof p.password==='string'?p.password:'';
 if(!/^[a-z0-9][a-z0-9-]{2,39}$/.test(slug)||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||password.length>128)throw new AuthError('请填写公司代码、邮箱和密码');
 const now=Date.now(),window=Math.floor(now/900000);
 for(const key of ['account:'+slug+':'+email,'visitor:'+siteUserId]){
  const k=await digest(key),limit=key.startsWith('account:')?5:30;
  const row=await db().prepare(`INSERT INTO team_staff_limits (key,window,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count`).bind(k,window).first<any>();
  if(row.count>limit)throw new AuthError('登录尝试过多，请 15 分钟后重试',429);
 }
 const m=await db().prepare(`SELECT m.id,m.tenant_id,m.version,m.email,p.password_hash,p.version AS credential_version FROM team_members m JOIN team_companies c ON c.id=m.tenant_id JOIN team_staff_credentials p ON p.member_id=m.id WHERE c.slug=? AND lower(m.email)=? AND c.active=1 AND m.active=1`).bind(slug,email).first<any>();
 const stored=m?.password_hash||('0'.repeat(64)+':'+ '0'.repeat(64));const candidate=await makePassword(password,stored.split(':')[0]);
 if(!m||!equal(candidate,stored))throw new AuthError('公司、账号或密码不正确',401);
 const token=randomToken(),hash=await digest(token);
 const result=await db().batch([
  db().prepare(`INSERT INTO team_staff_sessions (token_hash,member_id,site_user_id,member_version,credential_version,expires_at) SELECT ?,id,?,?,?,? FROM team_members WHERE id=? AND version=? AND active=1 AND EXISTS(SELECT 1 FROM team_staff_credentials WHERE member_id=? AND version=?) AND EXISTS(SELECT 1 FROM team_companies WHERE id=? AND active=1)`).bind(hash,siteUserId,m.version,m.credential_version,now+8*3600000,m.id,m.version,m.id,m.credential_version,m.tenant_id),
  db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),m.tenant_id,m.email,'staff_login',JSON.stringify({member:m.id}),new Date().toISOString())
 ]);
 if(!result[0].meta.changes)throw new AuthError('账号权限已变化，请重试',409);
 return {token,companyId:m.tenant_id};
}
export async function logoutStaff(raw:string|null){
 const token=value(raw,STAFF_SESSION);if(!token||!/^[a-f0-9]{64}$/.test(token))return;
 const hash=await digest(token);const row=await db().prepare('SELECT m.tenant_id,m.email,m.id FROM team_staff_sessions s JOIN team_members m ON m.id=s.member_id WHERE s.token_hash=?').bind(hash).first<any>();
 await db().batch([db().prepare('DELETE FROM team_staff_sessions WHERE token_hash=?').bind(hash),...(row?[db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),row.tenant_id,row.email,'staff_logout',JSON.stringify({member:row.id}),new Date().toISOString())]:[])]);
}
