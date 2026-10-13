import {AuthError} from '@/lib/h5-auth-core';
import {audit,db,staff} from './server';

const text=(value:unknown,max:number)=>typeof value==='string'?value.trim().slice(0,max):'';
const canRead=new Set(['admin','audit','finance_checker','checker']);

/** Build the insert used by funding mutations so the control event is committed
 * with the business mutation whenever a warning or block is reached. */
export function fundingRiskEventStatement(input:{tenantId:string,eventType:string,severity:string,snapshot:unknown,reason:string,correlationId?:string,actor?:string}){
  const correlationId=text(input.correlationId,120)||null;
  return db().prepare('INSERT INTO team_funding_risk_events (id,tenant_id,event_type,status,severity,snapshot_json,reason,correlation_id,created_at,actor) SELECT ?,?,?,\'open\',?,?,?,?,?,? WHERE ? IS NULL OR NOT EXISTS (SELECT 1 FROM team_funding_risk_events WHERE tenant_id=? AND correlation_id=? AND event_type=?)').bind(
    crypto.randomUUID(),input.tenantId,input.eventType,input.severity,JSON.stringify(input.snapshot),text(input.reason,500),correlationId,new Date().toISOString(),text(input.actor,120)||null,
    correlationId,input.tenantId,correlationId,input.eventType,
  );
}

export async function fundingRiskList(){
  const s=await staff();
  if(!s||!canRead.has(s.member.role))throw new AuthError('当前岗位无权查看资金风险事件',403,undefined,'FUNDING_RISK_FORBIDDEN');
  return (await db().prepare('SELECT id,event_type,status,severity,snapshot_json,reason,correlation_id,created_at,acknowledged_at,resolved_at,actor,reviewer FROM team_funding_risk_events WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100').bind(s.tenant.id).all()).results;
}

export async function fundingRiskTransition(id:string,action:string,reasonValue:unknown){
  const s=await staff();
  if(!s||s.member.role!=='admin')throw new AuthError('仅公司 Admin 可处理资金风险事件',403,undefined,'FUNDING_RISK_FORBIDDEN');
  const reason=text(reasonValue,500);
  if(reason.length<5)throw new AuthError('请填写至少 5 个字符的处理依据',400,undefined,'FUNDING_RISK_REASON_REQUIRED');
  const row=await db().prepare('SELECT id,status FROM team_funding_risk_events WHERE id=? AND tenant_id=?').bind(id,s.tenant.id).first<any>();
  if(!row)throw new AuthError('资金风险事件不存在',404,undefined,'FUNDING_RISK_NOT_FOUND');
  const now=new Date().toISOString();
  if(action==='acknowledge'){
    if(row.status!=='open')throw new AuthError('风险事件当前状态不可确认',409,undefined,'FUNDING_RISK_STATE_CONFLICT');
    const result=await db().prepare("UPDATE team_funding_risk_events SET status='acknowledged',acknowledged_at=?,reason=?,actor=? WHERE id=? AND tenant_id=? AND status='open'").bind(now,reason,s.user.userId,id,s.tenant.id).run();
    if(!result.meta.changes)throw new AuthError('风险事件已被其他管理员处理',409,undefined,'FUNDING_RISK_STATE_CONFLICT');
    await audit(s.tenant.id,s.user.userId,'funding_risk_acknowledged',{id,reason}).run();
    return {ok:true,id,status:'acknowledged'};
  }
  if(action==='resolve'){
    if(!['open','acknowledged','mitigating'].includes(row.status))throw new AuthError('风险事件当前状态不可关闭',409,undefined,'FUNDING_RISK_STATE_CONFLICT');
    const result=await db().prepare("UPDATE team_funding_risk_events SET status='resolved',resolved_at=?,reason=?,reviewer=? WHERE id=? AND tenant_id=? AND status IN ('open','acknowledged','mitigating')").bind(now,reason,s.user.userId,id,s.tenant.id).run();
    if(!result.meta.changes)throw new AuthError('风险事件已被其他管理员处理',409,undefined,'FUNDING_RISK_STATE_CONFLICT');
    await audit(s.tenant.id,s.user.userId,'funding_risk_resolved',{id,reason}).run();
    return {ok:true,id,status:'resolved'};
  }
  throw new AuthError('资金风险操作无效',400,undefined,'FUNDING_RISK_ACTION_INVALID');
}
