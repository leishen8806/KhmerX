type SelfcheckChannel={tenant_id?:string;type?:string;enabled?:number|boolean;hosts_json?:string|string[];allowed_origins_json?:string|string[];auth_mode?:string;phone_verification?:number|boolean;bot_telegram_id?:string|null;bot_username?:string|null;api_base_url?:string|null;package_id?:string|null;token_configured?:number|boolean};
const list=(value:unknown):string[]=>{if(Array.isArray(value))return value.filter((item):item is string=>typeof item==='string'&&item.trim().length>0);if(typeof value!=='string')return [];try{return list(JSON.parse(value||'[]'));}catch{return []}};
const enabled=(value:unknown)=>value===true||value===1||value==='1';
export type SelfcheckStatus='pass'|'fail'|'warn';
export type CompanyChannelSelfcheckCheck={key:string;label:string;status:SelfcheckStatus;detail?:string};
export type CompanyChannelSelfcheck={ok:boolean;checks:CompanyChannelSelfcheckCheck[];errors:string[];warnings:string[]};
export function selfCheckCompanyChannels(channels:SelfcheckChannel[],options:{tenantId?:string;formalEnvironment?:boolean;appClientKeyConfigured?:boolean}={}):CompanyChannelSelfcheck{
 const current=options.tenantId?channels.filter(channel=>channel.tenant_id===options.tenantId):channels;
 const checks:CompanyChannelSelfcheckCheck[]=[];
 const add=(key:string,label:string,status:SelfcheckStatus,detail:string)=>checks.push({key,label,status,detail});
 const tenantIds=new Set(current.map(channel=>String(channel.tenant_id||'')).filter(Boolean));
 add('company_binding_unique','公司渠道绑定唯一',tenantIds.size===1?'pass':'fail',tenantIds.size===1?'当前公司绑定唯一':'必须存在且只能存在一个公司渠道绑定');
 const h5=current.find(channel=>channel.type==='h5'&&enabled(channel.enabled));
 const h5Hosts=h5?[...list(h5.hosts_json),...list(h5.allowed_origins_json)]:[];
 add('h5_host_configured','H5 主机',h5&&!h5Hosts.length?'fail':h5?'pass':'warn',h5&&!h5Hosts.length?'启用 H5 渠道必须配置绑定主机':'已配置 H5 绑定主机');
 const app=current.find(channel=>channel.type==='app'&&enabled(channel.enabled));
 add('app_api_host_configured','App API 主机',app&&(!app.api_base_url||!String(app.api_base_url).trim())?'fail':app?'pass':'warn',app&&(!app.api_base_url||!String(app.api_base_url).trim())?'启用 App 渠道必须配置 API 地址':'已配置 App API 地址');
 const appClientKeyConfigured=options.appClientKeyConfigured===true;
 add('app_client_key_configured','App 客户端密钥',app&&!appClientKeyConfigured?'warn':app?'pass':'warn',app&&!appClientKeyConfigured?'App 客户端密钥未配置，App 请求按 H5 处理':app?'已配置 App 客户端密钥':'没有启用 App 渠道');
 const telegram=current.filter(channel=>channel.type==='telegram_miniapp'&&enabled(channel.enabled));
 add('telegram_auth_mode','Telegram 登录方式',telegram.length>0&&telegram.every(channel=>channel.auth_mode==='telegram')?'pass':telegram.length?'fail':'warn',telegram.length&&telegram.every(channel=>channel.auth_mode==='telegram')?'Telegram 登录方式正确':telegram.length?'启用 Telegram 渠道必须使用 Telegram 登录':'没有启用 Telegram 渠道');
 add('h5_phone_verification','H5 手机验证',h5&&enabled(h5.phone_verification)?'pass':h5?'fail':'warn',h5&&enabled(h5.phone_verification)?'H5 已开启手机验证':h5?'H5 必须开启手机验证':'没有启用 H5 渠道');
 add('app_phone_verification','App 手机验证',app&&enabled(app.phone_verification)?'pass':app?'fail':'warn',app&&enabled(app.phone_verification)?'App 已开启手机验证':app?'App 必须开启手机验证':'没有启用 App 渠道');
 const demo=current.some(channel=>channel.auth_mode==='demo');
 add('formal_demo_auth','正式环境禁止演示验证码',options.formalEnvironment&&demo?'fail':'pass',options.formalEnvironment&&demo?'正式环境禁止 demo auth':options.formalEnvironment?'正式环境未发现 demo auth':'测试/灰度环境允许按策略使用演示验证码');
 const owners=new Map<string,string>();let duplicate='';
 for(const channel of channels){const tenant=String(channel.tenant_id||'');const values=channel.type==='app'?[channel.api_base_url||'']:[...list(channel.hosts_json),...list(channel.allowed_origins_json)];for(const value of values.filter(Boolean)){const key=`host:${value.toLowerCase()}`,owner=owners.get(key);if(owner&&owner!==tenant)duplicate=`主机不能跨公司重复绑定: ${value}`;else owners.set(key,tenant)}for(const value of [channel.bot_telegram_id,channel.bot_username].filter(Boolean) as string[]){const key=`bot:${value.toLowerCase()}`,owner=owners.get(key);if(owner&&owner!==tenant)duplicate=`机器人不能跨公司重复绑定: ${value}`;else owners.set(key,tenant)}}
 add('cross_company_unique','主机和机器人跨公司唯一',duplicate?'fail':'pass',duplicate||'主机和机器人没有跨公司重复绑定');
 add('telegram_token_configured','Telegram Token 已配置',telegram.length===0?'warn':telegram.every(channel=>enabled(channel.token_configured))?'pass':'fail',telegram.length===0?'没有启用 Telegram 渠道':telegram.every(channel=>enabled(channel.token_configured))?'启用 Telegram 渠道均已配置 Token':'启用 Telegram 渠道必须配置 Token');
 const errors=checks.filter(check=>check.status==='fail').map(check=>check.detail||check.label),warnings=checks.filter(check=>check.status==='warn').map(check=>check.detail||check.label);
 return {ok:errors.length===0,checks,errors,warnings};
}
