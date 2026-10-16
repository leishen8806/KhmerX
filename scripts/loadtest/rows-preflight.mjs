import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {check,validateManifest} from './fixture/core.mjs';
import {privateFile} from './fixture/private-file.mjs';
export const grayLabel='灰度直连源站，已跳过证书校验，未经 Cloudflare';
export function rowsTarget(m,baseUrl,env={}){
 const url=new URL(baseUrl),gray=m.target?.profile==='gray-config',allowed=String(env.LOADTEST_ALLOWED_HOSTS||'').split(',').map(x=>x.trim());
 check(baseUrl===url.origin&&m.target.baseUrl===baseUrl&&!url.username&&!url.password,'Manifest target mismatch');
 if(gray)check(m.target.env==='gray'&&m.target.authMode==='telegram'&&url.protocol==='https:'&&!url.port&&['testapi.khmerx.org','testpayease.khmerx.org'].includes(url.hostname)&&m.target.hosts.includes(url.hostname)&&env.ORIGIN_IP==='159.223.77.134'&&allowed.includes(url.hostname)&&allowed.includes(env.ORIGIN_IP),'Gray direct origin requires every allowlist condition');
 else check(m.target.profile==='local-harness'&&m.target.env==='local'&&['http:','https:'].includes(url.protocol)&&['127.0.0.1','localhost'].includes(url.hostname)&&!env.ORIGIN_IP&&env.K6_INSECURE_SKIP_TLS_VERIFY!=='true','Only matching local harness targets are authorized');
 return gray?{hosts:{[url.hostname]:env.ORIGIN_IP},insecureSkipTLSVerify:true}:{};
}
export function declaredScales(raw){
 const s=JSON.parse(raw);check(s&&Object.keys(s).length===2&&['PAYEASE_GATEWAY_RATE_SCALE','PAYEASE_LIMIT_SCALE'].every(k=>typeof s[k]==='number'&&Number.isFinite(s[k])&&s[k]>0),'Both actual positive scales must be declared');return s;
}
export function preflight(m,{vus,baseUrl,mode,dataset='main',duration=300,env=process.env},file){
 validateManifest(m);rowsTarget(m,baseUrl,env);const url=new URL(baseUrl);
 check(url.origin===m.target.baseUrl&&m.target.hosts.includes(url.hostname),'Manifest target mismatch');
 check(m.target.customerRows===mode&&['off','on','shadow'].includes(mode),'Rows mode mismatch');
 check(m.dataset===dataset,'Wrong dataset');
 check(Number.isSafeInteger(vus)&&vus>=0&&m.customers.length>=vus&&(dataset!=='main'||vus>0),'Insufficient customers');
 check(Number.isFinite(duration)&&duration>0&&Date.parse(m.expiresAt)>Date.now()+(duration+600)*1000,'Manifest expired or too short-lived');
 if(file)privateFile(file);
 return {runId:m.runId,customers:m.customers.length,vus,mode,dataset,synthetic:true};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const [file,baseUrl,mode,count,dataset='main']=process.argv.slice(2);console.log(JSON.stringify(preflight(JSON.parse(readFileSync(file,'utf8')),{baseUrl,mode,vus:Number(count),dataset},file)))}catch{console.error('Manifest preflight rejected; check identity, expiry, mode and permissions');process.exitCode=1}
}
