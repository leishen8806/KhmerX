import {json,failure} from '@/lib/h5-auth';
import {db,staff} from '@/lib/team/server';
import {AuthError} from '@/lib/h5-auth-core';
export const dynamic='force-dynamic';
const roles=new Set(['admin','audit','checker','finance_checker']);
type AuditRow={actor:string;action:string;created_at:string};
export async function GET(){try{
 const s=await staff();if(!s||!roles.has(s.member.role))throw new AuthError('当前岗位没有渠道审计查看权限',403,'CHANNEL_AUDIT_FORBIDDEN');
 const rows=(await db().prepare("SELECT actor,action,created_at FROM team_audit WHERE tenant_id=? AND (action LIKE 'channel_%' OR action='bot_token_configure') ORDER BY created_at DESC LIMIT 100").bind(s.tenant.id).all<AuditRow>()).results;
 return json({events:rows.map(row=>({actor:row.actor,action:row.action,createdAt:row.created_at}))});
}catch(e){return failure(e)}}
