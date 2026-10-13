import {jobAuthorized,runAllCompanies} from '@/lib/postloan/server';
import {json} from '@/lib/h5-auth';
export const dynamic='force-dynamic';
export async function POST(request:Request){if(!await jobAuthorized(request))return json({error:'Unauthorized',code:'JOB_UNAUTHORIZED'},401);try{const result=await runAllCompanies();return json(result,result.ok?200:503)}catch{return json({error:'贷后检查失败，请重试',code:'POSTLOAN_JOB_FAILED'},503)}}
