'use client';
import {useEffect,useRef,useState} from 'react';
import {sections} from '@/lib/kyc/core';
import {kycText} from '@/lib/kyc/ui-copy';
import type {Locale} from '@/lib/i18n';
import './kyc-review-actions.css';
const phrases:Record<string,string[]>={approved:['资料已逐项核对。','材料与填写内容一致。','本次人工资料审核通过。'],needs_info:['请提供清晰、完整的材料。','请核对填写内容。','请按补件要求重新提交。'],rejected:['当前材料不符合审核要求。','填写内容与材料不一致。','请核对后联系业务人员。']};
type Props={record:{id:string;revision:number};checks:Record<string,boolean>;reason:string;decision:string;disabled:boolean;busy?:boolean;locale:Locale;onReason:(value:string)=>void;onDecide:()=>void};
export function ReviewActions({record,checks,reason,decision,disabled,busy=false,locale,onReason,onDecide}:Props){
 const t=(s:string)=>kycText(s,locale),[confirming,setConfirming]=useState(false),[overflow,setOverflow]=useState(false),dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement|null>(null);
 const close=()=>{dialog.current?.close();setConfirming(false);trigger.current?.focus()};
 useEffect(()=>{if(confirming&&!dialog.current?.open)dialog.current?.showModal()},[confirming]);
 useEffect(()=>{setConfirming(false);dialog.current?.close()},[record.id,record.revision,decision]);
 return <div className="kyc-review-actions"><div aria-label={t('常用短语')}>{(phrases[decision]||[]).map(phrase=><button type="button" data-phrase key={phrase} disabled={busy} onClick={()=>{const next=reason?reason+'\n'+t(phrase):t(phrase);if(next.length>1000){setOverflow(true);return}setOverflow(false);onReason(next)}}>{t(phrase)}</button>)}</div>
 {overflow&&<p role="status" data-phrase-error>{t('追加后超过1000字，请先缩短审核意见。')}</p>}
 <button type="button" data-action="decide" disabled={disabled} onClick={event=>{if(disabled)return;if(decision==='approved'){trigger.current=event.currentTarget;setConfirming(true)}else onDecide()}}>{t(decision==='approved'?'确认审核通过':'确认记录审核结果')}</button>
 <dialog ref={dialog} aria-labelledby="kyc-approval-title" onCancel={event=>{event.preventDefault();close()}}><h2 id="kyc-approval-title">{t('确认本次人工审核')}</h2><p>{record.id} · {t('版本')} {record.revision}</p><ul>{sections.map(s=><li data-summary-check key={s.id}>{t(s.label)}: {t(checks[s.id]?'已核对':'未确认')}</li>)}</ul><p className="kyc-approval-reason">{reason}</p><button type="button" onClick={close}>{t('取消')}</button><button type="button" data-confirm-review disabled={disabled} onClick={()=>{if(disabled)return;close();onDecide()}}>{t('确认审核通过')}</button></dialog>
 </div>;
}
