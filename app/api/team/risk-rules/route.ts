import {input,json,failure} from '@/lib/h5-auth';
import {riskRulesAction,riskRulesList} from '@/lib/team/risk-rules';
export const dynamic='force-dynamic';
export async function GET(){try{return json(await riskRulesList())}catch(e){return failure(e)}}
export async function POST(request:Request){try{return json(await riskRulesAction(await input(request)))}catch(e){return failure(e)}}
