import {selectedCompany,staff} from '@/lib/team/server';
import {channelToken} from '@/lib/bot-credentials';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {readState} from '@/lib/store';
import {validateInitData} from '@/lib/telegram';
import {json} from '@/lib/h5-auth';
export async function POST(request:Request){
 const u=await getChatGPTUser();if(!u)return json({error:'请先登录'},401);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'不允许跨站操作'},403);
 try{
  const company=await selectedCompany();if(company)await staff();
  const p=await request.json() as {botId:string;initData?:string};const {state}=await readState(company?.id||u.userId);const bot=state.bots.find(b=>b.id===p.botId&&b.enabled);
  if(!bot)throw Error('机器人未启用');const token=company?await channelToken(company.id,bot.id):(env as unknown as Record<string,string>)[bot.envKey];
  if(!token)return json({connected:false,message:company?'请由公司管理员在业务渠道中配置 Token':'请在部署环境中配置机器人 Token'});
  if(p.initData){if(p.initData.length>10000)throw Error('认证数据过长');return json({connected:true,user:await validateInitData(p.initData,token)})}
  const r=await fetch('https://api.telegram.org/bot'+token+'/getMe',{method:'GET',redirect:'manual',signal:AbortSignal.timeout(15000)});const v=await r.json() as any;
  if(!v.ok||!v.result?.is_bot)throw Error('Telegram 凭据验证失败');
  if(bot.username&&bot.username.toLowerCase()!==v.result.username.toLowerCase())throw Error('凭据与配置的机器人用户名不匹配');
  return json({connected:true,username:v.result.username,message:'已验证 @'+v.result.username+'，资金仍为测试模式'});
 }catch{return json({error:'机器人连接或签名验证失败，请检查配置后重试'},400)}
}
