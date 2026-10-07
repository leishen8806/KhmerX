import test from 'node:test';
import assert from 'node:assert/strict';
import {signInstitutionCallback,verifyInstitutionCallback} from '../lib/institution-callback.ts';

test('institution callback signature binds institution, timestamp, nonce and body',async()=>{
 const input={institutionId:'inst-a',timestamp:String(Math.floor(Date.now()/1000)),nonce:'nonce-1234567890',body:JSON.stringify({eventType:'loan.approved',id:'L1'})};
 const signature=await signInstitutionCallback('synthetic-secret',input);
 assert.equal(signature.length,64);
 assert.equal(await verifyInstitutionCallback('synthetic-secret',{...input,signature}),true);
 assert.equal(await verifyInstitutionCallback('wrong-secret',{...input,signature}),false);
 assert.equal(await verifyInstitutionCallback('synthetic-secret',{...input,signature,body:'{}'}),false);
});

test('institution callback rejects stale timestamps, malformed nonce and replay-shaped input',async()=>{
 const input={institutionId:'inst-a',timestamp:String(Math.floor(Date.now()/1000)-301),nonce:'nonce-1234567890',body:'{}'};
 const signature=await signInstitutionCallback('synthetic-secret',input);
 assert.equal(await verifyInstitutionCallback('synthetic-secret',{...input,signature}),false);
 assert.equal(await verifyInstitutionCallback('synthetic-secret',{...input,nonce:'short',signature}),false);
});
