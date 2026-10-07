import type {Loan,Status} from './domain';
import type {InstitutionEventType} from './institution-events';

export type InstitutionActionPlan={kind:'approval'|'funding'|'repayment'|'payment_failure';eventType:InstitutionEventType;loanId:string;expectedStatus:Status[];externalReference?:string;amountCents?:number};

export function buildInstitutionActionPlan(event:{eventType:string;loanId?:string|null;externalReference?:string;amountCents?:number},loan:Loan):InstitutionActionPlan{
 if(!event.loanId||event.loanId!==loan.id)throw new Error('事件贷款编号与当前订单不一致');
 const type=event.eventType as InstitutionEventType;
 if(type==='loan.approved')return {kind:'approval',eventType:type,loanId:loan.id,expectedStatus:['decision_pending']};
 if(type==='loan.rejected')return {kind:'approval',eventType:type,loanId:loan.id,expectedStatus:['decision_pending']};
 if(type==='funding.confirmed')return {kind:'funding',eventType:type,loanId:loan.id,expectedStatus:['signed'],externalReference:event.externalReference};
 if(type==='repayment.confirmed'){
  if(!Number.isSafeInteger(event.amountCents)||Number(event.amountCents)<=0)throw new Error('还款确认金额无效');
  return {kind:'repayment',eventType:type,loanId:loan.id,expectedStatus:['active'],externalReference:event.externalReference,amountCents:event.amountCents};
 }
 if(type==='payment.failed')return {kind:'payment_failure',eventType:type,loanId:loan.id,expectedStatus:['signed','active'],externalReference:event.externalReference};
 throw new Error('暂不支持的机构事件类型');
}

export function assertPlanPrecondition(plan:InstitutionActionPlan,loan:Loan){
 if(!plan.expectedStatus.includes(loan.status))throw new Error('贷款状态不允许处理此机构事件');
 return true;
}
