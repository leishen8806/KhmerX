import {sameOrigin} from '@/lib/h5-auth';
import {input,json} from '@/lib/h5-auth';
import {AuthError} from '@/lib/h5-auth-core';
import {configureBot} from '@/lib/bot-credentials';
export async function POST(request:Request){try{sameOrigin(request);return json(await configureBot(await input(request)))}catch(e){return json({error:e instanceof AuthError?e.message:'机器人配置未保存，请稍后重试',code:e instanceof AuthError?(e.code||'BOT_CONFIG_INVALID'):'SERVICE_UNAVAILABLE'},e instanceof AuthError?e.status:503,{},request)}}
