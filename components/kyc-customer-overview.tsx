'use client';
import {fields,slots,statusLabels,type Profile,type KycStatus} from '@/lib/kyc/core';
import {apiUrl} from '@/lib/api-client';
import {kycText} from '@/lib/kyc/ui-copy';
import type {ReactNode} from 'react';
import type {Locale} from '@/lib/i18n';
import './kyc-customer-overview.css';
type Group={id:string;label:string;amount:string;complete:boolean};
const copy={
 title:['检查并提交','Check and submit','ពិនិត្យ និងដាក់ស្នើ'],edit:['修改','Edit','កែប្រែ'],confirm:['确认提交审核','Confirm submission','បញ្ជាក់ការដាក់ស្នើ'],
 lock:['提交后资料将锁定，审核完成前不能修改；退回补件后可修改。','Your information is locked after submission until review finishes or an update is requested.','ព័ត៌មាននឹងត្រូវចាក់សោបន្ទាប់ពីដាក់ស្នើ រហូតដល់ពិនិត្យចប់ ឬស្នើឱ្យបន្ថែម។'],
 time:['预计处理时间暂未提供，请稍后查看审核状态。','An estimated review time is not available. Check the status later.','មិនទាន់មានពេលវេលាពិនិត្យប៉ាន់ស្មានទេ។ សូមពិនិត្យស្ថានភាពនៅពេលក្រោយ។'],
 submitted:['已提交','Submitted','បានដាក់ស្នើ'],review:['人工审核','Manual review','ការពិនិត្យដោយបុគ្គលិក'],result:['审核结果','Review result','លទ្ធផលពិនិត្យ'],
 unknown:['尚未提供开始审核时间','Review start time has not been provided','មិនទាន់មានពេលវេលាចាប់ផ្តើមពិនិត្យ'],waiting:['等待审核结果','Awaiting a decision','កំពុងរង់ចាំលទ្ធផល'],
 progress:['6 项中已完成','Completed groups out of 6:','ចំនួនក្រុមបានបំពេញក្នុងចំណោម ៦៖'],amount:['额度仍需审核确认，不代表已经批准。','Any limit remains subject to review; this is not an approval.','ទំហំឥណទាននៅតែត្រូវពិនិត្យ មិនមែនជាការអនុម័តទេ។'],
 yes:['已确认','Confirmed','បានបញ្ជាក់'],no:['未提供','Not provided','មិនបានផ្តល់'],
} as const;
const text=(key:keyof typeof copy,locale:Locale)=>copy[key][locale==='zh'?0:locale==='en'?1:2];
export function KycCustomerProgress({groups,locale}:{groups:Group[];locale:Locale}){
 const count=groups.filter(g=>g.complete).length;
 return <section className="kyc-customer-progress" aria-label={text('progress',locale)}><p>{text('progress',locale)} {count}/6</p><progress max={6} value={count}/><ul>{groups.filter(g=>g.complete).map(g=><li key={g.id}>{kycText(g.label,locale)} · {kycText(g.amount,locale)}</li>)}</ul><p>{text('amount',locale)}</p></section>;
}
export function KycCustomerTimeline({status,locale}:{status:KycStatus;locale:Locale}){
 const done=['approved','rejected','needs_info'].includes(status);
 return <section className="kyc-customer-timeline"><ol><li aria-current={!done?'step':undefined}>{text('submitted',locale)}</li><li>{text('review',locale)}<small>{text('unknown',locale)}</small></li><li aria-current={done?'step':undefined}>{text('result',locale)}<small>{done?kycText(statusLabels[status],locale):text('waiting',locale)}</small></li></ol>{status==='submitted'&&<p>{text('time',locale)}</p>}</section>;
}
export function KycSubmissionSummary({profile,groups,locale,busy,error,confirmation,onEdit,onConfirm}:{profile:Profile;groups:Group[];locale:Locale;busy:boolean;error?:string;confirmation?:ReactNode;onEdit:(id:string)=>void;onConfirm:()=>void}){
 return <main className="kyc-customer-summary"><h1>{text('title',locale)}</h1><p role="note">{text('lock',locale)}</p>{error&&<p role="alert">{error}</p>}{groups.map(g=>{const belongs=(section:string)=>section===g.id||(g.id==='employment'&&section==='income');return <section className="kyc-summary-group" key={g.id}><header><h2>{kycText(g.label,locale)}</h2><button type="button" disabled={busy} onClick={()=>onEdit(g.id)}>{text('edit',locale)}</button></header><p>{kycText(g.amount,locale)}</p><dl>{fields.filter(f=>belongs(f.section)).map(f=><div key={f.id}><dt>{kycText(f.label,locale)}</dt><dd>{profile.values[f.id]?(f.options?kycText(profile.values[f.id],locale):profile.values[f.id]):text('no',locale)}</dd></div>)}</dl>{g.id==='consent'&&<p>{profile.consent?text('yes',locale):text('no',locale)}</p>}<div className="kyc-summary-files">{slots.filter(s=>s.id!=='signature'&&belongs(s.section)&&profile.files[s.id]).map(s=>{const file=profile.files[s.id]!;return <figure key={s.id}>{file.type.startsWith('image/')?<img src={apiUrl('/api/kyc/files?id='+encodeURIComponent(file.id))} alt={kycText(s.label,locale)}/>:<a download href={apiUrl('/api/kyc/files?id='+encodeURIComponent(file.id))}>PDF · {kycText(s.label,locale)}</a>}<figcaption>{kycText(s.label,locale)}</figcaption></figure>})}</div></section>})}{confirmation}<button type="button" data-action="confirm-submit" disabled={busy} onClick={onConfirm}>{text('confirm',locale)}</button></main>;
}
