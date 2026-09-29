import {passwordLogin,logoutStaff,STAFF_SESSION,STAFF_MODE,STAFF_COMPANY} from '@/lib/team/auth';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {input,json,failure,cookie} from '@/lib/h5-auth';
import {db} from '@/lib/team/server';
import {AuthError} from '@/lib/h5-auth-core';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{
 const p=await input(request),outer=await getChatGPTUser();if(!outer)throw new AuthError('请先登录私有测试站点',401);
 const response=json({ok:true});const set=(name:string,v:string,age=28800)=>response.headers.append('Set-Cookie',cookie(request,name,v,age));
 if(p.action==='logout'){await logoutStaff(request.headers.get('cookie'));set(STAFF_SESSION,'',0);set(STAFF_MODE,'out',31536000);set(STAFF_COMPANY,'none');return response}
 if(p.action==='sso'){
  if(!await db().prepare(`SELECT id FROM team_members WHERE active=1 AND (user_id=? OR (lower(email)=? AND user_id LIKE 'pending:%'))`).bind(outer.userId,outer.email.toLowerCase()).first())throw new AuthError('当前站点账号没有后台员工权限',403);
  await logoutStaff(request.headers.get('cookie'));set(STAFF_SESSION,'',0);set(STAFF_MODE,'sso');set(STAFF_COMPANY,'none');return response;
 }
 if(p.action!=='login')throw new AuthError('登录操作无效');
 const result=await passwordLogin(p,outer.userId);await logoutStaff(request.headers.get('cookie'));set(STAFF_SESSION,result.token);set(STAFF_MODE,'password',31536000);set(STAFF_COMPANY,result.companyId);return response;
}catch(e){return failure(e)}}
