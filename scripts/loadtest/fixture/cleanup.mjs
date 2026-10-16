import {DatabaseSync} from 'node:sqlite';
import {check,hash,target,validateManifest} from './core.mjs';

const columns={h5_sessions:'owner',kyc_cases:'owner',team_assignments:'tenant_id',customer_workspaces:'owner',loan_index:'owner',public_identifiers:'tenant_id',demo_workspaces:'owner',h5_accounts:'owner',team_units:'tenant_id',team_companies:'id',team_audit:'tenant_id'};
const denied={team_members:'tenant_id',team_invites:'tenant_id',kyc_files:'owner',kyc_contracts:'owner',kyc_history:'owner',team_service_settings:'tenant_id',team_service_tickets:'tenant_id',team_audit_manifests:'tenant_id'};
function unrelated(db,owner){
 const out={};
 for(const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()){
  check(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name),'Unsupported table name');
  const rows=db.prepare(`SELECT * FROM "${name}"`).all().filter(r=>r.owner!==owner&&r.tenant_id!==owner&&!(name==='team_companies'&&r.id===owner));
  const data=rows.map(r=>JSON.stringify(r)).sort();out[name]={count:data.length,hash:hash(data.join('\n'))};
 }
 return out;
}
export function cleanup(options,manifest){
 validateManifest(manifest);const t=target(options),owner=manifest.target.tenantId,ops=manifest.opsDepartmentId;
 check(manifest.target.baseUrl===t.url.origin,'Cleanup target mismatch');
 const db=new DatabaseSync(t.file,{readOnly:!options.apply});db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
 db.exec(options.apply?'BEGIN IMMEDIATE':'BEGIN');
 try{
  const rows=(table,col=columns[table]||denied[table])=>db.prepare(`SELECT * FROM ${table} WHERE ${col}=?`).all(owner);
  const tenant=rows('team_companies')[0],units=rows('team_units'),ids=new Set(manifest.customers.map(c=>c.customerId));
  check(tenant?.name==='LOADTEST-'+manifest.runId&&tenant.slug==='loadtest-'+manifest.runId&&tenant.default_department===ops,'Tenant identity mismatch');
  check(units.length===1&&units[0].id===ops&&units[0].kind==='department','Ops set mismatch');
  const accounts=rows('h5_accounts');check(JSON.stringify(accounts.map(r=>r.customer_id).sort())===JSON.stringify([...ids].sort()),'Account set mismatch');
  const subset=table=>{const found=rows(table);check(found.every(r=>ids.has(r.customer_id)),'Foreign customer in '+table);return found};
  subset('h5_sessions');const cases=subset('kyc_cases'),assignments=subset('team_assignments');
  check(assignments.every(r=>r.department_id===ops),'Assignment department mismatch');
  const audit=rows('team_audit');check(audit.length<=ids.size&&audit.every(r=>r.actor==='system'&&['auto_assign','queue_unassigned'].includes(r.action)),'Unexpected audit');
  for(const table of Object.keys(denied))check(rows(table).length===0,'Unexpected data in '+table);
  const shards=subset('customer_workspaces'),index=subset('loan_index'),legacy=rows('demo_workspaces');
  const loans=[...legacy.flatMap(r=>JSON.parse(r.payload).loans||[]),...shards.flatMap(r=>JSON.parse(r.payload).loans||[])];
  check(loans.every(l=>ids.has(l.customerId)),'Foreign loan in payload');
  check(index.every(i=>loans.some(l=>l.id===i.loan_id&&l.customerId===i.customer_id)),'Unknown indexed loan');
  const known=new Set([...ids,...cases.map(c=>c.id),...loans.flatMap(l=>[l.id,l.id+':bill'])]);
  check(rows('public_identifiers').every(r=>known.has(r.internal_id)),'Unknown public identifier');
  const before=Object.fromEntries(Object.keys(columns).map(table=>[table,rows(table).length]));
  const externalBefore=unrelated(db,owner),auditHash=hash(JSON.stringify(audit));
  const summary={runId:manifest.runId,dataset:manifest.dataset,tenantId:owner,database:t.file,before,auditHash,manifestHash:hash(JSON.stringify(manifest)),externalBefore};
  const fingerprint=hash(JSON.stringify(summary)).slice(0,12);
  if(options.apply){
   check(options.confirm===fingerprint,'Cleanup fingerprint mismatch');
   for(const table of Object.keys(columns).filter(t=>!['team_companies','team_audit'].includes(t)))db.prepare(`DELETE FROM ${table} WHERE ${columns[table]}=?`).run(owner);
   if(audit.length)db.prepare('UPDATE team_companies SET active=0 WHERE id=?').run(owner);else db.prepare('DELETE FROM team_companies WHERE id=?').run(owner);
  }
  const after=Object.fromEntries(Object.keys(columns).map(table=>[table,rows(table).length])),externalAfter=unrelated(db,owner);
  check(JSON.stringify(externalBefore)===JSON.stringify(externalAfter),'Unrelated records changed');
  check(hash(JSON.stringify(rows('team_audit')))===auditHash,'Append-only audit changed');
  const report={...summary,fingerprint,applied:!!options.apply,after,tombstone:!!audit.length,retainedAudit:audit.length,externalAfter};
  options.persist?.(report);db.exec('COMMIT');return report;
 }catch(e){db.exec('ROLLBACK');throw e}finally{db.close()}
}
