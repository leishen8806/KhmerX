import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../lib/error-messages.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exports={};vm.runInNewContext(js,{exports,document:undefined});

test('all documented error codes have messages in en/km/zh',()=>{
 const apiCodes=readFileSync(new URL('../docs/api-error-codes.md',import.meta.url),'utf8').match(/`([A-Z][A-Z0-9_]+)`/g).map(value=>value.slice(1,-1));
  const arc=readFileSync(new URL('../docs/contracts/ARC-00-error-and-envelope.md',import.meta.url),'utf8');
  const contractSections=[3,6,7].map(number=>arc.match(new RegExp(`^## ${number}\\.[^\\n]*\\n([\\s\\S]*?)(?=^## |$)`,'m'))?.[1]||'');
  const contractCodes=contractSections.flatMap(section=>[...section.matchAll(/`([A-Z][A-Z0-9_]+)`/g)].map(match=>match[1]).filter(code=>!code.endsWith('_')));
  const required=new Set([...apiCodes,...contractCodes]);
  assert.equal(new Set(exports.errorCodes).size,exports.errorCodes.length,'duplicate error code');
  for(const code of required)assert.ok(exports.errorCodes.includes(code),`errorCodes missing ${code}`);
 for(const code of required){for(const locale of ['en','km','zh'])assert.ok(exports.errorMessages[locale][code],`${locale} missing ${code}`)}
 for(const locale of ['en','km','zh'])for(const code of exports.errorCodes)assert.ok(exports.errorMessages[locale][code],`${locale} missing ${code}`);
});

test('unknown server code falls back without exposing its error text',()=>{
 const text=exports.messageForError({code:'UNLISTED_CODE',error:'database secret'},'en');
 assert.equal(text,exports.errorMessages.en.REQUEST_FAILED);assert.doesNotMatch(text,/database secret/);
});

test('service failures include the request ID and rate limits include retry seconds',()=>{
 assert.match(exports.messageForError({code:'SERVICE_UNAVAILABLE',requestId:'rid-1'},'en'),/rid-1/);
 assert.match(exports.messageForError({code:'INTERNAL_ERROR',requestId:'rid-2'},'zh'),/rid-2/);
 assert.match(exports.messageForError({code:'RATE_LIMITED',params:{retryAfterSeconds:30}},'km'),/30/);
});

test('channel and verification states have explicit localized copy',()=>{
 for(const code of ['CHANNEL_COMPANY_MISMATCH','CHANNEL_DISABLED','CHANNEL_MAINTENANCE','VERIFICATION_EXPIRED','VERIFICATION_RATE_LIMITED'])for(const locale of ['en','km','zh'])assert.ok(exports.errorMessages[locale][code],`${locale} missing ${code}`);
 assert.match(exports.messageForError({code:'CHANNEL_COMPANY_MISMATCH'},'en'),/different company/);
 assert.match(exports.messageForError({code:'VERIFICATION_EXPIRED'},'zh'),/过期/);
});
