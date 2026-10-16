import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,readdirSync,rmSync,writeFileSync,statSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createDecipheriv,hkdfSync} from 'node:crypto';
import {plan,prepare,hash,sealCase} from '../scripts/loadtest/fixture/core.mjs';
import {writer,privateFile} from '../scripts/loadtest/fixture/private-file.mjs';
import {preflight} from '../scripts/loadtest/rows-preflight.mjs';
import {cleanup} from '../scripts/loadtest/fixture/cleanup.mjs';
import {runtime} from '../scripts/loadtest/fixture/test-runtime.mjs';

export function fixture(){
 const root=mkdtempSync(join(tmpdir(),'khmerx-l1-'));mkdirSync(join(root,'.wrangler/state'),{recursive:true});
 const database=join(root,'.wrangler/state/test.sqlite'),db=new DatabaseSync(database);
 db.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync(join('drizzle',f),'utf8'));
 const config={host:'localhost',bindings:{PAYEASE_ENV:'local',PAYEASE_AUTH_MODE:'demo',KHMERX_TEST_MODE:'true',CUSTOMER_ROWS:'on',KYC_DATA_SECRET:'synthetic-fixture-secret-'.repeat(2)}};
 const options={root,database,config,profile:'local-harness',baseUrl:'http://127.0.0.1:8788',runId:'synthetic-fixture-1',dataset:'main',count:600};
 return {options,db,close(){db.close();assert(root.startsWith(join(tmpdir(),'khmerx-l1-')));rmSync(root,{recursive:true,force:true})}};
}
export const applied=o=>prepare({...o,apply:true,confirm:plan(o).fingerprint}).manifest;
test('L1-A1 read-only plan, 600 unique hashed sessions, compatible encryption and Ops',()=>{
 const f=fixture();try{
  const {options:o,db}=f,size=statSync(o.database).size;plan(o);assert.equal(db.prepare('SELECT COUNT(*) n FROM h5_accounts').get().n,0);assert.equal(statSync(o.database).size,size);
  assert.throws(()=>prepare({...o,apply:true,confirm:'wrong'}),/fingerprint/);
  const m=applied(o);assert.equal(preflight(m,{vus:600,baseUrl:o.baseUrl,mode:'on'}).customers,600);
  assert.equal(db.prepare('SELECT token_hash FROM h5_sessions WHERE customer_id=?').get(m.customers[0].customerId).token_hash,hash(m.customers[0].sessionToken));
  assert.equal(db.prepare('SELECT password_hash FROM h5_accounts LIMIT 1').get().password_hash,null);
  assert.equal(db.prepare('SELECT kind FROM team_units WHERE id=?').get(m.opsDepartmentId).kind,'department');
  for(const table of ['customer_workspaces','loan_index','team_assignments','team_members','team_audit','team_service_settings'])assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,0);
  const row=db.prepare('SELECT id,payload FROM kyc_cases LIMIT 1').get(),b=Buffer.from(row.payload,'base64'),id=b.subarray(3,3+b[2]).toString(),offset=3+b[2];
  const key=hkdfSync('sha256',Buffer.from(o.config.bindings.KYC_DATA_SECRET),Buffer.from('payease-kyc-salt:'+id),Buffer.from('payease-kyc-aes-gcm-v2'),32),d=createDecipheriv('aes-256-gcm',key,b.subarray(offset,offset+12));
  d.setAAD(Buffer.from('case:'+row.id));d.setAuthTag(b.subarray(-16));assert.equal(JSON.parse(Buffer.concat([d.update(b.subarray(offset+12,-16)),d.final()])).phoneVerified,true);
  assert.throws(()=>applied(o),/exists/);
 }finally{f.close()}
});
test('L1-A1 five isolated datasets; expired/revoked auxiliaries and empty wrong-owner',()=>{
 const f=fixture();try{const ids=new Set();for(const dataset of ['smoke','main','timeout','aux','wrong-owner']){
  const o={...f.options,runId:'synthetic-'+dataset,dataset,count:undefined},m=applied(o);assert(!ids.has(m.target.tenantId));ids.add(m.target.tenantId);
  assert.equal(m.customers.length,{smoke:3,main:50,timeout:3,aux:6,'wrong-owner':0}[dataset]);
  const owner=m.target.tenantId;assert.equal(f.db.prepare('SELECT COUNT(*) n FROM kyc_cases WHERE owner=?').get(owner).n,['aux','wrong-owner'].includes(dataset)?0:m.customers.length);
  if(dataset==='aux'){const rows=f.db.prepare('SELECT s.expires_at,a.credential_version FROM h5_sessions s JOIN h5_accounts a ON s.customer_id=a.customer_id WHERE s.owner=?').all(owner);assert.equal(rows.filter(r=>r.expires_at<Date.now()/1000).length,3);assert.equal(rows.filter(r=>r.credential_version===1).length,3)}
 }}finally{f.close()}
});
test('L1-A1 target/preflight rejects ambiguity, production, paths, duplicates and expiry',()=>{
 const f=fixture();try{
  const o=f.options;
  for(const change of [{profile:undefined},{profile:'gray-config'},{baseUrl:'https://api.khmerx.org'},{baseUrl:'file://localhost/a'},{config:undefined},{config:{...o.config,host:'API.KHMERX.ORG.'}},{config:{bindings:{...o.config.bindings,PAYEASE_ENV:'gray'}}},{config:{bindings:{...o.config.bindings,PAYEASE_AUTH_MODE:'disabled'}}},{config:{...o.config,bindings:{...o.config.bindings,CUSTOMER_ROWS:undefined}}},{config:{...o.config,bindings:{...o.config.bindings,KYC_DATA_SECRET:''}}},{dataset:'bad'},{count:0},{runId:'../unsafe'}])assert.throws(()=>plan({...o,...change}));
  const outside=join(o.root,'outside.sqlite');writeFileSync(outside,'');assert.throws(()=>plan({...o,database:outside}),/inside/);
  const empty=join(o.root,'.wrangler/state/empty.sqlite');new DatabaseSync(empty).close();assert.throws(()=>plan({...o,database:empty}),/schema/);
  assert.throws(()=>sealCase('id','synthetic','invalid key'));
  const m=applied({...o,count:2}),p={vus:2,baseUrl:o.baseUrl,mode:'on'};
  for(const change of [{expiresAt:new Date(0).toISOString()},{integrity:{count:2,sha256:'bad'}},{customers:[m.customers[0],m.customers[0]]},{synthetic:false}])assert.throws(()=>preflight({...m,...change},p));
  for(const change of [{vus:3},{mode:'off'},{dataset:'aux'},{baseUrl:'http://localhost:9999'},{duration:Infinity}])assert.throws(()=>preflight(m,{...p,...change}));
  assert.throws(()=>prepare({...o,runId:'rollback-fixture',apply:true,confirm:plan({...o,runId:'rollback-fixture'}).fingerprint,persist(){throw Error('synthetic disk failure')}}),/disk/);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM team_companies').get().n,1);
 }finally{f.close()}
});
test('L1-A1 private file permissions, no overwrite and persistence rollback',()=>{
 const f=fixture();try{
  const file=join(f.options.root,'scripts/loadtest/manifests/private.manifest.json'),w=writer(f.options.root,file),m=applied({...f.options,count:1});
  w.persist(m);privateFile(file);if(process.platform!=='win32'){chmodSync(file,0o644);assert.throws(()=>privateFile(file),/600/);chmodSync(file,0o600)}assert.throws(()=>w.persist(m));w.rollback();assert.throws(()=>privateFile(file));
  assert.throws(()=>writer(f.options.root,join(f.options.root,'public.manifest.json')));
 }finally{f.close()}
});

const snapshot=db=>JSON.stringify(db.prepare("SELECT name,sql FROM sqlite_master ORDER BY name").all())+'\n'+JSON.stringify(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name})=>[name,db.prepare(`SELECT * FROM "${name}"`).all()]));
const createInput={action:'create',role:'mini',amount:5000,name:'SYNTH FIXTURE',consent:true,termDays:14,requestId:'synthetic-create-1'};
test('L1-A2 a,b,d,e,g,h: real create/confirm and cleanup retain immutable audit; unrelated data unchanged',async()=>{
 for(const mode of ['off','on']){
  const f=fixture();try{
   const o={...f.options,count:3,config:{...f.options.config,bindings:{...f.options.config.bindings,CUSTOMER_ROWS:mode,PAYEASE_AUTH_SECRET:'synthetic-auth-'.repeat(4)}}},m=applied(o),owner=m.target.tenantId;
   const other=applied({...o,runId:'unrelated-'+mode,count:1});
   const foreignBefore=JSON.stringify(f.db.prepare('SELECT * FROM h5_accounts WHERE owner=?').all(other.target.tenantId));
   const triggers=f.db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all(),r=await runtime(f.db,o.config.bindings);r.select(owner);
   const kyc=await r.load('@/lib/kyc/server'),auth=await r.load('@/lib/h5-auth'),authCore=await r.load('@/lib/h5-auth-core'),registration=await r.load('@/lib/registration-policy');
   for(const c of m.customers){
    assert.equal((await kyc.payload(await kyc.findCase(owner,c.customerId))).phoneVerified,true);
    const session=await authCore.getSession(auth.runtime(),owner,c.sessionToken);assert.equal(session.customerId,c.customerId);await registration.requireRegistrationComplete(auth.runtime(),owner,session);
    const created=await r.store.mutate(owner,{...createInput,requestId:`${o.runId}-${c.index}-create`},{id:c.customerId,phoneMasked:'SYNTHETIC'}),loan=created.state.loans[0];assert.equal(loan.status,'kyc_approved');
    const confirmed=await r.store.mutate(owner,{action:'confirm_bill',role:'mini',loanId:loan.id,quoteId:loan.billing.quoteId,billConfirmed:true,requestId:`${o.runId}-${c.index}-bill`},{id:c.customerId,phoneMasked:'SYNTHETIC'});assert(confirmed.state.loans.find(x=>x.id===loan.id).billConfirmedAt);
   }
   assert.equal(f.db.prepare('SELECT COUNT(*) n FROM team_assignments WHERE tenant_id=? AND department_id=?').get(owner,m.opsDepartmentId).n,3);
   assert.equal(f.db.prepare('SELECT COUNT(*) n FROM team_audit WHERE tenant_id=?').get(owner).n,3);
   assert.equal(f.db.prepare('SELECT COUNT(*) n FROM customer_workspaces WHERE owner=?').get(owner).n,mode==='on'?3:0);
   const auditBefore=JSON.stringify(f.db.prepare('SELECT * FROM team_audit WHERE tenant_id=?').all(owner)),before=snapshot(f.db),p=cleanup(o,m);assert.equal(snapshot(f.db),before);
   assert.throws(()=>cleanup({...o,apply:true,confirm:'wrong'},m));assert.equal(snapshot(f.db),before);
   assert.throws(()=>cleanup({...o,apply:true,confirm:p.fingerprint,persist(){throw Error('synthetic report failure')}},m),/report/);assert.equal(snapshot(f.db),before);
   const report=cleanup({...o,apply:true,confirm:p.fingerprint},m);assert.equal(report.retainedAudit,3);assert.equal(report.tombstone,true);
   assert(m.customers.every(c=>!JSON.stringify(report).includes(c.sessionToken)));
   for(const [t,n]of Object.entries(report.after))assert.equal(n,t==='team_audit'?3:t==='team_companies'?1:0,t);
   assert.equal(f.db.prepare('SELECT active FROM team_companies WHERE id=?').get(owner).active,0);
   assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM team_audit WHERE tenant_id=?').all(owner)),auditBefore);
   assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM h5_accounts WHERE owner=?').all(other.target.tenantId)),foreignBefore);
   assert.equal(f.db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);assert.deepEqual(f.db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all(),triggers);
   assert.throws(()=>f.db.prepare('DELETE FROM team_audit WHERE tenant_id=?').run(owner),/append-only/);
  }finally{f.close()}
 }
});
test('L1-A2 c: real create without Ops fails the tenant scope trigger',async()=>{
 const f=fixture();try{
  const o={...f.options,count:1},m=applied(o);f.db.prepare('DELETE FROM team_units WHERE id=?').run(m.opsDepartmentId);
  const r=await runtime(f.db,o.config.bindings);await assert.rejects(r.store.mutate(m.target.tenantId,createInput,{id:m.customers[0].customerId,phoneMasked:'SYNTHETIC'}),/tenant scope mismatch/);
 }finally{f.close()}
});
test('L1-A2 d: unused datasets delete fully; aux sessions fail actual authentication',async()=>{
 const f=fixture();try{for(const dataset of ['main','smoke','timeout','aux','wrong-owner']){
  const o={...f.options,dataset,runId:'unused-'+dataset,count:undefined},m=applied(o);
  if(dataset==='aux'){
   const r=await runtime(f.db,{...o.config.bindings,PAYEASE_AUTH_SECRET:'synthetic-auth-'.repeat(4)}),auth=await r.load('@/lib/h5-auth'),core=await r.load('@/lib/h5-auth-core');
   for(const c of m.customers)assert.equal(await core.getSession(auth.runtime(),m.target.tenantId,c.sessionToken),null);
  }
  const p=cleanup(o,m),result=cleanup({...o,apply:true,confirm:p.fingerprint},m);assert.equal(result.tombstone,false);assert(Object.values(result.after).every(n=>n===0));
 }}finally{f.close()}
});
test('L1-A2 f: each ownership condition rejects atomically, including extra/missing clients',()=>{
 const changes=[
  (db,m)=>db.prepare("UPDATE team_companies SET name='not-fixture' WHERE id=?").run(m.target.tenantId),
  (db,m)=>db.prepare("UPDATE team_companies SET default_department='wrong' WHERE id=?").run(m.target.tenantId),
  (db,m)=>db.prepare("UPDATE team_units SET kind='institution' WHERE id=?").run(m.opsDepartmentId),
  (db,m)=>db.prepare('DELETE FROM h5_accounts WHERE customer_id=?').run(m.customers[0].customerId),
  (db,m)=>db.prepare("INSERT INTO h5_accounts(customer_id,owner,phone_mask,mode,created_at) VALUES ('unrelated-extra',?,'SYNTHETIC','demo',0)").run(m.target.tenantId),
  (db,m)=>db.prepare("UPDATE h5_sessions SET customer_id='foreign' WHERE owner=?").run(m.target.tenantId),
  (db,m)=>db.prepare("UPDATE kyc_cases SET customer_id='foreign' WHERE owner=?").run(m.target.tenantId),
  (db,m)=>db.prepare("INSERT INTO team_assignments(tenant_id,customer_id,department_id) VALUES (?,'foreign',?)").run(m.target.tenantId,m.opsDepartmentId),
  (db,m)=>db.prepare("INSERT INTO team_audit(id,tenant_id,actor,action,detail,created_at) VALUES ('synthetic-audit',?,'employee','auto_assign','{}','synthetic')").run(m.target.tenantId),
  (db,m)=>db.prepare("INSERT INTO team_audit(id,tenant_id,actor,action,detail,created_at) VALUES ('synthetic-audit',?,'system','customer_cleanup','{}','synthetic')").run(m.target.tenantId),
  (db,m)=>db.prepare("INSERT INTO team_members(id,tenant_id,user_id,email,role,unit_id) VALUES ('synthetic-member',?,'synthetic-user','synthetic@example.test','kyc',?)").run(m.target.tenantId,m.opsDepartmentId),
  (db,m)=>db.prepare("INSERT INTO public_identifiers(ref,entity_type,internal_id,tenant_id,source_channel,created_at) VALUES ('synthetic-ref','O','unknown',?,'SY','synthetic')").run(m.target.tenantId),
  (db,m)=>db.prepare("INSERT INTO customer_workspaces(owner,customer_id,revision,payload,updated_at) VALUES (?,'foreign',0,'{}','synthetic')").run(m.target.tenantId),
 ];
 for(const change of changes){const f=fixture();try{const o={...f.options,count:1},m=applied(o);change(f.db,m);const before=snapshot(f.db);assert.throws(()=>cleanup(o,m));assert.throws(()=>cleanup({...o,apply:true,confirm:'not-trusted'},m));assert.equal(snapshot(f.db),before)}finally{f.close()}}
});
