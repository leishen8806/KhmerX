import {apiUrl,ApiClientError,type ApiFailure} from '../api-client';
import {clientRequestId} from '../client-id';
import {currentErrorLocale,messageForError} from '../error-messages';

// XMLHttpRequest exposes actual transmitted bytes; fetch has no upload progress event.
// Retries remain owned by the KYC caller, exactly as for the previous POST.
export function uploadKycFile<T>(body:Blob,headers:Record<string,string>,onProgress:(percent:number|undefined)=>void):Promise<T>{
 return new Promise((resolve,reject)=>{
  const xhr=new XMLHttpRequest();
  xhr.open('POST',apiUrl('/api/kyc/files'));
  xhr.withCredentials=true;xhr.timeout=180000;
  let settled=false,idle:ReturnType<typeof setTimeout>;
  const finish=()=>{settled=true;clearTimeout(idle)};
  const armIdle=()=>{clearTimeout(idle);idle=setTimeout(()=>{failed(0,{code:'KYC_UPLOAD_INTERRUPTED'});xhr.abort()},30000)};
  xhr.setRequestHeader('X-Request-Id',clientRequestId());
  for(const [key,value] of Object.entries(headers))xhr.setRequestHeader(key,value);
  xhr.upload.onprogress=e=>{if(settled)return;armIdle();onProgress(e.lengthComputable&&e.total>0?Math.min(100,Math.floor(e.loaded/e.total*100)):undefined)};
  // Once transmission finishes, storage/response time is bounded only by xhr.timeout.
  xhr.upload.onload=()=>clearTimeout(idle);
  const failed=(status:number,failure:ApiFailure={})=>{
   if(settled)return;finish();
   const normalized={...failure,code:failure.code||'REQUEST_FAILED',requestId:failure.requestId||xhr.getResponseHeader('X-Request-Id')||undefined};
   if(normalized.code==='AUTH_REQUIRED')window.dispatchEvent(new CustomEvent('khmerx:auth-required',{detail:{requestId:normalized.requestId}}));
   reject(Object.assign(new ApiClientError(messageForError(normalized,currentErrorLocale()),status,normalized),{retryAfterSeconds:normalized.params?.retryAfterSeconds}));
  };
  xhr.onload=()=>{
   let data;try{data=JSON.parse(xhr.responseText)}catch{failed(xhr.status);return}
   if(settled)return;
   if(xhr.status>=200&&xhr.status<300){finish();resolve(data as T);return}
   const retry=xhr.getResponseHeader('Retry-After');
   const seconds=retry?(Number.isFinite(Number(retry))?Number(retry):Math.max(0,(Date.parse(retry)-Date.now())/1000)):undefined;
   failed(xhr.status,{...data,params:{...data.params,...(seconds!==undefined&&Number.isFinite(seconds)?{retryAfterSeconds:seconds}:{})}});
  };
  xhr.onerror=()=>failed(0,{code:'KYC_UPLOAD_INTERRUPTED'});xhr.ontimeout=()=>failed(0,{code:'KYC_UPLOAD_INTERRUPTED'});xhr.onabort=()=>failed(0,{code:'KYC_UPLOAD_INTERRUPTED'});
  armIdle();try{xhr.send(body)}catch{failed(0,{code:'KYC_UPLOAD_INTERRUPTED'})}
 });
}
