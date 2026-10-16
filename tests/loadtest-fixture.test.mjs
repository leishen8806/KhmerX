import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,readdirSync,rmSync,writeFileSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createDecipheriv,hkdfSync} from 'node:crypto';
import {plan,prepare,hash,sealCase} from '../scripts/loadtest/fixture/core.mjs';
import {writer,privateFile} from '../scripts/loadtest/fixture/private-file.mjs';
import {preflight} from '../scripts/loadtest/rows-preflight.mjs';

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
  w.persist(m);privateFile(file);assert.throws(()=>w.persist(m));w.rollback();assert.throws(()=>privateFile(file));
  assert.throws(()=>writer(f.options.root,join(f.options.root,'public.manifest.json')));
 }finally{f.close()}
});
