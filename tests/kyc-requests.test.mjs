import test from 'node:test';
import assert from 'node:assert/strict';
import {fields,slots,sections,emptyProfile} from '../lib/kyc/core.ts';
import {parseRequests,requestSection,requestReason,reasonCodes} from '../lib/kyc/requests.ts';
const item={target:'slot:idFront',reasonCode:'blurred',note:'  Synthetic photo request  '};
test('requests preserve absent legacy vs explicit empty; validate every core target and all reason labels',()=>{
 assert.equal(parseRequests(undefined),undefined);assert.deepEqual(parseRequests([]),[]);
 assert.deepEqual(parseRequests([item]),[{...item,note:item.note.trim()}]);
 for(const [prefix,rows] of [['field',fields],['slot',slots.filter(s=>s.id!=='signature')],['section',sections]])for(const row of rows){const target=prefix+':'+row.id;assert.equal(requestSection(target),prefix==='section'?row.id:row.section);assert.equal(parseRequests([{...item,target}])[0].target,target)}
 assert.equal(requestSection('field:unknown'),undefined);
 for(const [code,tuple] of Object.entries(reasonCodes))for(const [i,locale] of ['zh','en','km'].entries())assert.equal(requestReason(code,locale),tuple[i]);
});
test('KYC supplement requests exclude loan signature and reject currently hidden slots with profile context',()=>{
 assert.equal(requestSection('slot:signature'),undefined);
 assert.throws(()=>parseRequests([{...item,target:'slot:signature'}]));
 const profile=emptyProfile();
 for(const id of ['rentContract','propertyCertificate','vehicleInvoice','vehicleContract','vehiclePhoto'])assert.throws(()=>parseRequests([{...item,target:'slot:'+id}],profile));
 assert.equal(parseRequests([{...item,target:'slot:rentContract'}]).length,1);
 profile.values.housing='租房';assert.equal(parseRequests([{...item,target:'slot:rentContract'}],profile).length,1);
 profile.values.vehicle='摩托车';assert.equal(parseRequests([{...item,target:'slot:vehiclePhoto'}],profile).length,1);
});
test('requests reject malformed objects, unknown targets/codes, duplicates and size limits',()=>{
 for(const raw of [null,{},'',1,[null],[[]],[{...item,extra:true}],[{...item,note:undefined}],[{...item,note:1}],[{...item,note:'x'.repeat(501)}],[{...item,target:'field:unknown'}],[{...item,target:'field:surname:extra'}],[{...item,reasonCode:'constructor'}],[{...item,reasonCode:'unknown'}],[item,{...item,reasonCode:'other'}],Array(33).fill(item)])assert.throws(()=>parseRequests(raw));
 assert.equal(parseRequests([{...item,note:'x'.repeat(500)}])[0].note.length,500);
 const max=fields.slice(0,32).map(f=>({...item,target:'field:'+f.id}));assert.equal(parseRequests(max).length,32);
});
