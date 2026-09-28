import {requireRegistrationComplete} from '@/lib/registration-policy';
import {selectedCompany} from '@/lib/team/server';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {AuthError,getSession,type AuthMode,type AuthRuntime} from './h5-auth-core';
export const SESSION_COOKIE='payease_h5_session',BROWSER_COOKIE='payease_h5_browser';
export function runtime():AuthRuntime{if(!env.DB)throw new AuthError('登录数据库暂不可用',503);const values=env as unknown as Record<string,string>;return {db:env.DB,config:{mode:(values.PAYEASE_AUTH_MODE||'disabled') as AuthMode,secret:values.PAYEASE_AUTH_SECRET||'',gatewayToken:values.TELEGRAM_GATEWAY_TOKEN}}}
export function cookieValue(request:Request,name:string){const value=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);return value&&/^[a-f0-9]{64}$/.test(value)?value:undefined}
export function cookie(request:Request,name:string,value:string,age:number){return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol==='https:'?'; Secure':''}`}
export function json(data:unknown,status=200,extra:Record<string,string>={}){return Response.json(data,{status,headers:{'Cache-Control':'no-store','Pragma':'no-cache',...extra}})}
export function failure(e:unknown){return e instanceof AuthError?json({error:e.message,...(e.retryAfter?{retryAfter:e.retryAfter}:{})},e.status,e.retryAfter?{'Retry-After':String(e.retryAfter)}:{}):json({error:'登录服务暂不可用，请稍后重试'},503)}
export async function owner(){const user=await getChatGPTUser();if(!user)throw new AuthError('请先进入有权访问的私有测试工作区',401);const company=await selectedCompany();return company?.id||user.userId}
export function sameOrigin(request:Request){if(request.headers.get('origin')!==new URL(request.url).origin)throw new AuthError('不允许跨站操作',403);if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AuthError('请求格式无效',415)}
export async function input(request:Request){sameOrigin(request);const raw=await request.text();if(raw.length>4096)throw new AuthError('请求过大',413);try{const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value}catch{throw new AuthError('请求格式无效')}}
export function browser(request:Request){const token=cookieValue(request,BROWSER_COOKIE);if(!token)throw new AuthError('登录页面已失效，请刷新后重试',401);return token}
export async function customer(request:Request){const ownerId=await owner(),r=runtime(),session=await getSession(r,ownerId,cookieValue(request,SESSION_COOKIE));if(!session)throw new AuthError('客户登录已失效，请重新验证手机号',401);await requireRegistrationComplete(r,ownerId,session);return {ownerId,r,session}}
