import {staff,identity} from '@/lib/team/server';
import {scopedState,staffAction} from '@/lib/team/workflow';
import {scopedStatePage} from '@/lib/team/scoped-state-page';
import {customerRowsMode} from '@/lib/customer-shards';
import {readState,mutate} from '@/lib/store';
import {json} from '@/lib/h5-auth';
import {route,readJsonBody} from '@/lib/http/route';
export const dynamic='force-dynamic';
export const GET=route({handler:async(request)=>{
 const u=await identity();
 const params=new URL(request.url).searchParams;
 const page=params.has('page')||params.has('pageSize')||params.has('status')?{page:Number(params.get('page')||1),pageSize:Number(params.get('pageSize')||50),status:params.get('status')||undefined}:undefined;
 const team=await staff();
 return json(team?((page||customerRowsMode()==='on')?await scopedStatePage(page||{}):await scopedState()):await readState(u.userId));
}});
export const POST=route({origin:'required',handler:async(request)=>{
 const u=await identity();
 const payload=await readJsonBody(request,10000);
 const team=await staff();
 return json(team?await staffAction(payload):await mutate(u.userId,payload));
}});
