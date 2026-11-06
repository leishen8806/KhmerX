type SelfcheckChannel={tenant_id?:string;type?:string;enabled?:number|boolean;hosts_json?:string|string[];allowed_origins_json?:string|string[];auth_mode?:string;phone_verification?:number|boolean;bot_telegram_id?:string|null;bot_username?:string|null};
const list=(value:unknown):string[]=>{if(Array.isArray(value))return value.filter((item):item is string=>typeof item==='string'&&item.trim().length>0);if(typeof value!=='string')return [];try{return list(JSON.parse(value||'[]'));}catch{return []}};
const enabled=(value:unknown)=>value===true||value===1||value==='1';
export type CompanyChannelSelfcheck={ok:boolean;errors:string[];warnings:string[]};
export function selfCheckCompanyChannels(channels:SelfcheckChannel[],options:{tenantId?:string;formalEnvironment?:boolean}={}):CompanyChannelSelfcheck{
 const errors:string[]=[],warnings:string[]=[],current=options.tenantId?channels.filter(channel=>channel.tenant_id===options.tenantId):channels,tenantIds=new Set(current.map(channel=>String(channel.tenant_id||'')).filter(Boolean));
 if(tenantIds.size!==1||tenantIds.has(''))errors.push('必须存在且只能存在一个公司渠道绑定');
 const owners=new Map<string,string>();
 for(const channel of channels){const type=channel.type||'',inCurrent=!options.tenantId||channel.tenant_id===options.tenantId;
  if(type==='h5'||type==='app'){
   const hosts=[...list(channel.hosts_json),...list(channel.allowed_origins_json)];
   if(inCurrent&&enabled(channel.enabled)&&hosts.length===0)errors.push(`${type} 渠道启用时必须配置 hosts`);
   for(const host of hosts){const key=host.toLowerCase(),owner=owners.get(key),tenant=String(channel.tenant_id||'');if(owner&&owner!==tenant)errors.push(`渠道 host 不能跨公司重复绑定: ${host}`);else owners.set(key,tenant)}
   if(inCurrent&&channel.auth_mode!=='telegram')errors.push(`${type} 渠道 auth_mode 必须为 telegram`);
   if(inCurrent&&!enabled(channel.phone_verification))errors.push(`${type} 渠道必须开启手机验证`);
  }
  if(type==='telegram_miniapp'&&channel.bot_telegram_id){const tenant=String(channel.tenant_id||''),key=`bot:${channel.bot_telegram_id}`,owner=owners.get(key);if(owner&&owner!==tenant)errors.push(`Telegram Bot 不能跨公司重复绑定: ${channel.bot_telegram_id}`);else owners.set(key,tenant);if(channel.bot_username){const user=`username:${channel.bot_username.toLowerCase()}`,previous=owners.get(user);if(previous&&previous!==tenant)errors.push(`Telegram 用户名不能跨公司重复绑定: ${channel.bot_username}`);else owners.set(user,tenant)}}
 }
 if(options.formalEnvironment&&current.some(channel=>channel.auth_mode==='demo'))errors.push('正式环境禁止 demo auth');
 return {ok:errors.length===0,errors,warnings};
}
