import {requireOrigin} from '@/lib/http/route';
import {SESSION_COOKIE,cookie,cookieValue,owner,runtime,input,browser,json,failure} from '@/lib/h5-auth';
import {registerPhone,loginPassword,setPassword,getSession,revokeSession,SESSION_TTL,AuthError} from '@/lib/h5-auth-core';
import {registrationPolicy,requireRegistrationStep} from '@/lib/registration-policy';
import {channelType,requireH5ChannelAvailable} from '@/lib/h5-channel-guard';
export async function POST(request:Request){try{requireOrigin(request);
 const id=await owner(),body=await input(request),r=runtime(),token=cookieValue(request,SESSION_COOKIE),policy=await registrationPolicy(r,id);
 await requireH5ChannelAvailable(r,id,channelType(request),policy.channelId);
 if(body.action==='set_password'){const s=await getSession(r,id,token);if(!s)throw new AuthError('请先登录',401);await requireRegistrationStep(r,id,s.customerId,'passwordSetup');const b=await browser(request);return json(await setPassword(r,id,token,body,b))}
 if(!['register','password_login'].includes(body.action))throw new AuthError('无效操作');
 if(body.action==='register'&&r.config.mode==='telegram')throw new AuthError('Telegram 模式请先验证手机号，不能仅凭手机号注册',409);if(body.action==='register'&&!policy.channelId)throw new AuthError('暂无可用业务渠道',409,undefined,'CHANNEL_DISABLED');
 // With both optional registration steps disabled, the Mini App uses the
 // submitted phone as its lightweight account key and can return directly.
 const b=await browser(request),result=body.action==='register'?await registerPhone(r,id,b,body,policy.channelId,!policy.phoneVerification&&!policy.passwordSetup):await loginPassword(r,id,b,body);
 await revokeSession(r,id,token);return json({authenticated:true,session:result.session,policy:await registrationPolicy(r,id,result.session.customerId)},200,{'Set-Cookie':cookie(request,SESSION_COOKIE,result.token,SESSION_TTL)})
}catch(e){return failure(e,request)}}
