import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const client=readFileSync('app/team/client.tsx','utf8');
const router=readFileSync('components/crm-subpages.tsx','utf8');

test('finance checker funding entry opens the funding review view',()=>{
  assert.match(client,/initialQueue!=='funding'/);
  assert.match(client,/data\?\.member\?\.role==='finance_checker'/);
  assert.match(client,/setSubview\('放款复核'\)/);
  assert.match(router,/view==='放款复核'/);
  assert.match(router,/<FundingPanel/);
});
