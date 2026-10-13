import test from 'node:test';
import assert from 'node:assert/strict';
import {assertFundingCapacity,fundingUsage,fundingStatus,defaultFundingLimits} from '../lib/funding-limits.ts';

const entry=(cents,at,kind='测试放款')=>({id:crypto.randomUUID(),loanId:'loan',kind,cents,debit:'loan_receivable',credit:'funding_cash',at});

test('funding limits calculate Cambodia day and month usage and 20% warning',()=>{
  const now='2026-10-07T04:00:00.000Z';
  const entries=[entry(790000,'2026-10-07T01:00:00.000Z'),entry(100000,'2026-10-06T17:00:00.000Z'),entry(999999,'2026-09-30T16:00:00.000Z'),entry(500000,'2026-10-07T01:00:00.000Z','测试还款')];
  assert.deepEqual(fundingUsage(entries,now),{dayCents:890000,monthCents:890000});
  const result=assertFundingCapacity(entries,10000,now);
  assert.equal(result.projectedDayCents,900000);
  assert.equal(result.warning,true);
});

test('funding guard rejects daily and monthly over-limit disbursement with machine code',()=>{
  const now='2026-10-07T04:00:00.000Z';
  assert.throws(()=>assertFundingCapacity([entry(defaultFundingLimits.dailyCents,'2026-10-07T01:00:00.000Z')],1,now),error=>error.code==='FUNDING_LIMIT_EXCEEDED');
  assert.throws(()=>assertFundingCapacity([entry(defaultFundingLimits.monthlyCents,'2026-10-01T01:00:00.000Z')],1,now),error=>error.code==='FUNDING_LIMIT_EXCEEDED');
});

test('funding status exposes remaining allowance, warning and hard block separately',()=>{
  const now='2026-10-07T04:00:00.000Z';
  const status=fundingStatus([entry(800000,'2026-10-07T01:00:00.000Z')],now);
  assert.equal(status.dailyRemainingCents,200000);
  assert.equal(status.dailyPercent,80);
  assert.equal(status.warning,true);
  assert.equal(status.blocked,false);
  const blocked=fundingStatus([entry(defaultFundingLimits.dailyCents,'2026-10-07T01:00:00.000Z')],now);
  assert.equal(blocked.blocked,true);
  assert.equal(blocked.dailyRemainingCents,0);
});
