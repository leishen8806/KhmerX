import {requireOrigin} from '@/lib/http/route';
import {db,staff,auditInsertSql} from '@/lib/team/server';
import {input,json,failure} from '@/lib/h5-auth';
import {AuthError} from '@/lib/h5-auth-core';

export const dynamic='force-dynamic';
const text=(value:unknown,max=200)=>typeof value==='string'?value.trim().slice(0,max):'';

export async function GET(){
 try{const s=await staff();if(!s||s.member.role!=='admin')throw new AuthError('仅公司管理员可查看转人工发件箱',403);
  const rows=await db().prepare(`SELECT id,event_type,institution_id,attempts,last_error,created_at,requeued_at,requeue_count
   FROM partner_outbox WHERE tenant_id=? AND status='dead' ORDER BY created_at DESC LIMIT 200`).bind(s.tenant.id).all();
  return json({items:rows.results});
 }catch(e){return failure(e)}
}

export async function POST(request:Request){
 try{requireOrigin(request);const s=await staff();if(!s||s.member.role!=='admin')throw new AuthError('仅公司管理员可重新发送发件箱记录',403);
  const p=await input(request);if(p.action!=='requeue')throw new AuthError('发件箱操作无效',400);
  const id=text(p.id,120),reason=text(p.reason,300),requestId=text(p.requestId,120);
  if(!reason)throw new AuthError('请填写重新发送原因',400,undefined,'REASON_REQUIRED');
  if(!/^[A-Za-z0-9_-]{8,120}$/.test(requestId))throw new AuthError('请求编号无效',400);
  const prior=await db().prepare("SELECT detail FROM team_audit WHERE tenant_id=? AND action='partner_outbox_requeue'").bind(s.tenant.id).all<{detail:string}>();
  if(prior.results.some(row=>{try{return JSON.parse(row.detail).requestId===requestId}catch{return false}}))return json({ok:true,idempotent:true,requestId});
  const now=new Date().toISOString();
  const result=await db().batch([
   db().prepare("UPDATE partner_outbox SET status='pending',attempts=0,next_attempt_at=?,lease_until=NULL,requeued_at=?,requeue_count=requeue_count+1 WHERE id=? AND tenant_id=? AND status='dead'").bind(Date.parse(now),now,id,s.tenant.id),
   auditInsertSql(s.tenant.id,s.user.userId,'partner_outbox_requeue',{recordId:id,reason,requestId},undefined,'changed')
  ]);
  if(result[0].meta.changes!==1)throw new AuthError('只有转人工记录可以重新发送',409);
  return json({ok:true,id,requestId});
 }catch(e){return failure(e,request)}
}
