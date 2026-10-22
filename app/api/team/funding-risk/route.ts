import {input,json,failure,sameOrigin} from '@/lib/h5-auth';
import {fundingRiskList,fundingRiskTransition} from '@/lib/team/funding-risk-events';
export const dynamic='force-dynamic';
export async function GET(){try{return json({items:await fundingRiskList()})}catch(e){return failure(e)}}
export async function POST(request:Request){try{sameOrigin(request);const p=await input(request);return json(await fundingRiskTransition(String(p.id||''),String(p.action||''),p.reason),200,{},request)}catch(e){return failure(e,request)}}
