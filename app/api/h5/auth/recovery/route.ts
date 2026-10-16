import {owner,runtime,input,browser,json,failure} from '@/lib/h5-auth';
import {sendCode,resetPassword,AuthError} from '@/lib/h5-auth-core';
export async function POST(request:Request){try{const id=await owner(),r=runtime(),body=await input(request),b=await browser(request);if(body.action==='send')return json(await sendCode(r,id,b,body,'reset'));if(body.action==='reset')return json(await resetPassword(r,id,b,body));throw new AuthError('无效操作')}catch(e){return failure(e,request)}}
