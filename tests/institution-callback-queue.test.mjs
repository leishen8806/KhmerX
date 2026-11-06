import test from 'node:test';
import assert from 'node:assert/strict';
import {nextCallbackRetry,callbackAttemptStatus,callbackRetryPolicy,callbackConsumerRetry,retryRevisionConflict} from '../lib/institution-callback-queue.ts';
import {applyInstitutionDecision} from '../lib/institution-callback-decision.ts';

test('callback retries use bounded exponential-style backoff and end in dead letter',()=>{
 assert.deepEqual(nextCallbackRetry(0,100),{status:'pending',nextAt:160});
 assert.deepEqual(nextCallbackRetry(1,100),{status:'pending',nextAt:160});
 assert.deepEqual(nextCallbackRetry(4,100),{status:'pending',nextAt:3700});
 assert.deepEqual(nextCallbackRetry(callbackRetryPolicy.maxAttempts,100),{status:'dead_letter',nextAt:null});
 assert.deepEqual(callbackAttemptStatus(5,'invalid response'),{attempts:5,status:'dead_letter',nextAt:null,lastError:'invalid response'});
});

test('revision conflicts keep the event received and schedule a retry before a later applied attempt',()=>{
 const retry=callbackConsumerRetry('REVISION_CONFLICT',100);
 assert.deepEqual(retry,{eventStatus:'received',attemptStatus:'pending',nextAt:130,lastError:'REVISION_CONFLICT'});
 assert.equal(callbackConsumerRetry('LOAN_NOT_FOUND',100),null);
 // A later consumer attempt is allowed to apply the approval after the race is gone;
 // this preserves the existing approval transition and its institution actor.
 const state={loans:[{id:'loan-1',status:'decision_pending',amount:1,fee:0,paid:0,wallet:0,botId:'bot-1',name:'TEST',note:'',demoDays:0,kyc:{income:0,contacts:[],document:''}}],bots:[],events:[],entries:[],notifications:[],requests:[],requestDigests:{}};
 const applied=applyInstitutionDecision(state,'loan-1','loan.approved','institution:unit-1','',JSON.stringify({loanId:'loan-1'}),'2026-11-06T00:00:00.000Z');
 assert.equal(applied.loans[0].approvalActor,'institution:unit-1');
 assert.equal(applied.events[0].action,'loan.approved');
});

test('callback consumer retries two revision conflicts and applies on the third attempt',async()=>{
 let calls=0;
 const result=await retryRevisionConflict(async()=>{
  calls++;
  return calls<3?{status:'received',reason:'REVISION_CONFLICT'}:{status:'applied'};
 });
 assert.equal(calls,3);
 assert.deepEqual(result,{result:{status:'applied'},attempts:3,exhausted:false});
});

test('callback consumer stops after three revision conflicts for upstream retry',async()=>{
 let calls=0;
 const result=await retryRevisionConflict(async()=>{
  calls++;
  return {status:'received',reason:'REVISION_CONFLICT'};
 });
 assert.equal(calls,3);
 assert.equal(result.attempts,3);
 assert.equal(result.exhausted,true);
 assert.deepEqual(result.result,{status:'received',reason:'REVISION_CONFLICT'});
});
