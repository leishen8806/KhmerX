import type {Locale} from '@/lib/i18n';
import {kycText} from '@/lib/kyc/ui-copy';
import {reasonCodes,requestReason,type KycRequest} from '@/lib/kyc/requests';
import './kyc-supplement.css';
export function RequestEditor({target,request,locale,disabled,onChange}:{target:string;request?:KycRequest;locale:Locale;disabled:boolean;onChange:(request?:KycRequest)=>void}){
 const t=(s:string)=>kycText(s,locale);
 return <div className="kyc-request-editor" data-target={target}><label><input type="checkbox" checked={!!request} disabled={disabled} onChange={e=>onChange(e.target.checked?{target,reasonCode:'',note:''}:undefined)}/>{t('需补充')}</label>{request&&<><label>{t('补件原因')}<select value={request.reasonCode} disabled={disabled} required onChange={e=>onChange({...request,reasonCode:e.target.value})}><option value="" disabled>{t('请选择')}</option>{Object.keys(reasonCodes).map(code=><option key={code} value={code}>{requestReason(code,locale)}</option>)}</select></label><label>{t('补充说明')}<textarea maxLength={500} required={request.reasonCode==='other'} value={request.note} disabled={disabled} onChange={e=>onChange({...request,note:e.target.value})}/></label></>}</div>;
}
export function RequestNotice({request,changed,locale}:{request:KycRequest;changed:boolean;locale:Locale}){
 return <div className="kyc-supplement-item" data-target={request.target} data-state={changed?'changed':'pending'}><strong>{kycText(changed?'已修改，待审核':'需补充',locale)}</strong><p>{requestReason(request.reasonCode,locale)}</p>{request.note&&<p>{request.note}</p>}</div>;
}
