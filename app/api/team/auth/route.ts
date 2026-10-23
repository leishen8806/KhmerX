import {passwordLogin,completeMfaLogin,createMfaChallenge,createSsoSession,logoutStaff,STAFF_SESSION,STAFF_MODE,STAFF_COMPANY,STAFF_PORTAL,STAFF_MFA_SETUP,portal} from '@/lib/team/auth';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {input,json,failure,cookie} from '@/lib/h5-auth';
import {db} from '@/lib/team/server';
import {AuthError,digest} from '@/lib/h5-auth-core';
import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{
 const p=await input(request),outer=await getChatGPTUser();if(!outer)throw new AuthError('请先登录私有测试站点',401);
 const response=json({ok:true});const set=(name:string,v:string,age=28800)=>response.headers.append('Set-Cookie',cookie(request,name,v,age));
 if(p.action==='logout'){await logoutStaff(request.headers.get('cookie'));set(STAFF_SESSION,'',0);set(STAFF_MODE,'out',31536000);set(STAFF_COMPANY,'none');set(STAFF_PORTAL,'business');set(STAFF_MFA_SETUP,'',0);return response}
 if(p.action==='bind_invite'){
  const email=outer.email.trim().toLowerCase(),company=String(p.company||'').trim().toLowerCase(),token=String(p.inviteToken||'').trim();if(!company||!token)throw new AuthError('请填写公司代码和邀请令牌',400,undefined,'INVITE_TOKEN_REQUIRED');
  const tenant=await db().prepare('SELECT id FROM team_companies WHERE slug=? AND active=1').bind(company).first<any>();if(!tenant)throw new AuthError('公司代码无效',403,undefined,'INVITE_COMPANY_INVALID');
  const row=await db().prepare(`SELECT i.token_hash,i.role,i.unit_id,m.id,m.tenant_id,m.email,m.active,m.mfa_enabled FROM team_invites i JOIN team_members m ON m.tenant_id=i.tenant_id AND lower(m.email)=lower(i.email) AND m.user_id LIKE 'pending:%' AND m.active=1 WHERE i.tenant_id=? AND lower(i.email)=? AND i.used=0 AND i.expires_at>? ORDER BY i.expires_at DESC LIMIT 1`).bind(tenant.id,email,Date.now()).first<any>();if(!row||row.token_hash!==await digest(token))throw new AuthError('邀请令牌无效或已过期',403,undefined,'INVITE_TOKEN_INVALID');
  const selected=portal(p.portal);if(!((selected==='lender'&&['checker','finance_checker'].includes(row.role))||(selected==='business'&&!['lender','checker','finance','finance_checker'].includes(row.role))))throw new AuthError('当前邀请不属于所选后台入口',403,undefined,'INVITE_PORTAL_MISMATCH');
  const changed=await db().batch([db().prepare(`UPDATE team_members SET user_id=?,version=version+1 WHERE id=? AND tenant_id=? AND lower(email)=? AND user_id LIKE 'pending:%' AND active=1`).bind(outer.userId,row.id,row.tenant_id,email),db().prepare('UPDATE team_invites SET used=1 WHERE token_hash=? AND tenant_id=? AND used=0').bind(row.token_hash,row.tenant_id)]);if(changed[0].meta.changes!==1||changed[1].meta.changes!==1)throw new AuthError('邀请状态已变化，请重新获取邀请',409,undefined,'INVITE_STATE_CHANGED');
  const sso=await createSsoSession(row.id,outer.userId);await logoutStaff(request.headers.get('cookie'));const setupRequired=row.role!=='admin'&&!row.mfa_enabled;const inviteResponse=json({ok:true,mfaSetupRequired:setupRequired});inviteResponse.headers.append('Set-Cookie',cookie(request,STAFF_SESSION,sso.token,28800));inviteResponse.headers.append('Set-Cookie',cookie(request,STAFF_MODE,'sso',31536000));inviteResponse.headers.append('Set-Cookie',cookie(request,STAFF_COMPANY,sso.companyId,28800));inviteResponse.headers.append('Set-Cookie',cookie(request,STAFF_PORTAL,selected,28800));if(setupRequired)inviteResponse.headers.append('Set-Cookie',cookie(request,STAFF_MFA_SETUP,row.id,1800));return inviteResponse;
 }
 if(p.action==='sso'){
  const email=outer.email.trim().toLowerCase();
  const existing=await db().prepare(`SELECT m.id,m.tenant_id,m.user_id,m.role FROM team_members m WHERE m.active=1 AND (m.user_id=? OR (lower(m.email)=? AND m.role='admin' AND m.user_id LIKE 'local:%') OR (lower(m.email)=? AND m.role='admin' AND m.user_id LIKE 'pending:platform:%'))`).bind(outer.userId,email,email).all<any>();
  let eligible=(existing.results||[]).filter((m:any)=>{if(!String(m.user_id).startsWith('pending:platform:'))return true;const expiry=Number(String(m.user_id).split(':')[2]);return Number.isFinite(expiry)&&expiry>Date.now()});
  // A platform operator may be re-authenticating with the same verified email
  // after the private Site account was recreated. Rebind only active admins,
  // only for an allowlisted platform email, and leave an audit trail for every
  // company; never use this fallback for ordinary staff or local-password rows.
  if(!eligible.length){
   const allowlisted=((env as any).KYC_REVIEWER_EMAILS||'').split(',').map((x:string)=>x.trim().toLowerCase());
   if(allowlisted.includes(email)){
    const stale=await db().prepare("SELECT m.id,m.tenant_id,m.user_id,m.role FROM team_members m WHERE m.active=1 AND lower(m.email)=? AND m.role='admin' AND m.user_id NOT LIKE 'local:%' AND m.user_id NOT LIKE 'pending:%'").bind(email).all<any>();
    if((stale.results||[]).length){
     const now=new Date().toISOString();
     const claims=(stale.results||[]).flatMap((m:any)=>[
      db().prepare("UPDATE team_members SET user_id=?,version=version+1 WHERE id=? AND user_id=? AND active=1 AND role='admin'").bind(outer.userId,m.id,m.user_id),
      db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),m.tenant_id,email,'platform_admin_identity_rebind',JSON.stringify({memberId:m.id,reason:'verified platform email re-authentication'}),now)
     ]);
     await db().batch(claims);
     eligible=(stale.results||[]).map((m:any)=>({...m,user_id:outer.userId}));
    }
   }
  }
  if(!eligible.length)throw new AuthError('当前站点账号没有后台员工权限',403);
  const selected=portal(p.portal);const match=eligible.find((m:any)=>m.role&&((selected==='lender'&&['checker','finance_checker'].includes(m.role))||(selected==='business'&&!['lender','checker','finance','finance_checker'].includes(m.role))));if(!match)throw new AuthError(selected==='lender'?'当前站点账号没有持牌机构复核权限，请联系管理员':'当前站点账号不属于服务机构后台，请切换到正确入口',403);
  const enabled=await db().prepare('SELECT mfa_enabled,role FROM team_members WHERE id=? AND active=1').bind(match.id).first<any>();
  if(enabled?.mfa_enabled)return json({mfaRequired:true,challenge:await createMfaChallenge(match.id,outer.userId),portal:selected});
  if(enabled?.role!=='admin')throw new AuthError('非管理员账号必须先启用 MFA 才能使用单点登录',403,undefined,'MFA_REQUIRED_FOR_SSO');
  const legacy=existing.results.filter((m:any)=>m.user_id!==outer.userId&&m.role==='admin'&&m.user_id.startsWith('local:'));
  if(legacy.length)throw new AuthError('本地管理员账号不能通过外层邮箱静默绑定，请使用公司密码登录或完成显式绑定',403);
  const bootstrap=match.user_id.startsWith('pending:platform:');
  if(bootstrap){
   const now=new Date().toISOString();
   const claimed=await db().batch([
    db().prepare("UPDATE team_members SET user_id=?,version=version+1 WHERE id=? AND user_id=? AND active=1").bind(outer.userId,match.id,match.user_id),
    db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),match.tenant_id,email,'platform_admin_bootstrap_bound',JSON.stringify({memberId:match.id,siteUserId:outer.userId}),now)
   ]);
   if(claimed[0].meta.changes!==1)throw new AuthError('管理员引导已被使用或已过期',409,'PLATFORM_BOOTSTRAP_EXPIRED');
  }
  const sso=await createSsoSession(match.id,outer.userId);await logoutStaff(request.headers.get('cookie'));set(STAFF_SESSION,sso.token);set(STAFF_MODE,'sso');set(STAFF_COMPANY,sso.companyId);set(STAFF_PORTAL,selected);return response;
 }
 if(p.action==='mfa'){
  const result=await completeMfaLogin(String(p.challenge||''),String(p.code||''),outer.userId,p.portal);set(STAFF_SESSION,result.token);set(STAFF_MODE,result.sso?'sso':'password',31536000);set(STAFF_COMPANY,result.companyId);set(STAFF_PORTAL,result.portal||portal(p.portal));return response;
 }
 if(p.action!=='login')throw new AuthError('登录操作无效');
 const result=await passwordLogin(p,outer.userId);if(result.mfaRequired)return json({...result,portal:portal(p.portal)});if(!('token' in result)||!result.companyId)throw new AuthError('登录结果无效，请重试');const token=result.token as string;const loginPortal=result.portal||portal(p.portal);await logoutStaff(request.headers.get('cookie'));set(STAFF_SESSION,token);set(STAFF_MODE,'password',31536000);set(STAFF_COMPANY,result.companyId);set(STAFF_PORTAL,loginPortal);return response;
}catch(e){return failure(e)}}
