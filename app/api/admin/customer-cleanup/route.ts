import {input,json,failure,sameOrigin} from '@/lib/h5-auth';
import {customerCleanup} from '@/lib/customer-cleanup';
export async function POST(request:Request){try{sameOrigin(request);return json(await customerCleanup(await input(request)))}catch(e){return failure(e,request)}}
