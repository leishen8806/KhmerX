import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {hasOtherCompanyCredential} from '../lib/telegram-company-match.ts';
import {validateInitData} from '../lib/telegram.ts';

function initData(token,authDate=Math.floor(Date.now()/1000)){
 const params=new URLSearchParams({auth_date:String(authDate),user:JSON.stringify({id:123456,first_name:'Synthetic'})});
 const canonical=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>`${key}=${value}`).join('\n');
 const secret=createHmac('sha256','WebAppData').update(token).digest();
 params.set('hash',createHmac('sha256',secret).update(canonical).digest('hex'));
 return params.toString();
}

test('Telegram initData distinguishes expired, invalid, other-company and valid credentials',async()=>{
 const now=Math.floor(Date.now()/1000),companyToken='111111:company-token-that-is-long-enough',otherToken='222222:other-token-that-is-long-enough';
 await assert.rejects(validateInitData(initData(companyToken,now-301),companyToken,now),error=>error.code==='TELEGRAM_INITDATA_EXPIRED');
 const signed=initData(companyToken,now),tampered=signed.replace(/hash=([0-9a-f])/i,(_,digit)=>`hash=${digit.toLowerCase()==='0'?'1':'0'}`);
 await assert.rejects(validateInitData(tampered,companyToken,now),error=>error.code==='TELEGRAM_INITDATA_INVALID');
 const other=initData(otherToken,now);
 assert.equal(await hasOtherCompanyCredential(other,['company-a'],['bot-1'],{owners:async()=>['company-a','company-b'],token:async(owner)=>owner==='company-b'?otherToken:companyToken}),true);
 const identity=await validateInitData(initData(companyToken,now),companyToken,now);assert.equal(identity.id,123456);
});

test('other-company credential lookup never exposes the matching company',async()=>{
 const other=initData('222222:other-token-that-is-long-enough'),calls=[];
 const matched=await hasOtherCompanyCredential(other,['company-a'],['bot-1'],{owners:async()=>['company-a','company-b'],token:async(owner)=>{calls.push(owner);return owner==='company-b'?'222222:other-token-that-is-long-enough':''}});
 assert.equal(matched,true);assert.deepEqual(calls,['company-b']);
});
