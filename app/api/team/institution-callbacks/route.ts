import {db,staff,audit} from '@/lib/team/server';
import {input,json,failure} from '@/lib/h5-auth';
import {AuthError} from '@/lib/h5-auth-core';
import {manualCallbackRetry} from '@/lib/institution-callback-queue';

export const dynamic='force-dynamic';
const text=(value:unknown,max=120)=>typeof value==='string'?value.trim().slice(0,max):'';
const allowed=(role:string)=>role==='admin'||role==='audit';
type RetryInput={action?:unknown;eventId?:unknown};
type RetryEvent={id:string;institution_id:string;status:string;attempts:number};

export async function GET(){
 try{
  const s=await staff();if(!s||!allowed(s.member.role))throw new AuthError('当前岗位没有持牌机构回调查看权限',403);
  const rows=await db().prepare(`SELECT e.id,e.institution_id,e.idempotency_key,e.event_type,e.status,e.request_id,e.created_at,e.updated_at,a.attempt,a.status AS attempt_status,a.next_at,a.last_error
   FROM institution_callback_events e LEFT JOIN institution_callback_attempts a ON a.id=(SELECT x.id FROM institution_callback_attempts x WHERE x.event_id=e.id ORDER BY x.attempt DESC LIMIT 1)
   WHERE EXISTS (SELECT 1 FROM team_units u WHERE u.id=e.institution_id AND u.tenant_id=? AND u.kind='institution') ORDER BY e.created_at DESC LIMIT 200`).bind(s.tenant.id).all();
  return json({events:rows.results,redacted:true});
 }catch(e){return failure(e)}
}

export async function POST(request:Request){
 try{
  const s=await staff();if(!s||s.member.role!=='admin')throw new AuthError('仅公司 Admin 可重试持牌机构回调',403);
  const p=await input(request) as RetryInput;if(p.action!=='retry')throw new AuthError('回调队列操作无效',400);
  const eventId=text(p.eventId,80),event=await db().prepare(`SELECT e.id,e.institution_id,e.status,COALESCE(MAX(a.attempt),-1) AS attempts FROM institution_callback_events e LEFT JOIN institution_callback_attempts a ON a.event_id=e.id WHERE e.id=? AND EXISTS (SELECT 1 FROM team_units u WHERE u.id=e.institution_id AND u.tenant_id=? AND u.kind='institution') GROUP BY e.id`).bind(eventId,s.tenant.id).first<RetryEvent>();
  if(!event)throw new AuthError('回调记录不存在或不属于当前公司',404);
  if(event.status!=='dead_letter')throw new AuthError('只有死信回调允许人工重试',409);
  const now=new Date().toISOString(),retry=manualCallbackRetry(Number(event.attempts)),attempt=retry.attempt;
  await db().batch([db().prepare("UPDATE institution_callback_events SET status='received',updated_at=? WHERE id=? AND status='dead_letter'").bind(now,event.id),db().prepare('INSERT INTO institution_callback_attempts (id,event_id,attempt,status,next_at,last_error,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),event.id,attempt,retry.status,retry.nextAt,'manual retry',now,now),audit(s.tenant.id,s.user.userId,'institution_callback_retry',{eventId:event.id,attempt,nextAt:retry.nextAt})]);
  return json({ok:true,eventId:event.id,attempt,nextAt:retry.nextAt});
 }catch(e){return failure(e)}
}
