import {crmSubpageByView} from '@/lib/team/crm-subpages';
import type {Locale} from '@/lib/i18n';

type CrmCopyEntry={key:string;source:string;en:string;km:string};
type CrmDescriptionEntry={source:string;en:string;km:string};

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

// These are page-specific descriptions, not a shared template.  Keep the
// Chinese route/view identifier as the lookup key so URLs and queue routing
// remain unchanged while each locale explains the actual page purpose.
const descriptionEntries:CrmDescriptionEntry[]=[
 {source:'今日概览',en:'Summarises key work, risk, funding and audit items for today.',km:'សង្ខេបកិច្ចការសំខាន់ៗ ហានិភ័យ មូលនិធិ និងសវនកម្មសម្រាប់ថ្ងៃនេះ។'},
 {source:'我的待办',en:'Shows tasks assigned to your role and their due times.',km:'បង្ហាញកិច្ចការដែលបានចាត់ឱ្យតួនាទីរបស់អ្នក និងពេលកំណត់។'},
 {source:'团队队列',en:'Shows team assignments, progress and queue workload.',km:'បង្ហាញការបែងចែកករណី វឌ្ឍនភាព និងបន្ទុកជួររបស់ក្រុម។'},
 {source:'SLA 与提醒',en:'Tracks SLA countdowns, due-soon tasks and reminder status.',km:'តាមដានពេលវេលា SLA កិច្ចការជិតដល់កំណត់ និងស្ថានភាពការរំលឹក។'},
 {source:'风险摘要',en:'Shows company risk levels, unusual events and items needing action.',km:'បង្ហាញកម្រិតហានិភ័យរបស់ក្រុមហ៊ុន ព្រឹត្តិការណ៍មិនប្រក្រតី និងការងារដែលត្រូវដោះស្រាយ។'},
 {source:'客户列表',en:'Searches customers and shows their profile, KYC, loans and business timeline.',km:'ស្វែងរកអតិថិជន និងបង្ហាញប្រវត្តិរូប KYC កម្ចី និងបន្ទាត់ពេលវេលាអាជីវកម្ម។'},
 {source:'KYC 审核队列',en:'Handles review, document requests, corrections and resubmissions in one queue.',km:'គ្រប់គ្រងការពិនិត្យ ការស្នើឯកសារបន្ថែម ការកែតម្រូវ និងការដាក់ស្នើឡើងវិញក្នុងជួរតែមួយ។'},
 {source:'客户标签与分组',en:'Maintains customer groups and operational tags with a complete audit trail.',km:'គ្រប់គ្រងក្រុមអតិថិជន និងស្លាកប្រតិបត្តិការ ដោយរក្សាកំណត់ត្រាសវនកម្មពេញលេញ។'},
 {source:'贷款申请',en:'Shows applications, fee confirmation, signing and approval status.',km:'បង្ហាញពាក្យស្នើសុំ ការបញ្ជាក់ថ្លៃសេវា ការចុះហត្ថលេខា និងស្ថានភាពអនុម័ត។'},
 {source:'审批协同',en:'Coordinates initial review, independent checks and approval updates.',km:'សម្របសម្រួលការពិនិត្យដំបូង ការត្រួតពិនិត្យឯករាជ្យ និងការធ្វើបច្ចុប្បន្នភាពលទ្ធផលអនុម័ត។'},
 {source:'合同与签约',en:'Shows fee snapshots, signature evidence and contract status.',km:'បង្ហាញរូបថតសង្ខេបថ្លៃសេវា ភស្តុតាងហត្ថលេខា និងស្ថានភាពកិច្ចសន្យា។'},
 {source:'放款管理',en:'Runs post-approval disbursement checks and shows funding records.',km:'អនុវត្តការត្រួតពិនិត្យបញ្ចេញប្រាក់ក្រោយអនុម័ត និងបង្ហាញកំណត់ត្រាមូលនិធិ។'},
 {source:'账单与还款',en:'Shows bills, repayment allocation and settlement results.',km:'បង្ហាញវិក្កយបត្រ ការបែងចែកការសងប្រាក់ និងលទ្ធផលបិទបំណុល។'},
 {source:'提现与钱包',en:'Shows wallet balances, withdrawal requests and processing status.',km:'បង្ហាញសមតុល្យកាបូប សំណើដកប្រាក់ និងស្ថានភាពដំណើរការ។'},
 {source:'业务时间线',en:'Shows the complete timeline from application through settlement.',km:'បង្ហាញបន្ទាត់ពេលវេលាពេញលេញពីការដាក់ពាក្យរហូតដល់បិទបំណុល។'},
 {source:'客服工单',en:'Creates, assigns, handles and closes customer support tickets.',km:'បង្កើត បែងចែក ដោះស្រាយ និងបិទសំបុត្រគាំទ្រអតិថិជន។'},
 {source:'补件任务',en:'Tracks document requests, collection and review updates.',km:'តាមដានការជូនដំណឹងស្នើឯកសារ ការប្រមូលឯកសារ និងការធ្វើបច្ចុប្បន្នភាពពិនិត្យ។'},
 {source:'贷后任务',en:'Handles due-date reminders, promises to pay and task closure.',km:'គ្រប់គ្រងការរំលឹកថ្ងៃដល់កំណត់ ការសន្យាសងប្រាក់ និងការបិទកិច្ចការ។'},
 {source:'逾期与催收',en:'Handles collection work and settlement by delinquency stage.',km:'គ្រប់គ្រងការងារប្រមូលប្រាក់ និងការបិទបំណុលតាមដំណាក់កាលហួសកំណត់។'},
 {source:'投诉与争议',en:'Records complaints, investigations, decisions and closure reasons.',km:'កត់ត្រាបណ្ដឹង ការស៊ើបអង្កេត សេចក្ដីសម្រេច និងមូលហេតុបិទករណី។'},
 {source:'通知发送记录',en:'Shows templates, delivery results, retries and dead letters.',km:'បង្ហាញគំរូ លទ្ធផលផ្ញើ ការព្យាយាមឡើងវិញ និងសារដែលបរាជ័យចុងក្រោយ។'},
 {source:'风控事件',en:'Shows risk events, handling status and responsible owners.',km:'បង្ហាញព្រឹត្តិការណ៍ហានិភ័យ ស្ថានភាពដោះស្រាយ និងអ្នកទទួលខុសត្រូវ។'},
 {source:'资金监管',en:'Monitors daily and monthly limits, 20% warnings and funding snapshots.',km:'ត្រួតពិនិត្យកម្រិតប្រចាំថ្ងៃ និងប្រចាំខែ ការព្រមាន ២០% និងស្ថានភាពមូលនិធិ។'},
 {source:'资金限额',en:'Configures daily and monthly limits and the 20% funding warning.',km:'កំណត់កម្រិតបញ្ចេញប្រាក់ប្រចាំថ្ងៃ ប្រចាំខែ និងសមាមាត្រព្រមានមូលនិធិ ២០%។'},
 {source:'冻结与解除',en:'Approves funding freezes and releases, recording the reason for each action.',km:'អនុម័តការបង្កក និងដោះការបង្កកមូលនិធិ ព្រមទាំងកត់ត្រាមូលហេតុនៃសកម្មភាពនីមួយៗ។'},
 {source:'资金流水',en:'Shows disbursement, repayment, withdrawal and reconciliation entries.',km:'បង្ហាញចលនាបញ្ចេញប្រាក់ សងប្រាក់ ដកប្រាក់ និងការផ្ទៀងផ្ទាត់គណនី។'},
 {source:'对账异常',en:'Handles funding differences, review and closure.',km:'ដោះស្រាយភាពខុសគ្នានៃមូលនិធិ ការពិនិត្យ និងការបិទករណី។'},
 {source:'贷款产品',en:'Maintains loan parameters, versions and effective scope.',km:'គ្រប់គ្រងប៉ារ៉ាម៉ែត្រ កំណែ និងវិសាលភាពមានប្រសិទ្ធភាពរបស់ផលិតផលកម្ចី។'},
 {source:'费率与费用',en:'Maintains rate versions and previews new bills.',km:'គ្រប់គ្រងកំណែអត្រា និងមើលជាមុននូវវិក្កយបត្រថ្មី។'},
 {source:'风控规则与版本',en:'Shows rule versions, enabled status and match records.',km:'បង្ហាញកំណែច្បាប់ ស្ថានភាពបើកប្រើ និងកំណត់ត្រាច្បាប់ដែលត្រូវបានផ្គូផ្គង។'},
 {source:'Telegram 业务渠道',en:'Manages bot routing, channel status and delivery results.',km:'គ្រប់គ្រងការបញ្ជូន Bot ស្ថានភាពឆានែល និងលទ្ធផលផ្ញើ។'},
 {source:'通知模板',en:'Maintains Chinese, English and Khmer templates and release versions.',km:'គ្រប់គ្រងគំរូភាសាចិន អង់គ្លេស និងខ្មែរ ព្រមទាំងកំណែដែលបានបោះផ្សាយ។'},
 {source:'公司新闻',en:'Publishes, unpublishes and audits company news.',km:'បោះផ្សាយ ដកចេញ និងធ្វើសវនកម្មព័ត៌មានក្រុមហ៊ុន។'},
 {source:'行业资讯',en:'Publishes industry updates and sorts them by publication time.',km:'បោះផ្សាយព័ត៌មានឧស្សាហកម្ម និងតម្រៀបតាមពេលវេលាបោះផ្សាយ។'},
 {source:'帮助中心',en:'Maintains help content and release versions.',km:'គ្រប់គ្រងមាតិកាជំនួយ និងកំណែដែលបានបោះផ្សាយ។'},
 {source:'客户漏斗',en:'Measures conversion from registration through KYC, approval and disbursement.',km:'វាស់វែងការបម្លែងពីការចុះឈ្មោះ តាម KYC អនុម័ត រហូតដល់បញ្ចេញប្រាក់។'},
 {source:'KYC 与审批',en:'Reports KYC states, approval results and handling time.',km:'រាយការណ៍ស្ថានភាព KYC លទ្ធផលអនុម័ត និងរយៈពេលដោះស្រាយ។'},
 {source:'放款与还款',en:'Summarises disbursed, repaid and settled amounts.',km:'សង្ខេបចំនួនបានបញ្ចេញប្រាក់ បានសង និងបានបិទបំណុល។'},
 {source:'逾期与催收报表',en:'Reports delinquency bands, collection tasks and outcomes.',km:'រាយការណ៍កម្រិតហួសកំណត់ កិច្ចការប្រមូលប្រាក់ និងលទ្ធផល។'},
 {source:'资金监管报表',en:'Summarises limits, warnings, ledger entries and reconciliation results.',km:'សង្ខេបកម្រិតមូលនិធិ ការព្រមាន ចលនាមូលនិធិ និងលទ្ធផលផ្ទៀងផ្ទាត់។'},
 {source:'客服与投诉',en:'Reports support tickets, complaints and dispute handling.',km:'រាយការណ៍សំបុត្រគាំទ្រ បណ្ដឹង និងការដោះស្រាយវិវាទ។'},
 {source:'自定义报表',en:'Selects a scope and fields, then exports an auditable report.',km:'ជ្រើសវិសាលភាព និងវាលទិន្នន័យ រួចនាំចេញរបាយការណ៍ដែលអាចធ្វើសវនកម្មបាន។'},
 {source:'公司与部门',en:'Maintains company, department and partner institution settings.',km:'គ្រប់គ្រងការកំណត់ក្រុមហ៊ុន នាយកដ្ឋាន និងស្ថាប័នដៃគូ។'},
 {source:'员工与角色',en:'Manages staff accounts, roles, activation and password resets.',km:'គ្រប់គ្រងគណនីបុគ្គលិក តួនាទី ការបើកប្រើ និងការកំណត់ពាក្យសម្ងាត់ឡើងវិញ។'},
 {source:'数据范围',en:'Shows company, department and institution data boundaries.',km:'បង្ហាញព្រំដែនទិន្នន័យរបស់ក្រុមហ៊ុន នាយកដ្ឋាន និងស្ថាប័ន។'},
 {source:'字段权限',en:'Configures KYC field access and records every change.',km:'កំណត់សិទ្ធិចូលប្រើវាល KYC និងកត់ត្រារាល់ការផ្លាស់ប្ដូរ។'},
 {source:'持牌机构',en:'Maintains institution scope, review roles and callback status.',km:'គ្រប់គ្រងវិសាលភាពស្ថាប័ន តួនាទីពិនិត្យ និងស្ថានភាព Callback។'},
 {source:'API 应用',en:'Manages API applications, key rotation and activation.',km:'គ្រប់គ្រងកម្មវិធី API ការប្ដូរសោ និងការបើកប្រើ។'},
{source:'语言与时区',en:'Configures back-office and client language and time zone.',km:'កំណត់ភាសា និងតំបន់ពេលវេលាសម្រាប់ប្រព័ន្ធគ្រប់គ្រង និងអតិថិជន។'},
 {source:'文件与扫描配置',en:'Shows file limits, scanning and quarantine status.',km:'បង្ហាញកម្រិតឯកសារ ស្ថានភាពស្កេន និងការដាក់ឯកសារនៅតំបន់ឃុំឃាំង។'},
 {source:'系统健康',en:'Shows service, job and database health.',km:'បង្ហាញសុខភាពសេវា កិច្ចការ និងមូលដ្ឋានទិន្នន័យ។'},
 {source:'操作审计',en:'Searches audit records by actor, object, time and outcome.',km:'ស្វែងរកកំណត់ត្រាសវនកម្មតាមអ្នកប្រតិបត្តិ វត្ថុ ពេលវេលា និងលទ្ធផល។'},
 {source:'登录与 IP',en:'Shows login, logout, failure and IP records.',km:'បង្ហាញកំណត់ត្រាចូល ចាកចេញ ការបរាជ័យ និង IP។'},
 {source:'数据修改',en:'Shows before-and-after values, reasons and reviews for sensitive changes.',km:'បង្ហាញតម្លៃមុន និងក្រោយ មូលហេតុ និងការពិនិត្យសម្រាប់ការកែប្រែទិន្នន័យសំខាន់។'},
 {source:'资金操作',en:'Shows funding actions, approvals and ledger links.',km:'បង្ហាញសកម្មភាពមូលនិធិ ការអនុម័ត និងតំណភ្ជាប់ទៅចលនាមូលនិធិ។'},
 {source:'权限变更',en:'Shows changes to roles, field access and sessions.',km:'បង្ហាញការផ្លាស់ប្ដូរតួនាទី សិទ្ធិវាល និងសម័យប្រើប្រាស់។'},
 {source:'安全告警',en:'Acknowledges, handles and closes security alerts.',km:'ទទួលស្គាល់ ដោះស្រាយ និងបិទការជូនដំណឹងសុវត្ថិភាព។'},
 {source:'应急事件',en:'Shows break-glass authorisations, scope and expiry.',km:'បង្ហាញការអនុញ្ញាតបន្ទាន់ វិសាលភាព និងពេលផុតកំណត់។'},
 {source:'审计导出',en:'Exports a redacted audit report by scope with an audit trail.',km:'នាំចេញរបាយការណ៍សវនកម្មដែលបានលាក់ព័ត៌មានតាមវិសាលភាព និងរក្សាកំណត់ត្រា។'}
];
const descriptionBySource=Object.fromEntries(descriptionEntries.map(entry=>[entry.source,entry]));
export const crmCopyKeys=entries.map(entry=>entry.key);
export const crmText=(source:string,locale:Locale):string=>{const entry=bySource[source];if(!entry||locale==='zh')return source;return locale==='km'?entry.km:entry.en};

const fallbackDescription=(source:string,locale:Locale)=>{
 const entry=bySource[source];
 if(locale==='zh')return crmSubpageByView[source]?.description||'授权范围内的独立业务页面。';
 const description=descriptionBySource[source];
 if(description)return locale==='km'?description.km:description.en;
 if(!entry)return locale==='km'?'ទំព័រអាជីវកម្មដែលមានសិទ្ធិចូលប្រើ។':'Authorized business page.';
 return locale==='km'?`ទំព័រអាជីវកម្ម ${entry.km} ក្នុងវិសាលភាពដែលអ្នកមានសិទ្ធិ។`:`Business page for ${entry.en} within your authorised scope.`;
};
export const crmDescription=(source:string,locale:Locale)=>fallbackDescription(source,locale);
export const crmFrameText=(source:'eyebrow'|'badge'|'generic',locale:Locale)=>{
 if(source==='eyebrow')return 'CRM · INDEPENDENT PAGE';
 return crmText(source==='badge'?'独立数据视图':'授权范围内的独立业务页面。',locale);
};
