import {json,failure} from '@/lib/h5-auth';
import {listCompanyChannels} from '@/lib/company-channels';
export const dynamic='force-dynamic';
export async function GET(){try{return json({channels:await listCompanyChannels()});}catch(e){return failure(e)}}
