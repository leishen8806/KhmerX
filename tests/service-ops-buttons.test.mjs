import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = name => fs.readFileSync(new URL(`../components/${name}`, import.meta.url), 'utf8');

test('service operations mark irreversible actions as danger buttons', () => {
  const crm = read('crm-subpages.tsx');
  const repayment = read('repayment-panel.tsx');
  const tickets = read('service-tickets.tsx');
  assert.ok(crm.includes('variant="destructive"') && crm.includes('>关闭事件</Button>'));
  assert.ok(crm.includes('variant="destructive"') && crm.includes('>撤销会话</Button>'));
  assert.ok(repayment.includes('variant="destructive"') && repayment.includes('>确认登记测试还款</Button>'));
  assert.match(tickets, /<Button disabled=\{busy\|\|t\.status==='closed'\} onClick=\{\(\)=>void update\(t\)\}>处理<\/Button>/);
});
