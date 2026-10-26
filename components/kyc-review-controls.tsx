'use client';
import {useState} from 'react';
import {fields} from '@/lib/kyc/core';
import {kycText} from '@/lib/kyc/ui-copy';
import type {Locale} from '@/lib/i18n';
const copy:Record<string,[string,string,string]>={
 show:['显示','Show','បង្ហាញ'],hide:['隐藏','Hide','លាក់'],
 title:['确认代修改差异','Review amendments','ពិនិត្យការកែប្រែ'],
 empty:['尚未修改资料。','No changes yet.','មិនទាន់មានការកែប្រែ។'],
 confirm:['我已核对上述修改及原因，确认保存并退回客户确认。','I checked these changes and the reason. Save and return to the customer for confirmation.','ខ្ញុំបានពិនិត្យការកែប្រែ និងមូលហេតុ។ រក្សាទុក និងបញ្ជូនឱ្យអតិថិជនបញ្ជាក់។'],
 save:['保存代修改并退回客户确认','Save amendments for customer confirmation','រក្សាទុកការកែប្រែឱ្យអតិថិជនបញ្ជាក់'],
};
const labelFor=(key:string,locale:Locale)=>copy[key][locale==='zh'?0:locale==='en'?1:2];

export function SensitiveValue({value,label,locale,scope=''}:{value:string;label:string;locale:Locale;scope?:string}){
 const token=JSON.stringify([scope,value]),[revealed,setRevealed]=useState(''),shown=revealed===token;
 if(!value)return <span>{kycText('未提供',locale)}</span>;
 return <span className="kyc-sensitive-value"><span>{shown?value:value.length>4?'•••• '+value.slice(-4):'••••'}</span> <button type="button" aria-label={labelFor(shown?'hide':'show',locale)+' '+label} aria-pressed={shown} onClick={()=>setRevealed(shown?'':token)}>{labelFor(shown?'hide':'show',locale)}</button></span>;
}
export function AmendConfirmation({original,values,reason,busy,onSave,locale='zh'}:{original:Record<string,string>;values:Record<string,string>;reason:string;busy:boolean;onSave:()=>void;locale?:Locale}){
 const changes=fields.filter(f=>(original[f.id]||'')!==(values[f.id]||''));
 const fingerprint=JSON.stringify([values,reason]),[confirmed,setConfirmed]=useState('');
 const allowed=changes.length>0&&!!reason.trim()&&!busy&&confirmed===fingerprint;
 return <section className="kyc-amend-diff"><h3>{labelFor('title',locale)}</h3>{changes.length?<dl>{changes.map(f=><div key={f.id}><dt>{kycText(f.label,locale)}</dt><dd><del>{original[f.id]||kycText('未提供',locale)}</del> → <ins>{values[f.id]||kycText('未提供',locale)}</ins></dd></div>)}</dl>:<p>{labelFor('empty',locale)}</p>}<label><input type="checkbox" checked={confirmed===fingerprint} disabled={busy||!changes.length} onChange={e=>setConfirmed(e.target.checked?fingerprint:'')}/>{labelFor('confirm',locale)}</label><button type="button" data-action="save-amend" disabled={!allowed} onClick={()=>{if(allowed)onSave()}}>{labelFor('save',locale)}</button></section>;
}
