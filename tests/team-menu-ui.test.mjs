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
const teamAuth=fs.readFileSync(path.join(process.cwd(),'app/api/team/auth/route.ts'),'utf8');
const teamRoute=fs.readFileSync(path.join(process.cwd(),'app/api/team/route.ts'),'utf8');
const csvExport=fs.readFileSync(path.join(process.cwd(),'components/csv-export.tsx'),'utf8');

test('multi-company SSO restores the last company and updates it on switch',()=>{
  assert.match(teamAuth,/STAFF_LAST_COMPANY/,'登录流程必须保留上次公司选择');
  assert.match(teamAuth,/remembered&&m\.tenant_id===remembered/,'SSO 必须优先恢复上次登录公司');
  assert.match(teamRoute,/STAFF_LAST_COMPANY/,'公司切换必须更新上次公司记录');
  assert.match(teamRoute,/\[cookie\(request,TEAM_COOKIE,t\.id,86400\),cookie\(request,STAFF_LAST_COMPANY,t\.id,31536000\)\]/,'公司切换需同时更新当前公司与持久化记忆');
});

test('platform company list prioritizes an active default',()=>{
  const teamServer=fs.readFileSync(path.join(process.cwd(),'lib/team/server.ts'),'utf8');
  assert.match(teamServer,/FROM team_companies ORDER BY active DESC,name/,'平台公司列表必须把启用公司排在停用公司之前，避免默认公司进入失败');
});

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

test('empty CSV exports are disabled and expose an accessible result count',()=>{
  assert.match(csvExport,/disabled=\{!rows\.length\}/,'无结果时导出按钮必须不可点击');
  assert.match(csvExport,/aria-label=\{rows\.length\?`导出当前结果 CSV，共 \$\{rows\.length\} 条`:'暂无可导出的结果'\}/,'导出按钮必须提供当前结果数量和空状态说明');
});

test('customer search and export controls share one aligned toolbar',()=>{
  const customerCenter=fs.readFileSync(path.join(process.cwd(),'components/customer-center.tsx'),'utf8');
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(customerCenter,/className="customer-center-toolbar"/,'客户搜索与导出控件必须使用统一工具栏');
  assert.match(customerCenter,/customer-center-toolbar[\s\S]*统一搜索[\s\S]*CsvExport/,'导出按钮必须与当前客户搜索处于同一工具栏');
  assert.match(css,/\.customer-center-toolbar\{display:flex;align-items:flex-end/,'工具栏需按搜索框底部对齐');
  assert.match(css,/\.customer-center-toolbar>\.button-row\{flex:0 0 auto;align-items:center;min-height:48px\}/,'导出区域需与输入框高度对齐');
});

test('form controls expose a consistent keyboard focus state',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/input:focus-visible,select:focus-visible,textarea:focus-visible\{outline:3px solid var\(--ring\);outline-offset:2px\}/,'输入、下拉和多行文本控件需要统一键盘焦点样式');
});

test('shared textarea keeps a visible border and usable multiline height',()=>{
  const textarea=fs.readFileSync(path.join(process.cwd(),'components/ui/textarea.tsx'),'utf8');
  assert.match(textarea,/min-h-\[120px\]/,'多行文本框需要稳定的最小高度，避免内容为空时塌陷');
  assert.match(textarea,/resize-y/,'多行文本框应允许用户按需调整高度');
  assert.match(textarea,/border border-input/,'多行文本框需要沿用统一输入边框');
  assert.match(textarea,/focus-visible:border-ring/,'多行文本框需要有清晰的焦点边框');
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
  assert.match(css,/\.button-row\{align-items:center\}/,'同一操作行内的按钮和输入控件应保持垂直居中');
  assert.match(css,/\.crm-panel-toolbar\{display:flex;align-items:flex-end/);
  assert.match(css,/\.crm-panel-toolbar>\.inline-field\{display:flex/);
  assert.match(css,/\.crm-panel-toolbar>button\{align-self:flex-end;min-height:48px\}/,'工具栏主按钮应与输入框底部和高度对齐');
  assert.match(css,/\.loan-products-panel \.table-scroll\{margin-top:4px\}/);
  assert.match(css,/\.crm-panel-toolbar>button\{width:100%\}/);
});

test('responsive filter labels can shrink inside narrow independent pages',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-filter-row>label\{min-width:0\}/,'筛选字段需要允许收缩，避免窄屏横向溢出');
});

test('report export controls stack cleanly on narrow pages',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.report-center-head>\.button-row\{align-items:center;justify-content:flex-end;min-width:0\}/);
  assert.match(css,/\.report-center-head>\.button-row\{display:grid;grid-template-columns:1fr;align-items:stretch/,'窄屏报表操作区需要纵向排列');
  assert.match(css,/\.report-center-head>\.button-row>select,\.report-center-head>\.button-row>button\{width:100%\}/,'窄屏报表控件需要占满操作区宽度');
});

test('organization tables keep language options horizontal and select arrows inset',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/company-language-cell label\{display:inline-flex!important;flex:0 0 auto;flex-direction:row!important;align-items:center/,'公司语言选项不得被通用表单标签样式挤成纵向');
  assert.match(css,/company-language-cell input\{flex:0 0 auto;width:auto;margin:0\}/,'语言复选框应与文字保持同一行');
  assert.match(css,/select:not\(\[multiple\]\)\{[^}]*background-position:right 14px center[^}]*padding-right:44px/,'下拉箭头需要与右边框保留稳定间距');
  assert.match(teamClient,/select aria-label=\{company\.slug\+' 状态'\}/,'公司状态下拉框必须有可读标签，便于键盘和辅助技术操作');
});

test('internal entry links use client navigation to avoid full-page flashes',()=>{
  const teamLogin=fs.readFileSync(path.join(process.cwd(),'app/team/login/client.tsx'),'utf8');
  const agreementPage=fs.readFileSync(path.join(process.cwd(),'app/agreements/loan/page.tsx'),'utf8');
  assert.match(teamLogin,/import Link from ['"]next\/link['"]/,'后台登录入口应使用应用内导航');
  assert.match(teamLogin,/<Link className="brand" href="\/team\/login">/,'登录页品牌入口应保留应用内导航');
  assert.match(teamLogin,/<Link href="\/h5">客户入口<\/Link>/,'客户入口应避免整页刷新');
  assert.match(agreementPage,/import Link from ['"]next\/link['"]/,'协议页应使用应用内导航');
  assert.match(agreementPage,/<Link className="brand" href="\/h5">/,'协议页品牌入口应保留应用内导航');
  assert.doesNotMatch(agreementPage,/<a className="text-link" href="\/kyc">/,'协议页返回资料填写不得触发整页刷新');
});

test('mini app KYC cards keep status before the chevron with a five pixel gap',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  const overrides=fs.readFileSync(path.join(process.cwd(),'app/kyc-overrides.css'),'utf8');
  assert.match(css,/\.mini-app \.customer-kyc \.kyc-group-arrow\{order:4;margin-left:5px\}/,'KYC 卡片箭头应紧跟状态并保持 5px 间距');
  assert.match(css,/\.mini-app \.customer-kyc \.kyc-group-copy em\{order:3;width:auto;flex:0 0 auto;margin-left:auto/,'KYC 卡片状态应位于箭头前并靠右对齐');
  assert.match(overrides,/\.mini-app \.customer-kyc \.kyc-group-arrow \{ order: 4;[\s\S]*?right: 14px/,'覆盖样式中的箭头必须保持在最右侧');
  assert.match(overrides,/\.mini-app \.customer-kyc \.kyc-group-copy em \{\n  order: 3;[\s\S]*?right: 43px;/,'覆盖样式中的状态必须与箭头保持 5px 间距');
});

test('shared native select fills narrow form width and keeps arrow inset',()=>{
  const nativeSelect=fs.readFileSync(path.join(process.cwd(),'components/ui/native-select.tsx'),'utf8');
  assert.match(nativeSelect,/group\/native-select relative w-full min-w-0/,'共享下拉容器需要占满可用宽度并允许收缩');
  assert.match(nativeSelect,/border border-input/,'共享下拉框需要保留统一边框');
  assert.match(nativeSelect,/px-3 py-2 pr-9/,'共享下拉箭头需要与右边框保持稳定内边距');
});

test('native selects can shrink in narrow forms while table selects stay readable',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.team-shell select\{min-width:0\}/,'窄屏表单下拉框需要允许收缩');
  assert.match(css,/\.crm-independent-page table select\{min-width:120px\}/,'表格中的下拉框需要保留可读宽度');
});

test('narrow filter result summaries wrap without pushing controls off screen',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-filter-row>\.fine\{min-width:0;overflow-wrap:anywhere\}/,'筛选结果摘要需要允许换行');
  assert.match(css,/\.crm-filter-row>\.fine\{flex-basis:100%\}/,'窄屏筛选摘要应独占一行');
});

test('independent page headers keep long titles from pushing badges off screen',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-independent-head>div:first-child\{min-width:0\}/,'独立页面标题区域需要允许收缩');
  assert.match(css,/\.crm-independent-head>\.crm-page-badge\{flex:0 0 auto\}/,'页面徽标需要保持稳定宽度');
});

test('panel title rows wrap readonly badges on narrow screens',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-panel-title-row>div:first-child\{min-width:0\}/,'面板标题文案需要允许收缩');
  assert.match(css,/\.crm-panel-title-row>\.crm-readonly-badge\{flex:0 0 auto\}/,'只读徽标需要保持稳定宽度');
  assert.match(css,/\.crm-panel-title-row\{display:block\}/,'窄屏面板标题区需要纵向排列');
});

test('independent page action buttons can shrink and wrap long labels',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-independent-page \.button-row\{min-width:0\}/,'独立页面操作区需要允许收缩');
  assert.match(css,/\.crm-independent-page \.button-row>button,\.crm-independent-page \.button-row>a\{min-width:0;overflow-wrap:anywhere\}/,'长按钮文案需要在窄屏安全换行');
});

test('narrow panel toolbars allow their title block to shrink',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-panel-toolbar>div:first-child\{min-width:0\}/,'窄屏工具栏标题区需要取消固定最小宽度');
});

test('independent tables wrap long values without widening the page',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-independent-page \.table-scroll th\{vertical-align:middle;white-space:nowrap\}/,'表头需要保持单行，避免表格列头高度不一致');
  assert.match(css,/\.crm-independent-page \.table-scroll td\{vertical-align:middle;overflow-wrap:anywhere\}/,'长编号、邮箱和备注需要在单元格内安全换行');
});

test('independent table actions stay compact inside the operation column',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-independent-page \.table-scroll td:last-child \.button-row\{align-items:flex-start\}/,'表格操作区需要从单元格顶部开始排列');
  assert.match(css,/\.crm-independent-page \.table-scroll td:last-child \.button-row>button,\.crm-independent-page \.table-scroll td:last-child \.button-row>a\{flex:0 1 auto\}/,'操作按钮不应因全局窄屏规则被强制拉伸');
});

test('independent tables expose one consistent narrow-screen scroll hint',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-independent-page \.table-scroll::before\{content:none\}/,'桌面端不应显示窄屏滚动提示');
  assert.match(css,/\.crm-independent-page \.crm-table-scroll-hint\{display:none\}/,'独立页面已有提示文案应避免与统一提示重复');
  assert.match(css,/\.crm-independent-page \.table-scroll::before\{content:'窄屏可左右滑动查看更多字段';display:block/,'窄屏独立表格必须明确提示可横向滚动');
});

test('independent table empty rows use a consistent centered layout',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-independent-page \.table-scroll td\[colspan\]\{padding:40px 20px;text-align:center;color:var\(--muted-foreground\)\}/,'独立表格无数据时应居中展示并保留稳定留白');
});

test('independent page KPI cards stay readable with long values on narrow screens',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-page-kpis\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);align-items:start\}/,'窄屏 KPI 卡片需要改为可收缩网格');
  assert.match(css,/\.crm-page-kpis>div\{min-width:0\}/,'KPI 卡片内容需要允许收缩');
  assert.match(css,/\.crm-page-kpis strong\{font-size:22px;overflow-wrap:anywhere\}/,'公司名称、代码和邮箱等长值需要自动换行');
  assert.match(css,/\.crm-page-kpis\{grid-template-columns:1fr\}/,'超窄屏 KPI 卡片需要单列排列');
});

test('independent page headers stack title and badge on narrow screens',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-independent-head\{display:block\}/,'窄屏独立页面头部需要上下排列');
  assert.match(css,/\.crm-independent-head>\.crm-page-badge\{display:inline-flex;margin-top:10px\}/,'独立页面徽标需要与标题保持稳定间距');
});

test('workspace headings allow long company and scope labels to wrap',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.admin-heading>div:first-child\{min-width:0\}/,'工作台标题内容区需要允许收缩');
  assert.match(css,/\.admin-heading h2\{overflow-wrap:anywhere\}/,'长页面标题需要自动换行');
  assert.match(css,/\.admin-heading \.data-label\{flex:0 1 auto;min-width:0;white-space:normal;text-align:right\}/,'数据范围标签需要允许换行且不撑宽标题栏');
});

test('workspace top bar keeps long breadcrumbs from pushing account actions off screen',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-breadcrumb\{max-width:100%\}/,'顶部面包屑需要限制最大宽度');
  assert.match(css,/\.crm-breadcrumb strong\{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/,'长面包屑标题需要省略而不撑开右侧操作区');
  assert.match(css,/\.crm-top-actions\{flex:0 0 auto\}/,'账户和语言操作区需要保持固定宽度');
});

test('workspace sidebar labels shrink and wrap on narrow layouts',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-sidebar nav summary,\.crm-sidebar-subnav a\{min-width:0\}/,'侧栏菜单项需要允许收缩');
  assert.match(css,/\.crm-sidebar-subnav a\{overflow-wrap:anywhere\}/,'长侧栏文案需要自动换行');
  assert.match(css,/\.crm-sidebar-subnav a span\{min-width:0;overflow-wrap:anywhere\}/,'侧栏标签文本不能撑宽导航');
});

test('workspace overview heading preserves action controls beside long titles',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-overview-head>div:first-child\{min-width:0\}/,'概览标题内容区需要允许收缩');
  assert.match(css,/\.crm-overview-head h1,\.crm-overview-head h2\{overflow-wrap:anywhere\}/,'概览长标题需要自动换行');
  assert.match(css,/\.crm-head-actions\{flex:0 0 auto\}/,'概览操作区需要保持固定宽度');
});

test('KYC queue title keeps count badge visible beside long labels',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.kyc-queue-title>div:first-child\{min-width:0\}/,'KYC 队列标题内容区需要允许收缩');
  assert.match(css,/\.kyc-queue-title h3\{overflow-wrap:anywhere\}/,'KYC 长标题需要自动换行');
  assert.match(css,/\.kyc-queue-count\{flex:0 0 auto\}/,'KYC 结果数量标签需要保持完整显示');
});

test('KYC queue toolbar keeps result text and actions within the page width',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.kyc-queue-toolbar>span\{min-width:0;overflow-wrap:anywhere\}/,'KYC 结果说明需要允许收缩换行');
  assert.match(css,/\.kyc-queue-toolbar \.button-row\{min-width:0;flex:0 0 auto\}/,'KYC 工具栏操作区需要保持独立宽度');
  assert.match(css,/\.kyc-queue-toolbar \.button-row>button,\.kyc-queue-toolbar \.button-row>a\{min-width:0;overflow-wrap:anywhere\}/,'KYC 操作按钮长文案需要可换行');
});

test('KYC case headings keep status pills visible beside long references',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.kyc-case-heading>div\{min-width:0\}/,'KYC 案件编号内容区需要允许收缩');
  assert.match(css,/\.kyc-case-heading \.pill\{flex:0 0 auto;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/,'KYC 状态标签需要固定并截断过长内容');
});

test('KYC case routing and actions wrap long organization and reviewer labels',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.kyc-case-primary span,\.kyc-case-routing span\{min-width:0;overflow-wrap:anywhere\}/,'KYC 部门机构和审核员信息需要可换行');
  assert.match(css,/\.kyc-case-actions \.text-link\{min-width:0;overflow-wrap:anywhere\}/,'KYC 操作链接长文案需要可换行');
});

test('KYC queue empty results use a centered consistent state',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.kyc-queue>\.sample\{margin:14px 0 0;text-align:center\}/,'KYC 无结果状态需要居中并保持统一间距');
});

test('report and funding headers preserve controls beside long titles',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.report-center-head>div:first-child,\.funding-settings-head>div:first-child\{min-width:0\}/,'报表和资金标题区需要允许收缩');
  assert.match(css,/\.report-center-head h2,\.funding-settings-head h2\{overflow-wrap:anywhere\}/,'报表和资金长标题需要自动换行');
  assert.match(css,/\.report-center-head>\.button-row,\.funding-settings-head>\.crm-page-badge\{flex:0 0 auto\}/,'报表导出和资金状态控件需要保持可见');
});

test('workspace section headings keep long labels and side notes within cards',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-section-heading h2\{min-width:0;overflow-wrap:anywhere\}/,'工作台分区标题需要允许收缩换行');
  assert.match(css,/\.crm-section-heading>span\{flex:0 1 auto;min-width:0;white-space:normal;text-align:right;overflow-wrap:anywhere\}/,'工作台分区辅助说明需要保持对齐并可换行');
});

test('workspace quick cards keep long labels from pushing arrows out',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-quick-card\{min-width:0\}/,'快捷业务卡片需要允许收缩');
  assert.match(css,/\.crm-quick-card strong,\.crm-quick-card small\{min-width:0;overflow-wrap:anywhere\}/,'快捷卡片长标题与说明需要换行');
  assert.match(css,/\.crm-quick-card b\{flex:0 0 auto\}/,'快捷卡片箭头需要保持可见');
});

test('workspace overview columns collapse before narrow screens overflow',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/@media\(max-width:900px\)\{\.crm-overview-grid\{grid-template-columns:1fr\}/,'工作台概览三栏布局需要在中等宽度折叠为单列');
  assert.match(css,/@media\(max-width:900px\)\{\.crm-overview-grid\{grid-template-columns:1fr\}\.crm-quick-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/,'快捷卡片在折叠后仍应保持两列');
  assert.match(css,/@media\(max-width:480px\)\{\.crm-quick-grid\{grid-template-columns:1fr\}\}/,'超窄屏快捷卡片需要单列展示');
});

test('workspace overview KPI cards reflow across tablet and mobile widths',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/@media\(max-width:1100px\)\{\.crm-kpis\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}\}/,'平板宽度指标卡片需要调整为三列');
  assert.match(css,/@media\(max-width:760px\)\{\.crm-kpis\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/,'窄屏指标卡片需要调整为两列');
  assert.match(css,/@media\(max-width:480px\)\{\.crm-kpis\{grid-template-columns:1fr\}\}/,'超窄屏指标卡片需要单列展示');
});

test('workspace audit activity keeps timestamps visible beside long notes',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-activity-row>span:nth-child\(2\)\{min-width:0;overflow-wrap:anywhere\}/,'审计操作描述需要允许收缩换行');
  assert.match(css,/\.crm-activity-row time\{flex:0 0 auto;white-space:nowrap\}/,'审计时间戳需要保持完整且不被挤压');
});

test('workspace funding risk card wraps long limit and warning copy',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-risk-card>div,\.crm-risk-card>strong,\.crm-risk-card>span,\.crm-risk-card>small\{min-width:0;overflow-wrap:anywhere\}/,'风控资金卡片文案需要允许收缩换行');
  assert.match(css,/\.crm-risk-dot\{flex:0 0 8px\}/,'风控状态圆点需要保持固定尺寸');
});

test('workspace navigation keeps long labels and counters aligned',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-nav a\{min-width:0\}/,'工作台业务导航项需要允许收缩');
  assert.match(css,/\.crm-nav a span:first-child\{min-width:0;overflow-wrap:anywhere\}/,'导航长名称需要自动换行');
  assert.match(css,/\.crm-nav a span:last-child\{flex:0 0 auto;white-space:nowrap\}/,'导航数量或箭头需要保持对齐');
});

test('workspace KPI values wrap instead of widening cards',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-kpi strong\{min-width:0;overflow-wrap:anywhere\}/,'工作台 KPI 长数值需要允许收缩换行');
});

test('workspace KPI labels wrap for multilingual text',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-kpi span,\.crm-kpi small\{min-width:0;overflow-wrap:anywhere\}/,'工作台 KPI 多语言标签需要允许换行');
});

test('workspace activity status dots keep a stable size',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-activity-dot\{flex:0 0 7px\}/,'审计活动状态圆点需要保持固定尺寸');
});

test('workspace section helper copy can shrink beside long headings',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-section-heading>span\{flex:0 1 auto;min-width:0;white-space:normal;text-align:right;overflow-wrap:anywhere\}/,'工作台分区辅助说明需要可收缩换行');
});

test('workspace overview action links wrap long labels cleanly',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-link\{min-width:0;overflow-wrap:anywhere;text-align:center\}/,'工作台操作链接需要允许长文案换行并保持居中');
});

test('workspace navigation group headings wrap without widening the rail',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-nav strong\{min-width:0;overflow-wrap:anywhere\}/,'工作台导航分组标题需要允许收缩换行');
});

test('customer toolbar helper copy wraps instead of forcing horizontal overflow',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.customer-center-toolbar>\.button-row \.fine\{margin:0;white-space:normal;overflow-wrap:anywhere\}/,'客户工具栏辅助文案需要允许窄屏换行');
});

test('team form grids collapse at the same narrow-screen breakpoint as the shell',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/@media\(max-width:760px\)\{\.team-grid\{grid-template-columns:1fr\}/,'团队表单网格需要在窄屏统一单列，避免 700-760px 区间溢出');
});

test('team tables wrap long identities and permission labels inside cells',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.team-shell td,\.team-shell th\{overflow-wrap:anywhere\}/,'组织与员工表格单元格需要允许长文案换行');
});

test('sidebar navigation group labels wrap without affecting disclosure controls',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-sidebar nav summary\{overflow-wrap:anywhere\}/,'侧边栏分组标题需要允许长文案换行');
});

test('sidebar disclosure arrows stay aligned when group labels wrap',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-sidebar nav summary>span\{min-width:0;overflow-wrap:anywhere\}\s*\.crm-sidebar nav summary i\{flex:0 0 auto\}/,'侧边栏展开箭头需要固定宽度并与换行标题保持对齐');
});

test('topbar breadcrumb yields space to account actions on narrow screens',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.crm-breadcrumb\{flex:1 1 auto;overflow:hidden\}/,'顶部面包屑需要可收缩并为账户操作区留出空间');
});

test('overview section helpers stack below titles on narrow screens',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/@media\(max-width:620px\)\{\.crm-section-heading\{display:block\}\.crm-section-heading>span\{display:block;margin-top:4px;text-align:left\}/,'工作台分区辅助说明需要在窄屏置于标题下方');
});

test('activity timestamps can wrap on very narrow screens',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/@media\(max-width:480px\)\{\.crm-activity-row\{align-items:flex-start\}\.crm-activity-row time\{white-space:normal;max-width:72px;text-align:right;overflow-wrap:anywhere\}/,'审计活动时间在极窄屏需要允许换行');
});

test('customer timeline descriptions wrap inside the detail card',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.customer-timeline-row span\{min-width:0;overflow-wrap:anywhere\}/,'客户时间线描述需要允许长文案换行');
});

test('customer detail facts become single-column on very narrow screens',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/@media\(max-width:480px\)\{\.customer-detail-facts\{grid-template-columns:1fr\}/,'客户详情事实摘要在极窄屏需要改单列');
});

test('customer list helper text wraps long identifiers inside rows',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.customer-list-row small\{overflow-wrap:anywhere\}/,'客户列表辅助信息需要允许长标识换行');
});

test('report metric labels wrap while values stay aligned',()=>{
  const css=fs.readFileSync(path.join(process.cwd(),'app/globals.css'),'utf8');
  assert.match(css,/\.report-grid p span\{min-width:0;overflow-wrap:anywhere\}\.report-grid b\{flex:0 0 auto;white-space:nowrap\}/,'报表指标名称需要换行且数值保持对齐');
});
