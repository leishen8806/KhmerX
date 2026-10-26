'use client';
import {useEffect,useRef,useState} from 'react';
import {apiFetch} from '@/lib/api-client';
import {fields} from '@/lib/kyc/core';
import {kycText} from '@/lib/kyc/ui-copy';
import type {Locale} from '@/lib/i18n';
const copy:Record<string,[string,string,string]>={
 show:['显示','Show','បង្ហាញ'],hide:['隐藏','Hide','លាក់'],
 failed:['无法显示，请重试','Unable to show. Please retry.','មិនអាចបង្ហាញបានទេ។ សូមព្យាយាមម្តងទៀត។'],
 title:['确认代修改差异','Review amendments','ពិនិត្យការកែប្រែ'],
 empty:['尚未修改资料。','No changes yet.','មិនទាន់មានការកែប្រែ។'],
 confirm:['我已核对上述修改及原因，确认保存并退回客户确认。','I checked these changes and the reason. Save and return to the customer for confirmation.','ខ្ញុំបានពិនិត្យការកែប្រែ និងមូលហេតុ។ រក្សាទុក និងបញ្ជូនឱ្យអតិថិជនបញ្ជាក់។'],
 save:['保存代修改并退回客户确认','Save amendments for customer confirmation','រក្សាទុកការកែប្រែឱ្យអតិថិជនបញ្ជាក់'],
};
const labelFor=(key:string,locale:Locale)=>copy[key][locale==='zh'?0:locale==='en'?1:2];

export function SensitiveValue({value,label,locale,scope='',caseId,revision,field,editable=false,disabled=false,onEdit,onReset}:{value:string;label:string;locale:Locale;scope?:string;caseId:string;revision:number;field:'documentNumber'|'bankAccount';editable?:boolean;disabled?:boolean;onEdit?:(value:string,token:string)=>void;onReset?:()=>void}){
 const identity=JSON.stringify([scope,caseId,revision,field]),generation=useRef(0),inFlight=useRef(false),active=useRef(identity);
 const [result,setResult]=useState<{identity:string;value:string;proof:string}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 const shown=result?.identity===identity;
 useEffect(()=>{active.current=identity;generation.current++;inFlight.current=false;setResult(null);setBusy(false);setError(false);return ()=>{generation.current++;inFlight.current=false;active.current='';};},[identity]);
 function hide(){generation.current++;inFlight.current=false;setResult(null);setBusy(false);setError(false);onReset?.();}
 async function toggle(){
  if(shown||busy){hide();return;}
  if(inFlight.current||disabled)return;inFlight.current=true;const request=++generation.current;setBusy(true);setError(false);
  try{
   const {data}=await apiFetch<{field:string;value:string;revealToken:string}>('/api/kyc/review/reveal',{method:'POST',body:JSON.stringify({id:caseId,revision,field})});
   if(request!==generation.current||active.current!==identity)return;
   if(data.field!==field||typeof data.value!=='string'||typeof data.revealToken!=='string')throw Error();
   setResult({identity,value:data.value,proof:data.revealToken});
  }catch{if(request===generation.current&&active.current===identity){setResult(null);setError(true);}}
  finally{if(request===generation.current){inFlight.current=false;setBusy(false);}}
 }
 const masked=!value?kycText('未提供',locale):/^[*•]{4}/.test(value)?value:value.length<=4?'••••':'•••• '+value.slice(-4);
 return <span className="kyc-sensitive-value">{shown&&editable?<input aria-label={label} value={result.value} maxLength={240} disabled={disabled} autoComplete="off" onChange={event=>{setResult({...result,value:event.target.value});onEdit?.(event.target.value,result.proof);}}/>:<span>{shown?result.value:masked}</span>} <button type="button" disabled={disabled} aria-label={labelFor(shown||busy?'hide':'show',locale)+' '+label} aria-pressed={shown} aria-busy={busy} onClick={toggle}>{labelFor(shown||busy?'hide':'show',locale)}</button>{error&&<span role="alert">{labelFor('failed',locale)}</span>}</span>;
}
export function AmendConfirmation({original,values,reason,busy,onSave,locale='zh'}:{original:Record<string,string>;values:Record<string,string>;reason:string;busy:boolean;onSave:()=>void;locale?:Locale}){
 const changes=fields.filter(f=>(original[f.id]||'')!==(values[f.id]||''));
 const fingerprint=JSON.stringify([values,reason]),[confirmed,setConfirmed]=useState('');
 const allowed=changes.length>0&&!!reason.trim()&&!busy&&confirmed===fingerprint;
 return <section className="kyc-amend-diff"><h3>{labelFor('title',locale)}</h3>{changes.length?<dl>{changes.map(f=><div key={f.id}><dt>{kycText(f.label,locale)}</dt><dd><del>{original[f.id]||kycText('未提供',locale)}</del> → <ins>{values[f.id]||kycText('未提供',locale)}</ins></dd></div>)}</dl>:<p>{labelFor('empty',locale)}</p>}<label><input type="checkbox" checked={confirmed===fingerprint} disabled={busy||!changes.length} onChange={e=>setConfirmed(e.target.checked?fingerprint:'')}/>{labelFor('confirm',locale)}</label><button type="button" data-action="save-amend" disabled={!allowed} onClick={()=>{if(allowed)onSave()}}>{labelFor('save',locale)}</button></section>;
}
