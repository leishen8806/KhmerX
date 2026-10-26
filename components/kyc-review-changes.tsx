'use client';
import {useEffect,useState} from 'react';
import {apiFetch,apiUrl} from '@/lib/api-client';
import {fields,slots} from '@/lib/kyc/core';
import {requestChangeState,safeChangeValue,type ReviewDiff} from '@/lib/kyc/review-changes-ui';
import {kycText} from '@/lib/kyc/ui-copy';
import type {Locale} from '@/lib/i18n';
import type {KycRequest} from '@/lib/kyc/requests';
import './kyc-review-changes.css';
const copy={hasChanges:['有变更','Changed','មានការផ្លាស់ប្តូរ'],title:['本次变更','Changes since review','ការផ្លាស់ប្តូរលើកនេះ'],none:['无变化','No changes','មិនមានការផ្លាស់ប្តូរ'],baseline:['没有审核基线','No review baseline','មិនមានទិន្នន័យមូលដ្ឋានពិនិត្យ'],failed:['无法加载变更','Unable to load changes','មិនអាចផ្ទុកការផ្លាស់ប្តូរបាន'],retry:['重试','Retry','ព្យាយាមម្តងទៀត'],loading:['正在加载变更','Loading changes','កំពុងផ្ទុកការផ្លាស់ប្តូរ'],changed:['已补充','Updated','បានបំពេញបន្ថែម'],pending:['未处理','Unchanged','មិនទាន់កែប្រែ'],unknown:['无法判断','Cannot determine','មិនអាចកំណត់បាន'],old:['原材料','Previous material','ឯកសារមុន'],current:['现材料','Current material','ឯកសារបច្ចុប្បន្ន']} as const;
export function changesText(key:keyof typeof copy,locale:Locale){return copy[key][locale==='zh'?0:locale==='en'?1:2];}
export function ReviewChanges({caseId,revision,requests=[],locale,audit=false,onLoaded}:{caseId:string;revision:number;requests?:KycRequest[];locale:Locale;audit?:boolean;onLoaded?:(diff:ReviewDiff|null)=>void}){
 const scope=caseId+':'+revision,[result,setResult]=useState<{scope:string;diff:ReviewDiff}|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[failedImages,setFailedImages]=useState<Record<string,boolean>>({});
 useEffect(()=>{let active=true;setResult(null);setError('');setFailedImages({});onLoaded?.(null);
  void apiFetch<ReviewDiff>('/api/kyc/review/changes?id='+encodeURIComponent(caseId)).then(({data})=>{if(!active)return;if(data.caseId!==caseId||data.currentRevision!==revision||!Array.isArray(data.fields)||!Array.isArray(data.materials))throw Error();setResult({scope,diff:data});onLoaded?.(data);}).catch(()=>{if(active)setError(scope);});
  return ()=>{active=false;};
 },[caseId,revision,attempt]);
 const diff=result?.scope===scope?result.diff:null,t=(key:keyof typeof copy)=>changesText(key,locale);
 function thumbnail(id:string|null|undefined,label:string){if(!id||audit)return null;const url=apiUrl('/api/kyc/files?review=1&id='+encodeURIComponent(id));return <figure>{!failedImages[id]&&<img src={url} alt={label} loading="lazy" onError={()=>setFailedImages(current=>({...current,[id]:true}))}/>}<figcaption><a href={url} target="_blank" rel="noopener noreferrer">{label}</a></figcaption></figure>;}
 return <section className="kyc-review-changes" aria-label={t('title')}><h2>{t('title')}</h2>{error===scope?<p role="alert">{t('failed')} <button type="button" onClick={()=>setAttempt(n=>n+1)}>{t('retry')}</button></p>:!diff?<p role="status">{t('loading')}</p>:diff.baselineRevision===null?<p>{t('baseline')}</p>:<><p>{diff.baselineRevision} → {diff.currentRevision}</p>{!diff.fields.length&&!diff.materials.length&&<p>{t('none')}</p>}<dl>{diff.fields.map(change=><div key={change.id}><dt>{kycText(fields.find(f=>f.id===change.id)?.label||change.id,locale)}</dt>{!audit&&Object.hasOwn(change,'oldValue')&&<dd><del>{safeChangeValue(change.id,change.oldValue)||'—'}</del> → <ins>{safeChangeValue(change.id,change.newValue)||'—'}</ins></dd>}</div>)}</dl>{diff.materials.map(change=><div key={change.slot}><strong>{kycText(slots.find(s=>s.id===change.slot)?.label||change.slot,locale)}</strong><div className="kyc-change-materials">{thumbnail(change.oldFileId,t('old'))}{thumbnail(change.newFileId,t('current'))}</div></div>)}</>}{requests.length>0&&<ul>{requests.map(request=><li key={request.target}>{kycText(request.target.startsWith('field:')?fields.find(f=>f.id===request.target.slice(6))?.label||request.target:request.target.startsWith('slot:')?slots.find(s=>s.id===request.target.slice(5))?.label||request.target:request.target,locale)} · {t(requestChangeState(request.target,diff))}</li>)}</ul>}</section>;
}
