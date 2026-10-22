import {input,json,sameOrigin,failure} from '@/lib/h5-auth';
import {AuthError} from '@/lib/h5-auth-core';
import {configureBot} from '@/lib/bot-credentials';
export async function POST(request:Request){try{sameOrigin(request);return json(await configureBot(await input(request)))}catch(e){return failure(e,request)}}
