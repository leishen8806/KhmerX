import {jobAuthorized,runAllCompanies} from '@/lib/postloan/server';
export const dynamic='force-dynamic';
export async function POST(request:Request){if(!await jobAuthorized(request))return Response.json({error:'Unauthorized'},{status:401});try{const result=await runAllCompanies();return Response.json(result,{status:result.ok?200:503,headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'贷后检查失败，请重试'},{status:503})}}
