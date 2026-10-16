import nodeTest from 'node:test';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
const test=(name,fn)=>nodeTest(name,{skip:process.platform!=='linux'||process.env.L1G_CONTAINER!=='1'},fn);
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,readdirSync,rmSync,writeFileSync,utimesSync,chmodSync,symlinkSync,linkSync,unlinkSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {checkConfig} from '../deploy/standalone/gray/check-config.mjs';
import {plan,prepare,hash} from '../scripts/loadtest/fixture/core.mjs';
import {cleanup,unrelated} from '../scripts/loadtest/fixture/cleanup.mjs';
import {dbCheck} from '../scripts/loadtest/fixture/gray.mjs';
import {execFileSync,spawnSync} from 'node:child_process';
import {runtime} from '../scripts/loadtest/fixture/test-runtime.mjs';

async function grayFixture(mode){
 const dir='/data/d1/'+randomUUID(),folder=dir+'/miniflare-D1DatabaseObject';mkdirSync(folder,{recursive:true});mkdirSync('/out/manifests',{recursive:true,mode:0o700});
 const config=JSON.parse(readFileSync('deploy/standalone/gray/config.json.example','utf8')),secret=()=>randomBytes(32).toString('hex');
 config.accessUser='synthetic';config.accessPassword=secret();config.sessionSecret=secret();
 for(const [k,v]of Object.entries(config.bindings))if(v.startsWith('replace-with-'))config.bindings[k]=secret();
 config.companies[0].id='t_'+randomUUID();config.companies[0].accounts[0].hash='v2:600000:'+secret()+':'+secret();config.bindings.CUSTOMER_ROWS=mode;
 assert.equal(checkConfig(config).deployable,true);
 const database=folder+'/application.sqlite',db=new DatabaseSync(database);db.exec('PRAGMA foreign_keys=ON');
 for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+f,'utf8'));
 // Execute the actual standalone seed SQL; source boundaries must stay aligned with server.mjs.
 const source=readFileSync('deploy/standalone/server.mjs','utf8'),seed=source.slice(source.indexOf('for(const company of cfg.companies){'),source.indexOf('const sign=x=>'));
 for(const table of ['team_companies','team_units','team_service_settings','team_members','team_staff_credentials','demo_workspaces'])assert(seed.includes('INSERT OR IGNORE INTO '+table));
 const adapter={prepare(sql){return {bind(...args){return {async run(){return db.prepare(sql).run(...args)}}}}},async batch(items){for(const item of items)await item.run()}};
 await new (Object.getPrototypeOf(async function(){}).constructor)('cfg','db',seed)(config,adapter);
 const backup='/out/'+randomUUID()+'.tgz';writeFileSync(backup,'synthetic recovery reference');utimesSync(backup,new Date(Date.now()-1000),new Date(Date.now()-1000));
 const options={profile:'gray-config',config,d1Dir:dir,baseUrl:'https://testapi.khmerx.org',expectRows:mode,outputDir:'/out/manifests',appStopped:true,backupRef:backup,runId:'gray-'+randomUUID().slice(0,24),dataset:'smoke'};
 return {db,options,close(){db.close();assert(dir.startsWith('/data/d1/'));rmSync(dir,{recursive:true});rmSync(backup)}};
}
test('G1 gate 5.1-2/3: real Telegram guard, create and confirm_bill; immutable public seed',async()=>{
 for(const mode of ['off','on']){
  const f=await grayFixture(mode);try{
   const {db,options:o}=f,p=plan(o),owner=p.summary.tenantId,before=unrelated(db,owner),triggers=db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all();
   const m=prepare({...o,apply:true,confirm:p.fingerprint}).manifest;
   assert.deepEqual(unrelated(db,owner),before);assert.equal(m.target.env,'gray');assert.equal(m.target.authMode,'telegram');
   const r=await runtime(db,o.config.bindings);r.select(owner);
   const auth=await r.load('@/lib/h5-auth'),core=await r.load('@/lib/h5-auth-core'),registration=await r.load('@/lib/registration-policy');
   for(const c of m.customers){
    const session=await core.getSession(auth.runtime(),owner,c.sessionToken);assert.equal(session.customerId,c.customerId);
    await registration.requireRegistrationComplete(auth.runtime(),owner,session);
    const created=await r.store.mutate(owner,{action:'create',role:'mini',amount:5000,name:'SYNTH FIXTURE',consent:true,termDays:14,requestId:c.index+'-synthetic-create'},{id:c.customerId,phoneMasked:'SYNTHETIC'}),loan=created.state.loans[0];
    assert.equal(loan.status,'kyc_approved');
    const confirmed=await r.store.mutate(owner,{action:'confirm_bill',role:'mini',loanId:loan.id,quoteId:loan.billing.quoteId,billConfirmed:true,requestId:c.index+'-synthetic-bill'},{id:c.customerId,phoneMasked:'SYNTHETIC'});
    assert(confirmed.state.loans.find(l=>l.id===loan.id).billConfirmedAt);
   }
   const counts=dbCheck(o,m);assert.equal(counts.modeMatches,true);assert.equal(counts.foreignCustomers,false);assert.equal(counts.uniqueOps,true);assert.equal(counts.audit,3);assert.throws(()=>db.prepare('DELETE FROM team_audit WHERE tenant_id=?').run(owner),/append-only/);
   const planned=cleanup(o,m),report=cleanup({...o,apply:true,confirm:planned.fingerprint},m);assert.equal(report.tombstone,true);assert.equal(report.retainedAudit,3);assert.equal(report.grayTombstones>=1,true);
   assert.deepEqual(unrelated(db,owner),before);assert.deepEqual(db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all(),triggers);
   assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);
   const output=JSON.stringify([p.summary,report,counts]);for(const secret of [o.config.accessPassword,o.config.sessionSecret,...Object.entries(o.config.bindings).filter(([k])=>/SECRET|TOKEN/.test(k)).map(([,v])=>v),...m.customers.map(c=>c.sessionToken)].filter(Boolean))assert(!output.includes(secret));
   assert(!output.includes(m.customers[0].customerId));assert.equal(hash(JSON.stringify(before)),hash(JSON.stringify(unrelated(db,owner))));
  }finally{f.close()}
 }
});

const snapshot=db=>JSON.stringify(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name})=>[name,db.prepare(`SELECT * FROM "${name}"`).all()]));
test('G1 refusals leave every table unchanged; no links, placeholders, production or unsafe operator declarations',async()=>{
 const f=await grayFixture('off');try{
  const {db,options:o}=f,before=snapshot(db),reject=change=>{assert.throws(()=>plan({...o,...change}));assert.equal(snapshot(db),before)};
  for(const change of [{d1Dir:'/tmp'},{appStopped:false},{backupRef:undefined},{backupRef:o.d1Dir+'/missing.tgz'},{outputDir:'/out'},{expectRows:'on'},{baseUrl:'https://api.khmerx.org'},{baseUrl:'https://payease.khmerx.org'},{baseUrl:'https://example.test'},{baseUrl:'http://testapi.khmerx.org'},{baseUrl:'https://testapi.khmerx.org/path'},{baseUrl:'https://testapi.khmerx.org:4430'}])reject(change);
  for(const change of [{PAYEASE_ENV:'local'},{PAYEASE_AUTH_MODE:'demo'},{KHMERX_TEST_MODE:'true'},{KYC_DATA_SECRET:'replace-with-secret'}])reject({config:{...o.config,bindings:{...o.config.bindings,...change}}});
  reject({config:JSON.parse(readFileSync('deploy/standalone/gray/config.json.example','utf8'))});
  const marker=process.env.L1G_CONTAINER;delete process.env.L1G_CONTAINER;try{reject({})}finally{process.env.L1G_CONTAINER=marker}
  const uid=process.getuid;process.getuid=()=>999;try{reject({})}finally{process.getuid=uid}
  const stat=fs.statSync;fs.statSync=(path,...args)=>{const s=stat(path,...args);if(path==='/out/manifests')s.uid=999;return s};syncBuiltinESMExports();try{reject({})}finally{fs.statSync=stat;syncBuiltinESMExports()}
  chmodSync('/out/manifests',0o755);try{reject({})}finally{chmodSync('/out/manifests',0o700)}
  utimesSync(o.backupRef,new Date(0),new Date(0));reject({});utimesSync(o.backupRef,new Date(Date.now()-1000),new Date(Date.now()-1000));
  const inside=o.d1Dir+'/backup.tgz';writeFileSync(inside,'synthetic');reject({backupRef:inside});unlinkSync(inside);
  const link='/data/d1/symlink-'+randomUUID();symlinkSync(o.d1Dir,link);reject({d1Dir:link});unlinkSync(link);
  const file=o.d1Dir+'/miniflare-D1DatabaseObject/application.sqlite',hard=file+'.hard';linkSync(file,hard);reject({});unlinkSync(hard);
  const second=file+'.sqlite',other=new DatabaseSync(second);other.exec('CREATE TABLE team_companies(id TEXT)');other.close();reject({});unlinkSync(second);
  reject({config:{...o.config,companies:[{...o.config.companies[0],id:'t_'+randomUUID()}]}});
  db.exec('BEGIN IMMEDIATE');try{reject({})}finally{db.exec('ROLLBACK')}
 }finally{f.close()}
});
test('G1 unused five datasets cleanup, rollback, ownership guards and audit preservation',async()=>{
 const f=await grayFixture('on');try{
  const {db,options:base}=f;
  for(const dataset of ['main','smoke','timeout','aux','wrong-owner']){
   const o={...base,runId:'unused-'+dataset+'-fixture',dataset,count:dataset==='main'?2:undefined},p=plan(o),m=prepare({...o,apply:true,confirm:p.fingerprint}).manifest,before=snapshot(db);
   if(dataset==='aux'){const r=await runtime(db,o.config.bindings),auth=await r.load('@/lib/h5-auth'),core=await r.load('@/lib/h5-auth-core');for(const c of m.customers)assert.equal(await core.getSession(auth.runtime(),m.target.tenantId,c.sessionToken),null)}
   assert.throws(()=>cleanup({...o,apply:true,confirm:'bad'},m));assert.equal(snapshot(db),before);
   const planned=cleanup(o,m);assert.equal(snapshot(db),before);
   assert.throws(()=>cleanup({...o,apply:true,confirm:planned.fingerprint,persist(){throw Error('synthetic disk failure')}},m));assert.equal(snapshot(db),before);
   const report=cleanup({...o,apply:true,confirm:planned.fingerprint},m);assert.equal(report.tombstone,false);assert(Object.values(report.after).every(n=>n===0));
  }
  const p=plan(base),m=prepare({...base,apply:true,confirm:p.fingerprint}).manifest,owner=m.target.tenantId;
  db.prepare('UPDATE team_units SET kind=? WHERE tenant_id=?').run('institution',owner);const before=snapshot(db);assert.throws(()=>cleanup(base,m),/Ops/);assert.equal(snapshot(db),before);
  db.prepare('UPDATE team_units SET kind=? WHERE tenant_id=?').run('department',owner);
  db.prepare('INSERT INTO loan_index(owner,customer_id,loan_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(owner,m.customers[0].customerId,'synthetic-unknown-loan','kyc_approved','synthetic','synthetic');
  const indexed=snapshot(db);assert.throws(()=>cleanup(base,m),/indexed loan/);assert.equal(snapshot(db),indexed);
 }finally{f.close()}
});
test('L1-A2 f: each ownership condition rejects atomically, including extra/missing clients',async()=>{
 const changes=[
  (db,m)=>db.prepare("UPDATE team_companies SET name='not-fixture' WHERE id=?").run(m.target.tenantId),
  (db,m)=>db.prepare("UPDATE team_companies SET default_department='wrong' WHERE id=?").run(m.target.tenantId),
  (db,m)=>db.prepare("UPDATE team_units SET kind='institution' WHERE id=?").run(m.opsDepartmentId),
  (db,m)=>db.prepare('DELETE FROM h5_accounts WHERE customer_id=?').run(m.customers[0].customerId),
  (db,m)=>db.prepare("INSERT INTO h5_accounts(customer_id,owner,phone_mask,mode,created_at) VALUES ('unrelated-extra',?,'SYNTHETIC','telegram',0)").run(m.target.tenantId),
  (db,m)=>db.prepare("UPDATE h5_sessions SET customer_id='foreign' WHERE owner=?").run(m.target.tenantId),
  (db,m)=>db.prepare("UPDATE kyc_cases SET customer_id='foreign' WHERE owner=?").run(m.target.tenantId),
  (db,m)=>db.prepare("INSERT INTO team_assignments(tenant_id,customer_id,department_id) VALUES (?,'foreign',?)").run(m.target.tenantId,m.opsDepartmentId),
  (db,m)=>db.prepare("INSERT INTO team_audit(id,tenant_id,actor,action,detail,created_at) VALUES ('synthetic-audit',?,'employee','auto_assign','{}','synthetic')").run(m.target.tenantId),
  (db,m)=>db.prepare("INSERT INTO team_audit(id,tenant_id,actor,action,detail,created_at) VALUES ('synthetic-audit',?,'system','customer_cleanup','{}','synthetic')").run(m.target.tenantId),
  (db,m)=>db.prepare("INSERT INTO team_members(id,tenant_id,user_id,email,role,unit_id) VALUES ('synthetic-member',?,'synthetic-user','synthetic@example.test','kyc',?)").run(m.target.tenantId,m.opsDepartmentId),
  (db,m)=>db.prepare("INSERT INTO public_identifiers(ref,entity_type,internal_id,tenant_id,source_channel,created_at) VALUES ('synthetic-ref','O','unknown',?,'SY','synthetic')").run(m.target.tenantId),
  (db,m)=>db.prepare("INSERT INTO customer_workspaces(owner,customer_id,revision,payload,updated_at) VALUES (?,'foreign',0,'{}','synthetic')").run(m.target.tenantId),
 ];
 for(const change of changes){const f=await grayFixture('on');try{const o={...f.options,dataset:'main',count:1},m=prepare({...o,apply:true,confirm:plan(o).fingerprint}).manifest;change(f.db,m);const before=snapshot(f.db);assert.throws(()=>cleanup(o,m));assert.throws(()=>cleanup({...o,apply:true,confirm:'not-trusted'},m));assert.equal(snapshot(f.db),before)}finally{f.close()}}
});

test('L1 P2 remaining forbidden tables, bad loan index and foreign legacy loans reject cleanup unchanged',async()=>{
 const inserts=[
  'INSERT INTO team_invites(token_hash,tenant_id,email,role,issuer,expires_at) VALUES (\'synthetic\',?,\'synthetic@example.test\',\'kyc\',\'synthetic-admin\',0)',
  'INSERT INTO kyc_files(id,owner,customer_id,slot,metadata,created_at) VALUES (\'synthetic-file\',?,\'synthetic\',\'idFront\',\'synthetic\',\'synthetic\')',
  'INSERT INTO kyc_contracts(signature_id,owner,customer_id,payload,created_at) VALUES (\'synthetic-contract\',?,\'synthetic\',\'{}\',\'synthetic\')',
  'INSERT INTO kyc_history(id,case_id,revision,owner,action,actor,snapshot,created_at) VALUES (\'synthetic-history\',\'synthetic-case\',1,?,\'draft\',\'synthetic\',\'{}\',\'synthetic\')',
  'INSERT INTO team_service_settings(tenant_id,funding_id,repayment_id,collection_id) VALUES (?,?,?,?)',
  'INSERT INTO team_service_tickets(id,tenant_id,customer_id,kind,subject,body,created_at,updated_at,created_by,updated_by) VALUES (\'synthetic-ticket\',?,\'synthetic\',\'synthetic\',\'synthetic\',\'synthetic\',\'synthetic\',\'synthetic\',\'synthetic\',\'synthetic\')',
  'INSERT INTO team_audit_manifests(id,tenant_id,digest,row_count,created_by,created_at) VALUES (\'synthetic-manifest\',?,\'synthetic\',0,\'synthetic\',\'synthetic\')',
  'INSERT INTO loan_index(owner,loan_id,customer_id,status,created_at,updated_at) VALUES (?,\'unknown\',?,\'registered\',\'synthetic\',\'synthetic\')',
  'UPDATE demo_workspaces SET payload=\'{"loans":[{"id":"foreign","customerId":"foreign"}]}\' WHERE owner=?',
 ];
 for(const [i,sql]of inserts.entries()){const f=await grayFixture('on');try{
  const o={...f.options,dataset:'main',count:1},m=prepare({...o,apply:true,confirm:plan(o).fingerprint}).manifest,owner=m.target.tenantId;
  if(i===0){f.db.prepare('INSERT INTO team_members(id,tenant_id,user_id,email,role,unit_id) VALUES (\'synthetic-admin\',?,\'synthetic\',\'synthetic@example.test\',\'admin\',?)').run(owner,m.opsDepartmentId)}
  if(i===4)for(const [suffix,kind]of [['funding','institution'],['post','postloan']])f.db.prepare('INSERT INTO team_units(id,tenant_id,name,kind) VALUES (?,?,\'synthetic\',?)').run(owner+':'+suffix,owner,kind);
  f.db.prepare(sql).run(...(i===4?[owner,owner+':funding',owner+':funding',owner+':post']:i===7?[owner,m.customers[0].customerId]:[owner]));
  const before=snapshot(f.db);assert.throws(()=>cleanup(o,m));assert.throws(()=>cleanup({...o,apply:true,confirm:'not-trusted'},m));assert.equal(snapshot(f.db),before);
 }finally{f.close()}}
});

test('G1 CLI plan/apply/db-check/cleanup sanitize output and protect private manifests',async()=>{
 const f=await grayFixture('off');try{
  const o=f.options,config='/out/config-'+randomUUID()+'.json',manifest='/out/manifests/'+o.runId+'.json',report='/out/manifests/'+o.runId+'-cleanup.json';writeFileSync(config,JSON.stringify(o.config),{mode:0o600});
  const args=['--profile','gray-config','--config',config,'--d1-dir',o.d1Dir,'--base-url',o.baseUrl,'--expect-rows','off','--dataset',o.dataset,'--run-id',o.runId,'--output-dir',o.outputDir,'--app-stopped','--backup-ref',o.backupRef];
  const run=(command,extra=[])=>execFileSync(process.execPath,['scripts/loadtest/fixture/cli.mjs',command,...args,...extra],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const planned=run('plan'),applied=run('apply',['--apply','--confirm',JSON.parse(planned).fingerprint,'--output',manifest]),checked=run('db-check',['--manifest',manifest]),cleanPlan=run('cleanup',['--manifest',manifest]),cleaned=run('cleanup',['--manifest',manifest,'--apply','--confirm',JSON.parse(cleanPlan).fingerprint,'--output',report]);
  const m=JSON.parse(readFileSync(manifest,'utf8')),output=[planned,applied,checked,cleanPlan,cleaned,readFileSync(report,'utf8')].join('');
  for(const value of [o.config.accessPassword,o.config.sessionSecret,...Object.entries(o.config.bindings).filter(([k])=>/SECRET|TOKEN/.test(k)).map(([,v])=>v),...m.customers.flatMap(c=>[c.customerId,c.sessionToken])].filter(Boolean))assert(!output.includes(value));
  const refused=spawnSync(process.execPath,['scripts/loadtest/fixture/cli.mjs','plan',...args,'--count','invalid'],{encoding:'utf8'});assert.equal(refused.status,1);assert(!refused.stderr.includes(o.config.sessionSecret));
  for(const file of [config,manifest,report])unlinkSync(file);
 }finally{f.close()}
});

test('G1 gray create without Ops fails the actual tenant scope trigger',async()=>{
 const f=await grayFixture('on');try{
  const o=f.options,m=prepare({...o,apply:true,confirm:plan(o).fingerprint}).manifest;f.db.prepare('DELETE FROM team_units WHERE id=?').run(m.opsDepartmentId);
  const r=await runtime(f.db,o.config.bindings);await assert.rejects(r.store.mutate(m.target.tenantId,{action:'create',role:'mini',amount:5000,name:'SYNTH FIXTURE',consent:true,termDays:14,requestId:'synthetic-missing-ops'},{id:m.customers[0].customerId,phoneMasked:'SYNTHETIC'}),/tenant scope mismatch/);
 }finally{f.close()}
});
