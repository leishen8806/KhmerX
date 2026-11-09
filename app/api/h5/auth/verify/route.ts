import {requireOrigin} from '@/lib/http/route';
import {registrationPolicy,requireRegistrationStep} from '@/lib/registration-policy';
import {requestChannelType,requireH5ChannelAvailable} from '@/lib/h5-channel-guard';
import {SESSION_COOKIE,cookie,cookieValue,owner,runtime,input,browser,json,failure} from '@/lib/h5-auth';
import {getSession,verifyCode,revokeSession,SESSION_TTL} from '@/lib/h5-auth-core';
export async function POST(request:Request){try{requireOrigin(request);const id=await owner(),body=await input(request),r=runtime(),existing=await getSession(r,id,cookieValue(request,SESSION_COOKIE)),policy=await registrationPolicy(r,id,existing?.customerId);await requireH5ChannelAvailable(r,id,await requestChannelType(r,request,id),policy.channelId);if(existing)await requireRegistrationStep(r,id,existing.customerId,'phoneVerification');const result=await verifyCode(r,id,await browser(request),body,existing?.customerId);await revokeSession(r,id,cookieValue(request,SESSION_COOKIE));return json({authenticated:true,session:result.session},200,{'Set-Cookie':cookie(request,SESSION_COOKIE,result.token,SESSION_TTL)})}catch(e){return failure(e,request)}}
