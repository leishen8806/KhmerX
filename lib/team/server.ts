import {staffIdentity,STAFF_COMPANY,STAFF_PORTAL,STAFF_MFA_SETUP,value,portal,portalAllows,makePassword,createMfaEnrollment,generateMfaRecoveryCodes,revealMfaSecret,verifyTotp,verifyTotpWithCounter} from './auth';
import {fillServiceAssignments} from './servicing';
import {defaultPricing,validatePricing,normalizePricing,type Pricing} from '@/lib/pricing';
import {defaultFundingLimits} from '@/lib/funding-limits';
import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {AuthError,randomToken,digest} from '@/lib/h5-auth-core';
import {canSee,roleLabels,roleCatalog,roleUnitKind,kycFieldGroups,type Member,type Assignment,type TeamRole,type KycFieldGroup} from './policy';
import {assertProductionSafe,isTestMode} from '@/lib/runtime-guards';
assertProductionSafe();
export const TEAM_COOKIE=STAFF_COMPANY;
export const CUSTOMER_COMPANY_COOKIE='payease_company';
export const db=()=>{if(!env.DB)throw new AuthError('公司数据库暂不可用',503);return env.DB};
export async function identity(){const u=await staffIdentity();if(isTestMode()&&!u.staffTenantId){await db().prepare(`UPDATE team_members SET user_id=?,version=version+1 WHERE lower(email)=? AND user_id LIKE 'pending:%' AND active=1 AND NOT EXISTS (SELECT 1 FROM team_members existing WHERE existing.tenant_id=team_members.tenant_id AND existing.user_id=?)`).bind(u.userId,u.email.toLowerCase(),u.userId).run()}return u}
async function companyByCookie(customerOnly=false){const raw=(await headers()).get('cookie');const v=customerOnly?value(raw,CUSTOMER_COMPANY_COOKIE):(value(raw,TEAM_COOKIE)??value(raw,CUSTOMER_COMPANY_COOKIE));if(!v||v==='none')return null;if(!/^t_[a-f0-9-]{36}$/.test(v))throw new AuthError('公司工作区无效',403);const t=await db().prepare('SELECT * FROM team_companies WHERE id=? AND active=1').bind(v).first<any>();if(!t)throw new AuthError('公司已停用或不可访问',403);return t}
export const selectedCompany=()=>companyByCookie();
export const customerCompany=()=>companyByCookie(true);
export async function staff(){const u=await identity(),t=await selectedCompany();if(!t){if(u.staffTenantId)throw new AuthError('请选择员工所属公司',403);return null}if(u.staffMode!=='sso'&&u.staffTenantId&&u.staffTenantId!==t.id)throw new AuthError('当前账号没有此公司的员工权限',403);const m=await db().prepare('SELECT * FROM team_members WHERE tenant_id=? AND user_id=? AND active=1').bind(t.id,u.userId).first<Member>();if(!m)throw new AuthError('当前账号没有此公司的员工权限，请前往公司工作区',403);const raw=(await headers()).get('cookie'),saved=value(raw,STAFF_PORTAL),selected=saved?portal(saved):(['checker','finance_checker'].includes(m.role)?'lender':'business'),setup=value(raw,STAFF_MFA_SETUP),mfaSetup=!!setup&&setup===m.id&&!(m as any).mfa_enabled;if(saved&&!portalAllows(m.role,selected))throw new AuthError(selected==='lender'?'当前账号没有持牌机构复核权限，请联系管理员':'当前账号不属于服务机构后台，请切换到正确入口',403);return {tenant:t,member:m,user:u,portal:selected,mfaSetup}}
export async function pricingFor(owner:string):Promise<Pricing>{if(!owner.startsWith('t_'))return {...defaultPricing};const row=await db().prepare('SELECT pricing_json FROM team_companies WHERE id=? AND active=1').bind(owner).first<{pricing_json:string}>();if(!row)throw new AuthError('公司不可用',403);return row.pricing_json?normalizePricing(JSON.parse(row.pricing_json)):{...defaultPricing}}
// Keep authentication material out of every team-data response, including
// internal callers that do not pass through the HTTP route sanitizer.
function safeMember(member:any){const {mfa_secret:_,pending_mfa_secret:__,...safe}=member||{};return safe}
// Return only fields consumed by the workspace shell. The raw pricing JSON is
// already normalized into `pricing` and must not be exposed as an internal blob.
function safeCompany(company:any){if(!company)return null;const {id,name,slug,active,default_department,auto_assign,client_en_enabled,client_km_enabled,client_zh_enabled}=company;return {id,name,slug,active,default_department,auto_assign,client_en_enabled,client_km_enabled,client_zh_enabled}}
export async function assignments(tenant:string){return (await db().prepare('SELECT * FROM team_assignments WHERE tenant_id=?').bind(tenant).all<Assignment>()).results}
export async function assignment(tenant:string,customer:string){return await db().prepare('SELECT * FROM team_assignments WHERE tenant_id=? AND customer_id=?').bind(tenant,customer).first<Assignment>()}
export async function ensureAssignment(tenant:string,customer:string){if(!tenant.startsWith('t_'))return;const t=await db().prepare('SELECT * FROM team_companies WHERE id=? AND active=1').bind(tenant).first<any>();if(!t)throw new AuthError('公司不可访问',403);await db().batch([db().prepare(`INSERT OR IGNORE INTO team_assignments (tenant_id,customer_id,department_id,reviewer_id,institution_id,version) SELECT ?,?,?,CASE WHEN ?=1 THEN (SELECT m.id FROM team_members m WHERE m.tenant_id=? AND m.unit_id=? AND m.role='kyc' AND m.active=1 ORDER BY (SELECT COUNT(*) FROM team_assignments a LEFT JOIN kyc_cases k ON k.owner=a.tenant_id AND k.customer_id=a.customer_id WHERE a.reviewer_id=m.id AND (k.status IS NULL OR k.status IN ('draft','submitted','needs_info'))) ASC,m.id LIMIT 1) ELSE NULL END,CASE WHEN ?=1 THEN (SELECT u.id FROM team_units u WHERE u.tenant_id=? AND u.kind='institution' AND u.active=1 AND EXISTS (SELECT 1 FROM team_members m WHERE m.unit_id=u.id AND m.role='lender' AND m.active=1) ORDER BY (SELECT COUNT(*) FROM team_assignments a WHERE a.institution_id=u.id),u.id LIMIT 1) ELSE NULL END,0`).bind(tenant,customer,t.default_department,t.auto_assign,tenant,t.default_department,t.auto_assign,tenant),db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),tenant,'system',t.auto_assign?'auto_assign':'queue_unassigned',JSON.stringify({customer}),new Date().toISOString())]);await fillServiceAssignments(tenant)}
export async function guardKyc(tenant:string,customer:string,write=false){const s=await staff();if(!s||s.tenant.id!==tenant||!canSee(s.member,await assignment(tenant,customer)||undefined,'kyc')||(write&&!['admin','kyc','dept_admin'].includes(s.member.role)))throw new AuthError('无权访问或审核这份资料',403);return s}
export async function platformAdmin(){const u=await identity(),allowed=((env as any).KYC_REVIEWER_EMAILS||'').split(',').map((x:string)=>x.trim().toLowerCase());if(u.staffTenantId||!allowed.includes(u.email.toLowerCase()))throw new AuthError('仅平台管理员可创建公司',403);return u}
export function audit(tenant:string,actor:string,action:string,detail:unknown){return db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),tenant,actor,action,JSON.stringify(detail),new Date().toISOString())}
export async function liveMember(m:Member){return !!await db().prepare('SELECT id FROM team_members WHERE id=? AND tenant_id=? AND user_id=? AND version=? AND active=1').bind(m.id,m.tenant_id,m.user_id,m.version).first()}
export async function teamData(){const u=await identity(),t=await selectedCompany();const membershipSql=u.staffMode==='sso'?'SELECT m.tenant_id,m.role,c.name,c.slug FROM team_members m JOIN team_companies c ON c.id=m.tenant_id WHERE m.user_id=? AND m.active=1 AND c.active=1':'SELECT m.tenant_id,m.role,c.name,c.slug FROM team_members m JOIN team_companies c ON c.id=m.tenant_id WHERE m.user_id=? AND m.tenant_id=? AND m.active=1 AND c.active=1';const memberships=(await db().prepare(membershipSql).bind(...(u.staffMode==='sso'?[u.userId]:[u.userId,u.staffTenantId])).all()).results;let platform=false;try{await platformAdmin();platform=true}catch{}if(!t){const companies=platform?(await db().prepare("SELECT id,name,slug,active,client_en_enabled,client_km_enabled,client_zh_enabled FROM team_companies ORDER BY name").bind().all()).results:[];return {user:{email:u.email},platform,memberships,companies,company:null};}let s;try{s=await staff()}catch{return {user:{email:u.email},platform,memberships,company:null,customerCompany:{name:t.name,slug:t.slug}}}if(!s)throw new AuthError('请先选择公司',403);await db().prepare('INSERT OR IGNORE INTO team_units (id,tenant_id,name,kind) VALUES (?,?,?,?)').bind('postloan:'+t.id,t.id,'运营贷后部','postloan').run();const units=(await db().prepare('SELECT id,name,kind,active FROM team_units WHERE tenant_id=?').bind(t.id).all()).results;const members=['admin','dept_admin'].includes(s.member.role)?(await db().prepare('SELECT id,email,role,unit_id,active,version FROM team_members WHERE tenant_id=? AND (? IS NULL OR unit_id=?)').bind(t.id,s.member.role==='admin'?null:s.member.unit_id,s.member.unit_id).all()).results:[];const permissionRows=members.length?(await db().prepare('SELECT member_id,field_group FROM team_kyc_field_permissions WHERE tenant_id=? AND active=1').bind(t.id).all()).results:[];const permissionsByMember=new Map<string,string[]>();for(const row of permissionRows as any[]){const list=permissionsByMember.get(row.member_id)||[];list.push(row.field_group);permissionsByMember.set(row.member_id,list)}for(const member of members as any[])member.kycFieldPermissions=permissionsByMember.get(member.id)||[];const trail=['admin','audit'].includes(s.member.role)?(await db().prepare('SELECT actor,action,detail,created_at FROM team_audit WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100').bind(t.id).all()).results:[];return {user:{email:u.email},platform,memberships,company:safeCompany(t),pricing:await pricingFor(t.id),member:safeMember(s.member),units,members,roleCatalog,kycFieldGroups,trail}}
export async function teamMembersPage(input:{page?:number;pageSize?:number;query?:string;role?:string;unitId?:string;active?:string}){const s=await staff();if(!s||s.member.role!=='admin')throw new AuthError('仅当前公司管理员可查看员工列表',403);const page=Math.max(1,Math.floor(Number(input.page)||1)),pageSize=Math.min(50,Math.max(5,Math.floor(Number(input.pageSize)||20))),query=String(input.query||'').trim().slice(0,120),role=String(input.role||'').trim().slice(0,40),unitId=String(input.unitId||'').trim().slice(0,80),active=String(input.active||'').trim();const pattern=`%${query.replaceAll('%','\\%').replaceAll('_','\\_')}%`;const clauses=['m.tenant_id=?'],args:any[]=[s.tenant.id];if(query){clauses.push("(m.email LIKE ? ESCAPE '\\' OR m.role LIKE ? ESCAPE '\\' OR COALESCE(u.name,'') LIKE ? ESCAPE '\\')");args.push(pattern,pattern,pattern)}if(role){clauses.push('m.role=?');args.push(role)}if(unitId){clauses.push('m.unit_id=?');args.push(unitId)}if(active==='1'||active==='0'){clauses.push('m.active=?');args.push(Number(active))}const where=clauses.join(' AND ');const total=await db().prepare(`SELECT COUNT(*) AS count FROM team_members m LEFT JOIN team_units u ON u.id=m.unit_id WHERE ${where}`).bind(...args).first<{count:number}>();const rows=(await db().prepare(`SELECT m.id,m.email,m.role,m.unit_id,m.active,m.version FROM team_members m LEFT JOIN team_units u ON u.id=m.unit_id WHERE ${where} ORDER BY lower(m.email),m.id LIMIT ? OFFSET ?`).bind(...args,pageSize,(page-1)*pageSize).all()).results;return {items:rows,total:Number(total?.count||0),page,pageSize,pages:Math.max(1,Math.ceil(Number(total?.count||0)/pageSize))}}
const txt=(v:any,max=80)=>typeof v==='string'?v.trim().slice(0,max):'';
// Creating or promoting an administrator is itself high risk and requires a
// second administrator's approval; otherwise one admin could self-provision
// another admin and approve an emergency grant alone.
// Audit staff can read sensitive records and approve/inspect security events;
// provisioning or promoting them must use the same dual-control path as
// administrators and funding/KYC approvers.
const highRiskRoles=new Set<TeamRole>(Object.entries(roleCatalog).filter(([,v])=>v.highRisk).map(([k])=>k as TeamRole));
export async function requireMfaStepUp(s:any,code:unknown){
 if(isTestMode())return;
 if(!s.member.mfa_enabled||!s.member.mfa_secret)throw new AuthError('请先启用 MFA 后再执行此安全操作',403,undefined,'MFA_STEP_UP_REQUIRED');
 const secret=await revealMfaSecret(s.member.mfa_secret),result=await verifyTotpWithCounter(secret,txt(code,6));if(!result)throw new AuthError('请使用当前 MFA 验证码确认此安全操作',403,undefined,'MFA_STEP_UP_REQUIRED');const claimed=await db().prepare('UPDATE team_members SET mfa_last_counter=? WHERE id=? AND mfa_enabled=1 AND (mfa_last_counter IS NULL OR mfa_last_counter<?)').bind(result.counter,s.member.id,result.counter).run();if(claimed.meta.changes!==1)throw new AuthError('当前 MFA 验证码已使用，请等待下一个时间片',403,undefined,'MFA_STEP_UP_REQUIRED');
}
async function requireRoleApproval(s:any,role:TeamRole,approvalId:unknown){
 if(isTestMode()||!highRiskRoles.has(role))return;
 const id=txt(approvalId,80);if(!id)throw new AuthError('高风险岗位变更必须经过第二名管理员批准',403,undefined,'STAFF_DUAL_CONTROL_REQUIRED');
 const row=await db().prepare('SELECT requester_id,status,scope_json,expires_at FROM team_emergency_access WHERE id=? AND tenant_id=?').bind(id,s.tenant.id).first<any>();
 if(!row||row.status!=='active'||Number(row.expires_at)<=Date.now()||row.requester_id!==s.member.id)throw new AuthError('员工权限批准已失效或不属于当前管理员',403,undefined,'STAFF_DUAL_CONTROL_REQUIRED');
 let scope:string[]=[];try{scope=JSON.parse(row.scope_json)}catch{scope=[]}if(!scope.includes('staff'))throw new AuthError('批准范围不包含员工权限变更',403,undefined,'STAFF_DUAL_CONTROL_REQUIRED');
 return id;
}
export async function manage(p:any){const u=await identity();
 if(p.action==='platform_bootstrap_admin'){
  const operator=await platformAdmin();
  const company=txt(p.company,40).toLowerCase(),email=txt(p.email,254).toLowerCase();
  if(!/^[a-z0-9][a-z0-9-]{2,39}$/.test(company)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new AuthError('请填写有效的公司代码和管理员邮箱');
  const tenant=await db().prepare('SELECT id,slug FROM team_companies WHERE slug=? AND active=1').bind(company).first<any>();
  if(!tenant)throw new AuthError('公司代码无效',404,'COMPANY_NOT_FOUND');
  const existing=await db().prepare('SELECT id,active FROM team_members WHERE tenant_id=? AND lower(email)=?').bind(tenant.id,email).first<any>();
  if(existing)throw new AuthError(existing.active?'该邮箱已是当前公司的员工，请直接使用现有账号':'该邮箱曾属于当前公司，需先由管理员恢复或清理后再引导');
  const memberId=crypto.randomUUID(),expires=Date.now()+24*3600000,pendingUser=`pending:platform:${expires}:${crypto.randomUUID()}`,now=new Date().toISOString();
  await db().batch([
   db().prepare('INSERT INTO team_members (id,tenant_id,user_id,email,role,unit_id,active,version) VALUES (?,?,?,?,?,?,1,0)').bind(memberId,tenant.id,pendingUser,email,'admin',null),
   db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),tenant.id,operator.email,'platform_admin_bootstrap',JSON.stringify({memberId,email,expiresAt:new Date(expires).toISOString(),mode:'verified_sso'}),now)
  ]);
  return {ok:true,company:tenant.slug,email,expiresAt:expires};
 }
 if(p.action==='platform_update_company'){
  const operator=await platformAdmin(),id=txt(p.companyId,80),name=txt(p.name,120),reason=txt(p.reason,300);
  if(!id||!name||typeof p.active!=='boolean'||!reason)throw new AuthError('请填写公司名称、状态和变更原因');
  const company=await db().prepare('SELECT id,name,slug,active,client_en_enabled,client_km_enabled,client_zh_enabled FROM team_companies WHERE id=?').bind(id).first<any>();
  if(!company)throw new AuthError('公司不存在',404);
  const enabled={en:p.en!==false,km:p.km!==false,zh:p.zh!==false};if(!Object.values(enabled).some(Boolean))throw new AuthError('至少启用一种客户端语言');
  if(!p.active&&company.active){const row=await db().prepare('SELECT payload FROM demo_workspaces WHERE owner=?').bind(id).first<any>();let loans:any[]=[];try{loans=JSON.parse(row?.payload||'{}').loans||[]}catch{}if(loans.some(l=>['decision_pending','signed','active','overdue'].includes(l.status)))throw new AuthError('公司仍有进行中的贷款业务，不能停用');}
  await db().batch([db().prepare('UPDATE team_companies SET name=?,active=?,client_en_enabled=?,client_km_enabled=?,client_zh_enabled=? WHERE id=?').bind(name,p.active?1:0,enabled.en?1:0,enabled.km?1:0,enabled.zh?1:0,id),audit(id,operator.email,'platform_update_company',{before:company,after:{name,active:p.active,languages:enabled},reason})]);return {ok:true};
 }
 if(p.action==='create_company'){await platformAdmin();const name=txt(p.name),slug=txt(p.slug,40),enabled={en:p.en!==false,km:p.km!==false,zh:p.zh!==false};if(!name||! /^[a-z0-9][a-z0-9-]{2,39}$/.test(slug))throw new AuthError('请填写公司名称及 3–40 位小写字母/数字入口代码');if(!Object.values(enabled).some(Boolean))throw new AuthError('至少启用一种客户端语言');const id='t_'+crypto.randomUUID(),dept=crypto.randomUUID(),now=new Date().toISOString();await db().batch([db().prepare('INSERT INTO team_companies (id,name,slug,active,default_department,client_en_enabled,client_km_enabled,client_zh_enabled) VALUES (?,?,?,1,?,?,?,?)').bind(id,name,slug,dept,enabled.en?1:0,enabled.km?1:0,enabled.zh?1:0),db().prepare('INSERT INTO team_units (id,tenant_id,name,kind) VALUES (?,?,?,?)').bind(dept,id,'运营一部','department'),db().prepare('INSERT INTO team_members (id,tenant_id,user_id,email,role,active,version) VALUES (?,?,?,?,?,1,0)').bind(crypto.randomUUID(),id,u.userId,u.email.toLowerCase(),'admin'),db().prepare('INSERT INTO team_funding_settings(tenant_id,daily_cents,monthly_cents,warning_percent,timezone,version,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?)').bind(id,defaultFundingLimits.dailyCents,defaultFundingLimits.monthlyCents,defaultFundingLimits.warningPercent,defaultFundingLimits.timezone,0,now,u.userId),audit(id,u.userId,'create_company',{name,languages:enabled,fundingDefaults:defaultFundingLimits})]);return {companyId:id,languages:enabled}}
 const s=await staff(),mfaAction=['mfa_enroll_start','mfa_enroll_confirm','mfa_disable','mfa_recovery_generate'].includes(String(p.action));if(!s||(!mfaAction&&s.member.role!=='admin'))throw new AuthError('仅当前公司管理员可管理组织',403);if(s.mfaSetup&&!mfaAction)throw new AuthError('请先完成 MFA 设置后再进入后台',403,undefined,'MFA_SETUP_REQUIRED');const tenant=s.tenant.id;
 if(p.action==='mfa_enroll_start'){
  if((s.member as any).mfa_enabled)await requireMfaStepUp(s,p.code);
  const enrollment=await createMfaEnrollment();
  const changed=await db().prepare('UPDATE team_members SET pending_mfa_secret=?,mfa_enroll_started_at=?,version=version+1 WHERE id=? AND tenant_id=? AND active=1 AND version=?').bind(enrollment.protectedSecret,Date.now(),s.member.id,tenant,s.member.version).run();
  if(changed.meta.changes!==1)throw new AuthError('员工资料已变化，请刷新后重试',409);
  await db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),tenant,u.userId,'mfa_enroll_start',JSON.stringify({member:s.member.id,reverified:!!(s.member as any).mfa_enabled}),new Date().toISOString()).run();return {ok:true,mfa:{secret:enrollment.secret,uri:enrollment.uri}};
 }
 if(p.action==='mfa_enroll_confirm'){
  const row=await db().prepare('SELECT pending_mfa_secret,mfa_enabled,mfa_enroll_started_at,version FROM team_members WHERE id=? AND tenant_id=? AND active=1').bind(s.member.id,tenant).first<any>();if(!row?.pending_mfa_secret)throw new AuthError('请先开始 MFA 设置');if(row.mfa_enroll_started_at&&Number(row.mfa_enroll_started_at)+15*60*1000<Date.now())throw new AuthError('MFA 设置已过期，请重新开始',409);const secret=await revealMfaSecret(row.pending_mfa_secret);if(!await verifyTotp(secret,txt(p.code,6)))throw new AuthError('MFA 验证码不正确',400);const changed=await db().prepare('UPDATE team_members SET mfa_secret=pending_mfa_secret,pending_mfa_secret=NULL,mfa_enroll_started_at=NULL,mfa_enabled=1,version=version+1 WHERE id=? AND tenant_id=? AND version=?').bind(s.member.id,tenant,row.version).run();if(changed.meta.changes!==1)throw new AuthError('员工资料已变化，请刷新后重试',409);await db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),tenant,u.userId,'mfa_enabled',JSON.stringify({member:s.member.id}),new Date().toISOString()).run();return {ok:true};
 }
 if(p.action==='mfa_disable'){
  await requireMfaStepUp(s,p.code);if(!txt(p.reason,300))throw new AuthError('请填写关闭 MFA 的原因');await db().prepare('UPDATE team_members SET mfa_enabled=0,version=version+1 WHERE id=? AND tenant_id=? AND active=1 AND version=?').bind(s.member.id,tenant,s.member.version).run();await db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),tenant,u.userId,'mfa_disabled',JSON.stringify({member:s.member.id,reason:txt(p.reason,300)}),new Date().toISOString()).run();return {ok:true};
 }
 if(p.action==='mfa_recovery_generate'){
  await requireMfaStepUp(s,p.code);if(!(s.member as any).mfa_enabled)throw new AuthError('请先启用 MFA');const codes=await generateMfaRecoveryCodes(s.member.id);await db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),tenant,u.userId,'mfa_recovery_generate',JSON.stringify({member:s.member.id,count:codes.length}),new Date().toISOString()).run();return {ok:true,recoveryCodes:codes};
 }
 if(p.action==='client_language_config'){
  const enabled={en:p.en!==false,km:p.km!==false,zh:p.zh!==false};
  if(!enabled.en&&!enabled.km&&!enabled.zh)throw new AuthError('至少启用一种客户端语言');
  await db().batch([db().prepare('UPDATE team_companies SET client_en_enabled=?,client_km_enabled=?,client_zh_enabled=? WHERE id=?').bind(enabled.en?1:0,enabled.km?1:0,enabled.zh?1:0,tenant),audit(tenant,u.userId,'client_language_config',enabled)]);
  return {ok:true,languages:enabled};
 }
 if(p.action==='kyc_field_permission'){
  const memberId=txt(p.memberId,80),fieldGroup=txt(p.fieldGroup,40) as KycFieldGroup,reason=txt(p.reason,300);
  if(!memberId||!Object.hasOwn(kycFieldGroups,fieldGroup)||!reason||typeof p.enabled!=='boolean')throw new AuthError('请设置有效的 KYC 字段权限并填写原因');
  const target=await db().prepare("SELECT id,email,role,active FROM team_members WHERE id=? AND tenant_id=? AND role IN ('kyc','dept_admin')").bind(memberId,tenant).first<any>();
  if(!target||target.id===s.member.id)throw new AuthError('只能为本公司的 KYC 审核人员配置权限');
  const now=new Date().toISOString(),before=await db().prepare('SELECT active FROM team_kyc_field_permissions WHERE tenant_id=? AND member_id=? AND field_group=?').bind(tenant,memberId,fieldGroup).first<any>();
  await db().batch([db().prepare('INSERT INTO team_kyc_field_permissions (tenant_id,member_id,field_group,active,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(tenant_id,member_id,field_group) DO UPDATE SET active=excluded.active,updated_at=excluded.updated_at').bind(tenant,memberId,fieldGroup,p.enabled?1:0,now),audit(tenant,u.userId,'kyc_field_permission',{member:memberId,email:target.email,fieldGroup,before:before?.active===1,after:p.enabled,reason})]);
  return {ok:true};
 }
 if(p.action==='notification_template_save'){
  await requireMfaStepUp(s,p.code);
  const eventKey=txt(p.eventKey,60),locale=txt(p.locale,5),title=txt(p.title,120),body=txt(p.body,2000),reason=txt(p.reason,300);
  if(!/^[a-z][a-z0-9_.-]{1,59}$/.test(eventKey)||!['en','km','zh'].includes(locale)||!title||!body||!reason)throw new AuthError('请填写完整的通知模板、语言和变更原因');
  if(/\{\{\s*(?:outstanding_usd|amount|principal|fee|total)\s*\}\}/i.test(body))throw new AuthError('还款提醒模板不得包含金额字段',400,undefined,'NOTIFICATION_AMOUNT_FORBIDDEN');
  const old=await db().prepare('SELECT id,version,title,body,active FROM team_notification_templates WHERE tenant_id=? AND event_key=? AND locale=?').bind(tenant,eventKey,locale).first<any>();
  if(old&&p.version!==old.version)throw new AuthError('模板已被其他管理员更新，请刷新后重试',409);
  const now=new Date().toISOString(),id=old?.id||crypto.randomUUID(),version=(old?.version||0)+1,active=p.active===false?0:1;
  await db().batch([db().prepare('INSERT INTO team_notification_templates (id,tenant_id,event_key,locale,title,body,version,active,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,event_key,locale) DO UPDATE SET title=excluded.title,body=excluded.body,version=excluded.version,active=excluded.active,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(id,tenant,eventKey,locale,title,body,version,active,u.userId,now),audit(tenant,u.userId,'notification_template_save',{eventKey,locale,before:old?{title:old.title,body:old.body,active:old.active,version:old.version}:null,after:{title,body,active,version},reason})]);
  return {ok:true};
 }
 if(p.action==='pricing_save'){
  await requireMfaStepUp(s,p.code);
  const current=await pricingFor(tenant);if(p.version!==current.version)throw new AuthError('费率已更新，请刷新后重新设置',409);
  const next=validatePricing({feeModel:'single',version:current.version+1,deductionBps:p.deductionBps,annualInterestBps:p.annualInterestBps,interestTiming:p.interestTiming,serviceBps:p.serviceBps,serviceTiming:p.serviceTiming,termDays:p.termDays});
  const result=await db().batch([db().prepare("UPDATE team_companies SET pricing_json=? WHERE id=? AND pricing_json=? AND EXISTS (SELECT 1 FROM team_members WHERE id=? AND active=1 AND role='admin' AND version=?)").bind(JSON.stringify(next),tenant,s.tenant.pricing_json,s.member.id,s.member.version),db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),tenant,u.userId,'pricing_save',JSON.stringify({before:current,after:next}),new Date().toISOString())]);if(!result[0].meta.changes)throw new AuthError('权限或费率已变化，请刷新',409);return {ok:true}
 }
 if(p.action==='assignment_mode'){await requireMfaStepUp(s,p.code);const dept=p.departmentId||s.tenant.default_department;if(!await db().prepare("SELECT id FROM team_units WHERE tenant_id=? AND id=? AND kind='department' AND active=1").bind(tenant,dept).first())throw new AuthError('默认部门无效');await db().batch([db().prepare('UPDATE team_companies SET auto_assign=?,default_department=? WHERE id=?').bind(p.enabled?1:0,dept,tenant),audit(tenant,u.userId,'assignment_mode',{enabled:!!p.enabled,department:dept})]);return {ok:true}}
 if(p.action==='add_unit'){const name=txt(p.name);if(!['department','institution','postloan'].includes(p.kind)||!name)throw new AuthError('机构或部门信息无效');if(await db().prepare('SELECT id FROM team_units WHERE tenant_id=? AND kind=? AND lower(name)=lower(?)').bind(tenant,p.kind,name).first())throw new AuthError('同类型机构或部门名称已存在',409);const id=crypto.randomUUID();await db().batch([db().prepare('INSERT INTO team_units (id,tenant_id,name,kind,active) VALUES (?,?,?,?,1)').bind(id,tenant,name,p.kind),audit(tenant,u.userId,'add_unit',{id,name,kind:p.kind})]);return {ok:true,id}}
 if(p.action==='update_unit'){
  const id=txt(p.unitId,80),name=txt(p.name),reason=txt(p.reason,300);
  if(!id||!name||typeof p.active!=='boolean'||!reason)throw new AuthError('请填写机构或部门名称、状态和变更原因');
  const unit=await db().prepare('SELECT id,name,kind,active FROM team_units WHERE id=? AND tenant_id=?').bind(id,tenant).first<any>();
  if(!unit)throw new AuthError('机构或部门不存在',404);
  if(unit.kind==='postloan'&&id===`postloan:${tenant}`&&!p.active)throw new AuthError('系统默认贷后部门不能停用');
  if(unit.kind==='department'&&id===s.tenant.default_department&&!p.active)throw new AuthError('公司默认部门不能停用，请先切换默认部门');
  if(!p.active&&unit.active){
   const member=await db().prepare('SELECT id FROM team_members WHERE tenant_id=? AND unit_id=? AND active=1 LIMIT 1').bind(tenant,id).first();
   if(member)throw new AuthError('该机构或部门仍有启用员工，请先调整员工归属');
   const assignment=await db().prepare('SELECT customer_id FROM team_assignments WHERE tenant_id=? AND (department_id=? OR institution_id=? OR funding_institution_id=? OR repayment_institution_id=? OR collection_unit_id=?) LIMIT 1').bind(tenant,id,id,id,id,id).first();
   if(assignment)throw new AuthError('该机构或部门仍被业务分配使用，请先迁移业务');
   const route=await db().prepare('SELECT tenant_id FROM team_service_settings WHERE tenant_id=? AND (funding_id=? OR repayment_id=? OR collection_id=?)').bind(tenant,id,id,id).first();
   if(route)throw new AuthError('该机构或部门仍是承接路由，请先调整资金或贷后配置');
  }
  const duplicate=await db().prepare('SELECT id FROM team_units WHERE tenant_id=? AND kind=? AND lower(name)=lower(?) AND id<>?').bind(tenant,unit.kind,name,id).first();
  if(duplicate)throw new AuthError('同类型机构或部门名称已存在');
  await db().batch([db().prepare('UPDATE team_units SET name=?,active=? WHERE id=? AND tenant_id=?').bind(name,p.active?1:0,id,tenant),audit(tenant,u.userId,'update_unit',{id,kind:unit.kind,before:{name:unit.name,active:unit.active===1},after:{name,active:p.active},reason})]);
  return {ok:true};
 }
 if(p.action==='create_member'||p.action==='update_member'){
  const role=p.role as TeamRole,email=txt(p.email,254).toLowerCase();
  if(!Object.hasOwn(roleLabels,role))throw new AuthError('请选择有效岗位');
  let unitId:string|null=null;
  const kind=roleUnitKind(role);if(kind){const unit=await db().prepare('SELECT id FROM team_units WHERE tenant_id=? AND id=? AND kind=? AND active=1').bind(tenant,p.unitId||'',kind).first<any>();if(!unit)throw new AuthError('请选择当前公司的启用部门或机构');unitId=unit.id}
  const actorGuard="EXISTS (SELECT 1 FROM team_members actor WHERE actor.id=? AND actor.tenant_id=? AND actor.role='admin' AND actor.active=1 AND actor.version=?)";
  const actorArgs=[s.member.id,tenant,s.member.version];
  if(p.action==='create_member'){
   if(!/^\S+@\S+\.\S+$/.test(email))throw new AuthError('请填写有效的员工登录邮箱');
   if(await db().prepare('SELECT id FROM team_members WHERE tenant_id=? AND lower(email)=?').bind(tenant,email).first())throw new AuthError('该员工已存在，请直接修改其权限');
   await requireRoleApproval(s,role,p.emergencyId);
   if(p.passwordLogin===true&&!isTestMode())throw new AuthError('生产环境不能由管理员生成或查看员工密码，请发送邀请让员工本人设置密码',403,undefined,'PASSWORD_ADMIN_ISSUE_FORBIDDEN');
   const id=crypto.randomUUID(),password=p.passwordLogin===true?randomToken().slice(0,24):null,passwordHash=password?await makePassword(password):null,inviteToken=(password||isTestMode())?null:randomToken(),inviteHash=inviteToken?await digest(inviteToken):null,inviteExpiry=inviteToken?Date.now()+7*24*3600000:null;const results=await db().batch([db().prepare(`INSERT INTO team_members (id,tenant_id,user_id,email,role,unit_id,active,version) SELECT ?,?,?,?,?,?,1,0 WHERE ${actorGuard}`).bind(id,tenant,password?'local:'+id:'pending:'+crypto.randomUUID(),email,role,unitId,...actorArgs),...(passwordHash?[db().prepare('INSERT INTO team_staff_credentials (member_id,password_hash) SELECT id,? FROM team_members WHERE id=?').bind(passwordHash,id)]:[]),...(inviteHash?[db().prepare('INSERT INTO team_invites (token_hash,tenant_id,email,role,unit_id,issuer,expires_at,used) SELECT ?,?,?,?,?,?,?,0 WHERE EXISTS (SELECT 1 FROM team_members WHERE id=? AND tenant_id=? AND active=1)').bind(inviteHash,tenant,email,role,unitId,s.member.id,inviteExpiry,id,tenant)]:[]),db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),tenant,u.userId,'create_member',JSON.stringify({member:id,email,role,unitId,invited:!!inviteToken}),new Date().toISOString())]);if(!results[0].meta.changes)throw new AuthError('管理权限已变化，请刷新',409);return {ok:true,...(password?{loginDetails:{company:s.tenant.slug,email,password}}:{inviteDetails:{company:s.tenant.slug,email,expiresAt:inviteExpiry,inviteToken}})}
  }
  const m=await db().prepare('SELECT * FROM team_members WHERE id=? AND tenant_id=?').bind(p.memberId,tenant).first<Member>();
  if(!m||m.id===s.member.id)throw new AuthError('不能修改自己的管理权限');
  if(p.version!==m.version)throw new AuthError('员工权限已变化，请刷新后重试',409);
  if(role!==m.role)await requireRoleApproval(s,role,p.emergencyId);
  if(typeof p.active!=='boolean'||!txt(p.reason,300))throw new AuthError('请设置启停状态并填写变更原因');
  const active=p.active?1:0;
  const guard=`id=? AND tenant_id=? AND version=? AND ${actorGuard}`;
  const args=[m.id,tenant,m.version,...actorArgs];
  const statements=[];
  const permissionChanged=!active||role!==m.role||unitId!==m.unit_id;
  const restoring=m.active===0&&active===1;
  if(permissionChanged)statements.push(db().prepare(`UPDATE team_assignments SET reviewer_id=NULL,version=version+1 WHERE tenant_id=? AND reviewer_id=? AND EXISTS (SELECT 1 FROM team_members WHERE ${guard})`).bind(tenant,m.id,...args));
  // A role, scope, or status change must revoke every existing session. The
  // member-version check already blocks stale sessions, but deleting them here
  // makes revocation immediate and prevents disabled-account session buildup.
  if(permissionChanged)statements.push(db().prepare('DELETE FROM team_staff_sessions WHERE member_id=?').bind(m.id));
  if(!active)statements.push(db().prepare('DELETE FROM team_invites WHERE tenant_id=? AND lower(email)=lower(?) AND used=0').bind(tenant,m.email));
  const memberUpdate=restoring
   ? `UPDATE team_members SET role=?,unit_id=?,active=?,mfa_enabled=0,mfa_secret=NULL,pending_mfa_secret=NULL,mfa_enroll_started_at=NULL,version=version+1 WHERE ${guard}`
   : `UPDATE team_members SET role=?,unit_id=?,active=?,version=version+1 WHERE ${guard}`;
  statements.push(db().prepare(memberUpdate).bind(role,unitId,active,...args));
  statements.push(db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),tenant,u.userId,'update_member',JSON.stringify({member:m.id,before:{role:m.role,unitId:m.unit_id,active:m.active,mfaEnabled:!!(m as any).mfa_enabled},after:{role,unitId,active,mfaEnabled:restoring?false:!!(m as any).mfa_enabled},restored:restoring,reason:txt(p.reason,300)}),new Date().toISOString()));
  const results=await db().batch(statements);if(!results[results.length-2].meta.changes)throw new AuthError('管理权限或员工资料已变化，请刷新',409);return {ok:true}
 }
 if(p.action==='reset_member_password'){
 const memberId=txt(p.memberId,80),reason=txt(p.reason,300);
  if(!memberId||!reason)throw new AuthError('请填写重置原因');
  if(!isTestMode())throw new AuthError('生产环境不允许管理员读取或设置员工密码，请使用员工自助邀请流程',403,undefined,'PASSWORD_ADMIN_RESET_FORBIDDEN');
  const m=await db().prepare('SELECT id,tenant_id,email,active FROM team_members WHERE id=? AND tenant_id=?').bind(memberId,tenant).first<any>();
  if(!m||m.id===s.member.id)throw new AuthError('不能重置自己的密码');
  if(!m.active)throw new AuthError('已停用员工不能重置密码');
  const password=randomToken().slice(0,24),passwordHash=await makePassword(password);
  const results=await db().batch([
   db().prepare(`UPDATE team_staff_credentials SET password_hash=?,version=version+1 WHERE member_id=? AND EXISTS (SELECT 1 FROM team_members WHERE id=? AND tenant_id=? AND active=1 AND EXISTS (SELECT 1 FROM team_members actor WHERE actor.id=? AND actor.tenant_id=? AND actor.role='admin' AND actor.active=1 AND actor.version=?))`).bind(passwordHash,m.id,m.id,tenant,s.member.id,tenant,s.member.version),
   db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),tenant,u.userId,'reset_member_password',JSON.stringify({member:m.id,email:m.email,reason}),new Date().toISOString())
  ]);
  if(!results[0].meta.changes)throw new AuthError('员工密码记录不存在或权限已变化，请刷新后重试',409);
  return {ok:true,loginDetails:{company:s.tenant.slug,email:m.email,password},passwordReset:true};
 }
 if(p.action==='revoke_member_sessions'){
  const memberId=txt(p.memberId,80),reason=txt(p.reason,300);
  if(!memberId||!reason)throw new AuthError('请填写撤销会话原因');
  const m=await db().prepare('SELECT id,tenant_id,email,active FROM team_members WHERE id=? AND tenant_id=?').bind(memberId,tenant).first<any>();
  if(!m||m.id===s.member.id)throw new AuthError('不能撤销自己的会话');
  if(!m.active)throw new AuthError('已停用员工无需单独撤销会话');
  const result=await db().prepare('DELETE FROM team_staff_sessions WHERE member_id=? AND EXISTS (SELECT 1 FROM team_members actor WHERE actor.id=? AND actor.tenant_id=? AND actor.role=\'admin\' AND actor.active=1 AND actor.version=?)').bind(m.id,s.member.id,tenant,s.member.version).run();
  await db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),tenant,u.userId,'revoke_member_sessions',JSON.stringify({member:m.id,email:m.email,revoked:result.meta.changes,reason}),new Date().toISOString()).run();
  return {ok:true,revokedSessions:result.meta.changes};
 }
 throw new AuthError('操作无效');
}
