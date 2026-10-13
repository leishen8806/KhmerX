import {selectedCompany,staff} from '@/lib/team/server';
import {channelToken} from '@/lib/bot-credentials';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {readState} from '@/lib/store';
import {validateInitData} from '@/lib/telegram';
import {input,json} from '@/lib/h5-auth';
import {assertAllowedOrigin} from '@/lib/request-security';
export async function POST(request:Request){
 const u=await getChatGPTUser();if(!u)return json({error:'请先登录',code:'AUTH_REQUIRED'},401);
 try{assertAllowedOrigin(request,false)}catch{return json({error:'不允许跨站操作',code:'CROSS_SITE_REQUEST'},403)}
 try{
  const company=await selectedCompany();
  // Bot credentials and Telegram connectivity are tenant administration data.
  // Only company Admin/Audit staff may probe them; the no-company path is
  // retained exclusively for the explicit local test mode.
  if(!company&&(env as unknown as Record<string,string>).KHMERX_TEST_MODE!=='true')return json({error:'无权查看机器人状态',code:'BOT_ACCESS_FORBIDDEN'},403);
  if(company){let team;try{team=await staff()}catch{return json({error:'无权查看机器人状态',code:'BOT_ACCESS_FORBIDDEN'},403)}if(!team||!['admin','audit'].includes(team.member.role))return json({error:'无权查看机器人状态',code:'BOT_ACCESS_FORBIDDEN'},403)}
  const p=await input(request) as {botId?:unknown;initData?:unknown};const botId=typeof p.botId==='string'?p.botId:'';const {state}=await readState(company?.id||u.userId);const bot=state.bots.find(b=>b.id===botId&&b.enabled);
  if(!bot)throw Error('机器人未启用');const token=company?await channelToken(company.id,bot.id):(env as unknown as Record<string,string>)[bot.envKey];
  if(!token)return json({connected:false,message:company?'请由公司管理员在业务渠道中配置 Token':'请在部署环境中配置机器人 Token',code:'BOT_NOT_CONFIGURED'});
  if(typeof p.initData==='string'&&p.initData){if(p.initData.length>10000)throw Error('认证数据过长');return json({connected:true,user:await validateInitData(p.initData,token)})}
  const r=await fetch('https://api.telegram.org/bot'+token+'/getMe',{method:'GET',redirect:'manual',signal:AbortSignal.timeout(15000)});const v=await r.json() as any;
  if(!v.ok||!v.result?.is_bot)throw Error('Telegram 凭据验证失败');
  if(bot.username&&bot.username.toLowerCase()!==v.result.username.toLowerCase())throw Error('凭据与配置的机器人用户名不匹配');
  return json({connected:true,username:v.result.username,message:'已验证 @'+v.result.username+'，资金仍为测试模式'});
 }catch{return json({error:'机器人连接或签名验证失败，请检查配置后重试',code:'BOT_VERIFICATION_FAILED'},400)}
}
