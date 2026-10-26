import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as core from '../lib/kyc/core.ts';

function load(file,mocks){
 const exports={};
 const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext('(function(exports,require){'+code+'\n})',{Response,Request,URL,crypto,console})(exports,n=>{assert(n in mocks,n);return mocks[n]});
 return exports;
}
const changes=existsSync('lib/kyc/review-changes.ts')?load('lib/kyc/review-changes.ts',{'@/lib/kyc/core':core}):{};
const plain=value=>JSON.parse(JSON.stringify(value));
function profile(values={},files={}){return {...core.emptyProfile(),values,files};}

// These catch missing comparison, unbounded/raw sensitive values, and overbroad schema projection.
test('diff compares whitelisted fields and material ids, excluding signature and unknown data',()=>{
 assert.equal(typeof changes.reviewChanges,'function');
 const before=profile({surname:'OLD',documentNumber:'123456789',bankAccount:'987654321',unknown:'old'},{idFront:{id:'front-old'},idBack:{id:'back-old'},signature:{id:'sig-old'}});
 const after=profile({surname:'NEW',documentNumber:'987654321',bankAccount:'123456789',unknown:'new'},{idFront:{id:'front-new'},selfie:{id:'self-new'},signature:{id:'sig-new'},unknown:{id:'bad'}});
 assert.deepEqual(plain(changes.reviewChanges(before,after,'kyc')),{
  fields:[{id:'surname',oldValue:'OLD',newValue:'NEW'},{id:'documentNumber',oldValue:'****6789',newValue:'****4321'},{id:'bankAccount',oldValue:'****4321',newValue:'****6789'}],
  materials:[{slot:'idFront',oldFileId:'front-old',newFileId:'front-new'},{slot:'idBack',oldFileId:'back-old',newFileId:null},{slot:'selfie',oldFileId:null,newFileId:'self-new'}]
 });
});
test('short numeric, empty and missing sensitive values cannot bypass masking on either side',()=>{
 assert.equal(typeof changes.reviewChanges,'function');
 for(const [oldValue,newValue,wantOld,wantNew] of [['12','123','****12','****123'],['','7','','****7'],[undefined,'','', ''],['12345',undefined,'****2345',''],[12,12345,'****12','****2345']]){
  const result=plain(changes.reviewChanges(profile({documentNumber:oldValue}),profile({documentNumber:newValue}),'admin'));
  if(String(oldValue??'')===String(newValue??''))assert.deepEqual(result.fields,[]);
  else assert.deepEqual(result.fields,[{id:'documentNumber',oldValue:wantOld,newValue:wantNew}]);
 }
});
test('audit receives only names and slots; no baseline or unchanged values yields no changes',()=>{
 assert.equal(typeof changes.reviewChanges,'function');
 const before=profile({surname:'OLD'},{idFront:{id:'old'}}),after=profile({surname:'NEW'},{idFront:{id:'new'}});
 assert.deepEqual(plain(changes.reviewChanges(before,after,'audit')),{fields:[{id:'surname'}],materials:[{slot:'idFront'}]});
 assert.deepEqual(plain(changes.reviewChanges(null,after,'admin')),{fields:[],materials:[]});
 assert.deepEqual(plain(changes.reviewChanges(after,after,'dept_admin')),{fields:[],materials:[]});
});
