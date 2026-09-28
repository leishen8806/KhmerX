import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
test('service migration enables isolated defaults and backfills existing customer assignments',()=>{
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')&&!f.startsWith('0013')).sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8'));
 for(const id of ['one','two']){
  db.prepare('INSERT INTO team_companies(id,name,slug,default_department) VALUES (?,?,?,?)').run(id,id,id,'dept:'+id);
  db.prepare("INSERT INTO team_units(id,tenant_id,name,kind) VALUES (?,?,?,'department')").run('dept:'+id,id,'Operations');
  db.prepare('INSERT INTO team_assignments(tenant_id,customer_id,department_id) VALUES (?,?,?)').run(id,'customer:'+id,'dept:'+id);
 }
 db.exec(fs.readFileSync('drizzle/0013_service_routing.sql','utf8'));
 for(const id of ['one','two']){
  const s=db.prepare('SELECT * FROM team_service_settings WHERE tenant_id=?').get(id),a=db.prepare('SELECT * FROM team_assignments WHERE tenant_id=?').get(id);
  assert.equal(s.auto_assign,1);assert.equal(a.funding_institution_id,s.funding_id);assert.equal(a.repayment_institution_id,s.repayment_id);assert.equal(a.collection_unit_id,s.collection_id);assert.equal(a.institution_id,null);
 }
 assert.throws(()=>db.prepare("UPDATE team_service_settings SET funding_id='funding:two' WHERE tenant_id='one'").run(),/scope/);
 assert.throws(()=>db.prepare("UPDATE team_assignments SET repayment_institution_id='repayment:two' WHERE tenant_id='one'").run(),/scope/);
});
