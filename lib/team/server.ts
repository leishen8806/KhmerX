import {staffIdentity,STAFF_COMPANY,value,makePassword} from './auth';
import {fillServiceAssignments} from './servicing';
import {defaultPricing,validatePricing,normalizePricing,type Pricing} from '@/lib/pricing';
import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';
import {AuthError,randomToken} from '@/lib/h5-auth-core';
import {canSee,roleLabels,kycFieldGroups,type Member,type Assignment,type TeamRole,type KycFieldGroup} from './policy';
export const TEAM_COOKIE=STAFF_COMPANY;
export const CUSTOMER_COMPANY_COOKIE='payease_company';
export const db=()=>{if(!env.DB)throw new AuthError('公司数据库暂不可用',503);return env.DB};
export async function identity(){const u=await staffIdentity();if(u.staffTenantId)return u;await db().prepare(`UPDATE team_members SET user_id=?,version=version+1 WHERE lower(email)=? AND user_id LIKE 'pending:%' AND active=1 AND NOT EXISTS (SELECT 1 FROM team_members existing WHERE existing.tenant_id=team_members.tenant_id AND existing.user_id=?)`).bind(u.userId,u.email.toLowerCase(),u.userId).run();return u}
async function companyByCookie(customerOnly=false){const raw=(await headers()).get('cookie');const v=customerOnly?value(raw,CUSTOMER_COMPANY_COOKIE):(value(raw,TEAM_COOKIE)??value(raw,CUSTOMER_COMPANY_COOKIE));if(!v||v==='none')return null;if(!/^t_[a-f0-9-]{36}$/.test(v))throw new AuthError('公司工作区无效',403);const t=await db().prepare('SELECT * FROM team_companies WHERE id=? AND active=1').bind(v).first<any>();if(!t)throw new AuthError('公司已停用或不可访问',403);return t}
export const selectedCompany=()=>companyByCookie();
export const customerCompany=()=>companyByCookie(true);
export async function staff(){const u=await identity(),t=await selectedCompany();if(!t){if(u.staffTenantId)throw new AuthError('请选择员工所属公司',403);return null}if(u.staffTenantId&&u.staffTenantId!==t.id)throw new AuthError('当前账号没有此公司的员工权限',403);const m=await db().prepare('SELECT * FROM team_members WHERE tenant_id=? AND user_id=? AND active=1').bind(t.id,u.userId).first<Member>();if(!m)throw new AuthError('当前账号没有此公司的员工权限，请前往公司工作区',403);return {tenant:t,member:m,user:u}}
export async function pricingFor(owner:string):Promise<Pricing>{if(!owner.startsWith('t_'))return {...defaultPricing};const row=await db().prepare('SELECT pricing_json FROM team_companies WHERE id=? AND active=1').bind(owner).first<{pricing_json:string}>();if(!row)throw new AuthError('公司不可用',403);return row.pricing_json?normalizePricing(JSON.parse(row.pricing_json)):{...defaultPricing}}
export async function assignments(tenant:string){return (await db().prepare('SELECT * FROM team_assignments WHERE tenant_id=?').bind(tenant).all<Assignment>()).results}
export async function assignment(tenant:string,customer:string){return await db().prepare('SELECT * FROM team_assignments WHERE tenant_id=? AND customer_id=?').bind(tenant,customer).first<Assignment>()}
export async function ensureAssignment(tenant:string,customer:string){if(!tenant.startsWith('t_'))return;const t=await db().prepare('SELECT * FROM team_companies WHERE id=? AND active=1').bind(tenant).first<any>();if(!t)throw new AuthError('公司不可访问',403);await db().batch([db().prepare(`INSERT OR IGNORE INTO team_assignments (tenant_id,customer_id,department_id,reviewer_id,institution_id,version) SELECT ?,?,?,CASE WHEN ?=1 THEN (SELECT m.id FROM team_members m WHERE m.tenant_id=? AND m.unit_id=? AND m.role='kyc' AND m.active=1 ORDER BY (SELECT COUNT(*) FROM team_assignments a LEFT JOIN kyc_cases k ON k.owner=a.tenant_id AND k.customer_id=a.customer_id WHERE a.reviewer_id=m.id AND (k.status IS NULL OR k.status IN ('draft','submitted','needs_info'))) ASC,m.id LIMIT 1) ELSE NULL END,CASE WHEN ?=1 THEN (SELECT u.id FROM team_units u WHERE u.tenant_id=? AND u.kind='institution' AND EXISTS (SELECT 1 FROM team_members m WHERE m.unit_id=u.id AND m.role='lender' AND m.active=1) ORDER BY (SELECT COUNT(*) FROM team_assignments a WHERE a.institution_id=u.id),u.id LIMIT 1) ELSE NULL END,0`).bind(tenant,customer,t.default_department,t.auto_assign,tenant,t.default_department,t.auto_assign,tenant),db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),tenant,'system',t.auto_assign?'auto_assign':'queue_unassigned',JSON.stringify({customer}),new Date().toISOString())]);await fillServiceAssignments(tenant)}
export async function guardKyc(tenant:string,customer:string,write=false){const s=await staff();if(!s||s.tenant.id!==tenant||!canSee(s.member,await assignment(tenant,customer)||undefined,'kyc')||(write&&!['admin','kyc'].includes(s.member.role)))throw new AuthError('无权访问或审核这份资料',403);return s}
export async function platformAdmin(){const u=await identity(),allowed=((env as any).KYC_REVIEWER_EMAILS||'').split(',').map((x:string)=>x.trim().toLowerCase());if(u.staffTenantId||!allowed.includes(u.email.toLowerCase()))throw new AuthError('仅平台管理员可创建公司',403);return u}
export function audit(tenant:string,actor:string,action:string,detail:unknown){return db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),tenant,actor,action,JSON.stringify(detail),new Date().toISOString())}
export async function liveMember(m:Member){return !!await db().prepare('SELECT id FROM team_members WHERE id=? AND tenant_id=? AND user_id=? AND version=? AND active=1').bind(m.id,m.tenant_id,m.user_id,m.version).first()}
export async function teamData(){const u=await identity(),t=await selectedCompany();const memberships=(await db().prepare('SELECT m.tenant_id,m.role,c.name,c.slug FROM team_members m JOIN team_companies c ON c.id=m.tenant_id WHERE m.user_id=? AND m.active=1 AND c.active=1 AND (? IS NULL OR m.tenant_id=?)').bind(u.userId,u.staffTenantId,u.staffTenantId).all()).results;let platform=false;try{await platformAdmin();platform=true}catch{}if(!t)return {user:{email:u.email},platform,memberships,company:null};let s;try{s=await staff()}catch{return {user:{email:u.email},platform,memberships,company:null,customerCompany:{name:t.name,slug:t.slug}}}if(!s)throw new AuthError('请先选择公司',403);await db().prepare('INSERT OR IGNORE INTO team_units (id,tenant_id,name,kind) VALUES (?,?,?,?)').bind('postloan:'+t.id,t.id,'运营贷后部','postloan').run();const units=(await db().prepare('SELECT id,name,kind FROM team_units WHERE tenant_id=?').bind(t.id).all()).results;const members=['admin','dept_admin'].includes(s.member.role)?(await db().prepare('SELECT id,email,role,unit_id,active,version FROM team_members WHERE tenant_id=? AND (? IS NULL OR unit_id=?)').bind(t.id,s.member.role==='admin'?null:s.member.unit_id,s.member.unit_id).all()).results:[];const permissionRows=members.length?(await db().prepare('SELECT member_id,field_group FROM team_kyc_field_permissions WHERE tenant_id=? AND active=1').bind(t.id).all()).results:[];const permissionsByMember=new Map<string,string[]>();for(const row of permissionRows as any[]){const list=permissionsByMember.get(row.member_id)||[];list.push(row.field_group);permissionsByMember.set(row.member_id,list)}for(const member of members as any[])member.kycFieldPermissions=permissionsByMember.get(member.id)||[];const trail=['admin','audit'].includes(s.member.role)?(await db().prepare('SELECT actor,action,detail,created_at FROM team_audit WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100').bind(t.id).all()).results:[];return {user:{email:u.email},platform,memberships,company:t,pricing:await pricingFor(t.id),member:s.member,units,members,kycFieldGroups,trail}}
const txt=(v:any,max=80)=>typeof v==='string'?v.trim().slice(0,max):'';
export async function manage(p:any){const u=await identity();
 if(p.action==='create_company'){await platformAdmin();const name=txt(p.name),slug=txt(p.slug,40),enabled={en:p.en!==false,km:p.km!==false,zh:p.zh!==false};if(!name||! /^[a-z0-9][a-z0-9-]{2,39}$/.test(slug))throw new AuthError('请填写公司名称及 3–40 位小写字母/数字入口代码');if(!Object.values(enabled).some(Boolean))throw new AuthError('至少启用一种客户端语言');const id='t_'+crypto.randomUUID(),dept=crypto.randomUUID();await db().batch([db().prepare('INSERT INTO team_companies (id,name,slug,active,default_department,client_en_enabled,client_km_enabled,client_zh_enabled) VALUES (?,?,?,1,?,?,?,?)').bind(id,name,slug,dept,enabled.en?1:0,enabled.km?1:0,enabled.zh?1:0),db().prepare('INSERT INTO team_units (id,tenant_id,name,kind) VALUES (?,?,?,?)').bind(dept,id,'运营一部','department'),db().prepare('INSERT INTO team_members (id,tenant_id,user_id,email,role,active,version) VALUES (?,?,?,?,?,1,0)').bind(crypto.randomUUID(),id,u.userId,u.email.toLowerCase(),'admin'),audit(id,u.userId,'create_company',{name,languages:enabled})]);return {companyId:id,languages:enabled}}
 const s=await staff();if(!s||s.member.role!=='admin')throw new AuthError('仅当前公司管理员可管理组织',403);const tenant=s.tenant.id;
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
  const eventKey=txt(p.eventKey,60),locale=txt(p.locale,5),title=txt(p.title,120),body=txt(p.body,2000),reason=txt(p.reason,300);
  if(!/^[a-z][a-z0-9_.-]{1,59}$/.test(eventKey)||!['en','km','zh'].includes(locale)||!title||!body||!reason)throw new AuthError('请填写完整的通知模板、语言和变更原因');
  const old=await db().prepare('SELECT id,version,title,body,active FROM team_notification_templates WHERE tenant_id=? AND event_key=? AND locale=?').bind(tenant,eventKey,locale).first<any>();
  if(old&&p.version!==old.version)throw new AuthError('模板已被其他管理员更新，请刷新后重试',409);
  const now=new Date().toISOString(),id=old?.id||crypto.randomUUID(),version=(old?.version||0)+1,active=p.active===false?0:1;
  await db().batch([db().prepare('INSERT INTO team_notification_templates (id,tenant_id,event_key,locale,title,body,version,active,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,event_key,locale) DO UPDATE SET title=excluded.title,body=excluded.body,version=excluded.version,active=excluded.active,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(id,tenant,eventKey,locale,title,body,version,active,u.userId,now),audit(tenant,u.userId,'notification_template_save',{eventKey,locale,before:old?{title:old.title,body:old.body,active:old.active,version:old.version}:null,after:{title,body,active,version},reason})]);
  return {ok:true};
 }
 if(p.action==='pricing_save'){
  const current=await pricingFor(tenant);if(p.version!==current.version)throw new AuthError('费率已更新，请刷新后重新设置',409);
  const next=validatePricing({feeModel:'single',version:current.version+1,deductionBps:p.deductionBps,annualInterestBps:p.annualInterestBps,interestTiming:p.interestTiming,serviceBps:p.serviceBps,serviceTiming:p.serviceTiming,termDays:p.termDays});
  const result=await db().batch([db().prepare("UPDATE team_companies SET pricing_json=? WHERE id=? AND pricing_json=? AND EXISTS (SELECT 1 FROM team_members WHERE id=? AND active=1 AND role='admin' AND version=?)").bind(JSON.stringify(next),tenant,s.tenant.pricing_json,s.member.id,s.member.version),db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),tenant,u.userId,'pricing_save',JSON.stringify({before:current,after:next}),new Date().toISOString())]);if(!result[0].meta.changes)throw new AuthError('权限或费率已变化，请刷新',409);return {ok:true}
 }
 if(p.action==='assignment_mode'){const dept=p.departmentId||s.tenant.default_department;if(!await db().prepare("SELECT id FROM team_units WHERE tenant_id=? AND id=? AND kind='department'").bind(tenant,dept).first())throw new AuthError('默认部门无效');await db().batch([db().prepare('UPDATE team_companies SET auto_assign=?,default_department=? WHERE id=?').bind(p.enabled?1:0,dept,tenant),audit(tenant,u.userId,'assignment_mode',{enabled:!!p.enabled,department:dept})]);return {ok:true}}
 if(p.action==='add_unit'){if(!['department','institution','postloan'].includes(p.kind)||!txt(p.name))throw new AuthError('机构或部门信息无效');const id=crypto.randomUUID();await db().batch([db().prepare('INSERT INTO team_units (id,tenant_id,name,kind) VALUES (?,?,?,?)').bind(id,tenant,txt(p.name),p.kind),audit(tenant,u.userId,'add_unit',{id,name:txt(p.name),kind:p.kind})]);return {ok:true}}
 if(p.action==='create_member'||p.action==='update_member'){
  const role=p.role as TeamRole,email=txt(p.email,254).toLowerCase();
  if(!Object.hasOwn(roleLabels,role))throw new AuthError('请选择有效岗位');
  let unitId:string|null=null;
  if(!['admin','audit'].includes(role)){const kind=['collection_admin','collector'].includes(role)?'postloan':['ops','kyc','dept_admin'].includes(role)?'department':'institution';const unit=await db().prepare('SELECT id FROM team_units WHERE tenant_id=? AND id=? AND kind=?').bind(tenant,p.unitId||'',kind).first<any>();if(!unit)throw new AuthError('请选择当前公司的对应部门或机构');unitId=unit.id}
  const actorGuard="EXISTS (SELECT 1 FROM team_members actor WHERE actor.id=? AND actor.tenant_id=? AND actor.role='admin' AND actor.active=1 AND actor.version=?)";
  const actorArgs=[s.member.id,tenant,s.member.version];
  if(p.action==='create_member'){
   if(!/^\S+@\S+\.\S+$/.test(email))throw new AuthError('请填写有效的员工登录邮箱');
   if(await db().prepare('SELECT id FROM team_members WHERE tenant_id=? AND lower(email)=?').bind(tenant,email).first())throw new AuthError('该员工已存在，请直接修改其权限');
   const id=crypto.randomUUID(),password=p.passwordLogin===true?randomToken().slice(0,24):null,passwordHash=password?await makePassword(password):null;const results=await db().batch([db().prepare(`INSERT INTO team_members (id,tenant_id,user_id,email,role,unit_id,active,version) SELECT ?,?,?,?,?,?,1,0 WHERE ${actorGuard}`).bind(id,tenant,password?'local:'+id:'pending:'+crypto.randomUUID(),email,role,unitId,...actorArgs),...(passwordHash?[db().prepare('INSERT INTO team_staff_credentials (member_id,password_hash) SELECT id,? FROM team_members WHERE id=?').bind(passwordHash,id)]:[]),db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),tenant,u.userId,'create_member',JSON.stringify({member:id,email,role,unitId}),new Date().toISOString())]);if(!results[0].meta.changes)throw new AuthError('管理权限已变化，请刷新',409);return {ok:true,...(password?{loginDetails:{company:s.tenant.slug,email,password}}:{})}
  }
  const m=await db().prepare('SELECT * FROM team_members WHERE id=? AND tenant_id=?').bind(p.memberId,tenant).first<Member>();
  if(!m||m.id===s.member.id)throw new AuthError('不能修改自己的管理权限');
  if(p.version!==m.version)throw new AuthError('员工权限已变化，请刷新后重试',409);
  if(typeof p.active!=='boolean'||!txt(p.reason,300))throw new AuthError('请设置启停状态并填写变更原因');
  const active=p.active?1:0;
  const guard=`id=? AND tenant_id=? AND version=? AND ${actorGuard}`;
  const args=[m.id,tenant,m.version,...actorArgs];
  const statements=[];
  if(!active||role!==m.role||unitId!==m.unit_id)statements.push(db().prepare(`UPDATE team_assignments SET reviewer_id=NULL,version=version+1 WHERE tenant_id=? AND reviewer_id=? AND EXISTS (SELECT 1 FROM team_members WHERE ${guard})`).bind(tenant,m.id,...args));
  statements.push(db().prepare(`UPDATE team_members SET role=?,unit_id=?,active=?,version=version+1 WHERE ${guard}`).bind(role,unitId,active,...args));
  statements.push(db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),tenant,u.userId,'update_member',JSON.stringify({member:m.id,before:{role:m.role,unitId:m.unit_id,active:m.active},after:{role,unitId,active},reason:txt(p.reason,300)}),new Date().toISOString()));
  const results=await db().batch(statements);if(!results[results.length-2].meta.changes)throw new AuthError('管理权限或员工资料已变化，请刷新',409);return {ok:true}
 }
 if(p.action==='reset_member_password'){
  const memberId=txt(p.memberId,80),reason=txt(p.reason,300);
  if(!memberId||!reason)throw new AuthError('请填写重置原因');
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
