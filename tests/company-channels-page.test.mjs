import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('admin channel page is read-first and does not render secrets or write controls',()=>{
 const source=fs.readFileSync('app/team/channels/client.tsx','utf8');
 assert.match(source,/只读取当前公司配置/);assert.match(source,/api\/team\/channels/);assert.doesNotMatch(source,/token_encrypted|password_hash|type=\"password\"/);
});
