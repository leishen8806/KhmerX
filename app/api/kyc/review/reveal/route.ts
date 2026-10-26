import {route} from '@/lib/http/route';
import {revealKycValue} from '@/lib/kyc/reveal';
export const dynamic='force-dynamic';
export const POST=route({origin:'required',handler:async request=>Response.json(await revealKycValue(request),{headers:{'Cache-Control':'no-store'}})});
