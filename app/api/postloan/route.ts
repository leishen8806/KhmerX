import {postloanData,postloanAction} from '@/lib/postloan/server';
import {json,input,failure,sameOrigin} from '@/lib/h5-auth';
export const dynamic='force-dynamic';
export async function GET(){try{return json(await postloanData())}catch(e){return failure(e)}}
export async function POST(request:Request){try{sameOrigin(request);return json(await postloanAction(await input(request)))}catch(e){return failure(e,request)}}
