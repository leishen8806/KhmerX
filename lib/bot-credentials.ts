import {env} from 'cloudflare:workers';
import {db,staff,requireMfaStepUp} from '@/lib/team/server';
import {readState} from '@/lib/store';
import {encryptBytes,decryptBytes} from '@/lib/kyc/server';
import {AuthError} from '@/lib/h5-auth-core';
import {tokenKey} from '@/lib/notifications/core';
const context=(owner:string,botId:string)=>'bot-token:'+owner+':'+botId;
export async function channelToken(owner:string,botId:string){
 const key=tokenKey(owner,botId),row=await db().prepare('SELECT token_encrypted FROM telegram_bot_credentials WHERE owner=? AND bot_id=?').bind(owner,botId).first<{token_encrypted:string}>();
 if(!row)return (env as unknown as Record<string,string>)[key]||'';
 return new TextDecoder().decode(await decryptBytes(Uint8Array.from(atob(row.token_encrypted),c=>c.charCodeAt(0)),context(owner,botId)));
}
export async function configureBot(p:any){
 const s=await staff();if(!s||s.member.role!=='admin')throw new AuthError('仅公司管理员可配置机器人',403);
 await requireMfaStepUp(s,p.code);
 const owner=s.tenant.id,botId=p.botId;tokenKey(owner,botId);
 const {state}=await readState(owner);if(!state.bots.some(b=>b.id===botId))throw new AuthError('业务渠道不存在',404);
 const old=await db().prepare('SELECT telegram_id,version FROM telegram_bot_credentials WHERE owner=? AND bot_id=?').bind(owner,botId).first<{telegram_id:string;version:number}>();
 const token=typeof p.token==='string'?p.token.trim():'';
 if(!/^[0-9]{5,20}:[A-Za-z0-9_-]{20,100}$/.test(token))throw new AuthError('请填写有效的 BotFather Bot Token');
 let me:any;
 // getMe takes no parameters. GET avoids empty-POST framing differences on Workers.
 let response:Response;try{response=await fetch('https://api.telegram.org/bot'+token+'/getMe',{method:'GET',redirect:'manual',signal:AbortSignal.timeout(15000)})}catch(error){const message=String(error instanceof Error?error.message:'unknown').replaceAll(token,'[redacted]').replace(/https?:\/\/[^\s]+/g,'[url]').slice(0,240);console.error('telegram_getme_connection',message);throw new AuthError('Telegram 校验失败：服务连接失败，请稍后重试',502)}
 if(!response.ok){const status=response.status;if(status===401||status===404)throw new AuthError('Telegram 拒绝此 Token，请确认是否已撤销或输入有误',400);throw new AuthError('Telegram 校验服务返回 HTTP '+status+'，请稍后重试',502)}
 let body:any;try{body=await response.json()}catch{throw new AuthError('Telegram 校验服务返回异常格式，请稍后重试',502)}
 if(body?.ok!==true)throw new AuthError('Telegram 校验未通过，请检查机器人配置',400);me=body.result;
 if(me?.is_bot!==true||!Number.isSafeInteger(me.id)||me.id<=0||!me.first_name||typeof me.first_name!=='string'||typeof me.username!=='string'||!/^[a-zA-Z0-9_]{5,32}$/.test(me.username))throw new AuthError('Telegram 返回的机器人资料无效');
 const telegramId=String(me.id),legacy=(env as unknown as Record<string,string>)[tokenKey(owner,botId)];if(!old&&legacy&&legacy.split(':')[0]!==telegramId)throw new AuthError('此渠道已有机器人凭据，请为不同机器人新增渠道',409);if(token.split(':')[0]!==telegramId)throw new AuthError('机器人身份校验失败');
 if(old&&old.telegram_id!==telegramId)throw new AuthError('此渠道已绑定其他机器人，请新增渠道；原客户订阅和贷款渠道保持不变',409);
 const duplicate=await db().prepare('SELECT id FROM telegram_bot_credentials WHERE telegram_id=? AND id<>?').bind(telegramId,context(owner,botId)).first();if(duplicate)throw new AuthError('该机器人已绑定其他业务渠道',409);
 const encrypted=btoa(String.fromCharCode(...await encryptBytes(new TextEncoder().encode(token),context(owner,botId)))),at=new Date().toISOString(),label=me.first_name.slice(0,64),username=me.username;
 const results=await db().batch([
 db().prepare(`INSERT INTO telegram_bot_credentials (id,owner,bot_id,telegram_id,label,username,token_encrypted,version,updated_at)
 SELECT ?,?,?,?,?,?,?,1,? WHERE EXISTS (SELECT 1 FROM team_members WHERE id=? AND tenant_id=? AND active=1 AND role='admin' AND version=?)
 AND COALESCE((SELECT version FROM telegram_bot_credentials WHERE owner=? AND bot_id=?),0)=?
 ON CONFLICT(id) DO UPDATE SET label=excluded.label,username=excluded.username,token_encrypted=excluded.token_encrypted,version=telegram_bot_credentials.version+1,updated_at=excluded.updated_at`).bind(context(owner,botId),owner,botId,telegramId,label,username,encrypted,at,s.member.id,owner,s.member.version,owner,botId,old?.version||0),
 db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),owner,s.user.userId,'bot_token_configure',JSON.stringify({botId,telegramId,label,username}),at)
 ]);if(!results[0].meta.changes)throw new AuthError('配置或管理权限已变化，请刷新后重试',409);
 return {ok:true,botId,label,username,configured:true};
}
