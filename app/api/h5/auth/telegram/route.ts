import {BROWSER_COOKIE,SESSION_COOKIE,cookie,cookieValue,owner,runtime,browser,json,failure} from '@/lib/h5-auth';
import {loginTelegram,SESSION_TTL,AuthError} from '@/lib/h5-auth-core';
import {registrationPolicy} from '@/lib/registration-policy';
import {channelToken,telegramCredentialOwners} from '@/lib/bot-credentials';
import {customerCompany} from '@/lib/team/server';

export const dynamic='force-dynamic';

export async function POST(request:Request){
 try{
  const initData=request.headers.get('x-telegram-init-data')||'';
  if(!initData||initData.length>10000)throw new AuthError('请从 Telegram Mini App 打开后再登录',401);
  const r=runtime(),b=await browser(request);
  const requestedChannel=new URL(request.url).searchParams.get('channel')||'bot-1';
  if(!/^bot-[1-9]\d*$/.test(requestedChannel))throw new AuthError('Telegram 渠道无效',400);
  // A direct Telegram Mini App launch has no payease_company cookie. Resolve
  // the tenant by verifying initData against each active company's configured
  // bot credential; never silently pick the first company.
  const selected=await customerCompany();
  let candidates=selected?[selected.id]:await telegramCredentialOwners(requestedChannel);
  if(!candidates.length)candidates=[await owner()];
  let result:any, id=''; let last:unknown;
  for(const candidate of candidates){
   try{
    const token=await channelToken(candidate,requestedChannel);
    result=await loginTelegram(r,candidate,b,initData,token,requestedChannel);
    id=candidate;break;
   }catch(error){last=error}
  }
  if(!result)throw last instanceof Error?last:new AuthError('Telegram 登录凭证无效，请重新打开 Mini App',401,undefined,'TELEGRAM_INITDATA_INVALID');
  await registrationPolicy(r,id,result.session.customerId);
  const sessionCookie=cookie(request,SESSION_COOKIE,result.token,SESSION_TTL);
  const companyCookie=cookie(request,'payease_company',id,86400);
  return json({authenticated:true,session:result.session,mode:'telegram',policy:await registrationPolicy(r,id,result.session.customerId)},200,{'Set-Cookie':[sessionCookie,companyCookie]})
 }catch(e){return failure(e)}
}
