import test from 'node:test';
import assert from 'node:assert/strict';
import {nextCallbackRetry,callbackAttemptStatus,manualCallbackRetry,callbackRetryPolicy} from '../lib/institution-callback-queue.ts';

test('callback retries use bounded exponential-style backoff and end in dead letter',()=>{
 assert.deepEqual(nextCallbackRetry(0,100),{status:'pending',nextAt:160});
 assert.deepEqual(nextCallbackRetry(1,100),{status:'pending',nextAt:160});
 assert.deepEqual(nextCallbackRetry(4,100),{status:'pending',nextAt:3700});
 assert.deepEqual(nextCallbackRetry(callbackRetryPolicy.maxAttempts,100),{status:'dead_letter',nextAt:null});
 assert.deepEqual(callbackAttemptStatus(5,'invalid response'),{attempts:5,status:'dead_letter',nextAt:null,lastError:'invalid response'});
 assert.deepEqual(manualCallbackRetry(5,100),{attempt:6,status:'pending',nextAt:160});
 assert.deepEqual(manualCallbackRetry(9,100),{attempt:10,status:'pending',nextAt:160});
});
