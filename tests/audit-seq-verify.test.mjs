import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script=fileURLToPath(new URL('../scripts/audit-seq-verify.mjs',import.meta.url));
function fixture(rows){
  const directory=mkdtempSync(join(tmpdir(),'audit-seq-verify-'));
  const file=join(directory,'audit.sqlite');
  const db=new DatabaseSync(file);
  db.exec('CREATE TABLE team_audit(id TEXT PRIMARY KEY,seq INTEGER,tenant_id TEXT,actor TEXT,action TEXT,detail TEXT,created_at TEXT); CREATE TABLE team_audit_manifests(id TEXT PRIMARY KEY,version INTEGER,tenant_id TEXT,digest TEXT,row_count INTEGER,last_created_at TEXT,last_id TEXT,created_at TEXT);');
  const insert=db.prepare('INSERT INTO team_audit(id,seq,tenant_id,actor,action,detail,created_at) VALUES(?,?,?,?,?,?,?)');
  for(const row of rows)insert.run(...row);
  db.close();
  return {file,directory};
}
function run(file,...args){return spawnSync(process.execPath,[script,'--db',file,...args],{encoding:'utf8',env:{...process.env,PAYEASE_AUTH_SECRET:''}})}

test('verifier reports nulls, uniqueness, ordering and v2 comparison without writing',()=>{
  const f=fixture([
    ['early',1,'t','u','x','{}','2025-01-01T00:00:00.000Z'],
    ['same-b',3,'t','u','x','{}','2026-01-01T00:00:00.000Z'],
    ['same-a',2,'t','u','x','{}','2026-01-01T00:00:00.000Z']
  ]);
  const result=run(f.file);assert.equal(result.status,0);const report=JSON.parse(result.stdout);
  assert.equal(report.mode,'verify-read-only');assert.equal(report.version,'v3');assert.equal(report.rows,3);assert.equal(report.canonicalBytes>0,true);assert.equal(typeof report.elapsedMs,'number');assert.equal(report.seqNull.count,0);assert.equal(report.seqUnique,true);assert.equal(report.orderCheck,'skipped');assert.equal(report.v2Verify.available,true);assert.equal(report.v2Verify.secretAvailable,false);rmSync(f.directory,{recursive:true,force:true});
});

test('backfill order is scoped to the recorded max seq and permits later early timestamps',()=>{
  const f=fixture([
    ['early',1,'t','u','x','{}','2025-01-01T00:00:00.000Z'],
    ['same-a',2,'t','u','x','{}','2026-01-01T00:00:00.000Z'],
    ['same-b',3,'t','u','x','{}','2026-01-01T00:00:00.000Z'],
    ['late-commit',4,'t','u','x','{}','2024-01-01T00:00:00.000Z']
  ]);
  const report=JSON.parse(run(f.file,'--backfill-max-seq','3').stdout);assert.equal(report.orderCheck,'passed');assert.equal(report.seqUnique,true);rmSync(f.directory,{recursive:true,force:true});
});

test('verifier flags NULL and duplicate seq values',()=>{
  const f=fixture([
    ['a',1,'t','u','x','{}','2025-01-01T00:00:00.000Z'],
    ['b',1,'t','u','x','{}','2026-01-01T00:00:00.000Z'],
    ['c',null,'t','u','x','{}','2027-01-01T00:00:00.000Z']
  ]);
  const result=run(f.file);const report=JSON.parse(result.stdout);assert.equal(result.status,1);assert.equal(report.seqNull.count,1);assert.deepEqual(report.seqNull.ids,['c']);assert.equal(report.seqUnique,false);rmSync(f.directory,{recursive:true,force:true});
});

test('verifier limits NULL ids to the first 50 while retaining the total',()=>{
  const rows=Array.from({length:55},(_,index)=>[`null-${index}`,null,'t','u','x','{}',`2025-01-01T00:00:${String(index).padStart(2,'0')}.000Z`]);
  const f=fixture(rows);const result=run(f.file);const report=JSON.parse(result.stdout);assert.equal(result.status,1);assert.equal(report.seqNull.count,55);assert.equal(report.seqNull.ids.length,50);rmSync(f.directory,{recursive:true,force:true});
});

test('verifier rejects remote and production arguments and opens read-only',()=>{
  const source=readFileSync(script,'utf8');assert.match(source,/readOnly:\s*true/);assert.doesNotMatch(source,/\b(?:INSERT|UPDATE|DELETE)\s+INTO?\b/);
  const f=fixture([]);assert.equal(run(f.file,'--remote').status,2);assert.equal(run(f.file,'--production').status,2);rmSync(f.directory,{recursive:true,force:true});
});
