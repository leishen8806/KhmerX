export const roleLabels={admin:'公司管理员',collection_admin:'贷后部门主管',collector:'贷后客服',dept_admin:'KYC 审核主管',ops:'运营分单',kyc:'KYC 审核员',lender:'机构审批员',checker:'机构复核员',finance:'放款员',finance_checker:'放款复核员',audit:'审计员'} as const;
export type TeamRole=keyof typeof roleLabels;
export type Member={id:string;tenant_id:string;user_id:string;email:string;role:TeamRole;unit_id:string|null;active:number;version:number};
export type Assignment={tenant_id:string;customer_id:string;department_id:string;institution_id:string|null;version:number;funding_institution_id?:string|null;repayment_institution_id?:string|null;collection_unit_id?:string|null;reviewer_id?:string|null};
export function canSee(m:Member,a:Assignment|undefined,kind:'summary'|'kyc'='summary'){
 if(!m.active||!a||m.tenant_id!==a.tenant_id)return false;
 if(kind==='summary'&&['admin','audit'].includes(m.role))return true;
 if(['admin','audit'].includes(m.role))return true;
 if(['ops','dept_admin'].includes(m.role))return kind==='summary'&&m.unit_id===a.department_id;
 if(m.role==='kyc')return m.unit_id===a.department_id&&m.id===a.reviewer_id;
 if(['finance','finance_checker'].includes(m.role))return kind==='summary'&&m.unit_id===(a.funding_institution_id||a.institution_id);
 if(['lender','checker'].includes(m.role))return kind==='summary'&&!!a.institution_id&&m.unit_id===a.institution_id;
 return false;
}
export const actionRoles:Record<string,TeamRole[]>={approve:['lender'],reject:['lender'],approval_check:['checker'],disburse_request:['finance'],disburse:['finance_checker'],admin_disburse:['admin'],admin_repay:['admin'],overdue:['ops'],bot_save:['admin'],bot_add:['admin'],bot_switch:['admin']};
export function allowAction(m:Member,a:Assignment|undefined,action:string){return !!m.active&&!!actionRoles[action]?.includes(m.role)&&(action.startsWith('bot_')||canSee(m,a));}
export function requireDifferent(actor:string,other:string|undefined){if(!other||actor===other)throw Error('必须由另一位员工复核，不能复核本人操作');}
