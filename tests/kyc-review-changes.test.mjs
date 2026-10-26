import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as core from '../lib/kyc/core.ts';
import {changesFixture} from './helpers/kyc-changes-fixture.mjs';

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
 for(const id of ['documentNumber','bankAccount'])for(const [oldValue,newValue,wantOld,wantNew] of [['12','123','****','****'],['','7','','****'],[undefined,'','', ''],['12345',undefined,'****45',''],[12,12345,'****','****45'],['1234','87654321','****','****21'],['12345678','987654321','****78','****4321'],['123456789','987654321','****6789','****4321']]){
  const result=plain(changes.reviewChanges(profile({[id]:oldValue}),profile({[id]:newValue}),'admin'));
  if(String(oldValue??'')===String(newValue??''))assert.deepEqual(result.fields,[]);
  else assert.deepEqual(result.fields,[{id,oldValue:wantOld,newValue:wantNew}]);
 }
});
test('audit receives only names and slots; no baseline or unchanged values yields no changes',()=>{
 assert.equal(typeof changes.reviewChanges,'function');
 const before=profile({surname:'OLD'},{idFront:{id:'old'}}),after=profile({surname:'NEW'},{idFront:{id:'new'}});
 assert.deepEqual(plain(changes.reviewChanges(before,after,'audit')),{fields:[{id:'surname'}],materials:[{slot:'idFront'}]});
 assert.deepEqual(plain(changes.reviewChanges(null,after,'admin')),{fields:[],materials:[]});
 assert.deepEqual(plain(changes.reviewChanges(after,after,'dept_admin')),{fields:[],materials:[]});
});

const endpoint='app/api/kyc/review/changes/route.ts';
async function integration(t){
 assert(existsSync(endpoint),'changes GET must exist');
 const f=await changesFixture();t.after(()=>f.close());const route=await f.mod('@/app/api/kyc/review/changes/route');
 const requestId='12345678-1234-4123-8123-123456789abc';
 const get=async id=>{const response=await route.GET(new Request('http://localhost/api/kyc/review/changes'+(id===undefined?'':'?id='+encodeURIComponent(id)),{headers:{'x-request-id':requestId}}));return {response,body:await response.json()};};
 async function make(customer='customer',owner=f.A){let row=await f.kyc.initialize(owner,customer,false);return {row,data:await f.kyc.payload(row)};}
 async function step(row,data,action){return f.kyc.transition(row,action.startsWith('review:')?'needs_info':'submitted',data,action,'owner');}
 return {...f,get,make,step,requestId};
}
test('GET chooses latest real decision, not amend/save; binds tenant and id and audits only metadata',async t=>{
 const f=await integration(t);let {row,data}=await f.make();
 data.profile.values={surname:'FIRST',documentNumber:'11112345',bankAccount:'22223456'};data.profile.files={idFront:{id:'old-file'}};
 row=await f.step(row,data,'review:rejected');
 data.profile.values.surname='BASELINE';row=await f.step(row,data,'review:needs_info');const baseline=row.revision;
 data.profile.values={surname:'CURRENT',documentNumber:'99998765',bankAccount:'88887654'};data.profile.files={idFront:{id:'new-file'}};
 row=await f.step(row,data,'review:amend');row=await f.step(row,data,'save');
 const historyBefore=f.sql.prepare('SELECT count(*) AS n FROM kyc_history').get().n;
 const {response,body}=await f.get(row.id);
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-request-id'),f.requestId);
 assert.deepEqual(body,{caseId:row.id,currentRevision:row.revision,baselineRevision:baseline,fields:[{id:'surname',oldValue:'BASELINE',newValue:'CURRENT'},{id:'documentNumber',oldValue:'****45',newValue:'****65'},{id:'bankAccount',oldValue:'****56',newValue:'****54'}],materials:[{slot:'idFront',oldFileId:'old-file',newFileId:'new-file'}]});
 const event=f.sql.prepare("SELECT * FROM team_audit WHERE action='kyc_changes_view'").get();assert.equal(event.tenant_id,f.A);assert.equal(event.actor,'owner');assert(event.created_at);
 assert.deepEqual(JSON.parse(event.detail),{caseId:row.id,currentRevision:row.revision,baselineRevision:baseline,requestId:f.requestId});
 assert.equal(f.sql.prepare('SELECT count(*) AS n FROM kyc_history').get().n,historyBefore);assert.equal((await f.kyc.getCase(f.A,row.id)).revision,row.revision);
 for(const secret of ['CURRENT','BASELINE','old-file','new-file'])assert(!event.detail.includes(secret));
 assert.equal((await f.get("' OR 1=1 --")).response.status,404);
 f.select(f.B);assert.equal((await f.get(row.id)).response.status,404);
});
test('GET preserves role and assignment boundaries and fails closed for no-team fallback',async t=>{
 const f=await integration(t);let {row,data}=await f.make();data.profile.values.surname='BEFORE';data.profile.files.idFront={id:'old'};row=await f.step(row,data,'review:approved');data.profile.values.surname='AFTER';data.profile.files.idFront={id:'new'};row=await f.step(row,data,'save');
 for(const role of ['audit','kyc','dept_admin','service']){
  const id='member-'+role;f.sql.prepare('INSERT INTO team_members (id,tenant_id,user_id,email,role,unit_id,active,version) VALUES (?,?,?,?,?,?,1,0)').run(id,f.A,id,id+'@example.test',role,null);
  f.setUser({userId:id,email:id+'@example.test'});
  const result=await f.get(row.id);
  if(role==='audit'){assert.equal(result.response.status,200);assert.deepEqual(result.body.fields,[{id:'surname'}]);assert.deepEqual(result.body.materials,[{slot:'idFront'}]);}
  else assert.equal(result.response.status,403);
  if(role==='kyc'||role==='dept_admin'){
   const assignment=f.sql.prepare('SELECT department_id FROM team_assignments WHERE tenant_id=? AND customer_id=?').get(f.A,row.customer_id);
   f.sql.prepare('UPDATE team_members SET unit_id=? WHERE id=?').run(assignment.department_id,id);
   if(role==='kyc')f.sql.prepare('UPDATE team_assignments SET reviewer_id=? WHERE tenant_id=? AND customer_id=?').run(id,f.A,row.customer_id);
   const allowed=await f.get(row.id);assert.equal(allowed.response.status,200);assert.deepEqual(allowed.body.fields,[{id:'surname',oldValue:'BEFORE',newValue:'AFTER'}]);
   const events=f.sql.prepare("SELECT actor FROM team_audit WHERE action='kyc_changes_view'").all();assert(events.some(event=>event.actor===id));
  }
 }
 f.setUser({userId:'owner',email:'owner@example.test'});f.select('');const count=f.sql.prepare("SELECT count(*) AS n FROM team_audit WHERE action='kyc_changes_view'").get().n;
 assert.equal((await f.get(row.id)).response.status,403);assert.equal(f.sql.prepare("SELECT count(*) AS n FROM team_audit WHERE action='kyc_changes_view'").get().n,count);
 f.setUser({userId:'outsider',email:'outsider@example.test'});assert.equal((await f.get(row.id)).response.status,403);
});
test('GET returns empty without decisions; deterministic ties exclude other tenants and future revisions',async t=>{
 const f=await integration(t);let {row,data}=await f.make();row=await f.step(row,data,'save');
 assert.deepEqual((await f.get(row.id)).body,{caseId:row.id,currentRevision:row.revision,baselineRevision:null,fields:[],materials:[]});
 data.profile.values.surname='BASE';row=await f.step(row,data,'review:approved');
 const snapshot=row.payload;data.profile.values.surname='CURRENT';row=await f.step(row,data,'save');
 const add=f.sql.prepare('INSERT INTO kyc_history (id,case_id,revision,owner,action,actor,snapshot,created_at) VALUES (?,?,?,?,?,?,?,?)');
 add.run('z-tie',row.id,row.revision-1,f.A,'review:approved','owner',snapshot,'9999');
 add.run('foreign',row.id,900,f.B,'review:approved','owner','broken','9999');
 add.run('future',row.id,800,f.A,'review:approved','owner','broken','9999');
 for(let n=0;n<2;n++){const result=await f.get(row.id);assert.equal(result.response.status,200);assert.equal(result.body.baselineRevision,row.revision-1);assert.deepEqual(result.body.fields,[{id:'surname',oldValue:'BASE',newValue:'CURRENT'}]);}
 assert.equal((await f.get()).response.status,400);assert.equal((await f.get('')).response.status,400);
});
test('GET never returns differences when audit insert or snapshot decryption fails; errors are correlated and sanitized',async t=>{
 const f=await integration(t);let {row,data}=await f.make();row=await f.step(row,data,'review:approved');data.profile.values.documentNumber='SECRET-123456789';row=await f.step(row,data,'save');
 const prepare=f.DB.prepare;f.DB.prepare=query=>{const statement=prepare(query);return query.startsWith('INSERT INTO team_audit')?{bind(...args){args[1]='nonexistent-tenant';return statement.bind(...args)}}:statement;};
 let result=await f.get(row.id);assert.equal(result.response.status,500);assert.equal(result.body.requestId,f.requestId);assert.equal(result.body.fields,undefined);f.DB.prepare=prepare;
 f.sql.prepare('INSERT INTO kyc_history (id,case_id,revision,owner,action,actor,snapshot,created_at) VALUES (?,?,?,?,?,?,?,?)').run('corrupt-baseline',row.id,row.revision,f.A,'review:rejected','owner','bad-baseline-SECRET','9999');
 result=await f.get(row.id);assert.equal(result.response.status,500);assert.equal(result.body.fields,undefined);
 f.sql.prepare('UPDATE kyc_cases SET payload=? WHERE id=?').run('bad-cipher-SECRET',row.id);
 result=await f.get(row.id);assert.equal(result.response.status,500);assert.equal(result.body.requestId,f.requestId);
 assert(!JSON.stringify(result.body).includes('SECRET'));assert(!f.logs.join(' ').includes('SECRET'));
});
