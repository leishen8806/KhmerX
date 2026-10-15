import {staff,identity} from '@/lib/team/server';
import {scopedState,staffAction} from '@/lib/team/workflow';
import {readState,mutate} from '@/lib/store';
import {json} from '@/lib/h5-auth';
import {route,readJsonBody} from '@/lib/http/route';
export const dynamic='force-dynamic';
export const GET=route({handler:async()=>{
 const u=await identity();
 return json(await staff()?await scopedState():await readState(u.userId));
}});
export const POST=route({origin:'required',handler:async(request)=>{
 const u=await identity();
 const payload=await readJsonBody(request,10000);
 const team=await staff();
 return json(team?await staffAction(payload):await mutate(u.userId,payload));
}});