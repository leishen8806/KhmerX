import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const status=fs.readFileSync(new URL('../lib/h5-channel-status.ts',import.meta.url),'utf8');
const send=fs.readFileSync(new URL('../app/api/h5/auth/send/route.ts',import.meta.url),'utf8');
const verify=fs.readFileSync(new URL('../app/api/h5/auth/verify/route.ts',import.meta.url),'utf8');
const login=fs.readFileSync(new URL('../app/h5/login.tsx',import.meta.url),'utf8');

test('channel status maps disabled and maintenance to stable error codes',()=>{
 assert.match(status,/value==='maintenance'\|\|value==='maint'/);
 assert.match(status,/value==='disabled'\|\|value==='off'/);
 assert.match(status,/CHANNEL_MAINTENANCE/);
 assert.match(status,/CHANNEL_DISABLED/);
});

test('disabled send and verify routes guard before auth core',()=>{
 assert.match(send,/requireH5ChannelAvailable\(r,policy\.channelId\)/);
 assert.match(verify,/requireH5ChannelAvailable\(r,policy\.channelId\)/);
 assert.match(send,/registrationPolicy\(r,id,s\?\.customerId\)/);
});

test('blocked channel pages do not render a phone form',()=>{
 assert.match(login,/type BlockedCode/);
 assert.match(login,/if\(blocked\)/);
 assert.match(login,/authBlockedMismatchAction/);
 assert.match(login,/localizedChannelError\(blocked,authLocale\)/);
 assert.match(login,/setBlocked\(code\)/);
});
