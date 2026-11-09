import type {State} from '@/lib/domain';

export type InstitutionDecision='loan.approved'|'loan.rejected'|'funding.confirmed';

/** Record a repayment callback without changing the wallet or repayment ledger. */
export function recordInstitutionRepayment(state:State,loanId:string,institutionId:string,amountCents:number,externalReference:string,now=new Date().toISOString()):State{
 const next=structuredClone(state),loan=next.loans.find(item=>item.id===loanId);
 if(!loan)throw new Error('贷款申请不存在');
 if(loan.status!=='active')throw new Error('贷款状态不允许处理机构还款');
 if(!Number.isSafeInteger(amountCents)||amountCents<=0)throw new Error('还款确认金额无效');
 const reference=externalReference.trim().slice(0,80);if(!reference)throw new Error('机构还款外部编号为空');
 if(next.events.some(event=>event.loanId===loanId&&event.externalReference===reference))throw new Error('EXTERNAL_REFERENCE_DUPLICATE');
 if(loan.pendingRepayment)throw new Error('REPAYMENT_REVIEW_PENDING');
 loan.pendingRepayment={amountCents,externalReference:reference,institutionId,receivedAt:now};
 loan.note='机构已确认还款，等待财务复核';
 next.events.unshift({id:crypto.randomUUID(),loanId:loan.id,role:'lender',action:'repayment.confirmed',note:loan.note,at:now,source:'institution',eventType:'repayment.confirmed',externalReference:reference,institutionId});
 next.notifications.unshift({id:crypto.randomUUID(),loanId:loan.id,botId:loan.botId,text:loan.note,at:now,status:'机构回调已记录'});
 return next;
}

/** Apply only an institution decision; the independent checker remains required. */
export function applyInstitutionDecision(state:State,loanId:string,eventType:InstitutionDecision,actor:string,reason:string,contract?:string,now=new Date().toISOString(),externalReference?:string):State{
 const next=structuredClone(state),loan=next.loans.find(item=>item.id===loanId);
 if(!loan)throw new Error('贷款申请不存在');
 if(eventType==='funding.confirmed'){
  if(loan.status!=='signed'||!loan.approvalCheckedBy||loan.fundingActor)throw new Error('贷款状态不允许处理机构出资');
  const reference=externalReference?.trim().slice(0,120);if(!reference)throw new Error('机构出资外部编号为空');
  loan.fundingActor=actor;loan.externalReference=reference;loan.note='机构已确认出资，等待财务复核';
  next.events.unshift({id:crypto.randomUUID(),loanId:loan.id,role:'lender',action:eventType,note:loan.note,at:now});
  next.notifications.unshift({id:crypto.randomUUID(),loanId:loan.id,botId:loan.botId,text:loan.note,at:now,status:'机构回调已记录'});
  return next;
 }
 if(loan.status!=='decision_pending'||loan.approvalActor)throw new Error('贷款状态不允许处理机构决定');
 loan.approvalActor=actor;
 if(eventType==='loan.approved'){
  if(!contract)throw new Error('审批合同记录不存在');
  loan.signedAt=now;loan.signature='已保存的手写签名';loan.contract=contract;loan.note='机构回调初审通过，等待独立复核';
 }else{
  const note=reason.trim().slice(0,300);if(!note)throw new Error('机构拒绝原因为空');
  loan.status='rejected';loan.note=note;
 }
 next.events.unshift({id:crypto.randomUUID(),loanId:loan.id,role:'lender',action:eventType,note:loan.note,at:now});
 next.notifications.unshift({id:crypto.randomUUID(),loanId:loan.id,botId:loan.botId,text:loan.note,at:now,status:'机构回调已记录'});
 return next;
}
