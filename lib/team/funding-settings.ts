import {AuthError} from '@/lib/h5-auth-core';
import {defaultFundingLimits} from '@/lib/funding-limits';
import {db,staff,AUDIT_SEQ_SQL} from './server';

const roles=new Set(['admin','audit','finance','finance_checker','checker']);
const integer=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0?value:null;

export async function fundingSettingsForTenant(tenantId:string){
  const row=await db().prepare('SELECT daily_cents,monthly_cents,warning_percent,timezone,version,updated_at,updated_by FROM team_funding_settings WHERE tenant_id=?').bind(tenantId).first<any>();
  return {
    dailyCents:integer(row?.daily_cents)??defaultFundingLimits.dailyCents,
    monthlyCents:integer(row?.monthly_cents)??defaultFundingLimits.monthlyCents,
    warningPercent:typeof row?.warning_percent==='number'&&row.warning_percent>0&&row.warning_percent<100?row.warning_percent:defaultFundingLimits.warningPercent,
    timezone:typeof row?.timezone==='string'&&row.timezone?row.timezone:defaultFundingLimits.timezone,
    version:Number(row?.version??0),updatedAt:row?.updated_at??null,updatedBy:row?.updated_by??null,
  };
}

export async function fundingSettingsData(){
  const s=await staff();
  if(!s||!roles.has(s.member.role))throw new AuthError('当前岗位无权查看资金配置',403,undefined,'FUNDING_SETTINGS_FORBIDDEN');
  return {settings:await fundingSettingsForTenant(s.tenant.id),editable:s.member.role==='admin'};
}

export async function fundingSettingsSave(input:any){
  const s=await staff();
  if(!s||s.member.role!=='admin')throw new AuthError('仅公司 Admin 可修改资金配置',403,undefined,'FUNDING_SETTINGS_FORBIDDEN');
  const dailyCents=integer(input?.dailyCents),monthlyCents=integer(input?.monthlyCents),warningPercent=typeof input?.warningPercent==='number'&&Number.isInteger(input.warningPercent)&&input.warningPercent>0&&input.warningPercent<100?input.warningPercent:null;
  if(!dailyCents||!monthlyCents||!warningPercent||monthlyCents<dailyCents)throw new AuthError('资金限额和预警比例必须为有效正整数，月限额不得低于日限额',400,undefined,'FUNDING_SETTINGS_INVALID');
  if(dailyCents>100_000_000||monthlyCents>300_000_000)throw new AuthError('资金限额超过系统安全上限',400,undefined,'FUNDING_SETTINGS_INVALID');
  const current=await fundingSettingsForTenant(s.tenant.id),version=Number(input?.version);
  if(!Number.isInteger(version)||version!==current.version)throw new AuthError('资金配置已变化，请刷新后重试',409,undefined,'FUNDING_SETTINGS_CONFLICT');
  const next={dailyCents,monthlyCents,warningPercent,timezone:defaultFundingLimits.timezone,version:version+1};
  const now=new Date().toISOString();
  const result=await db().batch([
    db().prepare('INSERT INTO team_funding_settings(tenant_id,daily_cents,monthly_cents,warning_percent,timezone,version,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id) DO UPDATE SET daily_cents=excluded.daily_cents,monthly_cents=excluded.monthly_cents,warning_percent=excluded.warning_percent,timezone=excluded.timezone,version=excluded.version,updated_at=excluded.updated_at,updated_by=excluded.updated_by WHERE team_funding_settings.version=? AND EXISTS(SELECT 1 FROM team_members WHERE id=? AND tenant_id=? AND role=\'admin\' AND active=1 AND version=?)').bind(s.tenant.id,dailyCents,monthlyCents,warningPercent,next.timezone,next.version,now,s.user.userId,version,s.member.id,s.tenant.id,s.member.version),
    db().prepare('INSERT INTO team_audit(id,seq,tenant_id,actor,action,detail,created_at) SELECT ?,'+AUDIT_SEQ_SQL+',?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),s.tenant.id,s.user.userId,'funding_settings_save',JSON.stringify({before:current,after:next}),now),
  ]);
  if(result[0].meta.changes!==1)throw new AuthError('资金配置或权限已变化，请刷新后重试',409,undefined,'FUNDING_SETTINGS_CONFLICT');
  return {ok:true,settings:await fundingSettingsForTenant(s.tenant.id)};
}
