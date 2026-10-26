import test from 'node:test';
import assert from 'node:assert/strict';
import {changesFixture} from './helpers/kyc-sensitive-fixture.mjs';
async function setup(t){
 const f=await changesFixture();t.after(()=>f.close());let row=await f.kyc.initialize(f.A,'amend-sensitive',false),data=await f.kyc.payload(row);data.profile.values={surname:'OLD',documentNumber:'DOC123456789',bankAccount:'BANK987654321'};row=await f.kyc.transition(row,'submitted',data,'submit','customer');
 const {department_id:unit}=f.sql.prepare('SELECT department_id FROM team_assignments WHERE tenant_id=? AND customer_id=?').get(f.A,row.customer_id);
 f.sql.prepare("INSERT INTO team_members(id,tenant_id,user_id,email,role,unit_id,active,version) VALUES('reviewer',?,'reviewer','reviewer@example.test','kyc',?,1,0)").run(f.A,unit);
 f.sql.prepare("UPDATE team_assignments SET reviewer_id='reviewer' WHERE tenant_id=? AND customer_id=?").run(f.A,row.customer_id);
 for(const group of ['identity','bank'])f.sql.prepare("INSERT INTO team_kyc_field_permissions(tenant_id,member_id,field_group,active,updated_at) VALUES(?,'reviewer',?,1,?)").run(f.A,group,new Date().toISOString());
 f.setUser({userId:'reviewer',email:'reviewer@example.test'});
 const route=await f.mod('@/app/api/kyc/review/route');
 const amend=async(values,metadata)=>{const r=await route.POST(new Request('http://localhost/api/kyc/review',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify({action:'amend',id:row.id,revision:row.revision,values,sensitiveFields:metadata,reason:'Synthetic spelling correction'})}));return {r,body:await r.json()};};
 return {...f,row,data,amend};
}
test('amending another field preserves original sensitive values for masks, missing values and masked markers',async t=>{
 for(const kind of ['mask','missing','marker'])await t.test(kind,async t=>{
  const f=await setup(t),values={surname:'NEW',...(kind==='missing'?{}:{documentNumber:kind==='marker'?{masked:true}:'****6789',bankAccount:'****4321'})};
  const {r,body}=await f.amend(values,kind==='marker'?{documentNumber:{masked:true},bankAccount:{masked:true}}:undefined);assert.equal(r.status,200);
  const stored=await f.kyc.payload(await f.kyc.getCase(f.A,f.row.id));assert.equal(stored.profile.values.documentNumber,'DOC123456789');assert.equal(stored.profile.values.bankAccount,'BANK987654321');assert.equal(stored.profile.values.surname,'NEW');
  assert.equal(body.profile.values.documentNumber,'****6789');assert(!JSON.stringify(body).includes('BANK987654321'));
 });
});
test('sensitive edits require valid revealed proof bound to actor/tenant/case/revision/field and expiry',async t=>{
 const f=await setup(t),tokenApi=await f.mod('@/lib/kyc/reveal-token'),scope={tenant:f.A,actor:'reviewer',caseId:f.row.id,revision:f.row.revision,field:'documentNumber'};
 const values={...f.data.profile.values,documentNumber:'NEW123456789'},meta=token=>({documentNumber:{masked:false,dirty:true,revealToken:token}});
 const before=f.sql.prepare('SELECT count(*) AS n FROM kyc_history').get().n;
 for(const token of [undefined,'forged',await tokenApi.mintRevealToken({...scope,actor:'owner'}),await tokenApi.mintRevealToken({...scope,tenant:f.B}),await tokenApi.mintRevealToken({...scope,caseId:'other'}),await tokenApi.mintRevealToken({...scope,revision:0}),await tokenApi.mintRevealToken({...scope,field:'bankAccount'})])assert.equal((await f.amend(values,meta(token))).r.status,403);
 const now=Date.now;let expired;try{Date.now=()=>now()-301000;expired=await tokenApi.mintRevealToken(scope);}finally{Date.now=now;}assert.equal((await f.amend(values,meta(expired))).r.status,403);
 assert.equal(f.sql.prepare('SELECT count(*) AS n FROM kyc_history').get().n,before);
 const token=await tokenApi.mintRevealToken(scope),result=await f.amend(values,meta(token));assert.equal(result.r.status,200);assert.equal((await f.kyc.payload(await f.kyc.getCase(f.A,f.row.id))).profile.values.documentNumber,'NEW123456789');
 const event=f.sql.prepare("SELECT detail FROM team_audit WHERE action='kyc_field_amend'").get();assert(!event.detail.includes('6789'));assert(!event.detail.includes(token));assert(!event.detail.includes('NEW123456789'));assert(!f.logs.join(' ').includes(token));
});
test('sensitive edits require revealed-and-dirty metadata even with valid proof',async t=>{
 const rejected=[['dirty false','NEW123456789',{masked:false,dirty:false}],['dirty missing','NEW123456789',{masked:false}],['masked missing','NEW123456789',{dirty:true}],['numeric value',123,{masked:false,dirty:true}],['object value',{x:1},{masked:false,dirty:true}]];
 for(const [name,value,mark] of rejected)await t.test(name,async t=>{
  const f=await setup(t),api=await f.mod('@/lib/kyc/reveal-token'),token=await api.mintRevealToken({tenant:f.A,actor:'reviewer',caseId:f.row.id,revision:f.row.revision,field:'documentNumber'}),before=f.sql.prepare('SELECT count(*) AS n FROM kyc_history').get().n;
  const result=await f.amend({...f.data.profile.values,documentNumber:value},{documentNumber:{...mark,revealToken:token}});assert.equal(result.r.status,403);
  assert.equal(f.sql.prepare('SELECT count(*) AS n FROM kyc_history').get().n,before);assert.equal((await f.kyc.payload(await f.kyc.getCase(f.A,f.row.id))).profile.values.documentNumber,'DOC123456789');
 });
 await t.test('revealed dirty string is accepted',async t=>{
  const f=await setup(t),api=await f.mod('@/lib/kyc/reveal-token'),token=await api.mintRevealToken({tenant:f.A,actor:'reviewer',caseId:f.row.id,revision:f.row.revision,field:'documentNumber'});
  assert.equal((await f.amend({...f.data.profile.values,documentNumber:'NEW123456789'},{documentNumber:{masked:false,dirty:true,revealToken:token}})).r.status,200);assert.equal((await f.kyc.payload(await f.kyc.getCase(f.A,f.row.id))).profile.values.documentNumber,'NEW123456789');
 });
});
test('whitespace wrapped canonical and generic masks never overwrite originals even with valid proof',async t=>{
 for(const mask of [' ****6789 ','  ****  ',' \t••••1234\n'])await t.test(mask,async t=>{
  const f=await setup(t),api=await f.mod('@/lib/kyc/reveal-token'),token=await api.mintRevealToken({tenant:f.A,actor:'reviewer',caseId:f.row.id,revision:f.row.revision,field:'documentNumber'});
  const result=await f.amend({...f.data.profile.values,surname:'NEW',documentNumber:mask},{documentNumber:{masked:false,dirty:true,revealToken:token}});assert.equal(result.r.status,200);assert.equal((await f.kyc.payload(await f.kyc.getCase(f.A,f.row.id))).profile.values.documentNumber,'DOC123456789');
 });
});
