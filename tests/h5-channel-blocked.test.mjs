import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const status=fs.readFileSync(new URL('../lib/h5-channel-status.ts',import.meta.url),'utf8');
const send=fs.readFileSync(new URL('../app/api/h5/auth/send/route.ts',import.meta.url),'utf8');
const verify=fs.readFileSync(new URL('../app/api/h5/auth/verify/route.ts',import.meta.url),'utf8');
const login=fs.readFileSync(new URL('../app/h5/login.tsx',import.meta.url),'utf8');

function statusModule(){
 const source=ts.transpileModule(status,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const exports={};const moduleRef={exports};vm.runInNewContext(source,{exports,module:moduleRef,Number,String});return moduleRef.exports;
}

test('channel status maps disabled and maintenance to stable error codes',()=>{
 assert.match(status,/value==='maintenance'\|\|value==='maint'/);
 assert.match(status,/value==='disabled'\|\|value==='off'/);
 assert.match(status,/CHANNEL_MAINTENANCE/);
 assert.match(status,/CHANNEL_DISABLED/);
});

test('company channel rows are primary and a missing H5 row does not disable demo login',()=>{
 const {h5ChannelStatus}=statusModule();
 assert.equal(h5ChannelStatus({mode:'demo'},undefined,undefined,{exists:true,enabled:1}),'active');
 assert.equal(h5ChannelStatus({mode:'demo'},undefined,undefined,{exists:true,enabled:0}),'disabled');
 assert.equal(h5ChannelStatus({mode:'demo'},undefined,undefined),'active');
 assert.doesNotMatch(status,/\|\|!channelId/);
});

test('disabled send and verify routes guard before auth core',()=>{
 assert.match(send,/await requireH5ChannelAvailable\(r,id,channelType\(request\),policy\.channelId\)/);
 assert.match(verify,/await requireH5ChannelAvailable\(r,id,channelType\(request\),policy\.channelId\)/);
 assert.match(send,/registrationPolicy\(r,id,s\?\.customerId\)/);
});

test('app and Telegram entry points select their channel rows before auth core',()=>{
 const mobile=fs.readFileSync(new URL('../mobile/lib/core/network/interceptors/base_headers_interceptor.dart',import.meta.url),'utf8');
 const telegram=fs.readFileSync(new URL('../app/api/h5/auth/telegram/route.ts',import.meta.url),'utf8');
 assert.match(mobile,/X-Payease-Client.*app/);
 assert.match(telegram,/await requireH5ChannelAvailable\(r,candidate\.owner,'telegram_miniapp'/);
});

test('blocked channel pages do not render a phone form',()=>{
 assert.match(login,/type BlockedCode/);
 assert.match(login,/if\(blocked\)/);
 assert.match(login,/authBlockedMismatchAction/);
 assert.match(login,/localizedChannelError\(blocked,authLocale\)/);
 assert.match(login,/setBlocked\(code\)/);
});
test('Telegram verifier errors stay in the form and offer a reopen action',()=>{
 assert.match(login,/TELEGRAM_INITDATA_EXPIRED/);
 assert.match(login,/TELEGRAM_INITDATA_INVALID/);
 assert.match(login,/authTelegramReopen/);
 assert.match(login,/messageForError\(\{code:nextTelegramCode\},authLocale\)/);
});
