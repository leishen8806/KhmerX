import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';

const source=readFileSync(new URL('../lib/public-id.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
vm.runInNewContext(js,{exports,crypto:webcrypto,Intl,Date});
const {publicIdentifier,isPublicIdentifier,PUBLIC_ID_PATTERN}=exports;

test('public identifiers are 16 characters and preserve entity and channel',()=>{
 const id=publicIdentifier('O','TG',new Date('2026-10-09T00:00:00Z'));
 assert.equal(id.length,16);
 assert.equal(id.slice(0,3),'OTG');
 assert.equal(id.slice(3,9),'261009');
 assert.match(id,PUBLIC_ID_PATTERN);
 assert.equal(isPublicIdentifier(id),true);
});

test('public identifiers reject ambiguous characters and invalid inputs',()=>{
 assert.equal(isPublicIdentifier('OTG261009ABCIEFG'),false);
 assert.equal(isPublicIdentifier('otg2610097K3M8Q2'),false);
 assert.throws(()=>publicIdentifier('XX','TG'));
 assert.throws(()=>publicIdentifier('O','XX'));
});

test('public identifier generation has no duplicates in a representative batch',()=>{
 const ids=new Set(Array.from({length:10000},()=>publicIdentifier('O','H5')));
 assert.equal(ids.size,10000);
});
