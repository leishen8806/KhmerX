import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'app/team/client.tsx'),'utf8');
const subpages=fs.readFileSync(path.join(process.cwd(),'lib/team/crm-subpages.ts'),'utf8');
const router=fs.readFileSync(path.join(process.cwd(),'components/crm-subpages.tsx'),'utf8');

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
  assert.match(source,/const nonLoanRole=\['audit','kyc','ops','dept_admin','collection_admin','collector'\]\.includes\(role\)/,'非贷款岗位需要显式识别');
  assert.match(source,/const hiddenGroups=\['组织与系统','产品与运营',\.\.\.\(nonLoanRole\?\['业务中心'\]\:\[\]\)\]/,'非贷款岗位不得显示业务中心');
  assert.match(source,/const visibleGroups=admin\|\|lender\?groups:groups\.filter/,'普通员工不得显示组织与产品管理菜单');
  assert.match(source,/const workspaceTabs=\(admin\|\|member\?\.role==='audit'/,'工作区业务标签必须按岗位范围收敛');
  assert.match(source,/const activeWorkspaceTab=workspaceTabs\.some\(\(\[key\]\)=>key===queueView\)\?queueView:defaultWorkspaceTab/,'隐藏标签不能成为当前工作区');
  assert.match(source,/member\.role==='kyc'\|\|member\.role==='dept_admin'\|\|member\.role==='ops'\?\[\['kyc','KYC 待审核'/,'非贷款岗位概览不得显示贷款和资金快捷入口');
  assert.match(source,/\(admin\|\|member\.role==='audit'\|\|member\.role==='finance'\|\|member\.role==='finance_checker'\|\|lender\)&&<section className="crm-overview-section"/,'资金风险摘要需按岗位显示');
  assert.match(subpages,/hiddenCrmViews=new Set\(\['客户 360° 详情','待补件','补件任务'\]\)/);
  assert.match(subpages,/view==='待补件'\|\|view==='补件任务'\?'KYC 审核队列'/);
  assert.match(router,/function roleAllowsCrmView\(role:string,view:string\)/,'直接访问页面必须经过岗位守卫');
  assert.match(router,/if\(!roleAllowsCrmView\(props\.member\?\.role\|\|'',view\)\)return <Frame view=\{view\} title="无权访问">/,'无权岗位不得渲染业务页面');
});
