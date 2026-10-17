import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'app/team/client.tsx'),'utf8');
const subpages=fs.readFileSync(path.join(process.cwd(),'lib/team/crm-subpages.ts'),'utf8');

test('service backend menu keeps merged customer and KYC entries unique',()=>{
  assert.doesNotMatch(source,/\['客户 360° 详情','\/team\/customers'/);
  assert.doesNotMatch(source,/\['待补件','\/team\/kyc'/);
  assert.doesNotMatch(source,/\['补件任务','\/team\/kyc'/);
  assert.match(source,/\['资金限额','\/team\/funding','funding'\]/);
  assert.match(source,/\['资金监管','\/team\/funding','funding'\]/);
  assert.doesNotMatch(source,/\['每日放款限额','\/team\/funding','funding'\]/);
  assert.doesNotMatch(source,/\['每月放款限额','\/team\/funding','funding'\]/);
  assert.doesNotMatch(source,/\['20% 资金预警','\/team\/funding','funding'\]/);
  const groups=[...source.matchAll(/\['(?:工作台|客户中心|业务中心|服务中心|风控与资金|产品与运营|报表中心|组织与系统|审计与安全)'\s*,\[([\s\S]*?)\]\],/g)].map(([,items])=>[...items.matchAll(/\['([^']+)'\s*,/g)].map(([,label])=>label));
  const labels=groups.flat();
  assert.equal(labels.length,new Set(labels).size,'菜单二级名称必须唯一');
  assert.match(subpages,/hiddenCrmViews=new Set\(\['客户 360° 详情','待补件','补件任务'\]\)/);
  assert.match(subpages,/view==='待补件'\|\|view==='补件任务'\?'KYC 审核队列'/);
});
