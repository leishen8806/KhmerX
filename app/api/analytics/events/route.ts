import {customer,input,json,failure} from '@/lib/h5-auth';
import {AuthError} from '@/lib/h5-auth-core';

const allowed=new Set(['page_view','mini_nav_home','mini_nav_records','mini_nav_profile','kyc_step_view','kyc_step_complete','kyc_file_select','kyc_file_upload_success','kyc_file_upload_failed','kyc_submit','loan_apply_start','loan_bill_confirm','loan_signature_saved','loan_submitted','telegram_notification_sent','telegram_notification_failed']);
const text=(value:unknown,max:number)=>typeof value==='string'?value.trim().slice(0,max):'';

export async function POST(request:Request){
 try{
  const {ownerId,r,session}=await customer(request),body=await input(request);
  const eventName=text(body.eventName,64),route=text(body.route,160)||'/h5',locale=['en','km','zh'].includes(body.locale)?body.locale:'en';
  if(!allowed.has(eventName))throw new AuthError('埋点事件无效');
  const source=['mini_app','h5'].includes(body.source)?body.source:'mini_app';
  const metadata=body.metadata&&typeof body.metadata==='object'&&!Array.isArray(body.metadata)?JSON.stringify(body.metadata).slice(0,2000):'{}';
  const recent=await r.db.prepare("SELECT COUNT(*) AS count FROM analytics_events WHERE tenant_id=? AND customer_id=? AND created_at>datetime('now','-1 minute')").bind(ownerId,session.customerId).first<{count:number}>();
  if(Number(recent?.count||0)>=120)return json({ok:false},202);
  await r.db.prepare('INSERT INTO analytics_events (id,tenant_id,customer_id,event_name,locale,screen,properties,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),ownerId,session.customerId,eventName,locale,route,JSON.stringify({version:1,source,sessionIdHash:text(body.sessionIdHash,128)||undefined,...JSON.parse(metadata)}),new Date().toISOString()).run();
  return json({ok:true});
 }catch(e){return failure(e)}
}
