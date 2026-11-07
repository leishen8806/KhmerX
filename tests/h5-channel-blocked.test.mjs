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
 assert.match(send,/await requireH5ChannelAvailable\(r,id,await requestChannelType\(r,request,id\),policy\.channelId\)/);
 assert.match(verify,/await requireH5ChannelAvailable\(r,id,await requestChannelType\(r,request,id\),policy\.channelId\)/);
 assert.match(send,/registrationPolicy\(r,id,s\?\.customerId\)/);
});

test('app and Telegram entry points select their channel rows before auth core',()=>{
 const mobile=fs.readFileSync(new URL('../mobile/lib/core/network/interceptors/base_headers_interceptor.dart',import.meta.url),'utf8');
 const guard=fs.readFileSync(new URL('../lib/h5-channel-guard.ts',import.meta.url),'utf8');
 const telegram=fs.readFileSync(new URL('../app/api/h5/auth/telegram/route.ts',import.meta.url),'utf8');
 assert.match(mobile,/X-Payease-Client.*app/);
 assert.match(guard,/X-Payease-App-Key|x-payease-app-key/);
 assert.match(telegram,/await requireH5ChannelAvailable\(r,candidate\.owner,'telegram_miniapp'/);
});

test('App channel requires the configured package id as a constant-time key',()=>{
 const guard=fs.readFileSync(new URL('../lib/h5-channel-guard.ts',import.meta.url),'utf8');
 assert.match(guard,/constantTimeEqual/);
 assert.match(guard,/package_id/);
 assert.match(guard,/return 'h5'/);
});

test('App spoof matrix has explicit H5 fallback and selfcheck warning',()=>{
 const guard=fs.readFileSync(new URL('../lib/h5-channel-guard.ts',import.meta.url),'utf8');
 const selfcheck=fs.readFileSync(new URL('../lib/company-channel-selfcheck.ts',import.meta.url),'utf8');
 assert.match(guard,/if\(!owner\)return 'h5'/);
 assert.match(guard,/appRequestHasValidKey/);
 assert.match(selfcheck,/未配置 App 共享标识，App 请求将按 H5 处理/);
});

test('App header spoof matrix distinguishes valid, wrong, other-company and missing keys',()=>{
 const guard=fs.readFileSync(new URL('../lib/h5-channel-guard.ts',import.meta.url),'utf8');
 const {h5ChannelStatus}=statusModule();
 const source=ts.transpileModule(guard,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const exports={};const moduleRef={exports};vm.runInNewContext(source,{exports,module:moduleRef,Math,TextEncoder,Request,console,require(name){if(name==='cloudflare:workers')return {env:{}};if(name==='@/lib/h5-auth-core')return {AuthError:class extends Error{}};if(name==='@/lib/h5-channel-status')return {h5ChannelStatus(){return 'active'},h5ChannelErrorCode(){return undefined}};throw new Error(`unexpected import ${name}`)}});
 const {appRequestHasValidKey}=moduleRef.exports;
 const request=(key)=>new Request('https://testpayease.khmerx.org/api/h5/auth',{headers:{'X-Payease-Client':'app',...(key?{'X-Payease-App-Key':key}:{})}});
 const rows=[['valid',request('org.khmerx.payease'),'org.khmerx.payease',true],['wrong',request('wrong'),'org.khmerx.payease',false],['other-company',request('org.other.app'),'org.khmerx.payease',false],['missing',request(),'org.khmerx.payease',false],['no-config',request('org.khmerx.payease'),undefined,false]];
 for(const [label,req,configured,expected] of rows)assert.equal(appRequestHasValidKey(req,configured),expected,label);
 assert.equal(h5ChannelStatus({mode:'demo'},undefined,undefined,{exists:true,enabled:0}),'disabled','H5 fallback is blocked when H5 is disabled');
 assert.equal(h5ChannelStatus({mode:'demo'},undefined,undefined,{exists:true,enabled:1}),'active','valid App key can select the enabled App channel');
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
