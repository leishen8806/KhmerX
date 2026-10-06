export type Delivery={status:'sent'|'retry'|'failed'|'unknown';messageId?:number;retrySeconds?:number;reason:string};
export type NotificationLocale='en'|'km'|'zh';
const reminderText:Record<NotificationLocale,string>={
 zh:'PayEase 提醒：您有一笔即将到期的还款，请打开贷款应用查看最新账单。若已还款，请以应用内状态为准。',
 en:'PayEase reminder: a loan repayment is due soon. Open the loan app to view the latest bill. If you have already paid, use the in-app status as the source of truth.',
 km:'ការរំលឹក PayEase៖ ការសងកម្ចីរបស់អ្នកជិតដល់កាលកំណត់។ សូមបើកកម្មវិធីកម្ចីដើម្បីមើលវិក្កយបត្រថ្មីបំផុត។ ប្រសិនបើបានសងរួច សូមយោងតាមស្ថានភាពក្នុងកម្មវិធី។',
};
// A timeout may occur after Telegram accepted the message: never automatically resend it.
export async function sendTelegram(token:string,chatId:number,transport:typeof fetch=fetch,locale:NotificationLocale='zh'):Promise<Delivery>{
 try{const r=await transport('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text:reminderText[locale]||reminderText.en,protect_content:true}),signal:AbortSignal.timeout(8000)});const d=await r.json() as any;
 if(r.ok&&d.ok===true&&Number.isSafeInteger(d.result?.message_id)&&d.result?.chat?.id===chatId)return {status:'sent',messageId:d.result.message_id,reason:'Telegram 已接受'};
 if(d.ok===false&&d.error_code===429)return {status:'retry',retrySeconds:Math.min(86400,Math.max(1,Number(d.parameters?.retry_after)||60)),reason:'Telegram 限流'};
 if(d.ok===false&&[400,401,403].includes(d.error_code))return {status:'failed',reason:d.error_code===403?'客户未允许消息或已停用机器人':'机器人或收件人配置无效'};
 return {status:'unknown',reason:'发送结果不明确，需人工核对，未自动重发'}
 }catch{return {status:'unknown',reason:'网络中断或超时，需人工核对，未自动重发'}}
}
export function tokenKey(tenant:string,botId:string){if(!/^t_[a-f0-9-]{36}$/.test(tenant)||!/^bot-\d{1,2}$/.test(botId))throw Error('机器人渠道无效');return 'TELEGRAM_'+tenant.slice(2).replaceAll('-','').toUpperCase()+'_'+botId.replace('-','_').toUpperCase()+'_TOKEN'}
