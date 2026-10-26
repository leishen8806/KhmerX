import test from 'node:test';
import assert from 'node:assert/strict';
import {changesFixture} from './helpers/kyc-sensitive-fixture.mjs';
test('staff GET is masked at the API boundary while customer view and stored payload retain originals',async t=>{
 const f=await changesFixture();t.after(()=>f.close());let row=await f.kyc.initialize(f.A,'redaction',false),data=await f.kyc.payload(row);
 data.profile.values={documentNumber:'DOC123456789',bankAccount:'BANK987654321'};row=await f.kyc.transition(row,'submitted',data,'submit','customer');
 const route=await f.mod('@/app/api/kyc/review/route');const r=await route.GET(new Request('http://localhost/api/kyc/review?id='+row.id)),body=await r.json();
 assert.equal(r.status,200);assert.equal(body.profile.values.documentNumber,'****6789');assert.equal(body.profile.values.bankAccount,'****4321');assert.deepEqual(body.sensitiveFields,{documentNumber:{masked:true},bankAccount:{masked:true}});
 assert(!JSON.stringify(body).includes('DOC123456789'));assert.equal((await f.kyc.view(row)).profile.values.documentNumber,'DOC123456789');assert.equal((await f.kyc.payload(row)).profile.values.bankAccount,'BANK987654321');
 const audit=await f.kyc.staffView(row,'audit');assert.deepEqual(Object.keys(audit.profile.values),[]);assert.deepEqual(Object.keys(audit.profile.files),[]);
 for(const [v,masked] of [['1234','****'],['12345','****45'],['12345678','****78'],['123456789','****6789'],['','']]){data.profile.values.documentNumber=v;row=await f.kyc.transition(row,'submitted',data,'save','customer');assert.equal((await f.kyc.staffView(row,'kyc')).profile.values.documentNumber,masked);}
});
