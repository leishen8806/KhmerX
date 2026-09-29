import {staff,identity} from '@/lib/team/server';
import {scopedState,staffAction} from '@/lib/team/workflow';
import {readState,mutate} from '@/lib/store';
export const dynamic='force-dynamic';
export async function GET(){try{const u=await identity();if(await staff())return Response.json(await scopedState(),{headers:{'Cache-Control':'no-store'}});return Response.json(await readState(u.userId),{headers:{'Cache-Control':'no-store'}})}catch(e){return Response.json({error:e instanceof Error?e.message:'读取失败'},{status:(e as any)?.status||503})}}
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'不允许跨站操作'},{status:403});
 try{const u=await identity();const raw=await request.text();if(raw.length>10000)return Response.json({error:'请求过大'},{status:413});return Response.json(await staff()?await staffAction(JSON.parse(raw)):await mutate(u.userId,JSON.parse(raw)))}catch(e){return Response.json({error:e instanceof Error?e.message:'操作失败'},{status:400})}
}
