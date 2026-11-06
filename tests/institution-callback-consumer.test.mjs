import test from 'node:test';
import assert from 'node:assert/strict';

const source=await import('../lib/institution-callback-decision.ts');
const loan=()=>({id:'loan-1',botId:'bot-1',name:'TEST',amount:3000,fee:200,status:'decision_pending',paid:0,wallet:0,note:'等待机构审批',demoDays:0,kyc:{income:0,contacts:[],document:''}});
const base=()=>({loans:[loan()],bots:[],events:[],entries:[],notifications:[],requests:[],requestDigests:{}});

test('institution approval records actor but preserves checker gate',()=>{
 const next=source.applyInstitutionDecision(base(),'loan-1','loan.approved','institution:unit-1','',JSON.stringify({loanId:'loan-1'}),'2026-11-06T00:00:00.000Z');
 assert.equal(next.loans[0].status,'decision_pending');
 assert.equal(next.loans[0].approvalActor,'institution:unit-1');
 assert.equal(next.loans[0].signature,'已保存的手写签名');
 assert.equal(next.events[0].action,'loan.approved');
});

test('institution rejection closes decision and is idempotency-safe at state boundary',()=>{
 const next=source.applyInstitutionDecision(base(),'loan-1','loan.rejected','institution:unit-1','资料不完整','', '2026-11-06T00:00:00.000Z');
 assert.equal(next.loans[0].status,'rejected');
 assert.equal(next.loans[0].approvalActor,'institution:unit-1');
 assert.throws(()=>source.applyInstitutionDecision(next,'loan-1','loan.rejected','institution:unit-1','重复')); 
});

