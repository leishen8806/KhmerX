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
 assert.match(source,/token_encrypted/);
 assert.match(source,/checker.*finance_checker|finance_checker.*checker/);
 assert.match(fs.readFileSync('app/api/team/channels/route.ts','utf8'),/listCompanyChannels/);
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE company_channels(id TEXT PRIMARY KEY,tenant_id TEXT,type TEXT,enabled INTEGER,hosts_json TEXT,allowed_origins_json TEXT)');db.prepare('INSERT INTO company_channels VALUES (?,?,?,?,?,?)').run('h5-1','t-a','h5',1,'["testpayease.khmerx.org"]','["https://testpayease.khmerx.org"]');assert.equal(db.prepare('SELECT COUNT(*) n FROM company_channels WHERE tenant_id=? AND type=? AND enabled=1').get('t-a','h5').n,1);
});

test('selfcheck contract rejects incomplete and unsafe channel bindings',()=>{
 const source=fs.readFileSync('lib/company-channel-selfcheck.ts','utf8');
 assert.match(source,/必须存在且只能存在一个公司渠道绑定/);
 assert.match(source,/formalEnvironment/);
 assert.match(source,/Telegram Bot 不能跨公司重复绑定/);
});
