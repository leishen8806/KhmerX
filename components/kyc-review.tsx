'use client';
import {useI18n} from '@/lib/i18n';
import type {Locale} from '@/lib/i18n';
import {kycText,kycDate} from '@/lib/kyc/ui-copy';
import {fields,sections,statusLabels,completeness} from '@/lib/kyc/core';
import {KycMaterialViewer} from '@/components/kyc-material-viewer';
import type {RecordView} from '@/app/kyc/client';
import './kyc-review.css';

type Props={record:RecordView;locale?:Locale;checks:Record<string,boolean>;reason:string;decision:string;busy:boolean;error?:string;message?:string;onCheck:(id:string,value:boolean)=>void;onReason:(value:string)=>void;onDecision:(value:string)=>void;onDecide:()=>void;onAmend:()=>void};
export function KycReview({record,locale:reviewLocale,checks,reason,decision,busy,error,message,onCheck,onReason,onDecision,onDecide,onAmend}:Props){
 const context=useI18n(),locale=reviewLocale||context.locale,t=(s:string)=>kycText(s,locale),p=record.profile;
 const mayReview=record.canReview!==false,mayDecide=mayReview&&record.status==='submitted';
 const score=completeness(p,record.phoneVerified);
 return <main className="kyc-review-workspace" lang={locale}><header><a href="/team/kyc">{t('返回业务工作台')}</a><h1>{t('KYC 人工审核')}</h1><p>{t(statusLabels[record.status])} · {t('版本')} {record.revision} · {record.id}</p></header>
  <p className="notice">{t('身份证核验、活体检测与 KESS 尚未接入。当前完成的是人工资料审核，贷款放款仍使用测试资金。')}</p>
  {!record.phoneVerified&&<p className="notice">{t('模拟会话，未完成真实手机号验证')}</p>}
  {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status">{message}</p>}
  {record.review&&<div className="sample"><strong>{t('最近审核意见 ·')}{t(statusLabels[record.review.decision as keyof typeof statusLabels]||record.review.decision)}</strong><p>{record.review.reason}</p><small>{kycDate(record.review.at,locale)}</small></div>}
  <nav className="kyc-review-index" aria-label="KYC review sections">{sections.map(s=><a key={s.id} href={'#kyc-review-'+s.id}>{t(s.label)}</a>)}</nav>
  <div className="kyc-review-columns"><div className="kyc-review-cards">{sections.map(s=><details className="kyc-review-card" open id={'kyc-review-'+s.id} key={s.id}><summary>{t(s.label)}</summary>
   <label className="kyc-review-check"><input type="checkbox" checked={checks[s.id]===true} disabled={busy||!mayDecide} onChange={e=>onCheck(s.id,e.target.checked)}/>{t(decision==='needs_info'?'要求补充：':'已核对')} {t(s.label)}</label>
   <dl>{fields.filter(f=>f.section===s.id).map(f=>{const value=p.values[f.id];return <div key={f.id}><dt>{t(f.label)}</dt><dd>{value?(f.options?.find(o=>o.value===value)?t(f.options.find(o=>o.value===value)!.label):value):t('未提供')}</dd></div>})}</dl>
   {s.id==='consent'&&<><p>{t('资料审核授权：')}{t(p.consent?'已确认':'未确认')} · {p.declarationVersion}</p><p>{t('定位：')}{p.location?`${p.location.lat}, ${p.location.lon} ±${p.location.accuracy}m`:t('未授权或未提供')}</p></>}
  </details>)}</div>
  <aside className="kyc-review-aside"><KycMaterialViewer profile={p} locale={locale}/><section className="kyc-review-panel kyc-review-decision"><h2>{t('人工审核决定')}</h2>{mayDecide?<><p>{t(decision==='needs_info'?'勾选需要客户补充的页面，客户重新进入时会直接定位到第一项。':'请逐项打开材料核对。勾选仅记录人工核对，不代表已完成外部实名、活体或银行验证。')}</p>
   <label>{t('处理结果')}<select value={decision} disabled={busy} onChange={e=>onDecision(e.target.value)}>{!record.approvalOnly&&<option value="needs_info">{t('退回补件')}</option>}<option value="approved">{t('人工资料审核通过')}</option>{!record.approvalOnly&&<option value="rejected">{t('资料审核未通过')}</option>}</select></label>
   <label>{t('审核意见 / 补件原因')}<textarea value={reason} maxLength={1000} disabled={busy} onChange={e=>onReason(e.target.value)}/></label>
   <button type="button" data-action="decide" disabled={busy||!reason.trim()||(decision==='approved'&&sections.some(s=>!checks[s.id]))} onClick={onDecide}>{t(decision==='approved'?'确认审核通过':'确认记录审核结果')}</button>
  </>:<p>{t(statusLabels[record.status])}</p>}
  {mayReview&&!record.approvalOnly&&['submitted','needs_info'].includes(record.status)&&<button type="button" data-action="amend" disabled={busy} onClick={onAmend}>{t('代客户修改资料')}</button>}
  </section><section className="kyc-review-panel"><h2>{t('资料完整度')}</h2><p>{t('基础资料')} {score.base}/120 · {t('附加材料')} {score.additional}/85</p><details><summary>{t('逐项权重与来源')}</summary>{score.rows.map(r=><p key={r.source+r.label}>{t(r.label)} {r.points}/{r.maximum} · {r.source}</p>)}</details></section>
  {record.history&&<section className="kyc-review-panel"><h2>{t('版本与操作记录')}</h2>{record.history.map(h=><p key={h.revision}>{t('版本')} {h.revision} · {h.action} · {kycDate(h.created_at,locale)}{h.review&&<span> · {h.review.reason} · {h.actor}</span>}</p>)}</section>}
  </aside></div></main>;
}
