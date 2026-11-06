import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
test('company channel API contract exposes resolver requirements and E1 errors',()=>{
 const source=fs.readFileSync('lib/company-channels.ts','utf8');
 assert.match(source,/CHANNEL_CONFIG_INCOMPLETE/);
 assert.match(source,/resolveCompanyChannel/);
 assert.match(source,/WHERE tenant_id=\? AND type=\? AND enabled=1/);
 assert.match(source,/allowed_origins_json/);
 assert.doesNotMatch(source,/token_encrypted|saveCompanyChannel/);
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE company_channels(id TEXT PRIMARY KEY,tenant_id TEXT,type TEXT,enabled INTEGER,hosts_json TEXT,allowed_origins_json TEXT)');db.prepare('INSERT INTO company_channels VALUES (?,?,?,?,?,?)').run('h5-1','t-a','h5',1,'["testpayease.khmerx.org"]','["https://testpayease.khmerx.org"]');assert.equal(db.prepare('SELECT COUNT(*) n FROM company_channels WHERE tenant_id=? AND type=? AND enabled=1').get('t-a','h5').n,1);
});
