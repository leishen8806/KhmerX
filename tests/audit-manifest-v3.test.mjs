import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHmac} from 'node:crypto';

const secret='r'.repeat(32);
const digest=rows=>'v3:'+createHmac('sha256',secret).update(rows.map(r=>JSON.stringify([r.id,r.actor,r.action,r.detail,r.created_at])).join('\n')).digest('hex');
function db(){const d=new DatabaseSync(':memory:');d.exec('CREATE TABLE team_audit(id TEXT PRIMARY KEY,seq INTEGER,tenant_id TEXT,actor TEXT,action TEXT,detail TEXT,created_at TEXT); CREATE UNIQUE INDEX team_audit_seq_unique ON team_audit(seq) WHERE seq IS NOT NULL;');return d}
function add(d,id,created_at,detail='{}'){d.prepare("INSERT INTO team_audit(id,seq,tenant_id,actor,action,detail,created_at) VALUES(?,COALESCE((SELECT MAX(seq)+1 FROM team_audit),1),'t_demo','u','write',?,?)").run(id,detail,created_at)}
function snap(d){return d.prepare('SELECT id,seq,actor,action,detail,created_at FROM team_audit WHERE tenant_id=? ORDER BY seq').all('t_demo')}
test('v3 seq is deterministic for same-ms writes and late commits',()=>{const d=db();add(d,'a','2026-10-30T00:00:00.000Z');add(d,'b','2026-10-30T00:00:00.000Z');add(d,'c','2026-10-29T23:59:59.000Z');const rows=snap(d);assert.deepEqual(rows.map(r=>r.seq),[1,2,3]);assert.equal(rows[2].created_at,'2026-10-29T23:59:59.000Z');assert.equal(digest(rows),digest(rows))});
test('batch sequence has no gaps and edit/delete changes digest',()=>{const d=db();for(let i=0;i<4;i++)add(d,String(i),'2026-10-30T00:00:00.000Z',`{"n":${i}}`);let rows=snap(d);assert.deepEqual(rows.map(r=>r.seq),[1,2,3,4]);const before=digest(rows);d.prepare('UPDATE team_audit SET detail=? WHERE id=?').run('{"n":99}','1');assert.notEqual(digest(snap(d)),before);d.prepare('DELETE FROM team_audit WHERE id=?').run('2');assert.notEqual(digest(snap(d)),before)});
test('v2 tuple serialization remains unchanged',()=>{const rows=[{id:'a',actor:'u',action:'write',detail:'{}',created_at:'2026-10-30T00:00:00.000Z'}];const tuple=JSON.stringify([rows[0].id,rows[0].actor,rows[0].action,rows[0].detail,rows[0].created_at]);assert.equal(tuple,'["a","u","write","{}","2026-10-30T00:00:00.000Z"]')});
