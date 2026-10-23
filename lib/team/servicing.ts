import {staff,db} from './server';
import {AuthError} from '@/lib/h5-auth-core';
export async function servicingData(){const s=await staff();if(!s)throw new AuthError('请先登录公司',403);return {settings:await db().prepare('SELECT * FROM team_service_settings WHERE tenant_id=?').bind(s.tenant.id).first()}}
export async function servicingSave(p:any){
 const s=await staff();if(!s||s.member.role!=='admin')throw new AuthError('仅 Admin 可设置承接机构',403);
 const current=await db().prepare('SELECT * FROM team_service_settings WHERE tenant_id=?').bind(s.tenant.id).first<any>();
 if((current?.version??-1)!==p.version)throw new AuthError('配置已变化，请刷新',409);
 if(typeof p.enabled!=='boolean')throw new AuthError('请选择自动分配状态');
 for(const [id,kind] of [[p.fundingId,'institution'],[p.repaymentId,'institution'],[p.collectionId,'postloan']]){
  if(!await db().prepare('SELECT id FROM team_units WHERE id=? AND tenant_id=? AND kind=? AND active=1').bind(id||'',s.tenant.id,kind).first())throw new AuthError('请选择本公司的启用承接机构／贷后部门');
 }
 const next={tenant_id:s.tenant.id,auto_assign:p.enabled?1:0,funding_id:p.fundingId,repayment_id:p.repaymentId,collection_id:p.collectionId,version:p.version+1};
 const result=await db().batch([
 db().prepare(`INSERT INTO team_service_settings(tenant_id,auto_assign,funding_id,repayment_id,collection_id,version) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM team_members WHERE id=? AND role='admin' AND active=1 AND version=?) AND COALESCE((SELECT version FROM team_service_settings WHERE tenant_id=?),-1)=? ON CONFLICT(tenant_id) DO UPDATE SET auto_assign=excluded.auto_assign,funding_id=excluded.funding_id,repayment_id=excluded.repayment_id,collection_id=excluded.collection_id,version=excluded.version`).bind(next.tenant_id,next.auto_assign,next.funding_id,next.repayment_id,next.collection_id,next.version,s.member.id,s.member.version,s.tenant.id,p.version),
 db().prepare("INSERT INTO team_audit(id,tenant_id,actor,action,detail,created_at) SELECT ?,?,?,'service_routing_save',?,? WHERE changes()=1").bind(crypto.randomUUID(),s.tenant.id,s.user.userId,JSON.stringify({before:current,after:next}),new Date().toISOString())
 ]);
 if(!result[0].meta.changes)throw new AuthError('配置或权限已变化，请刷新',409);
 await fillServiceAssignments(s.tenant.id);return {ok:true};
}
export async function fillServiceAssignments(tenant:string){
 const result=await db().batch([
 db().prepare(`UPDATE team_assignments SET funding_institution_id=COALESCE(funding_institution_id,(SELECT funding_id FROM team_service_settings WHERE tenant_id=?)),repayment_institution_id=COALESCE(repayment_institution_id,(SELECT repayment_id FROM team_service_settings WHERE tenant_id=?)),collection_unit_id=COALESCE(collection_unit_id,(SELECT collection_id FROM team_service_settings WHERE tenant_id=?)),version=version+1 WHERE tenant_id=? AND (funding_institution_id IS NULL OR repayment_institution_id IS NULL OR collection_unit_id IS NULL) AND EXISTS(SELECT 1 FROM team_service_settings WHERE tenant_id=? AND auto_assign=1)`).bind(tenant,tenant,tenant,tenant,tenant),
 db().prepare("INSERT INTO team_audit(id,tenant_id,actor,action,detail,created_at) SELECT ?,?,'system','service_auto_assign','自动补齐未分配的放款、还款和催收承接机构',? WHERE changes()>0").bind(crypto.randomUUID(),tenant,new Date().toISOString())
 ]);return result[0].meta.changes;
}
