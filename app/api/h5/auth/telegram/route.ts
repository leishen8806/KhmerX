import {requireOrigin} from '@/lib/http/route';
import {BROWSER_COOKIE,SESSION_COOKIE,cookie,cookieValue,owner,runtime,browser,json,failure} from '@/lib/h5-auth';
import {loginTelegram,SESSION_TTL,AuthError} from '@/lib/h5-auth-core';
import {registrationPolicy} from '@/lib/registration-policy';
import {channelToken,telegramCredentialOwners,telegramCredentialChannels} from '@/lib/bot-credentials';
import {customerCompany} from '@/lib/team/server';

export const dynamic='force-dynamic';

export async function POST(request:Request){
 try{requireOrigin(request);
  const initData=request.headers.get('x-telegram-init-data')||'';
  if(!initData||initData.length>10000)throw new AuthError('请从 Telegram Mini App 打开后再登录',401);
  const r=runtime('telegram'),b=await browser(request);
  const requestedChannel=new URL(request.url).searchParams.get('channel')?.trim()||'';
  if(requestedChannel&&!/^bot-[1-9]\d*$/.test(requestedChannel))throw new AuthError('Telegram 渠道无效',400);
  // A direct Telegram Mini App launch has no payease_company cookie. Resolve
  // the tenant by verifying initData against each active company's configured
  // bot credential; never silently pick the first company.
  const selected=await customerCompany();
  const channels=requestedChannel?[requestedChannel]:await telegramCredentialChannels();
  let candidates:{owner:string;channel:string}[]=[];
  for(const channel of channels){
   const owners=selected?[selected.id]:await telegramCredentialOwners(channel);
   candidates.push(...owners.map(owner=>({owner,channel})));
  }
  if(!candidates.length)candidates=[{owner:await owner(),channel:requestedChannel||'bot-1'}];
  let result:any, id=''; let last:unknown;
  for(const candidate of candidates){
   try{
    const token=await channelToken(candidate.owner,candidate.channel);
    result=await loginTelegram(r,candidate.owner,b,initData,token,candidate.channel);
    id=candidate.owner;break;
   }catch(error){last=error}
  }
  if(!result)throw last instanceof Error?last:new AuthError('Telegram 登录凭证无效，请重新打开 Mini App',401,undefined,'TELEGRAM_INITDATA_INVALID');
  await registrationPolicy(r,id,result.session.customerId);
  const sessionCookie=cookie(request,SESSION_COOKIE,result.token,SESSION_TTL);
  const companyCookie=cookie(request,'payease_company',id,86400);
  return json({authenticated:true,session:result.session,mode:'telegram',policy:await registrationPolicy(r,id,result.session.customerId)},200,{'Set-Cookie':[sessionCookie,companyCookie]})
 }catch(e){return failure(e,request)}
}
