import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateBill,defaultPricing,validatePricing} from '../lib/pricing.ts';
import {initialState,applyAction} from '../lib/domain.ts';
test('14-day upfront annual interest: 100 principal, 10 deduction, 0.69 interest, 89.31 net, 100 due',()=>{const b=calculateBill(10000,defaultPricing,'a');assert.deepEqual([b.deduction,b.interest,b.net,b.total],[1000,69,8931,10000]);});
test('14-day deferred annual interest: 90 net, 100.69 due',()=>{const b=calculateBill(10000,{...defaultPricing,interestTiming:'repayment'},'b');assert.deepEqual([b.net,b.total,b.interest],[9000,10069,69]);});
test('annual interest follows configured days; services charged once at chosen time',()=>{const p={...defaultPricing,termDays:7,serviceBps:1000};assert.equal(calculateBill(10000,p,'c').total,11000);const b=calculateBill(10000,{...p,serviceTiming:'upfront'},'d');assert.deepEqual([b.interest,b.net,b.total],[35,7965,10000]);});
test('round each whole-period fee once to cents and reject nonpositive net',()=>{const b=calculateBill(3001,{...defaultPricing,annualInterestBps:1812,termDays:3},'e');assert.equal(b.interest,4);for(const p of [{...defaultPricing,termDays:365,annualInterestBps:10000},{...defaultPricing,deductionBps:-1},{...defaultPricing,termDays:1.5},{...defaultPricing,annualInterestBps:NaN}])assert.throws(()=>validatePricing(p));});
test('both plans require matching explicit bill confirmation, fund net and settle exact total',()=>{
 for(const interestTiming of ['upfront','repayment']){
 let s=applyAction(initialState(),{action:'create',role:'mini',name:'Test',amount:10000,botId:'bot-1',consent:true,requestId:crypto.randomUUID()});let l=s.loans[0];l.billing=calculateBill(l.amount,{...defaultPricing,interestTiming},'quote-'+interestTiming);l.fee=l.billing.total-l.amount;l.status='kyc_approved';const apply={action:'apply',role:'mini',loanId:l.id,requestId:crypto.randomUUID()};assert.throws(()=>applyAction(s,apply));assert.throws(()=>applyAction(s,{...apply,billConfirmed:true,quoteId:'wrong'}));s=applyAction(s,{...apply,billConfirmed:true,quoteId:l.billing.quoteId});assert(s.loans[0].billConfirmedAt);s.loans[0].status='signed';s=applyAction(s,{action:'disburse',role:'lender',loanId:l.id,requestId:crypto.randomUUID()});l=s.loans[0];assert.equal(l.wallet,l.billing.net);assert.equal(s.entries.reduce((sum,e)=>sum+(e.debit==='loan_receivable'?e.cents:0),0),l.billing.total);s=applyAction(s,{action:'repay',role:'mini',loanId:l.id,cents:l.billing.total,requestId:crypto.randomUUID()});assert.equal(s.loans[0].status,'closed');
 }
});

test("ACT/365 annual interest at 30 and 365 days",()=>{for(const [termDays,interest] of [[30,148],[365,1800]])assert.equal(calculateBill(10000,{...defaultPricing,termDays},"year").interest,interest)});
