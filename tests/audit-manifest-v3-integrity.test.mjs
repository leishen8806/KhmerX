import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHmac} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root=path.resolve('.');
const secret='audit-integrity-test-secret-'.repeat(2);
const tenant='t_audit_v3';

function canonical(rows){return rows.map(row=>JSON.stringify([row.id,row.actor,row.action,row.detail,row.created_at])).join('\n')}
function digest(rows,version=2){return `v${version}:`+createHmac('sha256',secret).update(canonical(rows)).digest('hex')}
function hasSql(source){return source.split('\n').some(line=>{const value=line.trim();return value&&!value.startsWith('--')})}
function migrations(sql){
  for(const file of fs.readdirSync('drizzle').filter(file=>/^[0-9]{4}_.*[.]sql$/.test(file)).sort()){
    const number=Number(file.slice(0,4));
    if(number>61||!hasSql(fs.readFileSync(path.join('drizzle',file),'utf8')))continue;
    sql.exec(fs.readFileSync(path.join('drizzle',file),'utf8'));
  }
}
function insertAudit(sql,id,createdAt,detail='{}',seq){
  if(seq===undefined)sql.prepare('INSERT INTO team_audit(id,tenant_id,actor,action,detail,created_at) VALUES(?,?,?,?,?,?)').run(id,tenant,'reviewer','decision',detail,createdAt);
  else sql.prepare('INSERT INTO team_audit(id,seq,tenant_id,actor,action,detail,created_at) VALUES(?,?,?,?,?,?,?)').run(id,seq,tenant,'reviewer','decision',detail,createdAt);
}
function createDb({withV2=false}={}){
  const sql=new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  migrations(sql);
  sql.prepare('INSERT INTO team_companies(id,name,slug,active,default_department) VALUES(?,?,?,?,?)').run(tenant,'Audit Test','audit-test',1,'dept');
  insertAudit(sql,'history-2','2026-01-01T00:00:00.000Z','{"n":2}');
  insertAudit(sql,'history-1','2025-01-01T00:00:00.000Z','{"n":1}');
  if(withV2){
    const rows=sql.prepare('SELECT id,actor,action,detail,created_at FROM team_audit WHERE tenant_id=? ORDER BY created_at,id').all(tenant);
    const last=rows.at(-1);
    sql.prepare('INSERT INTO team_audit_manifests(id,tenant_id,digest,row_count,first_created_at,last_created_at,last_id,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run('manifest-v2',tenant,digest(rows,2),rows.length,rows[0].created_at,last.created_at,last.id,'admin','2026-01-02T00:00:00.000Z');
  }
  sql.exec(fs.readFileSync('drizzle/0062_audit_manifest_v3_seq.sql','utf8'));
  return sql;
}
function dbAdapter(sql){return {prepare(query){return {bind(...args){const statement=sql.prepare(query);return {async first(){return statement.get(...args)||null},async all(){return {results:statement.all(...args)}},async run(){return {meta:{changes:Number(statement.run(...args).changes)}}}}}}}}}
async function loadIntegrity(sql){
  const DB=dbAdapter(sql);
  const env={PAYEASE_AUTH_SECRET:secret};
  const staff=async()=>({tenant:{id:tenant},member:{role:'admin'},user:{userId:'admin'}});
  const audit=(tenantId,actor,action,detail)=>({async run(){const id=crypto.randomUUID();const now=new Date().toISOString();sql.prepare('INSERT INTO team_audit(id,seq,tenant_id,actor,action,detail,created_at) SELECT ?,COALESCE((SELECT MAX(seq) FROM team_audit),0)+1,?,?,?,?,? WHERE 1=1').run(id,tenantId,actor,action,JSON.stringify(detail),now);return {meta:{changes:1}}}});
  const context=vm.createContext({console,crypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Date,structuredClone});
  const cache=new Map();
  function synth(id,values){const module=new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value)},{context,identifier:id});cache.set(id,module);return module}
  const serverId=path.join(root,'lib/team/server.ts');
  synth('cloudflare:workers',{env});
  synth('@/lib/h5-auth-core',{AuthError:class AuthError extends Error{constructor(message,status=400){super(message);this.status=status}}});
  synth(serverId,{db:()=>DB,staff,audit});
  function moduleFor(specifier,base=root+'/entry.ts'){
    let id=specifier;
    if(specifier.startsWith('@/'))id=path.join(root,specifier.slice(2));
    else if(specifier.startsWith('.'))id=path.resolve(path.dirname(base),specifier);
    if(id===serverId)return cache.get(serverId);
    if(!path.extname(id)&&fs.existsSync(`${id}.ts`))id+='.ts';
    if(cache.has(id))return cache.get(id);
    const source=ts.transpileModule(fs.readFileSync(id,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
    const module=new vm.SourceTextModule(source,{context,identifier:id});cache.set(id,module);return module;
  }
  const module=moduleFor('@/lib/team/audit-integrity');
  if(module.status==='unlinked')await module.link((specifier,referencing)=>moduleFor(specifier,referencing.identifier));
  if(module.status==='linked')await module.evaluate();
  return module.namespace;
}

test('real v3 verifier accepts migration backfill and later append',async()=>{
  const sql=createDb();
  const integrity=await loadIntegrity(sql);
  const manifest=await integrity.createManifest();
  assert.equal(manifest.version,3);
  const baseline=await integrity.verifyManifest(manifest.id);
  assert.equal(baseline.match,true);
  assert.equal(baseline.appendedRows,0);
  sql.prepare('INSERT INTO team_audit(id,seq,tenant_id,actor,action,detail,created_at) SELECT ?,COALESCE((SELECT MAX(seq) FROM team_audit),0)+1,?,?,?,?,?').run('after-manifest',tenant,'reviewer','decision','{"n":3}','2027-01-01T00:00:00.000Z');
  const verified=await integrity.verifyManifest(manifest.id);
  assert.equal(verified.match,true);
  assert.equal(verified.tampered,false);
  assert.equal(verified.appendedRows,1);
  sql.close();
});

test('real v3 verifier reports tampering after detail mutation',async()=>{
  const sql=createDb();const integrity=await loadIntegrity(sql);const manifest=await integrity.createManifest();
  sql.exec('DROP TRIGGER team_audit_no_update');
  sql.prepare('UPDATE team_audit SET detail=? WHERE id=?').run('{"tampered":true}','history-1');
  const verified=await integrity.verifyManifest(manifest.id);
  assert.equal(verified.tampered,true);assert.equal(verified.match,false);sql.close();
});

test('real v3 verifier reports tampering after deletion',async()=>{
  const sql=createDb();const integrity=await loadIntegrity(sql);const manifest=await integrity.createManifest();
  sql.exec('DROP TRIGGER team_audit_no_delete');
  sql.prepare('DELETE FROM team_audit WHERE id=?').run('history-1');
  const verified=await integrity.verifyManifest(manifest.id);
  assert.equal(verified.tampered,true);assert.equal(verified.match,false);sql.close();
});

test('real verifier keeps a pre-migration v2 manifest compatible',async()=>{
  const sql=createDb({withV2:true});const integrity=await loadIntegrity(sql);const verified=await integrity.verifyManifest('manifest-v2');
  assert.equal(verified.version,2);assert.equal(verified.match,true);assert.equal(verified.tampered,false);sql.close();
});

test('real v3 verifier requires manual review when seq is NULL',async()=>{
  const sql=createDb();const integrity=await loadIntegrity(sql);const manifest=await integrity.createManifest();
  sql.exec('DROP TRIGGER team_audit_no_update');
  sql.prepare('UPDATE team_audit SET seq=NULL WHERE id=?').run('history-1');
  const verified=await integrity.verifyManifest(manifest.id);
  assert.equal(verified.needsManualReview,true);assert.equal(verified.match,false);assert.equal(verified.tampered,false);sql.close();
});
