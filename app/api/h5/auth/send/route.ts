import {owner,runtime,input,browser,json,failure} from '@/lib/h5-auth';
import {sendCode} from '@/lib/h5-auth-core';
export async function POST(request:Request){try{const id=await owner(),body=await input(request);return json(await sendCode(runtime(),id,browser(request),body))}catch(e){return failure(e)}}
