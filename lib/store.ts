import {env} from 'cloudflare:workers';
import {initialState,applyAction,type State} from './domain';
import {customerAction} from './domain';
import {findCase,reviewer,KycError} from './kyc/server';
function db(){if(!env.DB)throw Error('测试数据库暂不可用');return env.DB}
export async function readState(owner:string):Promise<{state:State;revision:number}>{
 const row=await db().prepare('SELECT revision,payload FROM demo_workspaces WHERE owner=?').bind(owner).first<{revision:number;payload:string}>();
 return row?{state:JSON.parse(row.payload),revision:row.revision}:{state:initialState(),revision:0};
}
export async function mutate(owner:string,p:any,customer?:{id:string;phoneMasked:string}){
 await db().prepare('INSERT OR IGNORE INTO demo_workspaces (owner,revision,payload) VALUES (?,0,?)').bind(owner,JSON.stringify(initialState())).run();
 for(let i=0;i<4;i++){
  const {state,revision}=await readState(owner);
  const loan=state.loans.find(l=>l.id===p.loanId);
  // Customer ownership must be checked before consulting another customer's case.
  if(customer&&p.action!=='create'&&loan?.customerId!==customer.id)throw new KycError('申请不存在或不属于当前客户',404);
  let approvedCase;
  if(loan?.customerId){
   if(!customer&&['confirm_kyc','submit_kyc','resubmit','apply','sign','withdraw','repay'].includes(p.action))throw new KycError('请由客户在 H5 会话操作',403);
   if(['review','supplement'].includes(p.action))throw new KycError('请在 KYC 人工审核页面逐项核对资料',409);
   if(['approve','reject','disburse'].includes(p.action))await reviewer();
   if(['confirm_kyc','submit_kyc','resubmit','apply','approve','sign','disburse'].includes(p.action)){
    approvedCase=await findCase(owner,loan.customerId);
    if(approvedCase?.status!=='approved')throw new KycError('请先完成身份资料提交及人工审核，再返回我的贷款确认审核结果',409);
    if(loan.kycCaseId&&(loan.kycCaseId!==approvedCase.id||loan.kycRevision!==approvedCase.revision))throw new KycError('审核资料版本已变化，请联系审核人员',409);
   }
  }
  const next=customer?customerAction(state,p,customer):applyAction(state,p);
  if(next===state)return {state,revision};
  if(approvedCase){
   const updated=next.loans.find(l=>l.id===p.loanId)!;
   updated.kycCaseId=approvedCase.id;updated.kycRevision=approvedCase.revision;
   if(['confirm_kyc','submit_kyc','resubmit'].includes(p.action)){
    updated.status='kyc_approved';updated.note='人工资料审核通过，可以申请测试贷款（资料版本 '+approvedCase.revision+'）';
    next.events[0].note=updated.note;next.notifications[0].text=updated.note;
   }
  }
  const result=await db().prepare('UPDATE demo_workspaces SET payload=?,revision=revision+1 WHERE owner=? AND revision=?').bind(JSON.stringify(next),owner,revision).run();
  if(result.meta.changes===1)return {state:next,revision:revision+1};
 }
 throw Error('其他操作刚刚更新了记录，请重试');
}
