import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const repayment=readFileSync('components/repayment-panel.tsx','utf8');
const crm=readFileSync('components/crm-subpages.tsx','utf8');

test('admin repayment copy renders one selected locale',()=>{
 const i18n=readFileSync('components/team-ui-copy.ts','utf8');
 assert.match(i18n,/repaymentTitle:'还款管理'/);
 assert.match(i18n,/repaymentTitle:'Repayments'/);
 assert.match(i18n,/repaymentTitle:'ការសងប្រាក់'/);
 assert.match(repayment,/useAdminLocale/);
 assert.doesNotMatch(repayment,/还款管理 \/ Repayment \/ ការសងប្រាក់/);
});

test('loan application table translates headers and statuses',()=>{
 assert.match(crm,/columnLabels=\{\{id:t\('loanId'\),status:t\('status'\),customerId:t\('customerId'\),amount:t\('amount'\),fee:t\('fee'\)\}\}/);
 assert.match(crm,/statusText\(l\.status\)/);
});

test('settled repayments remain selectable in the paid-off filter',()=>{
 assert.match(repayment,/\['active','closed'\]\.includes\(l\.status\)/);
 assert.match(repayment,/<option value="closed">\{t\('closedFilter'\)\}<\/option>/);
 assert.match(repayment,/data-loan-status=\{l\.status\}/);
});
