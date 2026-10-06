import {registrationPolicy} from '@/lib/registration-policy';
import {customerCompany} from '@/lib/team/server';
import {BROWSER_COOKIE,SESSION_COOKIE,cookieValue,cookie,owner,runtime,json,failure} from '@/lib/h5-auth';
import {getSession,pendingChallenge,randomToken} from '@/lib/h5-auth-core';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const id=await owner(),r=runtime(),existing=cookieValue(request,BROWSER_COOKIE),browser=existing||randomToken(),company=await customerCompany();const session=await getSession(r,id,cookieValue(request,SESSION_COOKIE));const pending=session?null:await pendingChallenge(r,id,browser);return json({company:company?.name||null,authenticated:!!session,session,mode:r.config.mode,pending,policy:await registrationPolicy(r,id,session?.customerId),languages:{en:company?.client_en_enabled!==0,km:company?.client_km_enabled!==0,zh:company?.client_zh_enabled!==0}},200,existing?{}:{'Set-Cookie':cookie(request,BROWSER_COOKIE,browser,86400)})}catch(e){return failure(e)}}
