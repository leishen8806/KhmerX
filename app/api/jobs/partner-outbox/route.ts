import {jobAuthorized,json} from '@/lib/h5-auth';
import {dispatchPartnerOutbox} from '@/lib/partner-outbox';
export const dynamic='force-dynamic';
export async function POST(request:Request){if(!await jobAuthorized(request))return json({error:'Unauthorized',code:'JOB_UNAUTHORIZED'},401);try{const result=await dispatchPartnerOutbox();return json({ok:true,...result},200)}catch{return json({error:'发件箱投递失败，请重试',code:'PARTNER_OUTBOX_FAILED'},503)}}
