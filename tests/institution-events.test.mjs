import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeInstitutionEvent} from '../lib/institution-events.ts';

test('institution event envelope is normalized and bound to the signed institution',()=>{
 const event=normalizeInstitutionEvent({eventType:'loan.approved',institutionId:'inst-a',eventId:'evt-1',loanId:'loan-1',occurredAt:'2026-10-07T00:00:00Z',data:{decision:'approved'}},'inst-a');
 assert.equal(event.eventType,'loan.approved');assert.equal(event.institutionId,'inst-a');assert.deepEqual(event.data,{decision:'approved'});
});

test('institution event envelope rejects mismatched identity and malformed fields',()=>{
 assert.throws(()=>normalizeInstitutionEvent({eventType:'loan.approved',institutionId:'inst-b'},'inst-a'),/机构/);
 assert.throws(()=>normalizeInstitutionEvent({eventType:'loan approved'},'inst-a'),/事件类型/);
 assert.throws(()=>normalizeInstitutionEvent({eventType:'loan.approved',occurredAt:'not-a-date'},'inst-a'),/事件时间/);
});
