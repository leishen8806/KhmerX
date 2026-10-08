import {staff,identity} from '@/lib/team/server';
import {scopedState,staffAction} from '@/lib/team/workflow';
import {readState,mutate} from '@/lib/store';
import {json} from '@/lib/h5-auth';
import {addErrorCode} from '@/lib/error-codes';
export const dynamic='force-dynamic';
export async function GET(){try{const u=await identity();if(await staff())return json(await scopedState());return json(await readState(u.userId))}catch(e){const status=(e as any)?.status||503;return json(addErrorCode({error:e instanceof Error?e.message:'读取失败',code:(e as any)?.code},status),status)}}
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'不允许跨站操作'},403);
 try{const u=await identity();const raw=await request.text();if(raw.length>10000)return json(addErrorCode({error:'请求过大'},413),413);const payload=JSON.parse(raw);const team=await staff();return json(team?await staffAction(payload):await mutate(u.userId,payload))}catch(e){const status=(e as any)?.status||400;return json(addErrorCode({error:e instanceof Error?e.message:'操作失败',code:(e as any)?.code},status),status)}
}
