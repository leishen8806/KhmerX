import {db,staff,manage} from '@/lib/team/server';
import {failure,json,input} from '@/lib/h5-auth';
export const dynamic='force-dynamic';
export async function GET(){try{const s=await staff();if(!s||s.member.role!=='admin')return json({error:'仅公司管理员可管理通知模板'},403);const rows=await db().prepare('SELECT id,event_key,locale,title,body,version,active,updated_at FROM team_notification_templates WHERE tenant_id=? ORDER BY event_key,locale').bind(s.tenant.id).all();return json({templates:rows.results})}catch(e){return failure(e)}}
export async function POST(request:Request){try{const payload=await input(request) as Record<string,unknown>;return json(await manage({...payload,action:'notification_template_save'}))}catch(e){return failure(e)}}
