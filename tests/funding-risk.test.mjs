import test from 'node:test';
import assert from 'node:assert/strict';
import {fundingRiskEventType,fundingRiskLevel} from '../lib/funding-risk.ts';

test('funding risk levels separate attention, warning and freeze',()=>{
  assert.equal(fundingRiskLevel({availableCents:400,poolCents:1000,warningPercent:20}),'normal');
  assert.equal(fundingRiskLevel({availableCents:250,poolCents:1000,warningPercent:20}),'attention');
  assert.equal(fundingRiskLevel({availableCents:200,poolCents:1000,warningPercent:20}),'warning');
  assert.equal(fundingRiskLevel({availableCents:0,poolCents:1000,warningPercent:20}),'frozen');
  assert.equal(fundingRiskEventType('warning'),'funding_regulatory_warning');
  assert.equal(fundingRiskEventType('frozen'),'funding_regulatory_freeze');
});
