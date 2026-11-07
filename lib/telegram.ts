// Telegram official validation: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
const enc=new TextEncoder();
export class TelegramInitDataError extends Error {
 readonly code:'TELEGRAM_INITDATA_EXPIRED'|'TELEGRAM_INITDATA_INVALID';
 constructor(code:'TELEGRAM_INITDATA_EXPIRED'|'TELEGRAM_INITDATA_INVALID',message:string){super(message);this.name='TelegramInitDataError';this.code=code}
}
async function hmac(key:Uint8Array,data:string){const k=await crypto.subtle.importKey('raw',key as BufferSource,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(data)))}
export function canonicalInitData(initData:string){
 const p=new URLSearchParams(initData);if([...p.keys()].length!==new Set(p.keys()).size)throw Error('重复认证字段');
 const hash=p.get('hash');if(!hash||! /^[a-f0-9]{64}$/i.test(hash))throw Error('无效签名');
 p.delete('hash');
 const data=[...p.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
 // Include the normalized signature so parameter ordering, percent encoding,
 // and hash casing cannot produce a second replay key.
 return data+'\nhash='+hash.toLowerCase();
}
export async function validateInitData(initData:string,token:string,nowSeconds=Math.floor(Date.now()/1000)){
 const p=new URLSearchParams(initData);if([...p.keys()].length!==new Set(p.keys()).size)throw new TelegramInitDataError('TELEGRAM_INITDATA_INVALID','无效认证数据');
 const hash=p.get('hash');if(!hash||! /^[a-f0-9]{64}$/i.test(hash))throw new TelegramInitDataError('TELEGRAM_INITDATA_INVALID','无效签名');
 const at=Number(p.get('auth_date'));if(!Number.isSafeInteger(at)||at>nowSeconds+30||nowSeconds-at>300)throw new TelegramInitDataError('TELEGRAM_INITDATA_EXPIRED','认证已过期，请重新打开 Mini App');
 p.delete('hash');const data=[...p.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
 const key=await hmac(enc.encode('WebAppData'),token);const bytes=await hmac(key,data);const expected=bytes.reduce((s,b)=>s+b.toString(16).padStart(2,'0'),'');
 let diff=0;for(let i=0;i<64;i++)diff|=expected.charCodeAt(i)^hash.toLowerCase().charCodeAt(i);if(diff)throw new TelegramInitDataError('TELEGRAM_INITDATA_INVALID','签名验证失败');
 let user:any;try{user=JSON.parse(p.get('user')||'{}')}catch{throw new TelegramInitDataError('TELEGRAM_INITDATA_INVALID','用户信息无效')};if(!Number.isSafeInteger(user.id)||user.id<=0)throw new TelegramInitDataError('TELEGRAM_INITDATA_INVALID','用户信息无效');return {id:user.id,firstName:String(user.first_name||'')};
}
