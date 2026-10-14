import {requireRegistrationComplete} from '@/lib/registration-policy';
import {customerCompany} from '@/lib/team/server';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {AuthError,getSession,digest,randomToken,type AuthMode,type AuthRuntime} from './h5-auth-core';
import {addErrorCode} from './error-codes.ts';
import {assertAllowedOrigin} from './request-security';
export const SESSION_COOKIE='payease_h5_session',BROWSER_COOKIE='payease_h5_browser';
export function runtime():AuthRuntime{if(!env.DB)throw new AuthError('登录数据库暂不可用',503);const values=env as unknown as Record<string,string>;return {db:env.DB,config:{mode:(values.PAYEASE_AUTH_MODE||'disabled') as AuthMode,secret:values.PAYEASE_AUTH_SECRET||'',gatewayToken:values.TELEGRAM_GATEWAY_TOKEN,allowDemo:values.KHMERX_TEST_MODE==='true'}}}
export function telegramBotToken(channelId='bot-1'){const values=env as unknown as Record<string,string>;const suffix=channelId.match(/^bot-(\d+)$/)?.[1]||'1';const specific=values['TELEGRAM_BOT_TOKEN_'+suffix];return specific||(suffix==='1'?values.TELEGRAM_BOT_TOKEN||'':'')}
export function cookieValue(request:Request,name:string){const value=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);return value&&/^[a-f0-9]{64}$/.test(value)?value:undefined}
export function cookie(request:Request,name:string,value:string,age:number){return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol==='https:'?'; Secure':''}`}
export function json(data:unknown,status=200,extra:Record<string,string|string[]>={}){
 const normalized=addErrorCode(data,status);
 const isError=status>=400&&!!normalized&&typeof normalized==='object'&&!Array.isArray(normalized)&&typeof (normalized as Record<string,unknown>).error==='string';
 const existing=isError&&typeof (normalized as Record<string,unknown>).requestId==='string'?(normalized as Record<string,unknown>).requestId as string:undefined;
 const requestId=isError?(existing||crypto.randomUUID()):undefined;
 const body=isError&&requestId&&!existing?{...(normalized as Record<string,unknown>),requestId}:normalized;
 const headers=new Headers({'Cache-Control':'no-store','Pragma':'no-cache',...(requestId?{'X-Request-Id':requestId}:{})});
 for(const [key,value] of Object.entries(extra)){if(Array.isArray(value)){for(const item of value)headers.append(key,item)}else headers.set(key,value)}
 return Response.json(body,{status,headers})
}
export function failure(e:unknown){const requestId=crypto.randomUUID();const extra={'X-Request-Id':requestId,...(e instanceof AuthError&&e.retryAfter?{'Retry-After':String(e.retryAfter)}:{})};return e instanceof AuthError?json({error:e.message,code:e.code,requestId,...(e.retryAfter?{retryAfter:e.retryAfter}:{})},e.status,extra):json({error:'登录服务暂不可用，请稍后重试',code:'SERVICE_UNAVAILABLE',requestId},503,extra)}
export async function owner(){const user=await getChatGPTUser();if(!user)throw new AuthError('请先进入有权访问的私有测试工作区',401);const company=await customerCompany();return company?.id||user.userId}
export function sameOrigin(request:Request){try{assertAllowedOrigin(request,true)}catch{throw new AuthError('不允许跨站操作',403,undefined,'CROSS_SITE_REQUEST')}if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AuthError('请求格式无效',415)}
export async function input(request:Request){sameOrigin(request);const raw=await request.text();if(raw.length>4096)throw new AuthError('请求过大',413);try{const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value}catch{throw new AuthError('请求格式无效')}}
export async function browser(request:Request){const token=cookieValue(request,BROWSER_COOKIE);if(!token)throw new AuthError('登录页面已失效，请刷新后重试',401);if((env as any).KHMERX_TEST_MODE==='true')return token;if(!env.DB)throw new AuthError('登录数据库暂不可用',503);const row=await env.DB.prepare('SELECT token_hash FROM h5_browser_tokens WHERE token_hash=? AND expires_at>?').bind(await digest(token),Math.floor(Date.now()/1000)).first();if(!row)throw new AuthError('登录页面已失效，请刷新后重试',401);return token}
export async function issueBrowserToken(request?:Request){const token=randomToken(),now=Math.floor(Date.now()/1000);if(!env.DB)throw new AuthError('登录数据库暂不可用',503);await env.DB.prepare('DELETE FROM h5_browser_tokens WHERE expires_at<?').bind(now).run();
 // Rate-limit the trusted edge address, not the whole tenant. Cloudflare
 // supplies CF-Connecting-IP and strips client-controlled forwarding headers.
 const source=request?.headers.get('CF-Connecting-IP')||request?.headers.get('True-Client-IP')||'unknown';
 const sourceHash=await digest(source.trim().slice(0,128)||'unknown');
 const recent=await env.DB.prepare('SELECT COUNT(*) AS n FROM h5_browser_tokens WHERE source_hash=? AND created_at>?').bind(sourceHash,now-3600).first<{n:number}>();
 if(Number(recent?.n||0)>=100)throw new AuthError('登录请求过于频繁，请稍后重试',429,60,'BROWSER_TOKEN_RATE_LIMITED');
 await env.DB.prepare('INSERT INTO h5_browser_tokens (token_hash,source_hash,created_at,expires_at) VALUES (?,?,?,?)').bind(await digest(token),sourceHash,now,now+86400).run();return token}
export async function customer(request:Request){const ownerId=await owner(),r=runtime(),session=await getSession(r,ownerId,cookieValue(request,SESSION_COOKIE));if(!session)throw new AuthError('客户登录已失效，请重新验证手机号',401);await requireRegistrationComplete(r,ownerId,session);return {ownerId,r,session}}
