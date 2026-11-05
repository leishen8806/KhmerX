import {requireOrigin} from '@/lib/http/route';
import {input,json,failure} from '@/lib/h5-auth';
import {listCompanyChannels,saveCompanyChannel} from '@/lib/company-channels';
export const dynamic='force-dynamic';
export async function GET(){try{return json({channels:await listCompanyChannels()})}catch(e){return failure(e)}}
export async function POST(request:Request){try{requireOrigin(request);return json(await saveCompanyChannel(await input(request)),200)}catch(e){return failure(e,request)}}
