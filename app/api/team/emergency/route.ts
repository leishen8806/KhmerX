import {input,json,failure} from '@/lib/h5-auth';
import {AuthError} from '@/lib/h5-auth-core';
import {emergencyRequest,emergencyApprove,emergencyRevoke,emergencyList} from '@/lib/team/emergency';
export const dynamic='force-dynamic';
export async function GET(){try{return json({items:await emergencyList()})}catch(e){return failure(e)}}
export async function POST(request:Request){try{const p=await input(request);if(p.action==='request')return json(await emergencyRequest(p));if(p.action==='approve')return json(await emergencyApprove(String(p.id||''),p.code));if(p.action==='revoke')return json(await emergencyRevoke(String(p.id||'')));throw new AuthError('应急操作无效',400)}catch(e){return failure(e)}}
