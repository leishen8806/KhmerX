import {requireOrigin} from '@/lib/http/route';
import {input,json,failure} from '@/lib/h5-auth';
import {customerCleanup} from '@/lib/customer-cleanup';
export async function POST(request:Request){try{requireOrigin(request);return json(await customerCleanup(await input(request)))}catch(e){return failure(e,request)}}
