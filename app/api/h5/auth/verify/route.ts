import {SESSION_COOKIE,cookie,cookieValue,owner,runtime,input,browser,json,failure} from '@/lib/h5-auth';
import {verifyCode,revokeSession,SESSION_TTL} from '@/lib/h5-auth-core';
export async function POST(request:Request){try{const id=await owner(),body=await input(request),r=runtime();const result=await verifyCode(r,id,browser(request),body);await revokeSession(r,id,cookieValue(request,SESSION_COOKIE));return json({authenticated:true,session:result.session},200,{'Set-Cookie':cookie(request,SESSION_COOKIE,result.token,SESSION_TTL)})}catch(e){return failure(e)}}
