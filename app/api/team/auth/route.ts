import {passwordLogin,completeMfaLogin,createMfaChallenge,createSsoSession,logoutStaff,STAFF_SESSION,STAFF_MODE,STAFF_COMPANY,STAFF_PORTAL,portal} from '@/lib/team/auth';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {input,json,failure,cookie} from '@/lib/h5-auth';
import {db} from '@/lib/team/server';
import {AuthError} from '@/lib/h5-auth-core';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{
 const p=await input(request),outer=await getChatGPTUser();if(!outer)throw new AuthError('请先登录私有测试站点',401);
 const response=json({ok:true});const set=(name:string,v:string,age=28800)=>response.headers.append('Set-Cookie',cookie(request,name,v,age));
 if(p.action==='logout'){await logoutStaff(request.headers.get('cookie'));set(STAFF_SESSION,'',0);set(STAFF_MODE,'out',31536000);set(STAFF_COMPANY,'none');set(STAFF_PORTAL,'business');return response}
 if(p.action==='sso'){
  const email=outer.email.trim().toLowerCase();
  const existing=await db().prepare(`SELECT id,tenant_id,user_id,role FROM team_members WHERE active=1 AND (user_id=? OR (lower(email)=? AND user_id LIKE 'pending:%') OR (lower(email)=? AND role='admin' AND user_id LIKE 'local:%') )`).bind(outer.userId,email,email).all<any>();
  if(!existing.results.length)throw new AuthError('当前站点账号没有后台员工权限',403);
  const selected=portal(p.portal);const match=existing.results.find((m:any)=>m.role&&((selected==='lender'&&['checker','finance_checker'].includes(m.role))||(selected==='business'&&!['lender','checker','finance','finance_checker'].includes(m.role))));if(!match)throw new AuthError(selected==='lender'?'当前站点账号没有持牌机构复核权限，请联系管理员':'当前站点账号不属于服务机构后台，请切换到正确入口',403);
  const mfaAdmin=existing.results.find((m:any)=>m.role==='admin'&&m.user_id===outer.userId);if(mfaAdmin){const enabled=await db().prepare('SELECT mfa_enabled FROM team_members WHERE id=? AND active=1').bind(mfaAdmin.id).first<any>();if(enabled?.mfa_enabled)return json({mfaRequired:true,challenge:await createMfaChallenge(mfaAdmin.id,outer.userId),portal:selected});}
  const legacy=existing.results.filter((m:any)=>m.user_id!==outer.userId&&m.role==='admin'&&m.user_id.startsWith('local:'));
  if(legacy.length)throw new AuthError('本地管理员账号不能通过外层邮箱静默绑定，请使用公司密码登录或完成显式绑定',403);
  const sso=await createSsoSession(match.id,outer.userId);await logoutStaff(request.headers.get('cookie'));set(STAFF_SESSION,sso.token);set(STAFF_MODE,'sso');set(STAFF_COMPANY,sso.companyId);set(STAFF_PORTAL,selected);return response;
 }
 if(p.action==='mfa'){
  const result=await completeMfaLogin(String(p.challenge||''),String(p.code||''),outer.userId,p.portal);set(STAFF_SESSION,result.token);set(STAFF_MODE,result.sso?'sso':'password',31536000);set(STAFF_COMPANY,result.companyId);set(STAFF_PORTAL,result.portal||portal(p.portal));return response;
 }
 if(p.action!=='login')throw new AuthError('登录操作无效');
 const result=await passwordLogin(p,outer.userId);if(result.mfaRequired)return json({...result,portal:portal(p.portal)});if(!('token' in result)||!result.companyId)throw new AuthError('登录结果无效，请重试');const token=result.token as string;const loginPortal=result.portal||portal(p.portal);await logoutStaff(request.headers.get('cookie'));set(STAFF_SESSION,token);set(STAFF_MODE,'password',31536000);set(STAFF_COMPANY,result.companyId);set(STAFF_PORTAL,loginPortal);return response;
}catch(e){return failure(e)}}
