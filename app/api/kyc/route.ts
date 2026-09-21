import {context,initialize,view,save,json,failed} from '@/lib/kyc/server';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const c=await context(request);return json(await view(await initialize(c.owner,c.customerId,c.verified)))}catch(e){return failed(e)}}
export async function POST(request:Request){try{return json(await save(request))}catch(e){return failed(e)}}
