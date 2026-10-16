import {staff,db} from './server';
import {env} from 'cloudflare:workers';
import {AuthError} from '@/lib/h5-auth-core';
import {readState} from '@/lib/store';
import {applyAction,requestFingerprint} from '@/lib/domain';
import {findCase} from '@/lib/kyc/server';
import {validLoanContract} from '@/lib/loan-signing';
import {scopedState} from './workflow';
import {assertEmergencyAccess} from './emergency';
import {assertFundingCapacity} from '@/lib/funding-limits';
import {fundingRiskEventStatement} from './funding-risk-events';
import {fundingSettingsForTenant} from './funding-settings';
import {serializeWorkspacePayload} from '@/lib/workspace-payload';
export async function adminFunds(p:any){
 const s=await staff();if(!s||s.member.role!=='admin')throw new AuthError('仅本公司 Admin 可执行资金管理',403);
 if(!['admin_disburse','admin_repay'].includes(p.action))throw new AuthError('操作无效');
 const testMode=(env as any).KHMERX_TEST_MODE==='true';
 if(!testMode&&!p.emergencyId)throw new AuthError('管理员资金操作必须经过已批准的应急授权',403,undefined,'FUNDING_DUAL_CONTROL_REQUIRED');
 let emergency:any=null;
 if(typeof p.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(p.requestId))throw new AuthError('请求编号无效');
 const key=s.user.userId+':'+p.requestId,digest=requestFingerprint(p),{state,revision}=await readState(s.tenant.id);
 const loan=state.loans.find(l=>l.id===p.loanId);if(!loan?.customerId)throw new AuthError('贷款不属于本公司',403);
 if(state.requests.includes(key)){if(state.requestDigests?.[key]&&state.requestDigests[key]!==digest)throw new AuthError('请求编号已绑定其他操作',409,undefined,'IDEMPOTENCY_PAYLOAD_MISMATCH');return scopedState();}
 const route=await db().prepare('SELECT * FROM team_assignments WHERE tenant_id=? AND customer_id=?').bind(s.tenant.id,loan.customerId).first<any>();
 const reason=typeof p.note==='string'?p.note.trim():'';
 if(reason.length<3||reason.length>500)throw new AuthError('请填写 3–500 字操作依据');
 const now=new Date().toISOString();let next,reference='',fundingCheck:any=null,repaymentCents=0,receiptAlreadyRecorded=false;
 if(p.action==='admin_disburse'){
  if(p.emergencyId)emergency=await assertEmergencyAccess(String(p.emergencyId),'funding',p.action,String(p.loanId||''),loan.billing?.net??loan.amount);
  if(!route?.funding_institution_id)throw new AuthError('请先配置并分配放款承接机构');
  if(loan.status!=='signed'||!loan.approvalActor||!loan.approvalCheckedBy)throw new AuthError('请先完成贷款初审、独立复核及客户签约');
  const k=await findCase(s.tenant.id,loan.customerId);
  if(!k||k.status!=='approved'||k.id!==loan.kycCaseId||k.revision!==loan.kycRevision)throw new AuthError('KYC 状态或版本已变化',409);
  await validLoanContract(s.tenant.id,loan,k);
  const limits=await fundingSettingsForTenant(s.tenant.id);try{fundingCheck=assertFundingCapacity(state.entries,loan.billing?.net??loan.amount,now,limits)}catch(error){if((error as Error & {code?:string}).code==='FUNDING_LIMIT_EXCEEDED'){await fundingRiskEventStatement({tenantId:s.tenant.id,eventType:'funding_regulatory_freeze',severity:'critical',snapshot:{action:p.action,loanId:loan.id,requested:loan.billing?.net??loan.amount,at:now,limits},reason:(error as Error).message,correlationId:p.requestId,actor:s.user.userId}).run();throw new AuthError((error as Error).message,409,undefined,'FUNDING_LIMIT_EXCEEDED')}throw error}
  next=applyAction(state,{action:'disburse',loanId:loan.id,role:'lender',requestId:key,note:'测试放款已登记'},now);
  const target=next.loans.find(l=>l.id===loan.id)!;target.fundingActor ||= s.user.userId;target.fundingCheckedBy=s.user.userId;
}else{
  repaymentCents=Number(p.cents);
  if(!Number.isSafeInteger(repaymentCents)||repaymentCents<=0)throw new AuthError('还款金额必须为正整数分值',400,'REPAYMENT_AMOUNT_INVALID');
  if(p.emergencyId)emergency=await assertEmergencyAccess(String(p.emergencyId),'funding',p.action,String(p.loanId||''),repaymentCents);
  if(!route?.repayment_institution_id)throw new AuthError('请先配置并分配还款承接机构');
  reference=typeof p.reference==='string'?p.reference.trim().toUpperCase():'';
  if(!/^[A-Z0-9_-]{6,80}$/.test(reference))throw new AuthError('还款流水号须为 6–80 位字母、数字、横线或下划线');
  const prior=await db().prepare('SELECT loan_id,cents,verified FROM team_repayment_receipts WHERE tenant_id=? AND reference=?').bind(s.tenant.id,reference).first<any>();
  if(!testMode&&(!prior||Number(prior.verified)!==1))throw new AuthError('真实支付回执尚未由服务端核验，不能登记还款',409,undefined,'PAYMENT_RECEIPT_UNVERIFIED');
  if(!testMode&&prior&&Number(prior.cents)!==repaymentCents)throw new AuthError('还款金额与已核验回执不一致',409,undefined,'PAYMENT_RECEIPT_AMOUNT_MISMATCH');
  if(prior){
   if(prior.loan_id!==loan.id||Number(prior.cents)!==repaymentCents)throw new AuthError('流水号已用于其他还款，不可重复入账',409);
   const priorLedger=await db().prepare('SELECT 1 FROM team_repayment_ledger WHERE tenant_id=? AND reference=?').bind(s.tenant.id,reference).first();
   if(priorLedger)return scopedState();
   receiptAlreadyRecorded=true;
  }
  next=applyAction(state,{action:'repay',loanId:loan.id,role:'mini',requestId:key,cents:repaymentCents,note:'测试还款已登记'},now);
}
 next.requestDigests??={};next.requestDigests[key]=digest;next.events[0].note+=' · 已由公司管理员处理';
 const statements=[db().prepare("UPDATE demo_workspaces SET payload=?,revision=revision+1 WHERE owner=? AND revision=? AND EXISTS(SELECT 1 FROM team_members WHERE id=? AND tenant_id=? AND role='admin' AND active=1 AND version=?) AND EXISTS(SELECT 1 FROM team_assignments WHERE tenant_id=? AND customer_id=? AND version=?) AND EXISTS(SELECT 1 FROM team_companies WHERE id=? AND active=1) AND (?=0 OR EXISTS(SELECT 1 FROM kyc_cases WHERE owner=? AND id=? AND revision=? AND status='approved'))").bind(serializeWorkspacePayload(next),s.tenant.id,revision,s.member.id,s.tenant.id,s.member.version,s.tenant.id,loan.customerId,route.version,s.tenant.id,p.action==='admin_disburse'?1:0,s.tenant.id,loan.kycCaseId||'',loan.kycRevision??-1)];
 if(emergency)statements.push(db().prepare("UPDATE team_emergency_access SET status='consumed',consumed_at=?,consumed_action=?,consumed_loan_id=?,consumed_cents=? WHERE id=? AND tenant_id=? AND status='active' AND requester_id=?").bind(Date.now(),p.action,loan.id,p.action==='admin_repay'?repaymentCents:loan.billing?.net??loan.amount,emergency.id,s.tenant.id,s.member.id));
 let receiptIndex=-1,ledgerIndex=-1;
 if(reference&&!receiptAlreadyRecorded){receiptIndex=statements.length;statements.push(db().prepare('INSERT INTO team_repayment_receipts(tenant_id,reference,loan_id,cents,actor,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(s.tenant.id,reference,loan.id,repaymentCents,s.user.userId,now));}
 if(reference){ledgerIndex=statements.length;statements.push(db().prepare("INSERT INTO team_repayment_ledger(tenant_id,reference,loan_id,cents,actor,source,created_at) SELECT ?,?,?,?,?, 'admin_repay',? WHERE changes()=1").bind(s.tenant.id,reference,loan.id,repaymentCents,s.user.userId,now));}
 statements.push(db().prepare('INSERT INTO team_audit(id,tenant_id,actor,action,detail,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),s.tenant.id,s.user.userId,p.action,JSON.stringify({loanId:loan.id,reason,reference,cents:reference?repaymentCents:loan.billing?.net??loan.amount,institutionId:reference?route.repayment_institution_id:route.funding_institution_id,mode:testMode?'test_funds':'emergency_authorized',...(emergency?{emergencyId:emergency.id,emergencyScope:emergency.scope,emergencyExpiresAt:emergency.expiresAt}: {})}),now));
 if(fundingCheck?.warning)statements.push(fundingRiskEventStatement({tenantId:s.tenant.id,eventType:'funding_regulatory_warning',severity:'warning',snapshot:{action:p.action,loanId:loan.id,requested:loan.billing?.net??loan.amount,dailyUsed:fundingCheck.dailyUsed,monthlyUsed:fundingCheck.monthlyUsed,dailyLimit:fundingCheck.dailyLimit,monthlyLimit:fundingCheck.monthlyLimit,dailyRemaining:fundingCheck.dailyRemaining,monthlyRemaining:fundingCheck.monthlyRemaining,warningPercent:fundingCheck.warningPercent,timezone:fundingCheck.timezone,at:now},reason:'放款后资金限额达到预警阈值，请完成复核',correlationId:p.requestId,actor:s.user.userId}));
 const result=await db().batch(statements);if(!result[0].meta.changes)throw new AuthError('订单、分单或权限已更新，请刷新后重试',409);if(emergency&&result[1]?.meta?.changes!==1)throw new AuthError('应急授权已被使用或已失效',409);if(receiptIndex>=0&&result[receiptIndex]?.meta?.changes!==1)throw new AuthError('还款回执未能落账，请重试',409,'REPAYMENT_RECEIPT_NOT_RECORDED');if(ledgerIndex>=0&&result[ledgerIndex]?.meta?.changes!==1)throw new AuthError('还款账本未能落账，请重试',409,'REPAYMENT_LEDGER_NOT_RECORDED');
 return scopedState();
}
