import {input,json,failure,sameOrigin} from '@/lib/h5-auth';
import {kycFollowups} from '@/lib/kyc/followups';
export async function GET(request:Request){try{return json(await kycFollowups(new URL(request.url).searchParams.get('id')||''))}catch(e){return failure(e)}}
export async function POST(request:Request){try{sameOrigin(request);const p=await input(request);return json(await kycFollowups(String(p.id||''),p))}catch(e){return failure(e,request)}}
