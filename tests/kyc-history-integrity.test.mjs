import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';

test('KYC history cannot be rewritten after creation and submitted history cannot be deleted',()=>{
 const db=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync(`drizzle/${file}`,'utf8'));
 db.exec("INSERT INTO kyc_cases(id,owner,customer_id,revision,status,payload,updated_at) VALUES ('case-1','tenant-1','customer-1',1,'approved','{}','2026-10-13T00:00:00.000Z')");
 db.exec("INSERT INTO kyc_history(id,case_id,revision,owner,action,actor,snapshot,created_at) VALUES ('history-1','case-1',1,'tenant-1','submit','staff-1','{}','2026-10-13T00:00:00.000Z')");
 assert.throws(()=>db.prepare("UPDATE kyc_history SET snapshot='tampered' WHERE id='history-1'").run(),/append-only/);
 assert.throws(()=>db.prepare("DELETE FROM kyc_history WHERE id='history-1'").run(),/append-only/);
 db.exec("INSERT INTO kyc_cases(id,owner,customer_id,revision,status,payload,updated_at) VALUES ('case-2','tenant-1','customer-2',0,'draft','{}','2026-10-13T00:00:00.000Z')");
 db.exec("INSERT INTO kyc_history(id,case_id,revision,owner,action,actor,snapshot,created_at) VALUES ('history-2','case-2',0,'tenant-1','draft','system','{}','2026-10-13T00:00:00.000Z')");
 assert.doesNotThrow(()=>db.prepare("DELETE FROM kyc_history WHERE id='history-2'").run());
});
