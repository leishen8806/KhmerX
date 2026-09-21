import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {readState} from '@/lib/store';
import {validateInitData} from '@/lib/telegram';
export async function POST(request:Request){
 const u=await getChatGPTUser();if(!u)return Response.json({error:'请先登录'},{status:401});
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'不允许跨站操作'},{status:403});
 try{
  const p=await request.json() as {botId:string;initData?:string};const {state}=await readState(u.userId);const bot=state.bots.find(b=>b.id===p.botId&&b.enabled);
  if(!bot)throw Error('机器人未启用');const token=(env as unknown as Record<string,string>)[bot.envKey];
  if(!token)return Response.json({connected:false,message:'未配置 '+bot.envKey+'。请在部署环境中安全配置 token，勿填入名称或用户名。'});
  if(p.initData){if(p.initData.length>10000)throw Error('认证数据过长');return Response.json({connected:true,user:await validateInitData(p.initData,token)})}
  const r=await fetch('https://api.telegram.org/bot'+token+'/getMe',{signal:AbortSignal.timeout(8000)});const v=await r.json() as any;
  if(!v.ok||!v.result?.is_bot)throw Error('Telegram 凭据验证失败');
  if(bot.username&&bot.username.toLowerCase()!==v.result.username.toLowerCase())throw Error('凭据与配置的机器人用户名不匹配');
  return Response.json({connected:true,username:v.result.username,message:'已验证 @'+v.result.username+'，资金仍为测试模式'});
 }catch{return Response.json({error:'机器人连接或签名验证失败，请检查配置后重试'},{status:400})}
}
