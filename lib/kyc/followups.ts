import {readState} from '@/lib/store';
import {staff,db,assignment,AUDIT_SEQ_SQL} from '@/lib/team/server';
import {canSee} from '@/lib/team/policy';
import {AuthError} from '@/lib/h5-auth-core';
export const followupStatuses={pending:'待跟进',contacted:'已联系',waiting:'等待客户补充',resolved:'跟进完成'};
export async function kycFollowups(id:string,p?:any){
 const s=await staff();if(!s)throw new AuthError('请先登录公司工作区',403);
 const k=await db().prepare('SELECT id,customer_id,status,revision,updated_at FROM kyc_cases WHERE owner=? AND id=?').bind(s.tenant.id,id).first<any>();
 const a=k?await assignment(s.tenant.id,k.customer_id):null;
 if(!k||!['admin','dept_admin','ops','kyc','audit'].includes(s.member.role)||!canSee(s.member,a||undefined))throw new AuthError('无权查看此 KYC 订单',403);
 const canNote=['admin','dept_admin','ops','kyc'].includes(s.member.role);
 if(p){
  if(!canNote)throw new AuthError('当前岗位只可查看跟进记录',403);
  const note=typeof p.note==='string'?p.note.trim():'';
  if(!note||note.length>1000||!Object.hasOwn(followupStatuses,p.status)||typeof p.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(p.requestId))throw new AuthError('请填写有效跟进情况及 1–1000 字备注');
  const result=await db().prepare(`INSERT OR IGNORE INTO team_audit (id,seq,tenant_id,actor,action,detail,created_at)
   SELECT ?,${AUDIT_SEQ_SQL},?,?, 'kyc_followup',?,? WHERE EXISTS(SELECT 1 FROM team_members WHERE id=? AND active=1 AND version=?) AND EXISTS(SELECT 1 FROM team_assignments WHERE tenant_id=? AND customer_id=? AND version=?)`).bind('kyc-followup:'+s.tenant.id+':'+id+':'+s.member.id+':'+p.requestId,s.tenant.id,s.user.email,JSON.stringify({caseId:id,status:p.status,note}),new Date().toISOString(),s.member.id,s.member.version,s.tenant.id,k.customer_id,a!.version).run();
  if(!result.meta.changes&&!await db().prepare('SELECT id FROM team_audit WHERE id=?').bind('kyc-followup:'+s.tenant.id+':'+id+':'+s.member.id+':'+p.requestId).first())throw new AuthError('权限或分单已变化，请刷新后重试',409);
 }
 const rows=(await db().prepare("SELECT id,actor,detail,created_at FROM team_audit WHERE tenant_id=? AND action='kyc_followup' AND json_extract(detail,'$.caseId')=? ORDER BY created_at DESC,id DESC LIMIT 100").bind(s.tenant.id,id).all<any>()).results;
 const account=await db().prepare('SELECT phone_mask,created_at FROM h5_accounts WHERE owner=? AND customer_id=?').bind(s.tenant.id,k.customer_id).first();
 const loans=(await readState(s.tenant.id)).state.loans.filter(l=>l.customerId===k.customer_id).map(l=>({id:l.id,status:l.status,kycCaseId:l.kycCaseId}));
 return {order:k,account,loans,canNote,canReview:s.member.role==='admin'||(s.member.role==='kyc'&&a?.reviewer_id===s.member.id),records:rows.map(({detail,...r}:any)=>({...r,...JSON.parse(detail)}))};
}
