import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('KYC customer status surfaces localize review decisions and use the brand progress color', async () => {
  const client = await readFile('app/kyc/client.tsx', 'utf8');
  const overview = await readFile('components/kyc-customer-overview.css', 'utf8');
  const globals = await readFile('app/globals.css', 'utf8');
  assert.match(client, /reviewDecisionLabel/);
  assert.match(client, /kycText\('人工资料审核通过',locale\)/);
  assert.match(client, /kycText\('待补件',locale\)/);
  assert.match(client, /kycText\('资料审核未通过',locale\)/);
  assert.doesNotMatch(client, /资料审核មិនបានអនុម័ត/);
  assert.match(client, /kyc-review-notice--\$\{record\.review\.decision\}/);
  assert.doesNotMatch(client, /localLabel\(statusLabels\[record\.review\.decision/);
  assert.match(overview, /accent-color:#1677ff/);
  assert.match(globals, /kyc-review-notice--approved/);
  assert.match(globals, /kyc-review-notice--rejected/);
  assert.match(globals, /\.mini-app \.customer-primary-link\{background:#1677ff;color:#fff/);
});
