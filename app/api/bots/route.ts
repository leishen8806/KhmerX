import {selectedCompany,staff} from '@/lib/team/server';
import {channelToken} from '@/lib/bot-credentials';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {readState} from '@/lib/store';
import {validateInitData} from '@/lib/telegram';
import {input,json} from '@/lib/h5-auth';
import {route} from '@/lib/http/route';
import {ApiError} from '@/lib/http/api-error';
import {isTestMode} from '@/lib/runtime-guards';
export const POST=route({origin:'required',handler:async(request:Request)=>{
 const u=await getChatGPTUser();if(!u)throw new ApiError(401,'AUTH_REQUIRED','请先登录');
 const company=await selectedCompany();
 // Bot credentials and Telegram connectivity are tenant administration data.
 // Only company Admin/Audit staff may probe them; the no-company path is
 // retained exclusively for the explicit local test mode.
 if(!company&&!isTestMode())throw new ApiError(403,'BOT_ACCESS_FORBIDDEN','无权查看机器人状态');
 if(company){let team;try{team=await staff()}catch{throw new ApiError(403,'BOT_ACCESS_FORBIDDEN','无权查看机器人状态')}if(!team||!['admin','audit'].includes(team.member.role))throw new ApiError(403,'BOT_ACCESS_FORBIDDEN','无权查看机器人状态')}
 try{
  const p=await input(request) as {botId?:unknown;initData?:unknown};const botId=typeof p.botId==='string'?p.botId:'';const {state}=await readState(company?.id||u.userId);const bot=state.bots.find(b=>b.id===botId&&b.enabled);
  if(!bot)throw new ApiError(404,'BOT_NOT_CONFIGURED','机器人未启用');const token=company?await channelToken(company.id,bot.id):(env as unknown as Record<string,string>)[bot.envKey];
  if(!token)return json({connected:false,message:company?'请由公司管理员在业务渠道中配置 Token':'请在部署环境中配置机器人 Token',code:'BOT_NOT_CONFIGURED'});
  if(typeof p.initData==='string'&&p.initData){if(p.initData.length>10000)throw new ApiError(400,'BOT_VERIFICATION_FAILED','Telegram 验证数据无效');try{return json({connected:true,user:await validateInitData(p.initData,token)})}catch{throw new ApiError(400,'BOT_VERIFICATION_FAILED','Telegram 身份验证失败')}}
  const r=await fetch('https://api.telegram.org/bot'+token+'/getMe',{method:'GET',redirect:'manual',signal:AbortSignal.timeout(15000)});const v=await r.json() as any;
  if(!v.ok||!v.result?.is_bot)throw new ApiError(400,'BOT_VERIFICATION_FAILED','Telegram 凭据验证失败');
  if(bot.username&&bot.username.toLowerCase()!==v.result.username.toLowerCase())throw new ApiError(400,'BOT_VERIFICATION_FAILED','凭据与配置的机器人用户名不匹配');
  return json({connected:true,username:v.result.username,message:'已验证 @'+v.result.username+'，资金仍为测试模式'});
 }catch(e){
  if(e instanceof ApiError&&e.code==='BOT_VERIFICATION_FAILED')throw e;
  console.error('[bots] unexpected Telegram verification failure',e instanceof Error?e.stack||e:e);
  throw e;
 }
}});
