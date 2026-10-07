import {BROWSER_COOKIE,SESSION_COOKIE,cookie,cookieValue,owner,runtime,browser,json,failure} from '@/lib/h5-auth';
import {loginTelegram,SESSION_TTL,AuthError} from '@/lib/h5-auth-core';
import {registrationPolicy} from '@/lib/registration-policy';
import {channelToken} from '@/lib/bot-credentials';

export const dynamic='force-dynamic';

export async function POST(request:Request){
 try{
  const initData=request.headers.get('x-telegram-init-data')||'';
  if(!initData||initData.length>10000)throw new AuthError('请从 Telegram Mini App 打开后再登录',401);
  const id=await owner(),r=runtime(),b=await browser(request);
  const requestedChannel=new URL(request.url).searchParams.get('channel')||'bot-1';
  if(!/^bot-[1-9]\d*$/.test(requestedChannel))throw new AuthError('Telegram 渠道无效',400);
  // Bot credentials configured by the company Admin are encrypted in D1;
  // environment variables are only the legacy fallback for bot-1.
  const result=await loginTelegram(r,id,b,initData,await channelToken(id,requestedChannel),requestedChannel);
  await registrationPolicy(r,id,result.session.customerId);
  return json({authenticated:true,session:result.session,mode:'telegram',policy:await registrationPolicy(r,id,result.session.customerId)},200,{'Set-Cookie':cookie(request,SESSION_COOKIE,result.token,SESSION_TTL)})
 }catch(e){return failure(e)}
}
