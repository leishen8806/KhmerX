import {channelToken} from '@/lib/bot-credentials';
import {env} from 'cloudflare:workers';
import {runtime} from '@/lib/h5-auth';
import {db,staff} from '@/lib/team/server';
import {readState} from '@/lib/store';
import {AuthError,telegramCustomerKey} from '@/lib/h5-auth-core';
import {validateInitData} from '@/lib/telegram';
import {canonicalInitData} from '@/lib/telegram';
import {digest} from '@/lib/h5-auth-core';
import {encryptBytes,decryptBytes} from '@/lib/kyc/server';
import {localDay} from '@/lib/postloan/core';
import {sendTelegram,tokenKey,type NotificationLocale} from './core';
const config=()=>env as unknown as Record<string,string>;
const bindingId=(owner:string,customerId:string,botId:string)=>owner+':'+customerId+':'+botId;
export async function notificationSettings(owner:string,customerId:string){const {state}=await readState(owner);const rows=(await db().prepare('SELECT bot_id,active FROM telegram_subscriptions WHERE owner=? AND customer_id=?').bind(owner,customerId).all<any>()).results;return {channels:state.bots.filter(b=>b.enabled).map(b=>({id:b.id,label:b.label,username:b.username,configured:!!b.tokenConfigured||!!config()[tokenKey(owner,b.id)],bound:!!rows.find(r=>r.bot_id===b.id&&r.active)}))}}
export async function bindNotifications(owner:string,customerId:string,p:any){const {state}=await readState(owner),bot=state.bots.find(b=>b.id===p.botId&&b.enabled);if(!bot)throw new AuthError('机器人未启用');const id=bindingId(owner,customerId,bot.id);
 if(p.action==='unsubscribe'){await db().batch([db().prepare('UPDATE telegram_subscriptions SET active=0,updated_at=? WHERE id=? AND owner=? AND customer_id=?').bind(new Date().toISOString(),id,owner,customerId),db().prepare("UPDATE telegram_outbox SET status='cancelled',reason='客户关闭提醒' WHERE subscription_id=? AND owner=? AND status IN ('pending','retry')").bind(id,owner)]);return {ok:true}}
 if(p.action!=='subscribe'||p.consent!==true)throw new AuthError('请确认启用 Telegram 还款提醒');const token=await channelToken(owner,bot.id);if(!token)throw new AuthError('公司机器人尚未配置，当前保留站内提醒',503);
 if(typeof p.initData!=='string'||p.initData.length>3500)throw new AuthError('请从 Telegram 机器人内打开贷款应用');let user;try{user=await validateInitData(p.initData,token)}catch{throw new AuthError('Telegram 身份校验失败，请重新打开应用',401)}
 // The authenticated customer session is the authority for the subscription.
 // Legacy service callers without an h5 account remain supported, while real
 // customer sessions must match the Telegram-derived identity exactly.
 const account=await db().prepare('SELECT customer_id,telegram_user_hash,telegram_verified FROM h5_accounts WHERE owner=? AND customer_id=?').bind(owner,customerId).first<{customer_id:string;telegram_user_hash?:string|null;telegram_verified?:number}>();
 const expectedCustomerId=await telegramCustomerKey(runtime(),owner,user.id);
 // Legacy synthetic workspaces may not have an h5 account row yet. Once an
 // account exists, however, the signed Telegram user must map to that exact
 // keyed customer identity; never accept a merely present/verified flag.
 if(account&&(account.customer_id!==expectedCustomerId||account.telegram_user_hash!==expectedCustomerId||account.telegram_verified!==1))throw new AuthError('Telegram 账号与当前客户不一致，请重新打开应用',409);
 const canonical=canonicalInitData(p.initData),replayKey=await digest(owner+':'+bot.id+':'+customerId+':'+canonical);
 await db().prepare('DELETE FROM telegram_subscription_nonces WHERE consumed_at<?').bind(Date.now()-10*60*1000).run();
 const claimed=await db().prepare('INSERT OR IGNORE INTO telegram_subscription_nonces (initdata_hash,owner,customer_id,bot_id,consumed_at) VALUES (?,?,?,?,?)').bind(replayKey,owner,customerId,bot.id,Date.now()).run();
 if(!claimed.meta.changes)throw new AuthError('Telegram 授权已使用，请重新打开应用',409,undefined,'TELEGRAM_SUBSCRIPTION_REPLAY');
 const chat=String(user.id),bytes=await encryptBytes(new TextEncoder().encode(chat),'telegram:'+id),chatEncrypted=btoa(String.fromCharCode(...bytes)),hashBytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(owner+':'+bot.id+':'+chat)),hash=Array.from(new Uint8Array(hashBytes),b=>b.toString(16).padStart(2,'0')).join('');
 const existing=await db().prepare('SELECT id FROM telegram_subscriptions WHERE owner=? AND bot_id=? AND chat_hash=?').bind(owner,bot.id,hash).first<any>();if(existing&&existing.id!==id)throw new AuthError('此 Telegram 账号已绑定另一客户，请联系管理员',409);
 await db().prepare('INSERT INTO telegram_subscriptions (id,owner,customer_id,bot_id,chat_hash,chat_encrypted,active,updated_at) VALUES (?,?,?,?,?,?,1,?) ON CONFLICT(id) DO UPDATE SET chat_hash=excluded.chat_hash,chat_encrypted=excluded.chat_encrypted,active=1,updated_at=excluded.updated_at').bind(id,owner,customerId,bot.id,hash,chatEncrypted,new Date().toISOString()).run();return {ok:true}
}
export async function dispatchCompany(owner:string,now=new Date().toISOString()){
 const {state}=await readState(owner),today=localDay(now);let sent=0;
 // A crashed sender is ambiguous. Preserve the attempt, do not silently duplicate it.
 await db().prepare("UPDATE telegram_outbox SET status='unknown',reason='上次发送中断，需人工核对' WHERE owner=? AND status='sending' AND updated_at<?").bind(owner,new Date(Date.parse(now)-120000).toISOString()).run();
 for(const n of state.notifications.filter(n=>n.id.startsWith('postloan-reminder:'))){const l=state.loans.find(l=>l.id===n.loanId);if(!l?.customerId||l.status!=='active'||!l.dueAt||localDay(l.dueAt)<today)continue;const sub=await db().prepare('SELECT id FROM telegram_subscriptions WHERE owner=? AND customer_id=? AND bot_id=? AND active=1').bind(owner,l.customerId,l.botId).first<any>();if(!sub)continue;
  // A cancelled delivery may belong to a subscription that was disabled and
  // enabled again.  The unique (owner, notification_id) index must not make
  // the old cancelled row block the new subscription from being queued.
  const revived=await db().prepare("UPDATE telegram_outbox SET status='pending',attempts=0,next_at=0,updated_at=?,reason='重新订阅后重新入队',subscription_id=? WHERE owner=? AND notification_id=? AND subscription_id=? AND status IN ('cancelled','failed')").bind(now,sub.id,owner,n.id,sub.id).run();
  if(!revived.meta.changes)await db().prepare("INSERT OR IGNORE INTO telegram_outbox (id,owner,notification_id,loan_id,subscription_id,status,attempts,next_at,updated_at,reason) VALUES (?,?,?,?,?,'pending',0,0,?,'等待发送')").bind(crypto.randomUUID(),owner,n.id,l.id,sub.id,now).run();
 }
 const jobs=(await db().prepare("SELECT * FROM telegram_outbox WHERE owner=? AND status IN ('pending','retry') AND next_at<=? AND attempts<5 ORDER BY next_at,id LIMIT 20").bind(owner,Date.parse(now)).all<any>()).results;
 for(const job of jobs){const latest=await readState(owner),l=latest.state.loans.find(l=>l.id===job.loan_id),sub=await db().prepare('SELECT * FROM telegram_subscriptions WHERE id=? AND owner=? AND active=1').bind(job.subscription_id,owner).first<any>();const bot=latest.state.bots.find(b=>b.id===l?.botId&&b.enabled);
 if(!l||l.status!=='active'||!l.dueAt||localDay(l.dueAt)<today||!sub||!bot){await db().prepare("UPDATE telegram_outbox SET status='cancelled',reason='已结清、提醒过期或已停用' WHERE id=? AND status IN ('pending','retry')").bind(job.id).run();continue}
 const token=await channelToken(owner,bot.id);
 if(!token){
  // A broken channel must not leave the outbox pending forever or obscure
  // other channels. Mark only this delivery as failed and expose the reason
  // in the audit/notification panel for remediation.
  await db().prepare("UPDATE telegram_outbox SET status='failed',reason='该 Telegram 渠道未配置或凭据无效',updated_at=? WHERE id=? AND owner=? AND status IN ('pending','retry')").bind(now,job.id,owner).run();
  continue;
 }
 const claim=await db().prepare("UPDATE telegram_outbox SET status='sending',attempts=attempts+1,updated_at=? WHERE id=? AND owner=? AND status IN ('pending','retry') AND attempts=? AND EXISTS (SELECT 1 FROM telegram_subscriptions WHERE id=? AND active=1)").bind(now,job.id,owner,job.attempts,sub.id).run();if(!claim.meta.changes)continue;
 let result;try{const chat=Number(new TextDecoder().decode(await decryptBytes(Uint8Array.from(atob(sub.chat_encrypted),c=>c.charCodeAt(0)),'telegram:'+sub.id)));const account=await db().prepare('SELECT locale FROM h5_accounts WHERE owner=? AND customer_id=?').bind(owner,l.customerId).first<{locale?:string}>();const locale:NotificationLocale=account?.locale==='km'?'km':account?.locale==='zh'?'zh':'en';const template=await db().prepare('SELECT title,body FROM team_notification_templates WHERE tenant_id=? AND event_key=? AND locale=? AND active=1').bind(owner,'repayment_reminder',locale).first<{title:string;body:string}>();const safeTemplate=template&&!/\{\{\s*(?:outstanding_usd|amount|principal|fee|total)\s*\}\}/i.test(`${template.title}\n${template.body}`)?template:null;const text=safeTemplate?`${safeTemplate.title}\n${safeTemplate.body}`.replaceAll('{{due_date}}',localDay(l.dueAt)).slice(0,4000):undefined;result=await sendTelegram(token,chat,fetch,locale,text)}catch{result={status:'failed',reason:'收件人资料无法读取'}}
 const status=result.status==='retry'&&job.attempts>=4?'failed':result.status;await db().prepare("UPDATE telegram_outbox SET status=?,reason=?,message_id=?,next_at=?,updated_at=? WHERE id=? AND owner=? AND status='sending'").bind(status,result.reason,'messageId' in result?result.messageId:null,Date.parse(now)+('retrySeconds' in result?(result.retrySeconds||60)*1000:0),new Date().toISOString(),job.id,owner).run();if(status==='sent')sent++;
 }
 return {sent}
}
export async function notificationAdmin(){const s=await staff();if(!s||!['admin','audit'].includes(s.member.role))throw new AuthError('无通知管理权限',403);const {state}=await readState(s.tenant.id);return {channels:state.bots.map(b=>({id:b.id,label:b.label,username:b.username,enabled:b.enabled,configured:!!b.tokenConfigured||!!config()[tokenKey(s.tenant.id,b.id)]})),deliveries:(await db().prepare('SELECT id,loan_id,status,reason,attempts,updated_at FROM telegram_outbox WHERE owner=? ORDER BY updated_at DESC LIMIT 50').bind(s.tenant.id).all()).results}}

/** Reset only an explicitly failed/unknown delivery for an audited manual retry.
 * Unknown results are never retried automatically because Telegram may already
 * have accepted the message; the operator must make that decision explicitly.
 */
export async function retryNotificationDelivery(id:string){
 const s=await staff();
 if(!s||s.member.role!=='admin')throw new AuthError('仅公司 Admin 可人工重试通知',403);
 const delivery=await db().prepare('SELECT id,status,loan_id,attempts FROM telegram_outbox WHERE id=? AND owner=?').bind(id,s.tenant.id).first<any>();
 if(!delivery)throw new AuthError('通知记录不存在',404);
 if(!['failed','unknown'].includes(String(delivery.status)))throw new AuthError('仅失败或结果待核对的通知可人工重试',409);
 const now=new Date().toISOString();
 const changed=await db().prepare("UPDATE telegram_outbox SET status='retry',attempts=0,next_at=0,reason='管理员确认人工重试',updated_at=? WHERE id=? AND owner=? AND status IN ('failed','unknown')").bind(now,id,s.tenant.id).run();
 if(changed.meta.changes!==1)throw new AuthError('通知状态已变化，请刷新后重试',409);
 await audit(s.tenant.id,s.user.userId,'notification_delivery_manual_retry',{outboxId:id,loanId:delivery.loan_id,previousStatus:delivery.status,previousAttempts:delivery.attempts,at:now}).run();
 return {ok:true,id,status:'retry'};
}
