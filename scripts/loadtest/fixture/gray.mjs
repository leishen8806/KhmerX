import {DatabaseSync} from 'node:sqlite';
import {lstatSync,statSync,realpathSync,readdirSync} from 'node:fs';
import {resolve,relative,isAbsolute,join} from 'node:path';
import {checkConfig} from '../../../deploy/standalone/gray/check-config.mjs';
import {check,hash,validateManifest} from './core.mjs';

export function noLinks(file){
 const absolute=resolve(file);let current='/';
 for(const part of absolute.split('/').filter(Boolean)){current=join(current,part);check(!lstatSync(current).isSymbolicLink(),'Links refused')}
 check(realpathSync(absolute)===absolute,'Real path mismatch');return absolute;
}
export function grayOutput(dir){
 check(noLinks(dir)==='/out/manifests','Use /out/manifests');const s=statSync(dir);
 check(s.isDirectory()&&s.uid===1000&&s.gid===1000&&(s.mode&0o777)===0o700,'Output requires owner 1000:1000 and mode 700');
}
export function grayTarget(o){
 check(process.platform==='linux'&&process.env.L1G_CONTAINER==='1'&&process.getuid()===1000&&process.getgid()===1000,'Isolated UID 1000 container required');
 check(checkConfig(o.config).deployable,'Deployable gray config required');
 const raw=o.config.bindings,url=new URL(o.baseUrl);
 check(['testapi.khmerx.org','testpayease.khmerx.org'].includes(url.hostname)&&url.protocol==='https:'&&!url.port&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash,'Gray HTTPS origin required');
 check(o.expectRows===raw.CUSTOMER_ROWS,'Rows expectation mismatch');
 const dir=noLinks(o.d1Dir),rel=relative('/data/d1',dir);check(!rel.startsWith('..')&&!isAbsolute(rel),'Use /data/d1');
 check(o.appStopped===true,'Explicit stopped application declaration required');
 const backup=noLinks(o.backupRef),s=statSync(backup),age=Date.now()-s.mtimeMs,br=relative(dir,backup);
 check(s.isFile()&&s.size>0&&age>=0&&age<=1800000&&(br.startsWith('..')||isAbsolute(br)),'Fresh backup outside D1 required');
 grayOutput(o.outputDir);
 const folder=noLinks(join(dir,'miniflare-D1DatabaseObject')),candidates=[];
 for(const name of readdirSync(folder).filter(x=>x.endsWith('.sqlite'))){
  const file=noLinks(join(folder,name));check(statSync(file).isFile()&&statSync(file).nlink===1&&statSync(file).uid===1000&&statSync(file).gid===1000,'Database hardlinks refused');
  for(const suffix of ['-wal','-shm']){try{check(lstatSync(file+suffix).isFile()&&!lstatSync(file+suffix).isSymbolicLink()&&statSync(file+suffix).nlink===1,'Sidecar links refused')}catch(e){if(e.code!=='ENOENT')throw e}}
  const db=new DatabaseSync(file,{readOnly:true});try{if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='team_companies'").get())candidates.push(file)}finally{db.close()}
 }
 check(candidates.length===1,'Exactly one D1 application database required');const file=candidates[0],company=o.config.companies[0];
 const db=new DatabaseSync(file);try{
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');
  check(db.prepare('SELECT 1 FROM team_companies WHERE id=? AND slug=?').get(company.id,company.slug),'Public tenant mismatch');
  db.exec('ROLLBACK');
 }finally{db.close()}
 const bindings=Object.fromEntries(['PAYEASE_ENV','KHMERX_TEST_MODE','PAYEASE_AUTH_MODE','CUSTOMER_ROWS','KYC_DATA_SECRET','KYC_DATA_KEY_ID'].filter(k=>raw[k]!==undefined).map(k=>[k,raw[k]]));
 const safe={host:o.config.host,...Object.fromEntries(['publicClientHosts','adminHosts','apiHosts'].map(k=>[k,o.config[k]])),...Object.fromEntries(Object.entries(bindings).filter(([k])=>k!=='KYC_DATA_SECRET')),company:{id:company.id,slug:company.slug}};
 return {file,bindings,url,hosts:[url.hostname],configFingerprint:hash(JSON.stringify(safe)).slice(0,12),declarations:{appStopped:true,backupRef:backup}};
}
export function dbCheck(o,m){
 validateManifest(m);const t=grayTarget(o);check(m.target.profile==='gray-config'&&m.target.baseUrl===t.url.origin&&m.target.customerRows===t.bindings.CUSTOMER_ROWS&&m.target.configFingerprint===t.configFingerprint,'Manifest target mismatch');
 const db=new DatabaseSync(t.file,{readOnly:true});try{
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN');
  const owner=m.target.tenantId,ids=new Set(m.customers.map(c=>c.customerId)),rows=(table,column='owner')=>db.prepare(`SELECT * FROM ${table} WHERE ${column}=?`).all(owner);
  const shards=rows('customer_workspaces'),index=rows('loan_index'),legacy=rows('demo_workspaces').flatMap(r=>JSON.parse(r.payload).loans||[]),units=rows('team_units','tenant_id');
  const loans=[...legacy,...shards.flatMap(r=>JSON.parse(r.payload).loans||[])],foreign=[...rows('h5_accounts'),...rows('h5_sessions'),...rows('kyc_cases'),...shards,...index,...rows('team_assignments','tenant_id')].some(r=>!ids.has(r.customer_id))||loans.some(l=>!ids.has(l.customerId));
  const counts={customer_workspaces:shards.length,loan_index:index.length,legacyLoans:legacy.length,assignments:rows('team_assignments','tenant_id').length,audit:rows('team_audit','tenant_id').length};
  const on=t.bindings.CUSTOMER_ROWS==='on',expected=m.dataset==='main'||m.dataset==='smoke'||m.dataset==='timeout'?m.customers.length:0;
  const result={runId:m.runId,binding:hash(m.runId+':'+m.target.tenantId+':'+m.dataset+':'+m.integrity.sha256),checkedAt:new Date().toISOString(),...counts,assignmentsMatch:counts.assignments===expected&&counts.audit===expected,modeMatches:on?shards.length===expected&&index.length===expected&&legacy.length===0:shards.length===0&&index.length===0&&legacy.length===expected,uniqueOps:units.length===1&&units[0].id===m.opsDepartmentId&&units[0].kind==='department',foreignCustomers:foreign};
  db.exec('COMMIT');return result;
 }finally{db.close()}
}
