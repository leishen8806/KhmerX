import {AuthError} from '@/lib/h5-auth-core';
import {audit,db,staff} from '@/lib/team/server';

export type CompanyChannelType='telegram'|'h5'|'app';
export type CompanyChannel={
 id:string;tenant_id:string;type:CompanyChannelType;label:string;enabled:number;auth_mode:string;
 phone_verification:number;password_setup:number;languages_json:string;default_language:string;
 source_channel:string;hosts_json:string;origins_json:string;entry_slug:string|null;
 telegram_bot_id:string|null;telegram_username:string|null;app_platform:string|null;app_package:string|null;
 app_bundle_id:string|null;api_base_url:string|null;cookie_hosts_json:string;updated_by:string|null;updated_at:string;
};

const text=(value:unknown,max=200)=>typeof value==='string'?value.trim().slice(0,max):'';
const languages=(value:unknown)=>Array.isArray(value)?value.map(x=>String(x).trim()).filter(x=>['en','km','zh'].includes(x)).filter((x,i,a)=>a.indexOf(x)===i):[];
const hosts=(value:unknown)=>Array.isArray(value)?value.map(x=>String(x).trim().toLowerCase()).filter(x=>x&&x.length<255&&/^[a-z0-9.-]+(?::\d+)?$/.test(x)).filter((x,i,a)=>a.indexOf(x)===i):[];
function requireValid(type:CompanyChannelType,p:any){
 if(!['telegram','h5','app'].includes(type))throw new AuthError('渠道类型无效',400,undefined,'CHANNEL_TYPE_INVALID');
 const label=text(p.label,80),langs=languages(p.languages),defaultLanguage=text(p.defaultLanguage,2),hostList=hosts(p.hosts),originList=hosts(p.origins);
 if(!label||!langs.length||!langs.includes(defaultLanguage))throw new AuthError('渠道语言配置不完整',400,undefined,'CHANNEL_CONFIG_INCOMPLETE');
 if(type==='h5'&&p.phoneVerification!==true)throw new AuthError('H5 渠道必须启用手机号验证',400,undefined,'CHANNEL_CONFIG_INCOMPLETE');
 if(type==='telegram'&&(!text(p.telegramBotId,120)||!text(p.telegramUsername,120)))throw new AuthError('Telegram 渠道缺少机器人元数据',400,undefined,'CHANNEL_CONFIG_INCOMPLETE');
 if(type==='app'&&(!text(p.appPlatform,20)||(!text(p.appPackage,160)&&!text(p.appBundleId,160))||!text(p.apiBaseUrl,500)))throw new AuthError('App 渠道缺少平台或 API 配置',400,undefined,'CHANNEL_CONFIG_INCOMPLETE');
 if(type!=='telegram'&&(!hostList.length||!originList.length))throw new AuthError('渠道 hosts/origins 未配置',400,undefined,'CHANNEL_CONFIG_INCOMPLETE');
 return {label,langs,defaultLanguage,hostList,originList};
}
export async function listCompanyChannels(){const s=await staff();if(!s||s.member.role!=='admin')throw new AuthError('仅当前公司管理员可管理渠道',403,'CHANNEL_ADMIN_REQUIRED');return (await db().prepare('SELECT * FROM company_channels WHERE tenant_id=? ORDER BY type,label,id').bind(s.tenant.id).all<CompanyChannel>()).results.map(row=>({...row,languages:JSON.parse(row.languages_json||'[]'),hosts:JSON.parse(row.hosts_json||'[]'),origins:JSON.parse(row.origins_json||'[]'),cookieHosts:JSON.parse(row.cookie_hosts_json||'[]')}));}
export async function saveCompanyChannel(p:any){
 const s=await staff();if(!s||s.member.role!=='admin')throw new AuthError('仅当前公司管理员可管理渠道',403,'CHANNEL_ADMIN_REQUIRED');
 const type=String(p.type||'') as CompanyChannelType,valid=requireValid(type,p),id=text(p.id,80)||crypto.randomUUID(),old=await db().prepare('SELECT * FROM company_channels WHERE id=? AND tenant_id=?').bind(id,s.tenant.id).first<CompanyChannel>();
 if(old&&p.updatedAt!==old.updated_at)throw new AuthError('渠道配置已被其他管理员更新，请刷新后重试',409,'CHANNEL_CONFIG_STALE');
 const now=new Date().toISOString(),source=type==='telegram'?'telegram':type==='h5'?'h5':'app';
 const statement=db().prepare(`INSERT INTO company_channels (id,tenant_id,type,label,enabled,auth_mode,phone_verification,password_setup,languages_json,default_language,source_channel,hosts_json,origins_json,entry_slug,telegram_bot_id,telegram_username,app_platform,app_package,app_bundle_id,api_base_url,cookie_hosts_json,updated_by,updated_at)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,enabled=excluded.enabled,auth_mode=excluded.auth_mode,phone_verification=excluded.phone_verification,password_setup=excluded.password_setup,languages_json=excluded.languages_json,default_language=excluded.default_language,hosts_json=excluded.hosts_json,origins_json=excluded.origins_json,entry_slug=excluded.entry_slug,telegram_bot_id=excluded.telegram_bot_id,telegram_username=excluded.telegram_username,app_platform=excluded.app_platform,app_package=excluded.app_package,app_bundle_id=excluded.app_bundle_id,api_base_url=excluded.api_base_url,cookie_hosts_json=excluded.cookie_hosts_json,updated_by=excluded.updated_by,updated_at=excluded.updated_at WHERE company_channels.tenant_id=excluded.tenant_id AND (company_channels.updated_at=? OR ? IS NULL)`)
   .bind(id,s.tenant.id,type,valid.label,p.enabled===false?0:1,type==='telegram'?'telegram':'phone',p.phoneVerification===true?1:0,p.passwordSetup===false?0:1,JSON.stringify(valid.langs),valid.defaultLanguage,source,JSON.stringify(valid.hostList),JSON.stringify(valid.originList),text(p.entrySlug,80)||null,text(p.telegramBotId,120)||null,text(p.telegramUsername,120)||null,text(p.appPlatform,20)||null,text(p.appPackage,160)||null,text(p.appBundleId,160)||null,text(p.apiBaseUrl,500)||null,JSON.stringify(hosts(p.cookieHosts)),s.member.id,now,old?.updated_at||null,old?.updated_at||null);
 const result=await db().batch([statement,audit(s.tenant.id,s.user.userId,'company_channel_save',{id,type,enabled:p.enabled!==false})]);if(!result[0].meta.changes)throw new AuthError('渠道配置已被其他管理员更新，请刷新后重试',409,'CHANNEL_CONFIG_STALE');return {ok:true,id,updatedAt:now};
}
export async function resolveCompanyChannel(tenantId:string,type:CompanyChannelType,host?:string){
 if(!tenantId||!['telegram','h5','app'].includes(type))throw new AuthError('渠道类型无效',400,undefined,'CHANNEL_TYPE_INVALID');
 const rows=(await db().prepare('SELECT * FROM company_channels WHERE tenant_id=? AND type=? AND enabled=1 ORDER BY id').bind(tenantId,type).all<CompanyChannel>()).results;
 const match=host?rows.find(row=>{try{return JSON.parse(row.hosts_json||'[]').includes(host.toLowerCase())||JSON.parse(row.origins_json||'[]').includes(host.toLowerCase())}catch{return false}}):rows[0];
 if(!match)throw new AuthError('公司渠道未配置或未启用',503,'CHANNEL_CONFIG_INCOMPLETE');
 return {...match,languages:JSON.parse(match.languages_json||'[]'),hosts:JSON.parse(match.hosts_json||'[]'),origins:JSON.parse(match.origins_json||'[]'),cookieHosts:JSON.parse(match.cookie_hosts_json||'[]')};
}
