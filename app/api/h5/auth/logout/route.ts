import {BROWSER_COOKIE,SESSION_COOKIE,cookie,cookieValue,owner,runtime,input,json,failure} from '@/lib/h5-auth';
import {revokeSession,forgetBrowser} from '@/lib/h5-auth-core';
export async function POST(request:Request){try{const id=await owner();await input(request);await revokeSession(runtime(),id,cookieValue(request,SESSION_COOKIE));const b=cookieValue(request,BROWSER_COOKIE);if(b)await forgetBrowser(runtime(),id,b);return json({authenticated:false},200,{'Set-Cookie':cookie(request,SESSION_COOKIE,'',0)})}catch(e){return failure(e)}}
