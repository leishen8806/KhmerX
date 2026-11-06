import {AuthError} from '@/lib/h5-auth-core';
import {decryptBytes} from '@/lib/kyc/server';
import {db,staff} from '@/lib/team/server';

export type CompanyChannelType='telegram'|'h5'|'app';
type StoredChannelType='telegram_miniapp'|'h5'|'app';
type ChannelViewer='admin'|'checker'|'finance_checker';
export type CompanyChannelRow={
 id:string;tenant_id:string;type:StoredChannelType;label:string;enabled:number;auth_mode:string;
 phone_verification:number;password_setup:number;languages_json:string;default_language:string;
 source_channel:string;hosts_json:string;allowed_origins_json:string;entry_slug:string|null;
 otp_ttl_seconds:number;otp_max_attempts:number;otp_resend_cooldown_seconds:number;
 otp_rate_limits_json:string;sms_provider:string|null;bot_telegram_id:string|null;bot_username:string|null;
 mini_app_url:string|null;mini_app_short_name:string|null;webhook_url:string|null;webhook_secret_configured:number;
 init_data_max_age_seconds:number;notifications_enabled:number;telegram_bot_id:string|null;app_platform:string|null;
 package_id:string|null;bundle_id:string|null;api_base_url:string|null;cookie_hosts_json:string;
 min_supported_version:string|null;latest_version:string|null;download_url:string|null;force_upgrade:number;
 maintenance_messages_json:string;updated_by:string|null;updated_at:string;
};
const json=(value:string,fallback:unknown)=>{try{return JSON.parse(value||'')}catch{return fallback}};
const languageList=(value:string)=>{const parsed=json(value,[]);if(Array.isArray(parsed))return parsed.filter(x=>['en','km','zh'].includes(String(x)));if(parsed&&typeof parsed==='object')return Object.entries(parsed).filter(([,enabled])=>Boolean(enabled)).map(([key])=>key).filter(x=>['en','km','zh'].includes(x));return []};
const stringList=(value:string)=>{const parsed=json(value,[]);return Array.isArray(parsed)?parsed.filter(x=>typeof x==='string'):[]};
const hostOf=(value:string)=>{try{return new URL(value.includes('://')?value:`https://${value}`).hostname.toLowerCase()}catch{return value.toLowerCase()}};
const storedType=(type:CompanyChannelType):StoredChannelType=>type==='telegram'?'telegram_miniapp':type;
const allowedViewer=(role:string):role is ChannelViewer=>['admin','checker','finance_checker'].includes(role);
const tokenState=async(row:CompanyChannelRow):Promise<{configured:boolean;last4?:string}>=>{
 if(row.type!=='telegram_miniapp'||!row.telegram_bot_id)return {configured:false};
 const credential=await db().prepare('SELECT token_encrypted FROM telegram_bot_credentials WHERE owner=? AND bot_id=?').bind(row.tenant_id,row.telegram_bot_id).first<{token_encrypted:string}>();
 if(!credential?.token_encrypted)return {configured:false};
 try{const token=new TextDecoder().decode(await decryptBytes(Uint8Array.from(atob(credential.token_encrypted),c=>c.charCodeAt(0)),`bot-token:${row.tenant_id}:${row.telegram_bot_id}`));return token?{configured:true,last4:token.slice(-4)}:{configured:false};}catch{return {configured:false}}
};
const publicChannel=async(row:CompanyChannelRow,viewer:ChannelViewer):Promise<Record<string,unknown>>=>{
 const channel={id:row.id,tenantId:row.tenant_id,type:row.type==='telegram_miniapp'?'telegram':row.type,label:row.label,enabled:Boolean(row.enabled),authMode:row.auth_mode,phoneVerification:Boolean(row.phone_verification),passwordSetup:Boolean(row.password_setup),languages:languageList(row.languages_json),defaultLanguage:row.default_language,sourceChannel:row.source_channel,hosts:stringList(row.hosts_json),allowedOrigins:stringList(row.allowed_origins_json),entrySlug:row.entry_slug,otp:{ttlSeconds:row.otp_ttl_seconds,maxAttempts:row.otp_max_attempts,resendCooldownSeconds:row.otp_resend_cooldown_seconds,rateLimits:json(row.otp_rate_limits_json,{})},smsProvider:row.sms_provider,telegram:{botTelegramId:row.bot_telegram_id,botUsername:row.bot_username,miniAppUrl:row.mini_app_url,miniAppShortName:row.mini_app_short_name,webhookUrl:row.webhook_url,webhookSecretConfigured:Boolean(row.webhook_secret_configured),initDataMaxAgeSeconds:row.init_data_max_age_seconds},app:{platform:row.app_platform,packageId:row.package_id,bundleId:row.bundle_id,apiBaseUrl:row.api_base_url,cookieHosts:stringList(row.cookie_hosts_json),minSupportedVersion:row.min_supported_version,latestVersion:row.latest_version,downloadUrl:row.download_url,forceUpgrade:Boolean(row.force_upgrade)},maintenance:json(row.maintenance_messages_json,{}),updatedBy:row.updated_by,updatedAt:row.updated_at} as Record<string,unknown>;
 if(viewer==='admin'&&row.type==='telegram_miniapp')channel.token=await tokenState(row);
 return channel;
};
async function channelViewer(){const s=await staff();if(!s||!allowedViewer(s.member.role))throw new AuthError('当前岗位没有渠道配置查看权限',403,'CHANNEL_VIEW_FORBIDDEN');return s}
export async function readCompanyChannels(){const s=await channelViewer();const rows=(await db().prepare('SELECT * FROM company_channels WHERE tenant_id=? ORDER BY type,label,id').bind(s.tenant.id).all<CompanyChannelRow>()).results;return {staff:s,rows};}
export async function listCompanyChannels(){const {staff:s,rows}=await readCompanyChannels();return Promise.all(rows.map(row=>publicChannel(row,s.member.role as ChannelViewer)));}
export async function resolveCompanyChannel(tenantId:string,type:CompanyChannelType,host?:string){
 if(!tenantId||!['telegram','h5','app'].includes(type))throw new AuthError('渠道类型无效',400,undefined,'CHANNEL_TYPE_INVALID');
 const rows=(await db().prepare('SELECT * FROM company_channels WHERE tenant_id=? AND type=? AND enabled=1 ORDER BY id').bind(tenantId,storedType(type)).all<CompanyChannelRow>()).results;
 const wanted=host?hostOf(host):'';const match=host?rows.find(row=>[...stringList(row.hosts_json),...stringList(row.allowed_origins_json)].some(value=>hostOf(value)===wanted)):rows[0];
 if(!match)throw new AuthError('公司渠道未配置或未启用',503,'CHANNEL_CONFIG_INCOMPLETE');
 return publicChannel(match,'admin');
}
