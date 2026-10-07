import {staff,identity} from '@/lib/team/server';
import {scopedState,staffAction} from '@/lib/team/workflow';
import {readState,mutate} from '@/lib/store';
import {json} from '@/lib/h5-auth';
export const dynamic='force-dynamic';
export async function GET(){try{const u=await identity();if(await staff())return json(await scopedState());return json(await readState(u.userId))}catch(e){return json({error:e instanceof Error?e.message:'读取失败'},(e as any)?.status||503)}}
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'不允许跨站操作'},403);
 try{const u=await identity();const raw=await request.text();if(raw.length>10000)return json({error:'请求过大'},413);return json(await staff()?await staffAction(JSON.parse(raw)):await mutate(u.userId,JSON.parse(raw)))}catch(e){return json({error:e instanceof Error?e.message:'操作失败'},400)}
}
