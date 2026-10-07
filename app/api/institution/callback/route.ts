import {env} from 'cloudflare:workers';
import {addErrorCode} from '@/lib/error-codes';
import {verifyInstitutionCallback} from '@/lib/institution-callback';
import {nextCallbackRetry} from '@/lib/institution-callback-queue';
import {normalizeInstitutionEvent} from '@/lib/institution-events';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(addErrorCode(data,status),{status,headers:{'Cache-Control':'no-store'}});
const failure=(error:string,code:string,status:number)=>response({error,code},status);

export async function POST(request:Request){
 try{
  const institutionId=request.headers.get('x-institution-id')?.trim()||'',signature=request.headers.get('x-signature')?.trim()||'',timestamp=request.headers.get('x-timestamp')?.trim()||'',nonce=request.headers.get('x-nonce')?.trim()||'',idempotency=request.headers.get('x-idempotency-key')?.trim()||'';
  if(!institutionId||!signature||!timestamp||!nonce||!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,80}$/.test(institutionId))return failure('回调身份头不完整','CALLBACK_HEADERS_INVALID',400);
  if(!/^[A-Za-z0-9._:-]{8,120}$/.test(idempotency))return failure('幂等键无效','IDEMPOTENCY_KEY_INVALID',400);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return failure('回调必须使用 JSON','INVALID_REQUEST',415);
  const raw=await request.text();if(raw.length>65536)return failure('回调内容过大','PAYLOAD_TOO_LARGE',413);
  let payload:Record<string,unknown>;try{payload=JSON.parse(raw);if(!payload||Array.isArray(payload))throw Error()}catch{return failure('回调 JSON 无效','INVALID_REQUEST',400)}
  let eventEnvelope:ReturnType<typeof normalizeInstitutionEvent>;try{eventEnvelope=normalizeInstitutionEvent(payload,institutionId)}catch(error){return failure(error instanceof Error?error.message:'事件信封无效','EVENT_ENVELOPE_INVALID',400)}
  const secret=(env as unknown as Record<string,string>).INSTITUTION_CALLBACK_SECRET?.trim();
  if(!secret)return failure('持牌机构回调尚未配置','CALLBACK_NOT_CONFIGURED',503);
  if(!await verifyInstitutionCallback(secret,{institutionId,timestamp,nonce,body:raw,signature}))return failure('回调签名或时间窗口无效','CALLBACK_SIGNATURE_INVALID',401);
  const db=env.DB;if(!db)return failure('回调数据库暂不可用','SERVICE_UNAVAILABLE',503);
  const now=Math.floor(Date.now()/1000),nowIso=new Date().toISOString();
  await db.prepare('DELETE FROM institution_callback_nonces WHERE expires_at<?').bind(now).run();
  const existing=await db.prepare('SELECT id,event_type,status FROM institution_callback_events WHERE institution_id=? AND idempotency_key=?').bind(institutionId,idempotency).first<any>();
  if(existing)return response({ok:true,duplicate:true,eventId:existing.id,eventType:existing.event_type,status:existing.status});
  const nonceResult=await db.prepare('INSERT OR IGNORE INTO institution_callback_nonces (institution_id,nonce,expires_at,created_at) VALUES (?,?,?,?)').bind(institutionId,nonce,now+600,nowIso).run();
  if(!nonceResult.meta?.changes)return failure('回调 nonce 已使用','CALLBACK_REPLAYED',409);
  const eventId=crypto.randomUUID(),eventType=eventEnvelope.eventType;
  await db.prepare('INSERT INTO institution_callback_events (id,institution_id,idempotency_key,event_type,payload,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(eventId,institutionId,idempotency,eventType,raw,'received',nowIso,nowIso).run();
  const retry=nextCallbackRetry(0,now);
  await db.prepare('INSERT INTO institution_callback_attempts (id,event_id,attempt,status,next_at,last_error,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),eventId,0,retry.status,retry.nextAt,null,nowIso,nowIso).run();
  return response({ok:true,duplicate:false,eventId,eventType,status:'received'},202);
 }catch{return failure('持牌机构回调暂不可用','SERVICE_UNAVAILABLE',503)}
}
