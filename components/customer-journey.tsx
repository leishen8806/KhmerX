import {Check,ShieldCheck,ArrowRight,Wallet} from 'lucide-react';
import Link from 'next/link';
import type {Loan} from '@/lib/domain';

export function kycPresentation(status:string){
 const states:Record<string,{title:string;description:string;action:string}>={
  not_started:{title:'完成认证，开始借款',description:'准备好身份证、工作与收款账户资料。支持分步填写，随时保存草稿。',action:'填写身份资料'},
  draft:{title:'继续完善身份资料',description:'你的草稿已保存。补齐资料并提交后，我们将进行人工审核。',action:'继续填写'},
  submitted:{title:'身份资料审核中',description:'预计 24 小时内完成审核',action:'查看审核进度'},
  needs_info:{title:'请补充身份资料',description:'审核员需要更多资料。查看补件说明，修改后重新提交审核。',action:'查看说明并补件'},
  rejected:{title:'身份资料未通过',description:'请查看审核说明，了解未通过的原因与可进行的后续操作。',action:'查看审核说明'},
  approved:{title:'身份资料已通过',description:'现在可以申请借款。确认费用并签约后，机构将审核本笔贷款。',action:'查看身份资料'},
 };
 return states[status]||{title:'查看身份资料状态',description:'请打开身份资料页面，查看最新审核结果。',action:'查看身份资料'};
}

export const loanSteps=['贷款申请','贷款结算账单','用户确认签约','贷款审批状态','放款'];
export function loanPhase(loan?:Loan){return !loan?0:['active','closed'].includes(loan.status)?5:loan.status==='signed'?4:['decision_pending','rejected','approved'].includes(loan.status)?3:!loan.billConfirmedAt?1:2}
export function LoanSteps({phase}:{phase:number}){return <ol className="loan-stepbar" aria-label="申请贷款步骤">{loanSteps.map((s,i)=><li key={s} className={i<phase?'complete':i===phase?'current':''} aria-current={i===phase?'step':undefined}><span>{i<phase?<Check size={14}/>:i+1}</span><small>{s}</small></li>)}</ol>}
export function CustomerJourney({kycStatus,loan}:{kycStatus:string;loan?:Loan}){
 const approved=kycStatus==='approved';
 const funded=!!loan&&['active','closed'].includes(loan.status);
 const phase=!loan?-1:loanPhase(loan);
 const steps=loanSteps;
 const hints=['选择金额与期限','核对到账与应还金额','阅读协议并手写签名','等待机构审批结果','审批通过后安排放款'];
 return <><div className="section-heading"><div><p className="eyebrow">YOUR PROGRESS</p><h2>借款进度</h2></div><span className="pill">{funded?'已放款':phase<0?(approved?'待申请':'待认证'):`${Math.min(phase+1,5)} / 5`}</span></div>
 <Link className={'customer-kyc-link'+(approved?' verified':'')} href="/kyc"><ShieldCheck size={22}/><div><strong>{approved?'身份资料已通过':'身份资料审核'}</strong><small>{approved?'已满足申请条件':kycPresentation(kycStatus).title}</small></div><ArrowRight size={16}/></Link>
 <ol className="customer-timeline" aria-label="贷款流程">{steps.map((step,i)=><li key={step} className={i<phase?'complete':i===phase?'current':''} aria-current={i===phase?'step':undefined}><span className="customer-step-number">{i<phase?<Check size={16}/>:i+1}</span><div><strong>{step}</strong><small>{i<phase?'已完成':i===phase&&loan?.status==='rejected'?'申请未通过，请查看说明':i===phase?hints[i]:'待前序步骤完成'}</small></div>{i===phase&&<span className="customer-now">当前</span>}</li>)}</ol>
 {funded&&<div className="customer-repayment"><Wallet size={20}/><div><strong>{loan.status==='closed'?'本笔借款已结清':loan.demoDays>0?'已逾期，请及时还款':loan.wallet>0?'资金已到账，可提现':'借款还款中'}</strong><p>{loan.status==='closed'?'还款记录已保存，可在申请记录中查看。':`剩余应还 $${((loan.amount+loan.fee-loan.paid)/100).toFixed(2)}`}</p><a href="#application">查看账单 <ArrowRight size={14}/></a></div></div>}
 </>;
}
