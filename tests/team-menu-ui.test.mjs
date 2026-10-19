import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source=fs.readFileSync(path.join(process.cwd(),'app/team/client.tsx'),'utf8');
const subpages=fs.readFileSync(path.join(process.cwd(),'lib/team/crm-subpages.ts'),'utf8');
const router=fs.readFileSync(path.join(process.cwd(),'components/crm-subpages.tsx'),'utf8');
const products=fs.readFileSync(path.join(process.cwd(),'app/api/team/products/route.ts'),'utf8');
const riskRules=fs.readFileSync(path.join(process.cwd(),'lib/team/risk-rules.ts'),'utf8');
const customerTags=fs.readFileSync(path.join(process.cwd(),'app/api/team/customer-tags/route.ts'),'utf8');
const localeRoute=fs.readFileSync(path.join(process.cwd(),'app/api/team/locale/route.ts'),'utf8');
const reportCenter=fs.readFileSync(path.join(process.cwd(),'components/report-center.tsx'),'utf8');
const teamClient=fs.readFileSync(path.join(process.cwd(),'app/team/client.tsx'),'utf8');

test('customer tag writes enforce the current employee data scope',()=>{
  assert.match(customerTags,/import \{assignment,audit,db,staff\} from ['"]@\/lib\/team\/server['"]/);
  assert.match(customerTags,/import \{canSee\} from ['"]@\/lib\/team\/policy['"]/);
  assert.match(customerTags,/const target=await assignment\(s\.tenant\.id,customerId\);if\(!target\|\|!canSee\(s\.member,target,'summary'\)\)/);
  assert.match(customerTags,/links\.results as any\[\]\)\.filter\(link=>canSee\(s\.member,link,'summary'\)\)/,'客户标签读取也必须按当前岗位范围过滤');
});

test('staff locale changes write an audit record',()=>{
  assert.match(localeRoute,/import \{staff,db,audit\} from ['"]@\/lib\/team\/server['"]/);
  assert.match(localeRoute,/staff_locale_change/);
});

test('report export controls match the server role allowlist',()=>{
  assert.match(reportCenter,/const reportExportRoles=new Set\(\['admin','audit','finance','finance_checker','collection_admin','collector'\]\)/);
  assert.match(reportCenter,/role\?:string/);
  assert.match(reportCenter,/const canExport=reportExportRoles\.has\(role\|\|''\)/);
  assert.match(reportCenter,/canExport\?<><select aria-label="导出报表类型"/,'无导出权限岗位不得看到会失败的导出控件');
  assert.match(router,/ReportCenter customers=\{work\?\.customers\|\|\[\]\} loans=\{work\?\.state\?\.loans\|\|\[\]\} entries=\{work\?\.state\?\.entries\|\|\[\]\} notifications=\{work\?\.state\?\.notifications\|\|\[\]\} role=\{member\?\.role\|\|''\}/,'报表页面必须传递当前岗位');
  assert.match(teamClient,/TabsContent value="reports"><ReportCenter customers=\{work\?\.customers\|\|\[\]\} loans=\{work\?\.state\?\.loans\|\|\[\]\} entries=\{work\?\.state\?\.entries\|\|\[\]\} notifications=\{work\?\.state\?\.notifications\|\|\[\]\} role=\{member\?\.role\|\|''\}/,'工作台报表标签也必须传递当前岗位');
});

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
  assert.match(source,/const nonLoanRole=\['audit','kyc','ops','dept_admin','finance','collection_admin','collector'\]\.includes\(role\)/,'非贷款岗位需要显式识别');
  assert.match(source,/const hiddenGroups=\['组织与系统',\.\.\.\(nonLoanRole&&role!=='ops'\?\['产品与运营'\]\:\[\]\),\.\.\.\(nonLoanRole\?\['业务中心'\]\:\[\]\),\.\.\.\(role==='finance'\?\['客户中心','服务中心'\]/,'非贷款岗位不得显示越权业务菜单');
  assert.match(source,/groupName==='产品与运营'&&role==='ops'.*\['贷款产品','风控规则与版本'\]/,'运营岗位产品菜单只能显示已授权页面');
  assert.match(source,/const visibleGroups=\(admin\|\|lender\?groups:groups\.filter[\s\S]*\.filter\(\(\[,children\]:any\)=>children\.length\)/,'普通员工不得显示越权菜单，运营岗位只保留授权产品入口');
  assert.match(source,/const workspaceTabs=\(admin\|\|member\?\.role==='audit'/,'工作区业务标签必须按岗位范围收敛');
  assert.match(source,/const activeWorkspaceTab=workspaceTabs\.some\(\(\[key\]\)=>key===queueView\)\?queueView:defaultWorkspaceTab/,'隐藏标签不能成为当前工作区');
  assert.match(source,/member\.role==='kyc'\|\|member\.role==='dept_admin'\|\|member\.role==='ops'\?\[\['kyc','KYC 待审核'/,'非贷款岗位概览不得显示贷款和资金快捷入口');
  assert.match(source,/\(admin\|\|member\.role==='audit'\|\|member\.role==='finance'\|\|member\.role==='finance_checker'\|\|lender\)&&<section className="crm-overview-section"/,'资金风险摘要需按岗位显示');
  assert.match(subpages,/hiddenCrmViews=new Set\(\['客户 360° 详情','待补件','补件任务'\]\)/);
  assert.match(subpages,/view==='待补件'\|\|view==='补件任务'\?'KYC 审核队列'/);
  assert.doesNotMatch(router,/roleAllowsCrmView[\s\S]*客户 360° 详情/,'旧版 360 详情不得被岗位直链守卫重新开放');
  assert.doesNotMatch(router,/roleAllowsCrmView[\s\S]*待补件/,'待补件不得作为独立岗位页面重新开放');
  assert.match(router,/function roleAllowsCrmView\(role:string,view:string\)/,'直接访问页面必须经过岗位守卫');
  assert.match(router,/if\(role==='admin'\)return true;const audit=\[/,'只有管理员先获得全量页面守卫');
  assert.match(router,/if\(audit\.includes\(view\)\)return role==='audit';/,'审计与安全页面不得被普通员工通过直链访问');
  assert.match(products,/if\(!rolesWrite\.includes\(role\)&&role!==['"]admin['"]\)/,'贷款产品写接口不得把审计员当作可写岗位');
  assert.match(products,/export const GET=route\(\{handler:async\(\)=>\{\s*const s=await context\(\);\s*if\(!rolesWrite\.includes\(s\.member\.role\)&&s\.member\.role!==['"]admin['"]\)/,'贷款产品读取接口必须与产品管理岗位范围一致');
  assert.match(products,/if\(role!==['"]admin['"]\)throw new ApiError\(403,'FORBIDDEN','仅公司管理员可审核产品'/,'贷款产品审核必须由公司管理员执行');
  assert.match(riskRules,/const reviewerRoles=new Set\(\[['"]admin['"]\]\)/,'风控规则审核不得授予审计员写权限');
  assert.match(riskRules,/const readerRoles=new Set\(\[['"]admin['"],['"]audit['"],['"]ops['"]\]\)/,'风控规则读取必须限制为管理员、运营或审计岗位');
  assert.match(riskRules,/if\(!s\|\|!readerRoles\.has\(s\.member\.role\)\)throw new AuthError\(['"]当前岗位无权查看风控规则/,'风控规则列表不得向普通员工开放');
  assert.match(riskRules,/if\(!readerRoles\.has\(role\)\)throw new AuthError\(['"]当前岗位无权模拟风控规则/,'风控规则模拟必须复用读取岗位范围');
  assert.match(router,/function RiskEvents\(\{work,role\}/,'资金风险页面必须接收当前岗位');
  assert.match(router,/const canResolve=role==='admin';/,'资金风险处置控件只能由公司管理员看到');
  assert.match(router,/function FundingFreeze\(\{work,units,role,memberId\}/,'冻结页面必须接收当前岗位');
  assert.match(router,/role==='admin'\?<EmergencyAccess units=\{units\}/,'应急授权控件仅公司管理员可见');
  const emergency=fs.readFileSync(path.join(process.cwd(),'components/emergency-access.tsx'),'utf8');
  assert.match(emergency,/item\.requester_id!==memberId/,'应急申请人不得看到自己的批准按钮');
  assert.match(router,/if\(!roleAllowsCrmView\(props\.member\?\.role\|\|'',view\)\)return <Frame view=\{view\} title="无权访问">/,'无权岗位不得渲染业务页面');
  assert.match(router,/if\(role==='audit'\)return \['字段权限','数据范围'/,'审计员独立页面必须限制为只读业务视图');
  assert.match(router,/if\(role==='ops'\)return \['我的待办',[\s\S]*'贷款产品','风控规则与版本'\]/,'运营岗位页面必须与产品和风控规则读写接口保持一致');
  assert.match(router,/\['lender','checker'\]\.includes\(role\)/,'机构审批员与机构复核员必须共享贷款业务页面守卫');
  assert.match(subpages,/view==='贷款复核'\?'贷款申请':view==='放款复核'\?'放款管理'/,'持牌机构复核入口必须规范化到实际业务页面');
  assert.match(router,/const view=canonicalCrmView\(props\.view\)/,'独立子页面组件必须复用统一别名规范化');
  assert.match(router,/function AuditExportPage\(\{role\}/,'审计完整性页面必须接收当前岗位');
  assert.match(router,/view==='审计导出'.*<AuditExportPage role=\{props\.member\?\.role\|\|''\}/,'审计导出直达路由必须传递当前岗位');
  const auditIntegrity=fs.readFileSync(path.join(process.cwd(),'lib/team/audit-integrity.ts'),'utf8');
  assert.match(auditIntegrity,/async function writer\(\).*s\.member\.role!==['"]admin['"]/,'审计完整性快照写操作仅限公司管理员');
  assert.match(auditIntegrity,/async function reader\(\).*\[['"]admin['"],'audit'\]/,'审计完整性列表允许管理员和审计员只读查看');
  const notifications=fs.readFileSync(path.join(process.cwd(),'components/telegram-notifications.tsx'),'utf8');
  assert.match(notifications,/canManage=admin/,'通知记录页必须区分管理员写权限与审计员只读权限');
  assert.match(notifications,/canManage&&\['failed','unknown'\]\.includes\(d\.status\)/,'通知人工重试按钮仅管理员可见');
  const tickets=fs.readFileSync(path.join(process.cwd(),'components/service-tickets.tsx'),'utf8');
  assert.match(tickets,/canEdit=true/,'工单页面必须接收可编辑权限');
  assert.match(tickets,/canEdit&&<Button variant="outline"/,'审计员工单页面不得显示处理按钮');
  const kycFiles=fs.readFileSync(path.join(process.cwd(),'app/api/kyc/files/route.ts'),'utf8');
  assert.match(kycFiles,/reviewerSession\.team\?\.member\.role==='audit'.*不可下载 KYC 材料/,'审计员不得通过文件接口下载 KYC 原始材料');
  const teamServer=fs.readFileSync(path.join(process.cwd(),'lib/team/server.ts'),'utf8');
  assert.match(teamServer,/if\(p\.action==='mfa_disable'\)\{\s*if\(s\.member\.role==='audit'\).*MFA_REQUIRED/,'审计岗位必须保持 MFA 开启');
  assert.match(source,/role==='lender'\|\|role==='checker'\|\|role==='finance_checker'/,'持牌机构角色必须显示专属菜单');
  assert.match(source,/member\.role==='lender'\|\|member\.role==='checker'\|\|member\.role==='finance_checker'/,'机构审批员必须看到机构待办与风险摘要');
  assert.match(source,/member\.role==='lender'\?\[\['loans','贷款审批'/,'机构审批员首页快捷卡必须进入贷款审批');
  assert.match(source,/queue==='funding'&&role==='finance_checker'\)view='放款复核'/,'放款复核员首页快捷卡必须进入放款复核');
  assert.match(source,/\['audit','kyc','ops','dept_admin','finance','collection_admin','collector'\]\.includes\(role\)/,'放款员不得看到贷款审批类通用菜单');
  assert.match(source,/initialQueue==='loans'&&currentRole==='checker'\)setSubview\('贷款复核'\)/,'机构复核员直接进入贷款路径时必须落到复核页面');
  assert.match(source,/initialQueue==='funding'&&currentRole==='finance_checker'\)setSubview\('放款复核'\)/,'放款复核员直接进入资金路径时必须落到复核页面');
  assert.match(source,/CrmSubpageRouter view=\{canonicalCrmView\(subview\)\}/,'角色专属别名路由必须在页面守卫前统一规范化');
  assert.match(source,/role==='finance'\?\['客户中心','服务中心'\]/,'放款员不得看到客户与贷后服务菜单');
  assert.match(router,/role==='finance'\)return \['放款管理','账单与还款'/,'放款员页面守卫必须保留资金业务入口');
});

test('MFA security menu label stays unified while legacy links remain compatible in deployed builds',()=>{
  assert.match(source,/操作审计','#team-audit','audit'\],\['MFA 与登录安全','#team-audit','audit'\]/,'侧栏必须使用统一的 MFA 与登录安全名称');
  assert.match(subpages,/view==='登录与 IP'\|\|view==='MFA 与登录安全'\?'登录与 IP'/,'旧登录与 IP 链接必须继续规范化到同一内部页面');
  assert.match(router,/if\(view==='登录与 IP'\)return <Frame view=\{view\} title="MFA 与登录安全">/,'页面标题必须把旧内部视图显示为统一的新名称');
  assert.match(teamClient,/subview==='登录与 IP'\?'MFA 与登录安全':subview/,'面包屑必须把旧内部视图显示为统一的新名称');
});

test('audit staff can reach read-only organization pages from the sidebar',()=>{
  assert.match(source,/role==='audit'&&groupName==='组织与系统'\|\|!hiddenGroups\.includes\(groupName\)/);
  assert.match(source,/groupName==='组织与系统'&&role==='audit'.*\['数据范围','字段权限','系统健康'\]/);
  assert.match(router,/if\(role==='audit'\)return \['字段权限','数据范围','系统健康'/);
});

test('team data reads do not create organization records',()=>{
  const teamServer=fs.readFileSync(path.join(process.cwd(),'lib/team/server.ts'),'utf8');
  const teamDataBody=teamServer.slice(teamServer.indexOf('export async function teamData()'),teamServer.indexOf('export async function teamMembersPage'));
  assert.doesNotMatch(teamDataBody,/INSERT OR IGNORE INTO team_units/,'只读组织数据不得隐式创建贷后部门');
  assert.match(teamServer,/bind\('postloan:'\+id,id,'运营贷后部','postloan'\)/,'新公司创建时应显式初始化贷后部门');
});

test('expired staff sessions redirect without rendering the company chooser',()=>{
  assert.match(source,/setData\(null\);setWork\(null\);window\.location\.replace\('\/team\/login'\);return/);
  assert.doesNotMatch(source,/setData\(null\);setWork\(null\);setCompanyResolving\(false\);window\.location/,'认证失效时不能先关闭解析状态再跳转，避免短暂闪现公司选择页');
});

test('customer center uses the unified customer list title',()=>{
  const customerCenter=fs.readFileSync(path.join(process.cwd(),'components/customer-center.tsx'),'utf8');
  assert.doesNotMatch(customerCenter,/客户列表与 360° 详情/,'客户中心不应再宣传独立 360° 详情页面');
  assert.doesNotMatch(customerCenter,/CUSTOMER 360/,'客户中心详情区域不应再使用 360° 标识');
  assert.match(customerCenter,/<h2>客户列表<\/h2>/);
});

test('loan product high risk actions require an MFA code in the UI',()=>{
  const products=fs.readFileSync(path.join(process.cwd(),'components/loan-products.tsx'),'utf8');
  assert.match(products,/安全验证码/);
  assert.match(products,/action:'product_review',[\s\S]*code:mfaCode/);
  assert.match(products,/action:'product_retire',[\s\S]*code:mfaCode/);
  assert.match(products,/disabled=\{busy\|\|!mfaCode\|\|!reviewReason\.trim\(\)\}/);
  assert.match(products,/setNotice\('已保存并写入审计记录'\);setShow\(false\);setMfaCode\('\'\);setReviewReason\('\'\)/);
  assert.match(products,/审核意见/);
  assert.match(products,/reason:reviewReason\.trim\(\)/);
  const productRoute=fs.readFileSync(path.join(process.cwd(),'app/api/team/products/route.ts'),'utf8');
  assert.match(productRoute,/product_retire[\s\S]*下线产品必须填写原因/);
  assert.match(productRoute,/loan_product_retire',\{productId,version:product\.current_version,reason\}/);
});

test('loan product listings tolerate malformed terms and config JSON',()=>{
  const products=fs.readFileSync(path.join(process.cwd(),'components/loan-products.tsx'),'utf8');
  assert.match(products,/function termsOf\(p:Product\)/);
  assert.match(products,/catch\{return \[\]\}/);
  assert.match(products,/未配置/);
  const productRoute=fs.readFileSync(path.join(process.cwd(),'app/api/team/products/route.ts'),'utf8');
  assert.match(productRoute,/function parseConfig\(raw:unknown\)/);
  assert.match(productRoute,/config:parseConfig\(r\.config_json\)/);
});

test('loan product review controls have responsive toolbar styling',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-panel-toolbar\{display:flex;align-items:flex-end/);
  assert.match(css,/\.crm-panel-toolbar>\.inline-field\{display:flex/);
  assert.match(css,/\.loan-products-panel \.table-scroll\{margin-top:4px\}/);
  assert.match(css,/\.crm-panel-toolbar>button\{width:100%\}/);
});

test('organization tables keep language options horizontal and select arrows inset',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/company-language-cell label\{display:inline-flex!important;flex:0 0 auto;flex-direction:row!important;align-items:center/,'公司语言选项不得被通用表单标签样式挤成纵向');
  assert.match(css,/company-language-cell input\{flex:0 0 auto;width:auto;margin:0\}/,'语言复选框应与文字保持同一行');
  assert.match(css,/select:not\(\[multiple\]\)\{[^}]*background-position:right 14px center[^}]*padding-right:44px/,'下拉箭头需要与右边框保留稳定间距');
  assert.match(teamClient,/select aria-label=\{company\.slug\+' 状态'\}/,'公司状态下拉框必须有可读标签，便于键盘和辅助技术操作');
});
