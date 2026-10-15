import {clientRequestId} from '@/lib/client-id';
import {apiFetch} from '@/lib/api-client';
type EventName='page_view'|'mini_nav_home'|'mini_nav_records'|'mini_nav_profile'|'kyc_step_view'|'kyc_step_complete'|'kyc_file_select'|'kyc_file_upload_success'|'kyc_file_upload_failed'|'kyc_submit'|'loan_apply_start'|'loan_bill_confirm'|'loan_signature_saved'|'loan_submitted'|'telegram_notification_sent'|'telegram_notification_failed';
const sessionKey='payease-analytics-session';
function sessionId(){try{const old=sessionStorage.getItem(sessionKey);if(old)return old;const next=clientRequestId();sessionStorage.setItem(sessionKey,next);return next}catch{return ''}}
export function trackEvent(eventName:EventName,metadata:Record<string,unknown>={},source:'mini_app'|'h5'='mini_app'){
 if(typeof window==='undefined')return;
 const route=window.location.pathname.slice(0,160)||'/h5',locale=(document.documentElement.lang||'en').slice(0,2);
 const safe=Object.fromEntries(Object.entries(metadata).filter(([key,value])=>!/(phone|identity|idcard|passport|bank|file|token|secret|address|name)/i.test(key)&&['string','number','boolean'].includes(typeof value)).slice(0,12));
 void apiFetch('/api/analytics/events',{method:'POST',body:JSON.stringify({eventName,route,locale,source,sessionIdHash:sessionId(),metadata:safe}),keepalive:true}).catch(()=>undefined);
}
