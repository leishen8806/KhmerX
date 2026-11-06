import test from 'node:test';
import assert from 'node:assert/strict';

const source=await import('../lib/institution-callback-decision.ts');
const loan=(overrides={})=>({id:'loan-1',botId:'bot-1',name:'TEST',amount:3000,fee:200,status:'signed',paid:0,wallet:0,note:'贷款审批及复核通过，按用户已签合同等待放款',demoDays:0,approvalActor:'institution:unit-1',approvalCheckedBy:'checker-1',kyc:{income:0,contacts:[],document:''},...overrides});
const base=(overrides={})=>({loans:[loan(overrides)],bots:[],events:[],entries:[{loanId:'loan-1',cents:0}],notifications:[],requests:[],requestDigests:{}});

test('funding.confirmed marks institution initiation without money movement',()=>{
 const before=base(),next=source.applyInstitutionDecision(before,'loan-1','funding.confirmed','institution:unit-1','',undefined,'2026-11-06T00:00:00.000Z','FUND-1');
 assert.equal(next.loans[0].fundingActor,'institution:unit-1');
 assert.equal(next.loans[0].externalReference,'FUND-1');
 assert.equal(next.loans[0].status,'signed');
 assert.equal(next.loans[0].wallet,before.loans[0].wallet);
 assert.deepEqual(next.entries,before.entries);
 assert.match(next.loans[0].note,/等待财务复核/);
});

test('funding.confirmed rejects missing checker, wrong status, duplicate and missing reference',()=>{
 assert.throws(()=>source.applyInstitutionDecision(base({approvalCheckedBy:undefined}),'loan-1','funding.confirmed','institution:unit-1','',undefined,undefined,'FUND-1'),/状态/);
 assert.throws(()=>source.applyInstitutionDecision(base({status:'decision_pending'}),'loan-1','funding.confirmed','institution:unit-1','',undefined,undefined,'FUND-1'),/状态/);
 assert.throws(()=>source.applyInstitutionDecision(base({fundingActor:'institution:unit-1'}),'loan-1','funding.confirmed','institution:unit-1','',undefined,undefined,'FUND-1'),/状态/);
 assert.throws(()=>source.applyInstitutionDecision(base(),'loan-1','funding.confirmed','institution:unit-1','',undefined,undefined,''),/流水号/);
});
