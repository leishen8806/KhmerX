import {requireOrigin} from '@/lib/http/route';
import {registrationPolicy,requireRegistrationStep} from '@/lib/registration-policy';
import {requireH5ChannelAvailable} from '@/lib/h5-channel-guard';
import {SESSION_COOKIE,cookieValue,owner,runtime,input,browser,json,failure} from '@/lib/h5-auth';
import {sendCode,getSession} from '@/lib/h5-auth-core';
export async function POST(request:Request){try{requireOrigin(request);const id=await owner(),body=await input(request),r=runtime(),s=await getSession(r,id,cookieValue(request,SESSION_COOKIE)),policy=await registrationPolicy(r,id,s?.customerId);requireH5ChannelAvailable(r,policy.channelId);if(s)await requireRegistrationStep(r,id,s.customerId,'phoneVerification');return json(await sendCode(r,id,await browser(request),body))}catch(e){return failure(e,request)}}
