import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'app/team/client.tsx'),'utf8');

test('service backend menu keeps merged customer and KYC entries unique',()=>{
  assert.doesNotMatch(source,/\['客户 360° 详情','\/team\/customers'/);
  assert.doesNotMatch(source,/\['待补件','\/team\/kyc'/);
  assert.doesNotMatch(source,/\['补件任务','\/team\/kyc'/);
  const groups=[...source.matchAll(/\['(?:工作台|客户中心|业务中心|服务中心|风控与资金|产品与运营|报表中心|组织与系统|审计与安全)'\s*,\[([\s\S]*?)\]\],/g)].map(([,items])=>[...items.matchAll(/\['([^']+)'\s*,/g)].map(([,label])=>label));
  const labels=groups.flat();
  assert.equal(labels.length,new Set(labels).size,'菜单二级名称必须唯一');
});
