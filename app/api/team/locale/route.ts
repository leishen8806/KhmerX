import {staff,db,audit} from '@/lib/team/server';
import {input,json,failure,sameOrigin} from '@/lib/h5-auth';
import {AuthError} from '@/lib/h5-auth-core';
export async function POST(request:Request){try{sameOrigin(request);const s=await staff();if(!s)throw new AuthError('请先选择公司',403);const p=await input(request);if(!['zh','en','km'].includes(p.locale))throw new AuthError('语言选项无效');const previous=(s.member as any).locale||'zh',next=String(p.locale);if(previous!==next){await db().batch([db().prepare('UPDATE team_members SET locale=? WHERE id=? AND tenant_id=? AND active=1').bind(next,s.member.id,s.tenant.id),audit(s.tenant.id,s.user.userId,'staff_locale_change',{memberId:s.member.id,before:previous,after:next})]);}return json({ok:true,locale:next})}catch(e){return failure(e,request)}}
