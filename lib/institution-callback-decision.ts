import type {State} from '@/lib/domain';

export type InstitutionDecision='loan.approved'|'loan.rejected';

/** Apply only an institution decision; the independent checker remains required. */
export function applyInstitutionDecision(state:State,loanId:string,eventType:InstitutionDecision,actor:string,reason:string,contract?:string,now=new Date().toISOString()):State{
 const next=structuredClone(state),loan=next.loans.find(item=>item.id===loanId);
 if(!loan)throw new Error('贷款申请不存在');
 if(loan.status!=='decision_pending'||loan.approvalActor)throw new Error('贷款状态不允许处理机构决定');
 loan.approvalActor=actor;
 if(eventType==='loan.approved'){
  if(!contract)throw new Error('审批合同记录不存在');
  loan.signedAt=now;loan.signature='已保存的手写签名';loan.contract=contract;loan.note='机构回调初审通过，等待独立复核';
 }else{
  const note=reason.trim().slice(0,300);if(!note)throw new Error('机构拒绝原因为空');
  loan.status='rejected';loan.note=note;
 }
 next.events.unshift({id:crypto.randomUUID(),loanId:loan.id,role:'lender',action:eventType==='loan.approved'?'approve':'reject',note:loan.note,at:now});
 next.notifications.unshift({id:crypto.randomUUID(),loanId:loan.id,botId:loan.botId,text:loan.note,at:now,status:'机构回调已记录'});
 return next;
}
