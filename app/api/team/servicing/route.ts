import {requireOrigin} from '@/lib/http/route';
import {servicingData,servicingSave} from '@/lib/team/servicing';
import {input,json,failure} from '@/lib/h5-auth';
export async function GET(){try{return json(await servicingData())}catch(e){return failure(e)}}
export async function POST(r:Request){try{requireOrigin(r);return json(await servicingSave(await input(r)))}catch(e){return failure(e,r)}}
