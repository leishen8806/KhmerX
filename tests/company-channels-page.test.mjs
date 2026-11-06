import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('admin channel page is read-first and does not render secrets or write controls',()=>{
 const source=fs.readFileSync('app/team/channels/client.tsx','utf8');
 assert.match(source,/CHANNEL DETAIL/);assert.match(source,/配置自检面板/);assert.match(source,/审计记录/);assert.match(source,/api\/team\/channels/);assert.match(source,/Token/);assert.doesNotMatch(source,/token_encrypted|password_hash|type=\"password\"|<form/);
 assert.match(source,/selfcheck/);assert.match(source,/REAL TEAM_AUDIT/);assert.match(source,/channel-table/);assert.match(source,/已启用渠道/);assert.match(source,/自检异常/);assert.match(source,/Telegram 登录/);assert.match(source,/完整自检清单/);assert.match(source,/A · 公司与渠道/);assert.doesNotMatch(source,/testpayease\\.khmerx\\.org|testapi\\.khmerx\\.org|channels\\.length===3/);
 assert.match(source,/const canSeeToken=Boolean\(channel\.token\)/);assert.match(source,/const showToken=channels\.some\(channel=>channel\.token\)/);assert.match(source,/channel\.type==='telegram'.*不适用/);assert.match(source,/Bot Telegram ID/);assert.match(source,/频率限制/);assert.match(source,/通知开关/);assert.match(source,/设置密码/);
});
