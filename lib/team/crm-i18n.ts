import {crmSubpageByView} from '@/lib/team/crm-subpages';
import type {Locale} from '@/lib/i18n';

type CrmCopyEntry={key:string;source:string;en:string;km:string};

// `source` is deliberately the existing Chinese route/view identifier.  It is
// a display key only; changing it would break bookmarked CRM URLs and queue
// routing.  The English key is stable for tests and future catalog tooling.
const entries:CrmCopyEntry[]=[
 ['group.workspace','工作台','Workspace','កន្លែងធ្វើការ'],['group.customers','客户中心','Customers','អតិថិជន'],['group.business','业务中心','Business','អាជីវកម្ម'],['group.service','服务中心','Service','សេវាកម្ម'],['group.risk','风控与资金','Risk & funds','ហានិភ័យ និងមូលនិធិ'],['group.product','产品与运营','Product & operations','ផលិតផល និងប្រតិបត្តិការ'],['group.reports','报表中心','Reports','របាយការណ៍'],['group.org','组织与系统','Organization & system','អង្គការ និងប្រព័ន្ធ'],['group.audit','审计与安全','Audit & security','សវនកម្ម និងសុវត្ថិភាព'],
 ['menu.todayOverview','今日概览','Today overview','ទិដ្ឋភាពទូទៅថ្ងៃនេះ'],['menu.myTasks','我的待办','My tasks','កិច្ចការរបស់ខ្ញុំ'],['menu.teamQueue','团队队列','Team queue','ជួរក្រុម'],['menu.sla','SLA 与提醒','SLA & reminders','SLA និងការរំលឹក'],['menu.riskSummary','风险摘要','Risk summary','សេចក្ដីសង្ខេបហានិភ័យ'],
 ['menu.customers','客户列表','Customer list','បញ្ជីអតិថិជន'],['menu.kycQueue','KYC 审核队列','KYC review queue','ជួរពិនិត្យ KYC'],['menu.customerTags','客户标签与分组','Customer tags & groups','ស្លាក និងក្រុមអតិថិជន'],
 ['menu.loanApplications','贷款申请','Loan applications','ពាក្យស្នើកម្ចី'],['menu.approval','审批协同','Approval workflow','លំហូរអនុម័ត'],['menu.contracts','合同与签约','Contracts & signing','កិច្ចសន្យា និងការចុះហត្ថលេខា'],['menu.disbursement','放款管理','Disbursement','ការបញ្ចេញកម្ចី'],['menu.repayment','账单与还款','Billing & repayment','វិក្កយបត្រ និងការសងប្រាក់'],['menu.wallet','提现与钱包','Withdrawals & wallet','ការដកប្រាក់ និងកាបូប'],['menu.timeline','业务时间线','Business timeline','បន្ទាត់ពេលវេលាអាជីវកម្ម'],
 ['menu.tickets','客服工单','Support tickets','សំបុត្រគាំទ្រ'],['menu.documents','补件任务','Document tasks','កិច្ចការបំពេញឯកសារ'],['menu.postloan','贷后任务','Post-loan tasks','កិច្ចការក្រោយខ្ចី'],['menu.collections','逾期与催收','Overdue & collections','ហួសកំណត់ និងប្រមូលប្រាក់'],['menu.disputes','投诉与争议','Complaints & disputes','បណ្ដឹង និងវិវាទ'],['menu.notificationsLog','通知发送记录','Notification log','កំណត់ត្រាការផ្ញើជូនដំណឹង'],
 ['menu.riskEvents','风控事件','Risk events','ព្រឹត្តិការណ៍ហានិភ័យ'],['menu.funding','资金监管','Funds oversight','ការត្រួតពិនិត្យមូលនិធិ'],['menu.limits','资金限额','Funding limits','កម្រិតមូលនិធិ'],['menu.freeze','冻结与解除','Freeze & release','បង្កក និងដោះលែង'],['menu.ledger','资金流水','Funds ledger','បញ្ជីចលនាមូលនិធិ'],['menu.reconciliation','对账异常','Reconciliation issues','បញ្ហាផ្ទៀងផ្ទាត់គណនី'],
 ['menu.products','贷款产品','Loan products','ផលិតផលកម្ចី'],['menu.pricing','费率与费用','Rates & fees','អត្រា និងថ្លៃសេវា'],['menu.rules','风控规则与版本','Risk rules & versions','ច្បាប់ហានិភ័យ និងកំណែ'],['menu.telegram','Telegram 业务渠道','Telegram business channel','ឆានែលអាជីវកម្ម Telegram'],['menu.templates','通知模板','Notification templates','គំរូជូនដំណឹង'],['menu.news','公司新闻','Company news','ព័ត៌មានក្រុមហ៊ុន'],['menu.industry','行业资讯','Industry news','ព័ត៌មានឧស្សាហកម្ម'],['menu.help','帮助中心','Help center','មជ្ឈមណ្ឌលជំនួយ'],
 ['menu.customerFunnel','客户漏斗','Customer funnel','ចីវលោអតិថិជន'],['menu.kycApproval','KYC 与审批','KYC & approval','KYC និងការអនុម័ត'],['menu.loanRepayment','放款与还款','Disbursement & repayment','ការបញ្ចេញ និងសងប្រាក់'],['menu.overdueReport','逾期与催收报表','Overdue & collections report','របាយការណ៍ហួសកំណត់ និងប្រមូលប្រាក់'],['menu.fundingReport','资金监管报表','Funds oversight report','របាយការណ៍ត្រួតពិនិត្យមូលនិធិ'],['menu.supportReport','客服与投诉','Support & complaints','គាំទ្រ និងបណ្ដឹង'],['menu.customReport','自定义报表','Custom report','របាយការណ៍ផ្ទាល់ខ្លួន'],
 ['menu.companyDepartments','公司与部门','Company & departments','ក្រុមហ៊ុន និងនាយកដ្ឋាន'],['menu.staffRoles','员工与角色','Staff & roles','បុគ្គលិក និងតួនាទី'],['menu.dataScope','数据范围','Data scope','វិសាលភាពទិន្នន័យ'],['menu.fieldPermissions','字段权限','Field permissions','សិទ្ធិវាលទិន្នន័យ'],['menu.institutions','持牌机构','Licensed institutions','ស្ថាប័នមានអាជ្ញាប័ណ្ណ'],['menu.apiApps','API 应用','API applications','កម្មវិធី API'],['menu.languageTimezone','语言与时区','Language & timezone','ភាសា និងតំបន់ពេលវេលា'],['menu.filesScanning','文件与扫描配置','Files & scanning','ឯកសារ និងការស្កេន'],['menu.health','系统健康','System health','សុខភាពប្រព័ន្ធ'],
 ['menu.operationAudit','操作审计','Action audit','សវនកម្មសកម្មភាព'],['menu.loginIp','登录与 IP','Logins & IP','ការចូល និង IP'],['menu.dataChanges','数据修改','Data changes','ការកែប្រែទិន្នន័យ'],['menu.fundActions','资金操作','Funds actions','សកម្មភាពមូលនិធិ'],['menu.permissionChanges','权限变更','Permission changes','ការផ្លាស់ប្ដូរសិទ្ធិ'],['menu.securityAlerts','安全告警','Security alerts','ការជូនដំណឹងសុវត្ថិភាព'],['menu.incidents','应急事件','Incidents','ព្រឹត្តិការណ៍បន្ទាន់'],['menu.auditExport','审计导出','Audit export','នាំចេញសវនកម្ម'],
 ['lender.loanReview','贷款复核','Loan review','ពិនិត្យកម្ចីឡើងវិញ'],['lender.fundingReview','放款复核','Disbursement review','ពិនិត្យការបញ្ចេញកម្ចីឡើងវិញ'],['lender.auditLog','审计记录','Audit log','កំណត់ត្រាសវនកម្ម'],['lender.service','持牌机构复核','Licensed institution review','ការពិនិត្យស្ថាប័នមានអាជ្ញាប័ណ្ណ'],['lender.serviceBackend','服务机构后台','Service operations','ប្រតិបត្តិការសេវាកម្ម'],['page.kycOrders','KYC 审核订单','KYC review orders','បញ្ជាទិញពិនិត្យ KYC'],['frame.generic','授权范围内的独立业务页面。','Independent business page within your authorized scope.','ទំព័រអាជីវកម្មឯករាជ្យក្នុងវិសាលភាពដែលអ្នកមានសិទ្ធិ។'],['frame.badge','独立数据视图','Independent data view','ទិដ្ឋភាពទិន្នន័យឯករាជ្យ']
].map(([key,source,en,km])=>({key,source,en,km}));

const bySource=Object.fromEntries(entries.map(entry=>[entry.source,entry]));
export const crmCopyKeys=entries.map(entry=>entry.key);
export const crmText=(source:string,locale:Locale):string=>{const entry=bySource[source];if(!entry||locale==='zh')return source;return locale==='km'?entry.km:entry.en};

const fallbackDescription=(source:string,locale:Locale)=>{
 const entry=bySource[source];
 if(locale==='zh')return crmSubpageByView[source]?.description||'授权范围内的独立业务页面。';
 if(!entry)return locale==='km'?'ទំព័រអាជីវកម្មដែលមានសិទ្ធិចូលប្រើ។':'Authorized business page.';
 return locale==='km'?`ពិនិត្យ និងគ្រប់គ្រង ${entry.km}។`:`Review and manage ${entry.en}.`;
};
export const crmDescription=(source:string,locale:Locale)=>fallbackDescription(source,locale);
export const crmFrameText=(source:'eyebrow'|'badge'|'generic',locale:Locale)=>{
 if(source==='eyebrow')return 'CRM · INDEPENDENT PAGE';
 return crmText(source==='badge'?'独立数据视图':'授权范围内的独立业务页面。',locale);
};
