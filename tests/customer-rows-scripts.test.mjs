import test from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../scripts/customer-rows/seed-5000.mjs';
import { shard } from '../scripts/customer-rows/common.mjs';
import { mergeCustomerShards, reverseMerge, MAX_WORKSPACE_PAYLOAD_BYTES } from '../scripts/customer-rows/reverse-merge.mjs';

test('seed creates the requested fictional dataset without secrets',()=>{
  const rows=seed(5000);assert.equal(rows.length,5000);assert.equal(new Set(rows.map(x=>x.customerId)).size,5000);assert(!JSON.stringify(rows).match(/token|password|phone|secret/i));
});
test('legacy state split keeps only one customer and related records',()=>{
  const state={loans:[{id:'a',customerId:'A'},{id:'b',customerId:'B'}],events:[{loanId:'a'},{loanId:'b'}],entries:[],notifications:[],requests:[],requestDigests:{}};
  assert.deepEqual(Array.from(shard(state,'A').loans).map(x=>x.id),['a']);
});
test('reverse merge preserves tenant state and merges customer requests',()=>{
  const bots=[{id:'bot-1'}];
  const state={bots,loans:[{id:'old-a',customerId:'A'},{id:'legacy',customerId:'Z'}],events:[{loanId:'old-a'},{loanId:'legacy'}],entries:[],notifications:[],requests:[],requestDigests:{}};
  const rows=[{customer_id:'A',payload:JSON.stringify({loans:[{id:'new-a',customerId:'A'}],events:[{loanId:'new-a'}],entries:[],notifications:[],requests:['r1'],requestDigests:{r1:'d1'}})}];
  const merged=mergeCustomerShards(state,rows,'tenant-a');
  assert.deepEqual(merged.next.loans.map(x=>x.id),['legacy','new-a']);
  assert.deepEqual(merged.next.events.map(x=>x.loanId),['legacy','new-a']);
  assert.deepEqual(merged.next.requests,['r1']);
  assert.equal(merged.next.requestDigests.r1,'d1');
  assert.equal(merged.next.bots,bots);
});
test('reverse merge replaces old related records without duplicating unchanged loan ids',()=>{
  const state={loans:[{id:'same',customerId:'A'}],events:[{id:'old-event',loanId:'same'}],entries:[{id:'old-entry',loanId:'same'}],notifications:[{id:'old-notice',loanId:'same'}],requests:[],requestDigests:{}};
  const rows=[{customer_id:'A',payload:JSON.stringify({loans:[{id:'same',customerId:'A'}],events:[{id:'new-event',loanId:'same'}],entries:[{id:'new-entry',loanId:'same'}],notifications:[{id:'new-notice',loanId:'same'}],requests:[],requestDigests:{}})}];
  const merged=mergeCustomerShards(state,rows,'tenant-a');
  assert.deepEqual(merged.next.events.map(x=>x.id),['new-event']);
  assert.deepEqual(merged.next.entries.map(x=>x.id),['new-entry']);
  assert.deepEqual(merged.next.notifications.map(x=>x.id),['new-notice']);
});
test('reverse merge refuses oversized tenant state before apply',()=>{
  const state={loans:[],events:[],entries:[],notifications:[],requests:[],requestDigests:{},blob:'x'.repeat(MAX_WORKSPACE_PAYLOAD_BYTES)};
  assert.throws(()=>mergeCustomerShards(state,[],'tenant-big'),/reverse merge exceeds workspace payload limit/);
});
test('reverse merge applies with revision CAS and reports a conflict before claiming success',()=>{
  const state={loans:[],events:[],entries:[],notifications:[],requests:[],requestDigests:{}};
  const calls=[];
  const database={prepare(sql){
    return {
      all(...args){
        if(sql.includes('demo_workspaces'))return [{owner:'tenant-a',revision:7,payload:JSON.stringify(state)}];
        if(sql.includes('customer_workspaces'))return [{customer_id:'A',payload:JSON.stringify({loans:[],events:[],entries:[],notifications:[],requests:[],requestDigests:{}})}];
        throw new Error(`unexpected query ${sql}`);
      },
      run(...args){calls.push({sql,args});return {changes:0};
      },
    };
  }};
  assert.throws(()=>reverseMerge(database,{tenant:'tenant-a',apply:true}),/reverse merge revision conflict for tenant-a/);
  assert.equal(calls.length,1);
  assert.deepEqual(calls[0].args.slice(1),['tenant-a',7]);
});
