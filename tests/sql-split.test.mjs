import test from 'node:test';
import assert from 'node:assert/strict';
import {splitSql} from '../deploy/standalone/sql-split.mjs';

test('migration splitter keeps CASE END inside a trigger statement',()=>{
 const sql=`CREATE TRIGGER audit_guard BEFORE UPDATE ON demo BEGIN
   SELECT CASE WHEN NEW.status='closed' THEN 1 ELSE 0 END;
   UPDATE audit_log SET detail='END marker' WHERE id=NEW.id;
 END;
 CREATE TABLE after_trigger (id TEXT);`;
 const parts=splitSql(sql);
 assert.equal(parts.length,2);
 assert.match(parts[0],/CREATE TRIGGER/);
 assert.match(parts[0],/UPDATE audit_log/);
 assert.match(parts[1],/CREATE TABLE after_trigger/);
});

test('migration splitter respects word boundaries',()=>{
 const parts=splitSql("CREATE TABLE begin_endings (value TEXT DEFAULT 'BEGINNING'); CREATE TABLE done (id TEXT);");
 assert.equal(parts.length,2);
});

test('migration splitter ignores comment-only files',()=>{
 const parts=splitSql('-- retired migration\n-- intentionally left as documentation\n');
 assert.deepEqual(parts,[]);
});
