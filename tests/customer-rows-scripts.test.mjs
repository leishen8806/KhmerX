import test from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../scripts/customer-rows/seed-5000.mjs';
import { shard } from '../scripts/customer-rows/common.mjs';

test('seed creates the requested fictional dataset without secrets',()=>{
  const rows=seed(5000);assert.equal(rows.length,5000);assert.equal(new Set(rows.map(x=>x.customerId)).size,5000);assert(!JSON.stringify(rows).match(/token|password|phone|secret/i));
});
test('legacy state split keeps only one customer and related records',()=>{
  const state={loans:[{id:'a',customerId:'A'},{id:'b',customerId:'B'}],events:[{loanId:'a'},{loanId:'b'}],entries:[],notifications:[],requests:[],requestDigests:{}};
  assert.deepEqual(Array.from(shard(state,'A').loans).map(x=>x.id),['a']);
});
