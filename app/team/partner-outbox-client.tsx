'use client';
import {useEffect,useState} from 'react';
import {clientRequestId} from '@/lib/client-id';
import {useAdminLocale} from '@/lib/admin-i18n';
export default function PartnerOutboxClient(){
 const {t}=useAdminLocale();
 const [items,setItems]=useState<any[]>([]),[reason,setReason]=useState(''),[error,setError]=useState('');
 const load=async()=>{const r=await fetch('/api/team/partner-outbox',{cache:'no-store'});const body=await r.json() as any;if(!r.ok)throw new Error(body.code||body.error);setItems(body.items||[])};
 useEffect(()=>{void load().catch(e=>setError(e.message))},[]);
 async function requeue(id:string){setError('');if(!reason.trim()){setError(t('requeueReasonRequired'));return}if(!window.confirm(t('requeueConfirm')))return;const r=await fetch('/api/team/partner-outbox',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'requeue',id,reason,requestId:clientRequestId()})});const body=await r.json() as any;if(!r.ok){setError(body.code||body.error);return}setReason('');await load()}
 return <main className="panel"><h1>{t('partnerOutbox')}</h1><p className="fine">{t('partnerOutboxHint')}</p>{error&&<p role="alert">{error}</p>}<label>{t('requeueReason')}<input value={reason} maxLength={300} onChange={e=>setReason(e.target.value)} placeholder={t('required')}/></label><table><thead><tr><th>{t('event')}</th><th>{t('institution')}</th><th>{t('attempts')}</th><th>{t('lastError')}</th><th>{t('createdAt')}</th><th>{t('requeuedAt')}</th><th>{t('requeueCount')}</th><th/></tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{item.event_type}</td><td>{item.institution_id}</td><td>{item.attempts}</td><td>{item.last_error||'—'}</td><td>{item.created_at}</td><td>{item.requeued_at||'—'}</td><td>{item.requeue_count}</td><td><button type="button" onClick={()=>void requeue(item.id)}>{t('requeue')}</button></td></tr>)}</tbody></table></main>;
}
