import {staff,db} from './server';
import {env} from 'cloudflare:workers';
import {AuthError} from '@/lib/h5-auth-core';
import {readState} from '@/lib/store';
import {applyAction} from '@/lib/domain';
import {findCase} from '@/lib/kyc/server';
import {validLoanContract} from '@/lib/loan-signing';
import {scopedState} from './workflow';
import {assertEmergencyAccess} from './emergency';
export async function adminFunds(p:any){
 const s=await staff();if(!s||s.member.role!=='admin')throw new AuthError('仅本公司 Admin 可执行资金管理',403);
 if(!['admin_disburse','admin_repay'].includes(p.action))throw new AuthError('操作无效');
 const testMode=(env as any).KHMERX_TEST_MODE==='true';
 if(!testMode&&!p.emergencyId)throw new AuthError('管理员资金操作必须经过已批准的应急授权',403,undefined,'FUNDING_DUAL_CONTROL_REQUIRED');
 const emergency=p.emergencyId?await assertEmergencyAccess(String(p.emergencyId),'funding',p.action):null;
 if(typeof p.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(p.requestId))throw new AuthError('请求编号无效');
 const key=s.user.userId+':'+p.requestId,{state,revision}=await readState(s.tenant.id);
 const loan=state.loans.find(l=>l.id===p.loanId);if(!loan?.customerId)throw new AuthError('贷款不属于本公司',403);
 if(state.requests.includes(key))return scopedState();
 const route=await db().prepare('SELECT * FROM team_assignments WHERE tenant_id=? AND customer_id=?').bind(s.tenant.id,loan.customerId).first<any>();
 const reason=typeof p.note==='string'?p.note.trim():'';
 if(reason.length<3||reason.length>500)throw new AuthError('请填写 3–500 字操作依据');
 const now=new Date().toISOString();let next,reference='';
 if(p.action==='admin_disburse'){
  if(!route?.funding_institution_id)throw new AuthError('请先配置并分配放款承接机构');
  if(loan.status!=='signed'||!loan.approvalActor||!loan.approvalCheckedBy)throw new AuthError('请先完成贷款初审、独立复核及客户签约');
  const k=await findCase(s.tenant.id,loan.customerId);
  if(!k||k.status!=='approved'||k.id!==loan.kycCaseId||k.revision!==loan.kycRevision)throw new AuthError('KYC 状态或版本已变化',409);
  await validLoanContract(s.tenant.id,loan,k);
  next=applyAction(state,{action:'disburse',loanId:loan.id,role:'lender',requestId:key,note:'Admin 测试放款：'+reason},now);
  const target=next.loans.find(l=>l.id===loan.id)!;target.fundingActor ||= s.user.userId;target.fundingCheckedBy=s.user.userId;
 }else{
  if(!route?.repayment_institution_id)throw new AuthError('请先配置并分配还款承接机构');
  reference=typeof p.reference==='string'?p.reference.trim().toUpperCase():'';
  if(!/^[A-Z0-9_-]{6,80}$/.test(reference))throw new AuthError('还款流水号须为 6–80 位字母、数字、横线或下划线');
  if(!testMode&&p.paymentVerified!==true)throw new AuthError('真实支付回执尚未核验，不能登记还款',409,undefined,'PAYMENT_RECEIPT_UNVERIFIED');
  const prior=await db().prepare('SELECT loan_id,cents FROM team_repayment_receipts WHERE tenant_id=? AND reference=?').bind(s.tenant.id,reference).first<any>();
  if(prior){if(prior.loan_id===loan.id&&prior.cents===p.cents)return scopedState();throw new AuthError('流水号已用于其他还款，不可重复入账',409)}
  next=applyAction(state,{action:'repay',loanId:loan.id,role:'mini',requestId:key,cents:p.cents,note:'Admin 登记测试还款 '+reference+'：'+reason},now);
 }
 next.events[0].note+=' · Admin '+s.user.email;
 const statements=[db().prepare("UPDATE demo_workspaces SET payload=?,revision=revision+1 WHERE owner=? AND revision=? AND EXISTS(SELECT 1 FROM team_members WHERE id=? AND tenant_id=? AND role='admin' AND active=1 AND version=?) AND EXISTS(SELECT 1 FROM team_assignments WHERE tenant_id=? AND customer_id=? AND version=?) AND EXISTS(SELECT 1 FROM team_companies WHERE id=? AND active=1) AND (?=0 OR EXISTS(SELECT 1 FROM kyc_cases WHERE owner=? AND id=? AND revision=? AND status='approved'))").bind(JSON.stringify(next),s.tenant.id,revision,s.member.id,s.tenant.id,s.member.version,s.tenant.id,loan.customerId,route.version,s.tenant.id,p.action==='admin_disburse'?1:0,s.tenant.id,loan.kycCaseId||'',loan.kycRevision??-1)];
 if(reference)statements.push(db().prepare('INSERT INTO team_repayment_receipts(tenant_id,reference,loan_id,cents,actor,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(s.tenant.id,reference,loan.id,p.cents,s.user.userId,now));
 statements.push(db().prepare('INSERT INTO team_audit(id,tenant_id,actor,action,detail,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),s.tenant.id,s.user.userId,p.action,JSON.stringify({loanId:loan.id,reason,reference,cents:reference?p.cents:loan.billing?.net??loan.amount,institutionId:reference?route.repayment_institution_id:route.funding_institution_id,mode:'test_funds',...(emergency?{emergencyId:emergency.id,emergencyScope:emergency.scope,emergencyExpiresAt:emergency.expiresAt}: {})}),now));
 const result=await db().batch(statements);if(!result[0].meta.changes)throw new AuthError('订单、分单或权限已更新，请刷新后重试',409);
 return scopedState();
}
