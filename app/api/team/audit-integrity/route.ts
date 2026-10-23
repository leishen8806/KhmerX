import {input,json,failure,sameOrigin} from '@/lib/h5-auth';
import {AuthError} from '@/lib/h5-auth-core';
import {createManifest,verifyManifest,listManifests} from '@/lib/team/audit-integrity';
export const dynamic='force-dynamic';
export async function GET(){try{return json({items:await listManifests()})}catch(e){return failure(e)}}
export async function POST(request:Request){try{sameOrigin(request);const p=await input(request);if(p.action==='create')return json(await createManifest());if(p.action==='verify')return json(await verifyManifest(String(p.id||'')));throw new AuthError('审计完整性操作无效',400)}catch(e){return failure(e,request)}}
