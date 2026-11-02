import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const client=readFileSync('app/team/client.tsx','utf8');
const subpages=readFileSync('lib/team/crm-subpages.ts','utf8');

test('team shell titles use the current section and its menu configuration',()=>{
  assert.match(client,/const sectionTitle=subview\|\|crmQueueDefaultViews\?\.\[queueView\]\|\|'今日概览'/);
  assert.match(client,/subviewMeta\?\.queue==='reports'/);
  assert.match(client,/document\.title=`\$\{sectionTitle\} · KhmerX 后台`/);
  assert.doesNotMatch(client,/customers:\s*["']客户中心["']/,'section parent labels must not be duplicated in the client');
});

test('different queue entry points have distinct configured section names',()=>{
  for(const [queue,label] of [['kyc','KYC 审核队列'],['customers','客户列表'],['reports','客户漏斗']]){
    assert.match(subpages,new RegExp(`${queue}:'${label}'`));
  }
});

test('breadcrumbs omit the fixed overview prefix and report KPI values share one style',()=>{
  assert.doesNotMatch(client,/>今日概览<\/a><i>\/<\/i><span>\{sectionParent\}<\/span>/);
  const report=readFileSync('components/report-center.tsx','utf8');
  const css=readFileSync('app/globals.css','utf8');
  assert.equal((report.match(/className="report-kpi"/g)||[]).length,4);
  assert.match(css,/\.report-kpis>\.report-kpi \.operator-row-status-plain\{[^}]*color:var\(--color-text-primary\);font-size:24px;font-weight:700/);
});
