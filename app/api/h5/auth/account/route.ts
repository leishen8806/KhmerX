import {SESSION_COOKIE,cookie,cookieValue,owner,runtime,input,browser,json,failure} from '@/lib/h5-auth';
import {registerPhone,loginPassword,setPassword,getSession,revokeSession,SESSION_TTL,AuthError} from '@/lib/h5-auth-core';
import {registrationPolicy,requireRegistrationStep} from '@/lib/registration-policy';
export async function POST(request:Request){try{
 const id=await owner(),body=await input(request),r=runtime(),token=cookieValue(request,SESSION_COOKIE);
 if(body.action==='set_password'){const s=await getSession(r,id,token);if(!s)throw new AuthError('请先登录',401);await requireRegistrationStep(r,id,s.customerId,'passwordSetup');return json(await setPassword(r,id,token,body))}
 if(!['register','password_login'].includes(body.action))throw new AuthError('无效操作');
 const policy=await registrationPolicy(r,id);if(body.action==='register'&&!policy.channelId)throw new AuthError('暂无可用业务渠道',409);
 // With both optional registration steps disabled, the Mini App uses the
 // submitted phone as its lightweight account key and can return directly.
 const result=body.action==='register'?await registerPhone(r,id,browser(request),body,policy.channelId,!policy.phoneVerification&&!policy.passwordSetup):await loginPassword(r,id,browser(request),body);
 await revokeSession(r,id,token);return json({authenticated:true,session:result.session,policy:await registrationPolicy(r,id,result.session.customerId)},200,{'Set-Cookie':cookie(request,SESSION_COOKIE,result.token,SESSION_TTL)})
}catch(e){return failure(e)}}
