import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInstitutionActionPlan,assertPlanPrecondition} from '../lib/institution-event-plans.ts';

const loan=(status='decision_pending')=>({id:'loan-1',status,amount:10000,fee:0,paid:0,wallet:0,name:'TEST',botId:'bot-1',createdAt:new Date().toISOString(),demoDays:0,kyc:{income:0,contacts:[],document:''}});
test('institution events produce status-bound action plans',()=>{
 const p=buildInstitutionActionPlan({eventType:'loan.approved',loanId:'loan-1'},loan());assert.equal(p.kind,'approval');assertPlanPrecondition(p,loan());
 const funding=buildInstitutionActionPlan({eventType:'funding.confirmed',loanId:'loan-1',externalReference:'FUND-1'},loan('signed'));assert.equal(funding.kind,'funding');assert.equal(funding.externalReference,'FUND-1');
 const repayment=buildInstitutionActionPlan({eventType:'repayment.confirmed',loanId:'loan-1',amountCents:100},loan('active'));assert.equal(repayment.amountCents,100);
});
test('institution event plans reject wrong status, amount and unknown events',()=>{
 const p=buildInstitutionActionPlan({eventType:'loan.approved',loanId:'loan-1'},loan());assert.throws(()=>assertPlanPrecondition(p,loan('signed')),/状态/);
 assert.throws(()=>buildInstitutionActionPlan({eventType:'repayment.confirmed',loanId:'loan-1',amountCents:0},loan('active')),/金额/);
 assert.throws(()=>buildInstitutionActionPlan({eventType:'unknown.event',loanId:'loan-1'},loan()),/不支持/);
});
