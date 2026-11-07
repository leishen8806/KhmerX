import {env} from 'cloudflare:workers';
import {AuthError,type AuthRuntime} from '@/lib/h5-auth-core';
import {h5ChannelErrorCode,h5ChannelStatus,type ConfiguredChannel,type H5ChannelStatus} from '@/lib/h5-channel-status';

export type PublicChannelType='h5'|'app'|'telegram_miniapp';

function storedChannelType(type:PublicChannelType){return type==='telegram_miniapp'?'telegram_miniapp':type}

async function configuredChannel(r:AuthRuntime,owner:string|undefined,type:PublicChannelType):Promise<ConfiguredChannel|undefined>{
 if(!owner)return undefined;
 try{
  const row=await r.db.prepare('SELECT enabled,package_id FROM company_channels WHERE tenant_id=? AND type=? LIMIT 1').bind(owner,storedChannelType(type)).first<{enabled:unknown;package_id?:unknown}>();
  if(!row){console.warn('[h5-channel] company_channels row missing; using legacy state',type);return {exists:false};}
  return {exists:true,enabled:row.enabled,appKey:row.package_id};
 }catch(error){console.warn('[h5-channel] company_channels lookup unavailable; using legacy state',type,error instanceof Error?error.message:'unknown error');return {exists:false};}
}

export function constantTimeEqual(left:string,right:string):boolean{
 const a=new TextEncoder().encode(left),b=new TextEncoder().encode(right);let diff=a.length^b.length;
 for(let index=0;index<Math.max(a.length,b.length);index++)diff|=(a[index%Math.max(a.length,1)]??0)^(b[index%Math.max(b.length,1)]??0);
 return diff===0;
}

export function channelType(request:Request):'h5'|'app'{return request.headers.get('x-payease-client')?.trim().toLowerCase()==='app'?'app':'h5'}

export function appRequestHasValidKey(request:Request,configuredKey:unknown):boolean{
 if(channelType(request)!=='app')return false;
 const supplied=request.headers.get('x-payease-app-key')?.trim()||'';
 return Boolean(supplied&&configuredKey)&&constantTimeEqual(supplied,String(configuredKey));
}

export async function requestChannelType(r:AuthRuntime,request:Request,owner?:string):Promise<'h5'|'app'>{
 if(!owner)return 'h5';
 const configured=await configuredChannel(r,owner,'app');
 return configured?.exists&&appRequestHasValidKey(request,configured.appKey)?'app':'h5';
}

export async function channelStatus(r:AuthRuntime,owner?:string,channelType:PublicChannelType='h5',channelId?:unknown):Promise<H5ChannelStatus>{
 const values=env as unknown as Record<string,unknown>;
 const override=values.PAYEASE_H5_CHANNEL_STATUS;
 const emergency=String(override??'').trim().toLowerCase();
 if(emergency==='maintenance'||emergency==='maint'||emergency==='disabled'||emergency==='off')return h5ChannelStatus(r.config,channelId,override);
 return h5ChannelStatus(r.config,channelId,override,await configuredChannel(r,owner,channelType));
}

export async function requireH5ChannelAvailable(r:AuthRuntime,owner?:string,channelType:PublicChannelType='h5',channelId?:unknown):Promise<void>{
 const status=await channelStatus(r,owner,channelType,channelId),code=h5ChannelErrorCode(status);
 if(code)throw new AuthError(status==='maintenance'?'当前渠道正在维护':'当前渠道已停用',status==='maintenance'?503:403,undefined,code);
}
