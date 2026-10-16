import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {check,validateManifest} from './fixture/core.mjs';
import {privateFile} from './fixture/private-file.mjs';
export function preflight(m,{vus,baseUrl,mode,dataset='main',duration=300},file){
 validateManifest(m);const url=new URL(baseUrl);
 check(['http:','https:'].includes(url.protocol)&&['127.0.0.1','localhost'].includes(url.hostname)&&!url.username&&!url.password,'Loopback target required');
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
