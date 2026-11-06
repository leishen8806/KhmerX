import {env} from 'cloudflare:workers';
import {addErrorCode} from '@/lib/error-codes';
import {verifyInstitutionCallback} from '@/lib/institution-callback';
import {nextCallbackRetry} from '@/lib/institution-callback-queue';
import {normalizeInstitutionEvent} from '@/lib/institution-events';
import {consumeInstitutionCallbackEvent} from '@/lib/institution-callback-consumer';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200,requestId='')=>{
 const body=data&&typeof data==='object'&&!Array.isArray(data)?{...(data as Record<string,unknown>),requestId}:{data,requestId};
 return Response.json(addErrorCode(body,status),{status,headers:{'Cache-Control':'no-store','X-Request-Id':requestId}});
};
const failure=(error:string,code:string,status:number,requestId='')=>response({error,code},status,requestId);
type ExistingCallback={id:string;event_type:string;status:string};
async function sha256(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('')}
function callbackSecret(institutionId:string){
 const values=env as unknown as Record<string,string>,raw=values.INSTITUTION_CALLBACK_SECRETS_JSON?.trim();
 if(!raw)return values.INSTITUTION_CALLBACK_SECRET?.trim()||'';
 try{const map=JSON.parse(raw) as Record<string,unknown>,secret=map[institutionId];return typeof secret==='string'?secret.trim():''}catch{return ''}
}

export async function POST(request:Request){
 const requestId=crypto.randomUUID();
 try{
  const institutionId=request.headers.get('x-institution-id')?.trim()||'',signature=request.headers.get('x-signature')?.trim()||'',timestamp=request.headers.get('x-timestamp')?.trim()||'',nonce=request.headers.get('x-nonce')?.trim()||'',idempotency=request.headers.get('x-idempotency-key')?.trim()||'';
  if(!institutionId||!signature||!timestamp||!nonce||!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,80}$/.test(institutionId))return failure('回调身份头不完整','CALLBACK_HEADERS_INVALID',400,requestId);
  if(!/^[A-Za-z0-9._:-]{8,120}$/.test(idempotency))return failure('幂等键无效','IDEMPOTENCY_KEY_INVALID',400,requestId);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return failure('回调必须使用 JSON','INVALID_REQUEST',415,requestId);
  const raw=await request.text();if(raw.length>65536)return failure('回调内容过大','PAYLOAD_TOO_LARGE',413,requestId);
  let payload:Record<string,unknown>;try{payload=JSON.parse(raw);if(!payload||Array.isArray(payload))throw Error()}catch{return failure('回调 JSON 无效','INVALID_REQUEST',400,requestId)}
  let eventEnvelope:ReturnType<typeof normalizeInstitutionEvent>;try{eventEnvelope=normalizeInstitutionEvent(payload,institutionId)}catch(error){return failure(error instanceof Error?error.message:'事件信封无效','EVENT_ENVELOPE_INVALID',400,requestId)}
  const db=env.DB;if(!db)return failure('回调数据库暂不可用','SERVICE_UNAVAILABLE',503,requestId);
  const institution=await db.prepare("SELECT u.id,u.tenant_id FROM team_units u JOIN team_companies c ON c.id=u.tenant_id WHERE u.id=? AND u.kind='institution' AND c.active=1").bind(institutionId).first<{id:string;tenant_id:string}>();
  if(!institution)return failure('持牌机构不存在或已停用','INSTITUTION_NOT_FOUND',404,requestId);
  const secret=callbackSecret(institutionId);
  if(!secret)return failure('持牌机构回调尚未配置','CALLBACK_NOT_CONFIGURED',503,requestId);
  if(!await verifyInstitutionCallback(secret,{institutionId,timestamp,nonce,body:raw,signature,idempotencyKey:idempotency}))return failure('回调签名或时间窗口无效','CALLBACK_SIGNATURE_INVALID',401,requestId);
  const payloadHash=await sha256(raw),eventId=eventEnvelope.eventId||null;
  const now=Math.floor(Date.now()/1000),nowIso=new Date().toISOString();
  await db.prepare('DELETE FROM institution_callback_nonces WHERE expires_at<?').bind(now).run();
  const existing=await db.prepare('SELECT id,event_type,status FROM institution_callback_events WHERE institution_id=? AND idempotency_key=?').bind(institutionId,idempotency).first<ExistingCallback>();
  if(existing){const prior=await db.prepare('SELECT payload_hash,event_id FROM institution_callback_events WHERE id=?').bind(existing.id).first<{payload_hash:string|null;event_id:string|null}>();if(prior?.payload_hash&&prior.payload_hash!==payloadHash)return failure('幂等键已绑定其他载荷','IDEMPOTENCY_PAYLOAD_MISMATCH',409,requestId);return response({ok:true,duplicate:true,eventId:existing.id,eventType:existing.event_type,status:existing.status},200,requestId)}
  if(eventId){const sameEvent=await db.prepare('SELECT id,payload_hash FROM institution_callback_events WHERE institution_id=? AND event_id=?').bind(institutionId,eventId).first<{id:string;payload_hash:string|null}>();if(sameEvent){if(sameEvent.payload_hash!==payloadHash)return failure('事件编号已绑定其他载荷','EVENT_PAYLOAD_MISMATCH',409,requestId);return response({ok:true,duplicate:true,eventId:sameEvent.id,eventType:eventEnvelope.eventType,status:'received'},200,requestId)}}
  const storedEventId=crypto.randomUUID(),eventType=eventEnvelope.eventType;
  const retry=nextCallbackRetry(0,now);
  const results=await db.batch([
   db.prepare('INSERT OR IGNORE INTO institution_callback_nonces (institution_id,nonce,expires_at,created_at) VALUES (?,?,?,?)').bind(institutionId,nonce,now+600,nowIso),
   // Gate both writes on the nonce insert. A replay must not leave an event
   // or retry row behind before the 409 response is returned.
   db.prepare('INSERT INTO institution_callback_events (id,institution_id,idempotency_key,event_type,event_id,payload_hash,payload,status,request_id,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE changes()=1').bind(storedEventId,institutionId,idempotency,eventType,eventId,payloadHash,raw,'received',requestId,nowIso,nowIso),
   db.prepare('INSERT INTO institution_callback_attempts (id,event_id,attempt,status,next_at,last_error,created_at,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),storedEventId,0,retry.status,retry.nextAt,null,nowIso,nowIso)
  ]);
  if(!results[0].meta?.changes) return failure('回调 nonce 已使用','CALLBACK_REPLAYED',409,requestId);
  const consumed=await consumeInstitutionCallbackEvent({database:db,tenantId:institution.tenant_id,institutionId,eventId:storedEventId,eventType,payload:raw});
  if(consumed.status!=='received'){
   const error=consumed.reason||null,attemptStatus=consumed.status==='dead_letter'?'dead_letter':'completed';
   await db.batch([
    db.prepare('UPDATE institution_callback_events SET status=?,updated_at=? WHERE id=? AND status=\'received\'').bind(consumed.status,nowIso,storedEventId),
    db.prepare('UPDATE institution_callback_attempts SET status=?,last_error=?,updated_at=?,next_at=NULL WHERE event_id=? AND attempt=0').bind(attemptStatus,error,nowIso,storedEventId),
   ]);
  }
  const httpStatus=consumed.status==='received'?202:200;
  return response({ok:true,duplicate:false,eventId:storedEventId,eventType,status:consumed.status,consumerReason:consumed.reason||null},httpStatus,requestId);
 }catch{return failure('持牌机构回调暂不可用','SERVICE_UNAVAILABLE',503,requestId)}
}
