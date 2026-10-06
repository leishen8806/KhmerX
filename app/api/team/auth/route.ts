import {passwordLogin,completeMfaLogin,createMfaChallenge,logoutStaff,STAFF_SESSION,STAFF_MODE,STAFF_COMPANY} from '@/lib/team/auth';
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
  const email=outer.email.trim().toLowerCase();
  const existing=await db().prepare(`SELECT id,tenant_id,user_id,role FROM team_members WHERE active=1 AND (user_id=? OR (lower(email)=? AND user_id LIKE 'pending:%') OR (lower(email)=? AND role='admin' AND user_id LIKE 'local:%') )`).bind(outer.userId,email,email).all<any>();
  if(!existing.results.length)throw new AuthError('当前站点账号没有后台员工权限',403);
  const mfaAdmin=existing.results.find((m:any)=>m.role==='admin'&&m.user_id===outer.userId);if(mfaAdmin){const enabled=await db().prepare('SELECT mfa_enabled FROM team_members WHERE id=? AND active=1').bind(mfaAdmin.id).first<any>();if(enabled?.mfa_enabled)return json({mfaRequired:true,challenge:await createMfaChallenge(mfaAdmin.id,outer.userId)});}
  const legacy=existing.results.filter((m:any)=>m.user_id!==outer.userId&&m.role==='admin'&&m.user_id.startsWith('local:'));
  if(legacy.length&&email.endsWith('@visitor.invalid'))throw new AuthError('当前站点账号没有可绑定的管理员邮箱',403);
  if(legacy.length){
   await db().batch(legacy.flatMap((m:any)=>[
    db().prepare('UPDATE team_members SET user_id=?,version=version+1 WHERE id=? AND tenant_id=? AND user_id=? AND active=1 AND role=\'admin\'').bind(outer.userId,m.id,m.tenant_id,m.user_id),
    db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),m.tenant_id,outer.userId,'sso_admin_bind',JSON.stringify({member:m.id,email}),new Date().toISOString())
   ]));
  }
  await logoutStaff(request.headers.get('cookie'));set(STAFF_SESSION,'',0);set(STAFF_MODE,'sso');set(STAFF_COMPANY,'none');return response;
 }
 if(p.action==='mfa'){
  const result=await completeMfaLogin(String(p.challenge||''),String(p.code||''),outer.userId);if(result.sso){set(STAFF_SESSION,'',0);set(STAFF_MODE,'sso',31536000)}else{set(STAFF_SESSION,result.token);set(STAFF_MODE,'password',31536000)}set(STAFF_COMPANY,result.companyId);return response;
 }
 if(p.action!=='login')throw new AuthError('登录操作无效');
 const result=await passwordLogin(p,outer.userId);if(result.mfaRequired)return json(result);await logoutStaff(request.headers.get('cookie'));set(STAFF_SESSION,result.token);set(STAFF_MODE,'password',31536000);set(STAFF_COMPANY,result.companyId);return response;
}catch(e){return failure(e)}}
