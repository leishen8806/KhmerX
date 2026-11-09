import {requireOrigin} from '@/lib/http/route';
import {SESSION_COOKIE,cookie,owner,runtime,browser,json,failure} from '@/lib/h5-auth';
import {loginTelegram,SESSION_TTL,AuthError} from '@/lib/h5-auth-core';
import {registrationPolicy} from '@/lib/registration-policy';
import {channelToken,telegramCredentialOwners,telegramCredentialChannels} from '@/lib/bot-credentials';
import {hasOtherCompanyCredential} from '@/lib/telegram-company-match';
import {customerCompany} from '@/lib/team/server';
import {requireH5ChannelAvailable} from '@/lib/h5-channel-guard';
import {env} from 'cloudflare:workers';

export const dynamic='force-dynamic';

export async function POST(request:Request){
 try{requireOrigin(request);
  const initData=request.headers.get('x-telegram-init-data')||'';
  if(!initData||initData.length>10000)throw new AuthError('请从 Telegram Mini App 打开后再登录',401);
  const r=runtime('telegram'),b=await browser(request);
  const requestedChannel=new URL(request.url).searchParams.get('channel')?.trim()||'';
  if(requestedChannel&&!/^bot-[1-9]\d*$/.test(requestedChannel))throw new AuthError('Telegram 渠道无效',400);
  const deploymentCompanyId=String((env as unknown as Record<string,string>).PAYEASE_DEPLOYMENT_COMPANY_ID||'').trim();
  const cookieCompany=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('payease_company='))?.slice('payease_company='.length)||'';
  if(deploymentCompanyId&&cookieCompany&&cookieCompany!==deploymentCompanyId)throw new AuthError('Telegram 渠道与部署公司不匹配',403,undefined,'CHANNEL_COMPANY_MISMATCH');
  // A direct Telegram Mini App launch has no payease_company cookie. Resolve
  // the tenant by verifying initData against each active company's configured
  // bot credential; never silently pick the first company.
  const selected=deploymentCompanyId?(cookieCompany?await customerCompany():null):await customerCompany();
  const channels=requestedChannel?[requestedChannel]:await telegramCredentialChannels();
  let candidates:{owner:string;channel:string}[]=[];
  for(const channel of channels){
   const owners=deploymentCompanyId?[deploymentCompanyId]:selected?[selected.id]:await telegramCredentialOwners(channel);
   candidates.push(...owners.map(owner=>({owner,channel})));
  }
  if(!candidates.length)candidates=[{owner:await owner(),channel:requestedChannel||'bot-1'}];
  let result:any, id=''; let last:unknown;
  for(const candidate of candidates){
   try{
    const token=await channelToken(candidate.owner,candidate.channel);
    await requireH5ChannelAvailable(r,candidate.owner,'telegram_miniapp',candidate.channel);
    result=await loginTelegram(r,candidate.owner,b,initData,token,candidate.channel);
    id=candidate.owner;break;
   }catch(error){last=error}
  }
  if(!result){
   if(last instanceof AuthError&&last.code==='TELEGRAM_INITDATA_EXPIRED')throw last;
   if(last instanceof AuthError&&last.code==='TELEGRAM_INITDATA_INVALID'){
    const other=await hasOtherCompanyCredential(initData,candidates.map(candidate=>candidate.owner),channels,{owners:telegramCredentialOwners,token:channelToken});
    if(other)throw new AuthError('Telegram 渠道与部署公司不匹配',403,undefined,'CHANNEL_COMPANY_MISMATCH');
    throw last;
   }
   throw last instanceof Error?last:new AuthError('Telegram 登录凭证无效，请重新打开 Mini App',401,undefined,'TELEGRAM_INITDATA_INVALID');
  }
  await registrationPolicy(r,id,result.session.customerId);
  const sessionCookie=cookie(request,SESSION_COOKIE,result.token,SESSION_TTL);
  const companyCookie=cookie(request,'payease_company',id,86400);
  return json({authenticated:true,session:result.session,mode:'telegram',policy:await registrationPolicy(r,id,result.session.customerId)},200,{'Set-Cookie':[sessionCookie,companyCookie]})
 }catch(e){return failure(e,request)}
}
