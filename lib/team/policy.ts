export const roleLabels={admin:'公司管理员',collection_admin:'贷后部门主管',collector:'贷后客服',dept_admin:'KYC 审核主管',ops:'运营分单员',kyc:'KYC 审核员',lender:'机构审批员',checker:'持牌机构复核员',finance:'放款员',finance_checker:'放款复核员',audit:'审计员'} as const;
export type TeamRole=keyof typeof roleLabels;
export const roleCatalog:Record<TeamRole,{description:string;unitKind:'department'|'institution'|'postloan'|null;highRisk:boolean}>={
 admin:{description:'管理公司设置、员工与全部业务范围',unitKind:null,highRisk:true},
 collection_admin:{description:'管理所属贷后部门任务与客服分配',unitKind:'postloan',highRisk:false},
 collector:{description:'处理所属贷后部门的催收任务',unitKind:'postloan',highRisk:false},
 dept_admin:{description:'管理所属 KYC 部门并处理审核协作',unitKind:'department',highRisk:false},
 ops:{description:'负责所属部门的客户分配与资料流转；测试环境可调整逾期情景',unitKind:'department',highRisk:false},
 kyc:{description:'审核所属部门分配的 KYC 资料',unitKind:'department',highRisk:false},
 lender:{description:'审核所属持牌机构的贷款申请',unitKind:'institution',highRisk:true},
 checker:{description:'独立复核所属持牌机构的贷款审批',unitKind:'institution',highRisk:true},
 finance:{description:'发起所属机构的放款操作',unitKind:'institution',highRisk:true},
 finance_checker:{description:'复核所属机构的放款操作',unitKind:'institution',highRisk:true},
 audit:{description:'查看审计与安全记录，不参与业务审批',unitKind:null,highRisk:true}
};
export const roleUnitKind=(role:TeamRole)=>roleCatalog[role].unitKind;
export type Member={id:string;tenant_id:string;user_id:string;email:string;role:TeamRole;unit_id:string|null;data_scope?:'role'|'company'|'department'|'institution'|'assigned';active:number;version:number};
export const dataScopeLabels={role:'按角色默认范围',company:'当前公司',department:'所属部门',institution:'所属持牌机构',assigned:'仅指派案件'} as const;
export type DataScope=keyof typeof dataScopeLabels;
export function dataScopeForRole(role:TeamRole):DataScope{return role==='admin'||role==='audit'?'company':['lender','checker','finance','finance_checker'].includes(role)?'institution':['kyc'].includes(role)?'assigned':roleUnitKind(role)==='department'?'department':roleUnitKind(role)==='postloan'?'department':'role'}
export type Assignment={tenant_id:string;customer_id:string;department_id:string;institution_id:string|null;version:number;funding_institution_id?:string|null;repayment_institution_id?:string|null;collection_unit_id?:string|null;reviewer_id?:string|null};
export const kycFieldGroups={identity:'身份与证件',contacts:'联系人',employment:'工作与收入',bank:'银行与钱包',address:'地址与定位'} as const;
export type KycFieldGroup=keyof typeof kycFieldGroups;
export const kycFieldGroupFor=(field:string):KycFieldGroup=>{
 if(['contact1Name','contact1Relation','contact1Phone','contact2Name','contact2Relation','contact2Phone','contact3Name','contact3Relation','contact3Phone'].includes(field))return 'contacts';
 if(['bankName','bankAccount','bankHolder'].includes(field))return 'bank';
 if(['address','province','district','location'].includes(field))return 'address';
 if(['documentNumber'].includes(field))return 'identity';
 if(['workType','company','industry','position'].includes(field))return 'employment';
 if(['income','tenure','supervisorName','supervisorPhone'].includes(field))return 'employment';
 if(['vehicle','housing'].includes(field))return 'employment';
 return 'identity';
};
export function canSee(m:Member,a:Assignment|undefined,kind:'summary'|'kyc'='summary'){
 if(!m.active||!a||m.tenant_id!==a.tenant_id)return false;
 if(kind==='summary'&&['admin','audit'].includes(m.role))return true;
 if(['admin','audit'].includes(m.role))return true;
 if(m.role==='ops')return kind==='summary'&&m.unit_id===a.department_id;
 if(m.role==='dept_admin')return m.unit_id===a.department_id;
 if(m.role==='kyc')return m.unit_id===a.department_id&&m.id===a.reviewer_id;
 if(['finance','finance_checker'].includes(m.role))return kind==='summary'&&m.unit_id===(a.funding_institution_id||a.institution_id);
 if(['lender','checker'].includes(m.role))return kind==='summary'&&!!a.institution_id&&m.unit_id===a.institution_id;
 return false;
}
export const actionRoles:Record<string,TeamRole[]>={approve:['lender'],reject:['lender'],approval_check:['checker'],disburse_request:['finance'],disburse:['finance_checker'],admin_disburse:['admin'],admin_repay:['admin'],overdue:['ops'],bot_save:['admin'],bot_add:['admin'],bot_switch:['admin']};
export const actionLabels:Record<string,string>={approve:'贷款初审通过',reject:'拒绝贷款申请',approval_check:'独立复核贷款审批',disburse_request:'发起放款',disburse:'复核放款',admin_disburse:'管理员放款',admin_repay:'登记还款',overdue:'调整测试逾期情景',bot_save:'保存机器人配置',bot_add:'新增机器人',bot_switch:'切换业务机器人'};
// These labels describe the separate post-loan service API. They are kept out
// of actionRoles because that map is the authorization policy for loan actions.
export const roleDisplayActions:Partial<Record<TeamRole,string[]>>={
 collection_admin:['贷后任务改派与团队分配'],
 collector:['记录跟进、承诺还款与客户异议'],
 dept_admin:['KYC 审核、补件与协作'],
 kyc:['审核 KYC 资料与补件'],
 ops:['客户分配与资料流转'],
 audit:['只读查看审计与安全记录']
};
export function allowAction(m:Member,a:Assignment|undefined,action:string){return !!m.active&&!!actionRoles[action]?.includes(m.role)&&(action.startsWith('bot_')||canSee(m,a));}
export function requireDifferent(actor:string,other:string|undefined){if(!other||actor===other)throw Error('必须由另一位员工复核，不能复核本人操作');}
