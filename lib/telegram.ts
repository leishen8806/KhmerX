// Telegram official validation: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
const enc=new TextEncoder();
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
 const p=new URLSearchParams(initData);if([...p.keys()].length!==new Set(p.keys()).size)throw Error('重复认证字段');
 const hash=p.get('hash');if(!hash||! /^[a-f0-9]{64}$/i.test(hash))throw Error('无效签名');
 const at=Number(p.get('auth_date'));if(!Number.isSafeInteger(at)||at>nowSeconds+30||nowSeconds-at>300)throw Error('认证已过期，请重新打开 Mini App');
 p.delete('hash');const data=[...p.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
 const key=await hmac(enc.encode('WebAppData'),token);const bytes=await hmac(key,data);const expected=bytes.reduce((s,b)=>s+b.toString(16).padStart(2,'0'),'');
 let diff=0;for(let i=0;i<64;i++)diff|=expected.charCodeAt(i)^hash.toLowerCase().charCodeAt(i);if(diff)throw Error('签名验证失败');
 const user=JSON.parse(p.get('user')||'{}');if(!Number.isSafeInteger(user.id)||user.id<=0)throw Error('用户信息无效');return {id:user.id,firstName:String(user.first_name||'')};
}
