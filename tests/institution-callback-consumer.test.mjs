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

test('institution funding confirmation records a maker without touching wallet or ledger',()=>{
 const original=base();original.loans[0].status='signed';original.loans[0].approvalCheckedBy='checker-1';
 const next=source.applyInstitutionDecision(original,'loan-1','funding.confirmed','institution:unit-1','',undefined,'2026-11-06T00:00:00.000Z','FUND-1');
 assert.equal(next.loans[0].status,'signed');
 assert.equal(next.loans[0].fundingActor,'institution:unit-1');
 assert.equal(next.loans[0].externalReference,'FUND-1');
 assert.equal(next.loans[0].wallet,original.loans[0].wallet);
 assert.deepEqual(next.entries,original.entries);
 assert.equal(next.events[0].action,'funding.confirmed');
 assert.throws(()=>source.applyInstitutionDecision(next,'loan-1','funding.confirmed','institution:unit-1','',undefined,'2026-11-06T00:00:00.000Z','FUND-1'),/状态/);
});

test('institution funding confirmation requires the independent approval check',()=>{
 const pending=base();pending.loans[0].status='signed';
 assert.throws(()=>source.applyInstitutionDecision(pending,'loan-1','funding.confirmed','institution:unit-1','',undefined,undefined,'FUND-1'),/状态/);
});

