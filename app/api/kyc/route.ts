import {context,initialize,view,save,json} from '@/lib/kyc/server';
import {route} from '@/lib/http/route';
export const dynamic='force-dynamic';
export const GET=route({handler:async(request:Request)=>{
 const c=await context(request);
 return json(await view(await initialize(c.owner,c.customerId,c.verified)));
}});
export const POST=route({origin:'required',handler:async(request:Request)=>{
 // save() enforces Origin again via body(); the wrapper-level check is a
 // second line of defense for every write interface (ARC-00 §4).
 return json(await save(request));
}});