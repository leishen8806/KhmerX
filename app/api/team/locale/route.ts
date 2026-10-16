import {staff,db} from '@/lib/team/server';
import {input,json,failure,sameOrigin} from '@/lib/h5-auth';
import {AuthError} from '@/lib/h5-auth-core';
export async function POST(request:Request){try{sameOrigin(request);const s=await staff();if(!s)throw new AuthError('请先选择公司',403);const p=await input(request);if(!['zh','en','km'].includes(p.locale))throw new AuthError('语言选项无效');await db().prepare('UPDATE team_members SET locale=? WHERE id=? AND tenant_id=? AND active=1').bind(p.locale,s.member.id,s.tenant.id).run();return json({ok:true,locale:p.locale})}catch(e){return failure(e,request)}}
