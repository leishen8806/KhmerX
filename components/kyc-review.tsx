'use client';
import {useState} from 'react';
import {ReviewChanges,changesText} from '@/components/kyc-review-changes';
import {changedSections,type ReviewDiff} from '@/lib/kyc/review-changes-ui';
import {SensitiveValue} from '@/components/kyc-review-controls';
import {useI18n} from '@/lib/i18n';
import type {Locale} from '@/lib/i18n';
import {kycText,kycDate} from '@/lib/kyc/ui-copy';
import {fields,sections,statusLabels,completeness} from '@/lib/kyc/core';
import {RequestEditor} from '@/components/kyc-supplement';
import {reasonCodes,type KycRequest} from '@/lib/kyc/requests';
import {slots,slotVisible} from '@/lib/kyc/core';
import {KycMaterialViewer} from '@/components/kyc-material-viewer';
import type {RecordView} from '@/app/kyc/client';
import './kyc-review.css';
import {ReviewActions} from '@/components/kyc-review-actions';
import type {NextReview} from '@/lib/kyc/review-next';

type Props={next?:NextReview;autoNext?:boolean;onAutoNext?:(value:boolean)=>void;onNext?:()=>void;onRetryNext?:()=>void;requests?:KycRequest[];onRequest?:(target:string,request?:KycRequest)=>void;record:RecordView;locale?:Locale;checks:Record<string,boolean>;reason:string;decision:string;busy:boolean;error?:string;message?:string;onCheck:(id:string,value:boolean)=>void;onReason:(value:string)=>void;onDecision:(value:string)=>void;onDecide:()=>void;onAmend:()=>void};
export function KycReview({next,autoNext=false,onAutoNext,onNext,onRetryNext,requests=[],onRequest,record,locale:reviewLocale,checks,reason,decision,busy,error,message,onCheck,onReason,onDecision,onDecide,onAmend}:Props){
 const context=useI18n(),locale=reviewLocale||context.locale,t=(s:string)=>kycText(s,locale),p=record.profile;
 const auditSummary=record.scope?.startsWith('审计只读摘要')===true;
 const [changes,setChanges]=useState<ReviewDiff|null>(null),currentChanges=changes?.caseId===record.id&&changes.currentRevision===record.revision?changes:null,known=currentChanges?.baselineRevision!=null,changed=changedSections(currentChanges);
 const mayReview=!auditSummary&&record.canReview!==false,mayDecide=mayReview&&record.status==='submitted';
 const requestsIncomplete=decision==='needs_info'&&requests.some(r=>!Object.hasOwn(reasonCodes,r.reasonCode)||(r.reasonCode==='other'&&!r.note.trim()));
 const score=completeness(p,record.phoneVerified);
 const editor=(target:string)=>mayDecide&&decision==='needs_info'&&onRequest?<RequestEditor target={target} request={requests.find(r=>r.target===target)} locale={locale} disabled={busy} onChange={request=>onRequest(target,request)}/>:null;
 return <main className="kyc-review-workspace" lang={locale}><header><a href="/team/kyc">{t('返回业务工作台')}</a><h1>{t('KYC 人工审核')}</h1><p>{t(statusLabels[record.status])} · {t('版本')} {record.revision} · {record.id}</p></header>
  {auditSummary&&<p className="notice">{t('审计只读：敏感资料仅由 KYC 审核岗位查看')}</p>}
  <p className="notice">{t('身份证核验、活体检测与 KESS 尚未接入。当前完成的是人工资料审核，贷款放款仍使用测试资金。')}</p>
  {!record.phoneVerified&&<p className="notice">{t('模拟会话，未完成真实手机号验证')}</p>}
  {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status">{message}</p>}
  {record.review&&<div className="sample"><strong>{t('最近审核意见 ·')}{t(statusLabels[record.review.decision as keyof typeof statusLabels]||record.review.decision)}</strong><p>{record.review.reason}</p><small>{kycDate(record.review.at,locale)}</small></div>}
  <ReviewChanges key={record.id+':'+record.revision} caseId={record.id} revision={record.revision} requests={record.review?.requests} locale={locale} audit={auditSummary} onLoaded={setChanges}/>
  <nav className="kyc-review-index" aria-label="KYC review sections">{sections.map(s=><a key={s.id} href={'#kyc-review-'+s.id}>{t(s.label)}</a>)}</nav>
  <div className="kyc-review-columns"><div className="kyc-review-cards">{sections.map(s=><details className="kyc-review-card" open={!known||s.id==='consent'||changed.includes(s.id)} id={'kyc-review-'+s.id} key={s.id}><summary>{t(s.label)}{known&&<span className="kyc-change-badge">{changesText(changed.includes(s.id)?'hasChanges':s.id==='consent'?'unknown':'none',locale)}</span>}</summary>
   <label className="kyc-review-check"><input type="checkbox" checked={checks[s.id]===true} disabled={busy||!mayDecide} onChange={e=>onCheck(s.id,e.target.checked)}/>{t(decision==='needs_info'?'要求补充：':'已核对')} {t(s.label)}</label>
   <dl>{fields.filter(f=>f.section===s.id).map(f=>{const value=p.values[f.id];return <div key={f.id}><dt>{t(f.label)}</dt><dd>{auditSummary?t('无权查看'):['documentNumber','bankAccount'].includes(f.id)?<SensitiveValue key={record.id+':'+record.revision+':'+f.id} scope={record.id+':'+record.revision+':'+f.id} caseId={record.id} revision={record.revision} field={f.id as 'documentNumber'|'bankAccount'} value={value||''} label={t(f.label)} locale={locale}/>:value?(f.options?.find(o=>o.value===value)?t(f.options.find(o=>o.value===value)!.label):value):t('未提供')}</dd>{editor('field:'+f.id)}</div>})}</dl>
   {editor('section:'+s.id)}{slots.filter(slot=>slot.section===s.id&&slot.id!=='signature'&&slotVisible(slot.id,p)).map(slot=><div key={slot.id}>{t(slot.label)}{editor('slot:'+slot.id)}</div>)}
   {s.id==='consent'&&(auditSummary?<p>{t('无权查看')}</p>:<><p>{t('资料审核授权：')}{t(p.consent?'已确认':'未确认')} · {p.declarationVersion}</p><p>{t('定位：')}{p.location?`${p.location.lat}, ${p.location.lon} ±${p.location.accuracy}m`:t('未授权或未提供')}</p></>)}
  </details>)}</div>
  <aside className="kyc-review-aside">{auditSummary?<p className="notice">{t('无权查看')}</p>:<KycMaterialViewer profile={p} locale={locale}/>}<section className="kyc-review-panel kyc-review-decision"><h2>{t('人工审核决定')}</h2>{mayDecide?<><p>{t(decision==='needs_info'?'勾选需要客户补充的页面，客户重新进入时会直接定位到第一项。':'请逐项打开材料核对。勾选仅记录人工核对，不代表已完成外部实名、活体或银行验证。')}</p>
   <label>{t('处理结果')}<select value={decision} disabled={busy} onChange={e=>onDecision(e.target.value)}>{!record.approvalOnly&&<option value="needs_info">{t('退回补件')}</option>}<option value="approved">{t('人工资料审核通过')}</option>{!record.approvalOnly&&<option value="rejected">{t('资料审核未通过')}</option>}</select></label>
   <label>{t('审核意见 / 补件原因')}<textarea value={reason} maxLength={1000} disabled={busy} onChange={e=>onReason(e.target.value)}/></label>
   {requestsIncomplete&&<p className="error" data-request-error role="status">{t('请补全：')}{t('补件原因')} / {t('补充说明')}</p>}
   <ReviewActions record={record} checks={checks} reason={reason} decision={decision} locale={locale} busy={busy} disabled={busy||requestsIncomplete||!reason.trim()||reason.length>1000||(decision==='approved'&&sections.some(s=>!checks[s.id]))} onReason={onReason} onDecide={onDecide}/>
  </>:<p>{t(statusLabels[record.status])}</p>}
  {mayReview&&onAutoNext&&<label><input type="checkbox" checked={autoNext} disabled={busy} onChange={e=>onAutoNext(e.target.checked)}/>{t('审核后自动打开下一条')}</label>}
  {next&&next.state!=='idle'&&<div role="status">{next.state==='ready'?<button type="button" disabled={busy} onClick={onNext}>{t('下一条待审核')}</button>:next.state==='failed'?<><p>{t('无法获取下一条，请重试。')}</p><button type="button" disabled={busy} onClick={onRetryNext}>{t('重试')}</button></>:<p>{t(next.state==='empty'?'没有其他待审核资料。':'正在获取下一条。')}</p>}</div>}
  {mayReview&&!record.approvalOnly&&['submitted','needs_info'].includes(record.status)&&<button type="button" data-action="amend" disabled={busy} onClick={onAmend}>{t('代客户修改资料')}</button>}
  </section><section className="kyc-review-panel"><h2>{t('资料完整度')}</h2><p>{t('基础资料')} {score.base}/120 · {t('附加材料')} {score.additional}/85</p><details><summary>{t('逐项权重与来源')}</summary>{score.rows.map(r=><p key={r.source+r.label}>{t(r.label)} {r.points}/{r.maximum} · {t(r.source)}</p>)}</details></section>
  {record.history&&<section className="kyc-review-panel"><h2>{t('版本与操作记录')}</h2>{record.history.map(h=><p key={h.revision}>{t('版本')} {h.revision} · {h.action} · {kycDate(h.created_at,locale)}{h.review&&<span> · {h.review.reason} · {h.actor}</span>}</p>)}</section>}
  </aside></div></main>;
}
