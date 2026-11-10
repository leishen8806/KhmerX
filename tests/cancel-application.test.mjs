import assert from 'node:assert/strict';
import test from 'node:test';
import {applyAction,initialState} from '../lib/domain.ts';

function state(status){const s=initialState();s.loans=[{id:'loan-cancel-001',customerId:'customer-synthetic',name:'SYNTHETIC',botId:'bot-1',amount:5000,fee:200,status,createdAt:'2026-11-10T00:00:00.000Z',paid:0,wallet:0,note:'',demoDays:0,kyc:{income:0,contacts:[],document:'synthetic'}}];return s}
const input=(status,requestId)=>({action:'cancel_application',role:'mini',loanId:'loan-cancel-001',consent:true,requestId});

test('cancel_application cancels decision_pending and approved loans',()=>{
 for(const status of ['decision_pending','approved'])assert.equal(applyAction(state(status),input(status,`cancel-${status}-001`)).loans[0].status,'cancelled');
});

test('cancel_application requires consent and cannot cancel signed loans',()=>{
 assert.throws(()=>applyAction(state('decision_pending'),{...input('decision_pending','cancel-no-consent'),consent:false}),/确认撤回/);
 assert.throws(()=>applyAction(state('signed'),input('signed','cancel-signed-001')),/申请状态已变化/);
});

test('cancel_application request ids are idempotent',()=>{
 const first=applyAction(state('approved'),input('approved','cancel-idem-001'));
 const second=applyAction(first,input('approved','cancel-idem-001'));
 assert.equal(second.loans[0].status,'cancelled');
 assert.equal(second.events.filter(event=>event.action==='cancel_application').length,1);
});
