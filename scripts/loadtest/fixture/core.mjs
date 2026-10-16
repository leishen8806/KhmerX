import {createHash,randomBytes,randomUUID,hkdfSync,createCipheriv} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {realpathSync,statSync,lstatSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';

export const check=(ok,message)=>{if(!ok)throw new Error(message)};
export const hash=value=>createHash('sha256').update(value).digest('hex');
export const datasets={main:null,smoke:3,timeout:3,aux:6,'wrong-owner':0};
export const integrity=customers=>hash(customers.map(c=>c.customerId+':'+hash(c.sessionToken)).join('\n'));
export function tenantFor(runId){const h=hash(runId);return `t_${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`}
export function target(options){
 check(options.profile==='local-harness','Only local-harness is authorized; gray execution is HOLD');
 const url=new URL(options.baseUrl),b=options.config?.bindings;
 check(['http:','https:'].includes(url.protocol)&&['localhost','127.0.0.1'].includes(url.hostname)&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash,'Loopback origin required');
 check(b?.PAYEASE_ENV==='local'&&['demo','telegram'].includes(b.PAYEASE_AUTH_MODE),'Actual local runtime bindings required');
 check(b.PAYEASE_AUTH_MODE!=='demo'||b.KHMERX_TEST_MODE==='true','Demo requires local test mode');
 check(['off','on','shadow'].includes(b.CUSTOMER_ROWS),'Rows mode missing');
 check(typeof b.KYC_DATA_SECRET==='string'&&b.KYC_DATA_SECRET.length>=32,'KYC secret missing');
 for(const k of ['publicClientHosts','adminHosts','apiHosts'])check(options.config[k]===undefined||Array.isArray(options.config[k]),'Host arrays required');
 const hosts=[options.config.host,...['publicClientHosts','adminHosts','apiHosts'].flatMap(k=>options.config[k]||[])].filter(Boolean);
 check(hosts.length&&hosts.every(h=>typeof h==='string'&&!/(^|\.)khmerx\.org\.?$/i.test(h)),'Any khmerx.org host or missing hosts refused');
 const state=resolve(realpathSync(options.root),'.wrangler/state'),file=realpathSync(options.database),rel=relative(state,file);
 check(realpathSync(state)===state&&rel&&!rel.startsWith('..')&&!isAbsolute(rel)&&!lstatSync(options.database).isSymbolicLink()&&statSync(file).nlink===1,'Database must remain inside checkout .wrangler/state without links');
 const db=new DatabaseSync(file,{readOnly:true});
 try{for(const t of ['team_companies','team_units','h5_accounts','h5_sessions','kyc_cases'])check(db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=?').get(t),'Required schema missing')}finally{db.close()}
 return {file,bindings:b,url,hosts};
}
export function plan(options){
 const t=target(options);check(/^[a-z0-9-]{8,40}$/.test(options.runId),'runId must be 8-40 lowercase letters, digits or hyphens');
 check(Object.hasOwn(datasets,options.dataset),'Unknown dataset');
 const count=options.dataset==='main'?(options.count??50):datasets[options.dataset];
 check(Number.isSafeInteger(count)&&count>=(options.dataset==='main'?1:0)&&count<=5000&&(options.count===undefined||options.count===count),'Invalid dataset count');
 const db=new DatabaseSync(t.file,{readOnly:true});let counts;
 try{counts={companies:db.prepare('SELECT COUNT(*) n FROM team_companies').get().n,accounts:db.prepare('SELECT COUNT(*) n FROM h5_accounts').get().n}}finally{db.close()}
 const summary={profile:options.profile,env:'local',authMode:t.bindings.PAYEASE_AUTH_MODE,customerRows:t.bindings.CUSTOMER_ROWS,hosts:t.hosts,baseUrl:t.url.origin,database:t.file,size:statSync(t.file).size,...counts,count,runId:options.runId,dataset:options.dataset,tenantId:tenantFor(options.runId)};
 return {target:t,summary,fingerprint:hash(JSON.stringify(summary)).slice(0,12)};
}
export function sealCase(id,secret,keyId='v2'){
 check(/^[A-Za-z0-9._-]{1,64}$/.test(keyId),'Invalid key id');
 const iv=randomBytes(12),key=hkdfSync('sha256',Buffer.from(secret),Buffer.from('payease-kyc-salt:'+keyId),Buffer.from('payease-kyc-aes-gcm-v2'),32);
 const cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('case:'+id));
 const payload={profile:{values:{},files:{},consent:false,declarationVersion:'synthetic-fixture'},phoneVerified:true,ruleVersion:'synthetic-fixture'};
 const encrypted=Buffer.concat([cipher.update(JSON.stringify(payload)),cipher.final(),cipher.getAuthTag()]);
 return Buffer.concat([Buffer.from([0x4b,2,Buffer.byteLength(keyId)]),Buffer.from(keyId),iv,encrypted]).toString('base64');
}
export function prepare(options){
 const p=plan(options);if(!options.apply)return {summary:p.summary,fingerprint:p.fingerprint};
 check(options.confirm===p.fingerprint,'Confirmation fingerprint mismatch');
 const ttl=options.ttl??7200;check(Number.isSafeInteger(ttl)&&ttl>=600&&ttl<=21600,'Session TTL must be 600..21600 seconds');
 const db=new DatabaseSync(p.target.file);db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');
 try{
  const owner=p.summary.tenantId,now=Math.floor(Date.now()/1000),expires=now+ttl,b=p.target.bindings,dataset=options.dataset;
  check(db.prepare('SELECT COUNT(*) n FROM team_companies').get().n===p.summary.companies&&db.prepare('SELECT COUNT(*) n FROM h5_accounts').get().n===p.summary.accounts,'Target changed since planning');
  check(!db.prepare('SELECT 1 FROM team_companies WHERE id=? OR slug=?').get(owner,'loadtest-'+options.runId),'Fixture tenant already exists');
  db.prepare('INSERT INTO team_companies(id,name,slug,active,default_department) VALUES (?,?,?,1,?)').run(owner,'LOADTEST-'+options.runId,'loadtest-'+options.runId,owner+':ops');
  db.prepare('INSERT INTO team_units(id,tenant_id,name,kind,active) VALUES (?,?,?,\'department\',1)').run(owner+':ops',owner,'LOADTEST Ops');
  if(dataset!=='wrong-owner'){
   const state={loans:[],bots:[1,2].map(n=>({id:'bot-'+n,label:'Synthetic '+n,username:'',enabled:true,phoneVerification:false,passwordSetup:false})),events:[],entries:[],notifications:[],requests:[],requestDigests:{}};
   db.prepare('INSERT INTO demo_workspaces(owner,revision,payload) VALUES (?,0,?)').run(owner,JSON.stringify(state));
  }
  const customers=[];
  for(let index=1;index<=p.summary.count;index++){
   const customerId=`synthetic-${options.runId}-${String(index).padStart(5,'0')}`,sessionToken=randomBytes(32).toString('hex'),phoneMask='+000 **** '+String(index).padStart(4,'0');
   const type=dataset==='aux'?(index<=3?'expired':'revoked'):'normal',id=randomUUID();
   db.prepare('INSERT INTO h5_accounts(customer_id,owner,phone_key,phone_mask,mode,phone_verified,verification_completed,password_hash,credential_version,source_channel,created_at) VALUES (?,?,?,?,?,1,1,NULL,?,?,?)').run(customerId,owner,`synthetic:${options.runId}:${index}`,phoneMask,b.PAYEASE_AUTH_MODE,type==='revoked'?1:0,'SY',now);
   db.prepare('INSERT INTO h5_sessions(token_hash,owner,customer_id,phone_mask,mode,expires_at,credential_version) VALUES (?,?,?,?,?,?,0)').run(hash(sessionToken),owner,customerId,phoneMask,b.PAYEASE_AUTH_MODE,type==='expired'?now-60:expires);
   if(dataset!=='aux')db.prepare('INSERT INTO kyc_cases(id,owner,customer_id,revision,status,payload,updated_at) VALUES (?,?,?,1,?,?,?)').run(id,owner,customerId,'approved',sealCase(id,b.KYC_DATA_SECRET,b.KYC_DATA_KEY_ID),new Date().toISOString());
   customers.push({index,customerId,sessionToken,type});
  }
  const manifest={formatVersion:1,synthetic:true,runId:options.runId,dataset,opsDepartmentId:owner+':ops',createdAt:new Date().toISOString(),expiresAt:new Date(expires*1000).toISOString(),target:{profile:options.profile,env:'local',authMode:b.PAYEASE_AUTH_MODE,customerRows:b.CUSTOMER_ROWS,tenantId:owner,hosts:[p.target.url.hostname],baseUrl:p.target.url.origin,configFingerprint:p.fingerprint},customers,integrity:{count:customers.length,sha256:integrity(customers)}};
  options.persist?.(manifest);db.exec('COMMIT');return {summary:p.summary,fingerprint:p.fingerprint,manifest};
 }catch(e){db.exec('ROLLBACK');throw e}finally{db.close()}
}
export function validateManifest(m){
 check(m?.formatVersion===1&&m.synthetic===true&&/^[a-z0-9-]{8,40}$/.test(m.runId),'Invalid synthetic manifest');
 check(m.target?.profile==='local-harness'&&m.target.env==='local'&&m.target.tenantId===tenantFor(m.runId)&&m.opsDepartmentId===m.target.tenantId+':ops','Manifest owner mismatch');
 check(Object.hasOwn(datasets,m.dataset)&&Array.isArray(m.customers),'Dataset missing');
 check(['demo','telegram'].includes(m.target.authMode)&&/^[a-f0-9]{12}$/.test(m.target.configFingerprint)&&Array.isArray(m.target.hosts),'Manifest runtime missing');
 check(Date.parse(m.expiresAt)>Date.parse(m.createdAt)&&Date.parse(m.expiresAt)-Date.parse(m.createdAt)<=21600000,'Invalid manifest lifetime');
 check(m.dataset==='main'?m.customers.length>=1&&m.customers.length<=5000:m.customers.length===datasets[m.dataset],'Dataset count mismatch');
 const ids=new Set(),tokens=new Set();
 for(const [i,c] of m.customers.entries()){
  check(c.index===i+1&&c.customerId===`synthetic-${m.runId}-${String(i+1).padStart(5,'0')}`&&!ids.has(c.customerId),'Invalid or duplicate customer');
  check(/^[a-f0-9]{64}$/.test(c.sessionToken)&&!tokens.has(c.sessionToken),'Invalid or duplicate session');
  check(c.type===(m.dataset==='aux'?(i<3?'expired':'revoked'):'normal'),'Session type mismatch');ids.add(c.customerId);tokens.add(c.sessionToken);
 }
 check(m.integrity?.count===m.customers.length&&m.integrity.sha256===integrity(m.customers),'Manifest integrity mismatch');
 return m;
}
