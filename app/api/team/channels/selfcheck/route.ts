import {json,failure} from '@/lib/h5-auth';
import {CompanyChannelRow,readCompanyChannels} from '@/lib/company-channels';
import {db} from '@/lib/team/server';
import {selfCheckCompanyChannels} from '@/lib/company-channel-selfcheck';
import {isProduction} from '@/lib/runtime-guards';
import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function GET(){try{const {staff}=await readCompanyChannels();const rows=(await db().prepare('SELECT cc.*, CASE WHEN tbc.token_encrypted IS NULL THEN 0 ELSE 1 END AS token_configured FROM company_channels cc LEFT JOIN telegram_bot_credentials tbc ON tbc.owner=cc.tenant_id AND tbc.bot_id=cc.telegram_bot_id ORDER BY cc.tenant_id,cc.type,cc.label,cc.id').bind().all<CompanyChannelRow & {token_configured:number}>()).results;const values=env as unknown as Record<string,unknown>,key=String(values.PAYEASE_APP_CLIENT_KEY??'').trim();return json(selfCheckCompanyChannels(rows,{tenantId:staff.tenant.id,formalEnvironment:isProduction(),appClientKeyConfigured:new TextEncoder().encode(key).length>=32}));}catch(e){return failure(e)}}
