import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {auditMaterialRead} from '../lib/kyc/material-read-audit.ts';
function fixture(){const sql=new DatabaseSync(':memory:');sql.exec("PRAGMA foreign_keys=ON; CREATE TABLE team_companies(id TEXT PRIMARY KEY); CREATE TABLE team_audit(id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL,FOREIGN KEY(tenant_id) REFERENCES team_companies(id)); INSERT INTO team_companies VALUES ('tenant-a'),('tenant-b');");const db={prepare(query){return {bind(...args){const statement=sql.prepare(query);return {async run(){return {meta:{changes:Number(statement.run(...args).changes)}}}}}}}};return {sql,db};}
const base={tenantId:'tenant-a',actorId:'reviewer-a',caseId:'case-1',revision:3,slot:'idFront',fileId:'file-1',action:'thumbnail',requestId:'req-1'};
test('same material/action/actor in one 30-second bucket dedupes 20 different requests and keeps first request id',async()=>{const f=fixture(),t=Date.parse('2026-10-26T08:00:12.000Z');for(let i=0;i<20;i++)await auditMaterialRead({...base,requestId:`req-${i}`},t+i*500,f.db);assert.equal(f.sql.prepare('SELECT count(*) n FROM team_audit').get().n,1);assert.equal(JSON.parse(f.sql.prepare('SELECT detail FROM team_audit').get().detail).requestId,'req-0');f.sql.close();});
test('two module instances share one key and dimensions create independent rows',async()=>{const f=fixture(),t=Date.parse('2026-10-26T08:00:12.000Z');const a=await auditMaterialRead(base,t,f.db);const second=await import(`../lib/kyc/material-read-audit.ts?instance=two`);const b=await second.auditMaterialRead({...base,requestId:'req-2'},t,f.db);const c=await auditMaterialRead({...base,fileId:'file-2'},t,f.db);const d=await auditMaterialRead({...base,action:'preview'},t,f.db);assert.equal(a.id,b.id);assert.equal(f.sql.prepare('SELECT count(*) n FROM team_audit').get().n,3);assert.deepEqual(Object.keys(JSON.parse(f.sql.prepare('SELECT detail FROM team_audit LIMIT 1').get().detail)),['caseId','revision','slot','fileId','action','requestId']);assert.notEqual(c.id,d.id);f.sql.close();});
test('validates slot/action/ids/revision/time and never writes on invalid input',async()=>{const f=fixture();for(const bad of [{slot:'nope'},{action:'thumbnail_load'},{caseId:''},{fileId:''},{requestId:''},{revision:0},{revision:1.2}])await assert.rejects(auditMaterialRead({...base,...bad},0,f.db));await assert.rejects(auditMaterialRead(base,NaN,f.db));assert.equal(f.sql.prepare('SELECT count(*) n FROM team_audit').get().n,0);f.sql.close();});
test('uses actual write time, respects 29.9/30.1 boundaries, and propagates FK failure for retry',async()=>{const f=fixture(),t=Date.parse('2026-10-26T08:00:12.000Z'),boundary=Date.parse('2026-10-26T08:00:00.000Z');const row=await auditMaterialRead(base,t,f.db);assert.equal(row.createdAt,'2026-10-26T08:00:12.000Z');const edge=await auditMaterialRead({...base,fileId:'edge'},boundary+29_900,f.db);const next=await auditMaterialRead({...base,fileId:'edge'},boundary+30_100,f.db);assert.notEqual(edge.id,next.id);await assert.rejects(auditMaterialRead({...base,tenantId:'missing'},t,f.db),/FOREIGN KEY/);assert.equal(f.sql.prepare('SELECT count(*) n FROM team_audit').get().n,3);f.sql.close();});

test('dedupe key keeps actor independent in one bucket',async()=>{
 const f=fixture(),t=Date.parse('2026-10-26T08:00:12.000Z');
 const a=await auditMaterialRead({...base,actorId:'reviewer-a'},t,f.db);
 const b=await auditMaterialRead({...base,actorId:'reviewer-b'},t,f.db);
 assert.equal(a.inserted,true);assert.equal(b.inserted,true);assert.notEqual(a.id,b.id);
 assert.deepEqual(f.sql.prepare('SELECT actor FROM team_audit ORDER BY actor').all().map(row=>row.actor),['reviewer-a','reviewer-b']);
 assert.equal((await auditMaterialRead({...base,actorId:'reviewer-a'},t,f.db)).inserted,false);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM team_audit').get().n,2);f.sql.close();
});

test('dedupe key keeps revision independent in one bucket',async()=>{
 const f=fixture(),t=Date.parse('2026-10-26T08:00:12.000Z');
 const a=await auditMaterialRead({...base,revision:3},t,f.db);
 const b=await auditMaterialRead({...base,revision:4},t,f.db);
 assert.equal(a.inserted,true);assert.equal(b.inserted,true);assert.notEqual(a.id,b.id);
 assert.deepEqual(f.sql.prepare('SELECT detail FROM team_audit').all().map(row=>JSON.parse(row.detail).revision).sort(),[3,4]);
 assert.equal((await auditMaterialRead({...base,revision:3},t,f.db)).inserted,false);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM team_audit').get().n,2);f.sql.close();
});

test('dedupe key keeps case independent when file is unchanged',async()=>{
 const f=fixture(),t=Date.parse('2026-10-26T08:00:12.000Z');
 const a=await auditMaterialRead({...base,caseId:'case-1'},t,f.db);
 const b=await auditMaterialRead({...base,caseId:'case-2'},t,f.db);
 assert.equal(a.inserted,true);assert.equal(b.inserted,true);assert.notEqual(a.id,b.id);
 assert.deepEqual(f.sql.prepare('SELECT detail FROM team_audit').all().map(row=>JSON.parse(row.detail).caseId).sort(),['case-1','case-2']);
 assert.equal((await auditMaterialRead({...base,caseId:'case-1'},t,f.db)).inserted,false);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM team_audit').get().n,2);f.sql.close();
});

test('dedupe key keeps slot independent when file is unchanged',async()=>{
 const f=fixture(),t=Date.parse('2026-10-26T08:00:12.000Z');
 const a=await auditMaterialRead({...base,slot:'idFront',fileId:'file-1'},t,f.db);
 const b=await auditMaterialRead({...base,slot:'idBack',fileId:'file-1'},t,f.db);
 assert.equal(a.inserted,true);assert.equal(b.inserted,true);assert.notEqual(a.id,b.id);
 assert.deepEqual(f.sql.prepare('SELECT detail FROM team_audit').all().map(row=>JSON.parse(row.detail).slot).sort(),['idBack','idFront']);
 assert.equal((await auditMaterialRead({...base,slot:'idFront',fileId:'file-1'},t,f.db)).inserted,false);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM team_audit').get().n,2);f.sql.close();
});

test('dedupe key keeps tenant independent in one bucket',async()=>{
 const f=fixture(),t=Date.parse('2026-10-26T08:00:12.000Z');
 const a=await auditMaterialRead({...base,tenantId:'tenant-a'},t,f.db);
 const b=await auditMaterialRead({...base,tenantId:'tenant-b'},t,f.db);
 assert.equal(a.inserted,true);assert.equal(b.inserted,true);assert.notEqual(a.id,b.id);
 assert.deepEqual(f.sql.prepare('SELECT tenant_id FROM team_audit ORDER BY tenant_id').all().map(row=>row.tenant_id),['tenant-a','tenant-b']);
 assert.equal((await auditMaterialRead({...base,tenantId:'tenant-a'},t,f.db)).inserted,false);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM team_audit').get().n,2);f.sql.close();
});

test('inserted reflects the first write and same-bucket duplicate result',async()=>{
 const f=fixture(),t=Date.parse('2026-10-26T08:00:12.000Z');
 const first=await auditMaterialRead(base,t,f.db),second=await auditMaterialRead(base,t,f.db);
 assert.equal(first.inserted,true);assert.equal(second.inserted,false);
 assert.equal(second.id,first.id);assert.equal(second.bucket,first.bucket);assert.equal(second.createdAt,first.createdAt);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM team_audit').get().n,1);f.sql.close();
});

test('only primary-key conflicts are ignored',async()=>{
 const f=fixture(),t=Date.parse('2026-10-26T08:00:12.000Z');
 f.sql.exec('CREATE UNIQUE INDEX team_audit_actor_action_time ON team_audit(tenant_id,actor,action,created_at)');
 const first=await auditMaterialRead(base,t,f.db);
 assert.equal(first.inserted,true);
 await assert.rejects(auditMaterialRead({...base,fileId:'file-2'},t,f.db),/UNIQUE/);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM team_audit').get().n,1);
 const duplicate=await auditMaterialRead(base,t,f.db);
 assert.equal(duplicate.inserted,false);assert.equal(duplicate.id,first.id);
 assert.equal(f.sql.prepare('SELECT count(*) n FROM team_audit').get().n,1);f.sql.close();
});
