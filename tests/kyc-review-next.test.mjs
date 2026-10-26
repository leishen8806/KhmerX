import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
const api=existsSync('lib/kyc/review-next.ts')?await import('../lib/kyc/review-next.ts'):{};
test('next excludes current and non-submitted; uses reliable dates otherwise API order',()=>{
 assert.equal(typeof api.selectNext,'function');
 const rows=[{id:'current',status:'submitted'},{id:'done',status:'approved'},{id:'later',status:'submitted',submitted_at:'2026-10-24T02:00:00Z'},{id:'older',status:'submitted',submitted_at:'2026-10-24T01:00:00Z'}];
 assert.equal(api.selectNext(rows,'current').id,'older');delete rows[3].submitted_at;assert.equal(api.selectNext(rows,'current').id,'later');
 assert.equal(api.selectNext(rows.slice(0,2),'current'),null);
});
test('auto-next stores only boolean and fails closed for read/write exceptions',()=>{
 assert.equal(typeof api.readAutoNext,'function');const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 assert.equal(api.readAutoNext(storage),false);assert.equal(api.writeAutoNext(storage,true),true);assert.deepEqual([...values.values()],['true']);assert.equal(api.readAutoNext(storage),true);
 const broken={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};assert.equal(api.readAutoNext(broken),false);assert.equal(api.writeAutoNext(broken,true),false);
});
test('only a successful decision reads queue; 409 never accepts or fetches; queue failure is not empty',async()=>{
 assert.equal(typeof api.reviewAndNext,'function');const events=[];
 const result=await api.reviewAndNext(async()=>{events.push('POST');return {id:'current'}},()=>events.push('accepted'),async()=>{events.push('GET');return [{id:'next',status:'submitted'}]},'current');
 assert.deepEqual(events,['POST','accepted','GET']);assert.equal(result.nextId,'next');
 events.length=0;await assert.rejects(api.reviewAndNext(async()=>{throw {status:409}},()=>events.push('accepted'),async()=>{events.push('GET');return []},'current'));assert.deepEqual(events,[]);
 assert.deepEqual(await api.reviewAndNext(async()=>({}),()=>{},async()=>{throw Error('offline')},'current'),{state:'failed'});
 assert.deepEqual(await api.reviewAndNext(async()=>({}),()=>{},async()=>[],'current'),{state:'empty'});
});
