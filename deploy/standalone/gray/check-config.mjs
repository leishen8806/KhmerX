import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hostRules,isPublicClientHost} from '../hosts.mjs';
import {assertCustomerCompanyConfig} from '../company-config.mjs';
const exampleCompany='t_00000000-0000-4000-8000-000000000001';
const check=(ok,key)=>{if(!ok)throw Error('Invalid gray configuration: '+key)};
function checkCompanyChannels(channels){
 if(channels===undefined)return;
 check(Array.isArray(channels)&&channels.length>0,'company channels');
 const ids=new Set();
 const warnings=[];
 for(const channel of channels){
  check(channel&&typeof channel==='object'&&!Array.isArray(channel),'company channel object');
  check(typeof channel.id==='string'&&!ids.has(channel.id),'company channel id');ids.add(channel.id);
  check(['telegram','h5','app'].includes(channel.type),'company channel type');
  check(typeof channel.enabled==='boolean','company channel enabled');
  const channelCheck=(ok,key)=>{if(ok)return;if(channel.enabled)check(false,key);warnings.push(`${channel.id}: ${key}`)};
  channelCheck(Array.isArray(channel.languages)&&channel.languages.length>0&&channel.languages.every(x=>['en','km','zh'].includes(x)),'company channel languages');
  channelCheck(Array.isArray(channel.languages)&&channel.languages.includes(channel.defaultLanguage),'company channel default language');
  check(!Object.hasOwn(channel,'token')&&!Object.hasOwn(channel,'token_encrypted')&&!Object.hasOwn(channel,'password'),'company channel secret');
  if(channel.type!=='telegram'){channelCheck(Array.isArray(channel.hosts)&&channel.hosts.length>0,'company channel hosts');channelCheck(Array.isArray(channel.origins)&&channel.origins.length>0,'company channel origins')}
  if(channel.type==='telegram')channelCheck(typeof channel.telegramBotId==='string'&&typeof channel.telegramUsername==='string','company Telegram metadata');
  if(channel.type==='app')channelCheck(typeof channel.appPlatform==='string'&&typeof channel.apiBaseUrl==='string','company App metadata');
 }
 return warnings;
}
export function checkConfig(c,{example=false}={}){
 check(c&&typeof c==='object'&&!Array.isArray(c),'object');const b=c.bindings;
 check(b&&b.PAYEASE_ENV==='gray'&&b.KHMERX_TEST_MODE==='false'&&b.PAYEASE_IDENTITY_PROOF_REQUIRED==='true'&&b.PAYEASE_DEMO_OTP_ALLOWED==='true','runtime guards');
 const roles={publicClientHosts:['testpayease.khmerx.org','testadmin.khmerx.org','testapi.khmerx.org'],adminHosts:['testadmin.khmerx.org'],apiHosts:['testapi.khmerx.org']};
 for(const [key,hosts]of Object.entries(roles))check(Array.isArray(c[key])&&c[key].length===hosts.length&&hosts.every(h=>c[key].includes(h)),key);
 check(c.host==='testpayease.khmerx.org','host');const rules=hostRules(c);check([...rules.adminHosts,...rules.apiHosts].every(h=>isPublicClientHost(h,rules)),'public auth routing');
 const value=(v,key,min=1)=>check(typeof v==='string'&&v.trim().length>=min&&(example||!v.includes('replace-with-')),key);
 value(c.accessUser,'accessUser');value(c.accessPassword,'accessPassword',12);value(c.sessionSecret,'sessionSecret',32);
 for(const key of ['PAYEASE_AUTH_SECRET','PAYEASE_IDENTITY_PROOF_SECRET','KYC_DATA_SECRET','POSTLOAN_JOB_SECRET'])value(b[key],key,32);
 value(b.KYC_SCAN_TOKEN,'KYC_SCAN_TOKEN',16);value(b.TELEGRAM_GATEWAY_TOKEN,'TELEGRAM_GATEWAY_TOKEN');value(b.TELEGRAM_BOT_TOKEN_1,'TELEGRAM_BOT_TOKEN_1');
 check(b.TELEGRAM_BOT_TOKEN_2===undefined||typeof b.TELEGRAM_BOT_TOKEN_2==='string','TELEGRAM_BOT_TOKEN_2');if(b.TELEGRAM_BOT_TOKEN_2)value(b.TELEGRAM_BOT_TOKEN_2,'TELEGRAM_BOT_TOKEN_2');
 check(b.PAYEASE_AUTH_MODE==='telegram'&&b.PAYEASE_H5_AUTH_MODE==='demo'&&b.PAYEASE_TELEGRAM_AUTH_MODE==='telegram'&&['off','shadow','on'].includes(b.CUSTOMER_ROWS),'channel auth/rows mode');check(b.KYC_SCAN_URL==='http://scanner:8080/scan','KYC_SCAN_URL');
 for(const key of ['PAYEASE_LIMIT_SCALE','PAYEASE_GATEWAY_RATE_SCALE'])check(typeof b[key]==='string'&&Number.isFinite(Number(b[key]))&&Number(b[key])>0,key);
 check(Array.isArray(c.companies)&&c.companies.length===1,'single public company');let bound;try{bound=assertCustomerCompanyConfig(c,{requireExplicit:true})}catch(e){throw Error('Invalid gray configuration: '+String(e.message))}const company=c.companies[0];check(company&&typeof company==='object'&&!Array.isArray(company),'company object');check(bound===company.id,'customer company binding');
 check(/^t_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(company.id||'')&&(example||company.id!==exampleCompany),'company id');value(company.name,'company name');check(/^[a-z0-9][a-z0-9-]{2,63}$/.test(company.slug||''),'company slug');
 check(Array.isArray(company.accounts)&&company.accounts.length>0,'company accounts');const rolesSeen=new Set();
 for(const a of company.accounts){check(a&&['admin','collection_admin','collector','dept_admin','ops','kyc','lender','checker','finance','finance_checker','audit'].includes(a.role)&&!rolesSeen.has(a.role),'account role');rolesSeen.add(a.role);check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email||''),'account email');value(a.hash,'account hash');check(example&&a.hash.startsWith('replace-with-')||/^v2:(?:[1-9]\d{5}|1\d{6}|2000000):[a-f0-9]{64}:[a-f0-9]{64}$/.test(a.hash),'account hash format')}
 check(rolesSeen.has('admin'),'admin account');const channelWarnings=checkCompanyChannels(c.companyChannels);return {schema:'gray',deployable:!example,companies:1,authMode:'telegram',customerRows:b.CUSTOMER_ROWS,warnings:channelWarnings};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const args=process.argv.slice(2),example=args.includes('--example'),files=args.filter(a=>a!=='--example');check(files.length===1&&!files[0].startsWith('--'),'arguments');const result=checkConfig(JSON.parse(readFileSync(files[0],'utf8')),{example});console.log(example?'EXAMPLE VALID — NOT DEPLOYABLE': 'GRAY CONFIG CHECK: PASS');console.log(JSON.stringify(result))}catch(e){console.error(e instanceof SyntaxError?'GRAY CONFIG CHECK: FAIL (invalid JSON)':/^Invalid gray configuration:/.test(e.message)?e.message:'GRAY CONFIG CHECK: FAIL (unreadable file)');process.exitCode=1}
}
