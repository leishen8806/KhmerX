type SelfcheckChannel={tenant_id?:string;type?:string;enabled?:number|boolean;hosts_json?:string|string[];allowed_origins_json?:string|string[];auth_mode?:string;phone_verification?:number|boolean;bot_telegram_id?:string|null;bot_username?:string|null};
const list=(value:unknown):string[]=>{if(Array.isArray(value))return value.filter((item):item is string=>typeof item==='string'&&item.trim().length>0);if(typeof value!=='string')return [];try{return list(JSON.parse(value||'[]'));}catch{return []}};
const enabled=(value:unknown)=>value===true||value===1||value==='1';
export type SelfcheckStatus='pass'|'fail'|'warn';
export type CompanyChannelSelfcheckCheck={key:string;label:string;status:SelfcheckStatus;detail?:string};
export type CompanyChannelSelfcheck={ok:boolean;checks:CompanyChannelSelfcheckCheck[];errors:string[];warnings:string[]};
export function selfCheckCompanyChannels(channels:SelfcheckChannel[],options:{tenantId?:string;formalEnvironment?:boolean}={}):CompanyChannelSelfcheck{
 const checks:CompanyChannelSelfcheckCheck[]=[],current=options.tenantId?channels.filter(channel=>channel.tenant_id===options.tenantId):channels,tenantIds=new Set(current.map(channel=>String(channel.tenant_id||'')).filter(Boolean));
 const add=(key:string,label:string,status:SelfcheckStatus,detail?:string)=>checks.push({key,label,status,...detail?{detail}:{}});
 add('company_binding_unique','公司渠道绑定唯一性',tenantIds.size===1&&!tenantIds.has('')?'pass':'fail',tenantIds.size===1?'当前公司绑定唯一':'必须存在且只能存在一个公司渠道绑定');
 const owners=new Map<string,string>();
 for(const channel of channels){const type=channel.type||'',inCurrent=!options.tenantId||channel.tenant_id===options.tenantId;
  if(type==='h5'||type==='app'){
   const hosts=[...list(channel.hosts_json),...list(channel.allowed_origins_json)];
   if(inCurrent&&enabled(channel.enabled))add(`${type}_hosts_configured`,`${type.toUpperCase()} 主机配置`,hosts.length>0?'pass':'fail',hosts.length>0?'已配置主机或来源':`${type} 渠道启用时必须配置 hosts`);
   else add(`${type}_hosts_configured`,`${type.toUpperCase()} 主机配置`,hosts.length>0?'pass':'warn',hosts.length>0?'已配置主机或来源':'渠道未启用，主机配置待补充');
   for(const host of hosts){const key=host.toLowerCase(),owner=owners.get(key),tenant=String(channel.tenant_id||'');if(owner&&owner!==tenant)add(`duplicate_host_${key}`,'主机跨公司唯一性','fail',`渠道 host 不能跨公司重复绑定: ${host}`);else owners.set(key,tenant)}
   add(`${type}_auth_mode`,`${type.toUpperCase()} 认证方式`,channel.auth_mode==='telegram'?'pass':inCurrent?'fail':'warn',channel.auth_mode==='telegram'?'Telegram 登录':`${type} 渠道 auth_mode 必须为 telegram`);
   add(`${type}_phone_verification`,`${type.toUpperCase()} 手机验证`,enabled(channel.phone_verification)?'pass':inCurrent?'fail':'warn',enabled(channel.phone_verification)?'已开启手机验证':inCurrent?`${type} 渠道必须开启手机验证`:'渠道未启用，手机验证待补充');
  }
  if(type==='telegram_miniapp'&&channel.bot_telegram_id){const tenant=String(channel.tenant_id||''),key=`bot:${channel.bot_telegram_id}`,owner=owners.get(key);if(owner&&owner!==tenant)add(`duplicate_bot_${key}`,'Telegram Bot 跨公司唯一性','fail',`Telegram Bot 不能跨公司重复绑定: ${channel.bot_telegram_id}`);else owners.set(key,tenant);if(channel.bot_username){const user=`username:${channel.bot_username.toLowerCase()}`,previous=owners.get(user);if(previous&&previous!==tenant)add(`duplicate_username_${user}`,'Telegram 用户名跨公司唯一性','fail',`Telegram 用户名不能跨公司重复绑定: ${channel.bot_username}`);else owners.set(user,tenant)}}
 }
 if(options.formalEnvironment)add('formal_demo_auth','正式环境认证模式',current.some(channel=>channel.auth_mode==='demo')?'fail':'pass',current.some(channel=>channel.auth_mode==='demo')?'正式环境禁止 demo auth':'未发现 demo auth');
 const errors=checks.filter(check=>check.status==='fail').map(check=>check.detail||check.label),warnings=checks.filter(check=>check.status==='warn').map(check=>check.detail||check.label);
 return {ok:errors.length===0,checks,errors,warnings};
}
