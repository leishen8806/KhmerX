import {json,failure} from '@/lib/h5-auth';
import {CompanyChannelRow,readCompanyChannels} from '@/lib/company-channels';
import {db} from '@/lib/team/server';
import {selfCheckCompanyChannels} from '@/lib/company-channel-selfcheck';
import {isProduction} from '@/lib/runtime-guards';
export const dynamic='force-dynamic';
export async function GET(){try{const {staff}=await readCompanyChannels();const rows=(await db().prepare('SELECT * FROM company_channels ORDER BY tenant_id,type,label,id').bind().all<CompanyChannelRow>()).results;return json(selfCheckCompanyChannels(rows,{tenantId:staff.tenant.id,formalEnvironment:isProduction()}));}catch(e){return failure(e)}}
