/** Browser-safe API boundary. Keep server-only modules out of this file. */
import {clientRequestId} from './client-id';

export type ApiFailure={error?:string;code?:string;requestId?:string;params?:Record<string,unknown>;retryAfter?:number};
export type ApiFetchInit=RequestInit & {timeoutMs?:number;totalTimeoutMs?:number;idempotencyKey?:string;notifyAuth?:boolean};
export class ApiClientError extends Error{
 readonly code:string;
 readonly status:number;
 readonly requestId?:string;
 readonly params?:Record<string,unknown>;
 constructor(message:string,status:number,body:ApiFailure={}){super(message);this.name='ApiClientError';this.code=body.code||'REQUEST_FAILED';this.status=status;this.requestId=body.requestId;this.params=body.params}
}

function baseUrl(){
 if(typeof window==='undefined')return '';
 const configured=(window as Window & {__PAYEASE_API_BASE__?:string}).__PAYEASE_API_BASE__;
 return configured?.replace(/\/$/,'')||'';
}

export function apiUrl(path:string){return `${baseUrl()}${path.startsWith('/')?path:`/${path}`}`}

function notifyAuthRequired(failure:ApiFailure){
 if(typeof window==='undefined'||failure.code!=='AUTH_REQUIRED')return;
 window.dispatchEvent(new CustomEvent('khmerx:auth-required',{detail:{requestId:failure.requestId}}));
}

function timeoutSignal(timeoutMs:number,source?:AbortSignal){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 const abort=()=>controller.abort(source?.reason);
 if(source){if(source.aborted)abort();else source.addEventListener('abort',abort,{once:true})}
 return {signal:controller.signal,cleanup:()=>{clearTimeout(timer);source?.removeEventListener('abort',abort)}};
}

const retryDelay=(attempt:number)=>250*(2**attempt)+Math.floor(Math.random()*251);
const retryAfterMs=(response:Response)=>{
 const value=response.headers.get('retry-after');
 if(!value)return undefined;
 const seconds=Number(value);
 if(Number.isFinite(seconds))return Math.min(5000,Math.max(0,seconds*1000));
 const date=Date.parse(value);
 return Number.isFinite(date)?Math.min(5000,Math.max(0,date-Date.now())):undefined;
};
const abortError=()=>typeof DOMException==='undefined'?Object.assign(new Error('请求总时限已到'),{name:'AbortError'}):new DOMException('请求总时限已到','AbortError');
const waitForRetry=async(delay:number,deadline:number,source?:AbortSignal)=>{
 const remaining=deadline-Date.now();
 if(remaining<=0)throw abortError();
 await new Promise<void>((resolve,reject)=>{
  const timer=setTimeout(resolve,Math.min(delay,remaining));
  const abort=()=>{clearTimeout(timer);reject(source?.reason||abortError())};
  if(source){if(source.aborted)abort();else source.addEventListener('abort',abort,{once:true})}
  setTimeout(()=>{if(Date.now()>=deadline)reject(abortError())},Math.min(delay,remaining)+1);
 });
 if(Date.now()>=deadline)throw abortError();
};

export async function apiFetch<T=unknown>(path:string,init:ApiFetchInit={}){
 const {timeoutMs=15000,totalTimeoutMs=30000,idempotencyKey,notifyAuth=true,...requestInit}=init;
 const method=(requestInit.method||'GET').toUpperCase();
 const canRetry=method==='GET'||Boolean(idempotencyKey);
 const deadline=Date.now()+Math.max(1,totalTimeoutMs);
 const shouldNotifyAuth=notifyAuth&&!path.startsWith('/api/h5/auth');
 const headers=new Headers(requestInit.headers);
 if(requestInit.body&&!headers.has('content-type')&&typeof requestInit.body==='string')headers.set('content-type','application/json');
 if(!headers.has('x-request-id'))headers.set('x-request-id',clientRequestId());
 // Interfaces that pass idempotencyKey must guarantee idempotency themselves;
 // the current server does not read the X-Idempotency-Key header.
 if(idempotencyKey)headers.set('x-idempotency-key',idempotencyKey);
 for(let attempt=0;;attempt++){
  const remaining=deadline-Date.now();
  if(remaining<=0)throw abortError();
  const timeout=timeoutSignal(Math.min(timeoutMs,remaining),requestInit.signal||undefined);
  try{
   const response=await fetch(apiUrl(path),{...requestInit,headers,signal:timeout.signal,credentials:requestInit.credentials||'include'});
   const requestId=response.headers.get('x-request-id')||undefined;
   const type=response.headers.get('content-type')||'';
   const body=type.includes('application/json')?await response.json().catch(()=>({})):await response.blob();
   if(response.ok)return {data:body as T,response,requestId};
   const failure=(body&&typeof body==='object'&&!('size' in body)?body:{}) as ApiFailure;
   const normalized={...failure,requestId:failure.requestId||requestId};
   if(canRetry&&attempt<2&&[502,503,504].includes(response.status)){
    await waitForRetry(response.status===503?retryAfterMs(response)??retryDelay(attempt):retryDelay(attempt),deadline,requestInit.signal||undefined);continue
   }
   if(shouldNotifyAuth)notifyAuthRequired(normalized);
   throw new ApiClientError(failure.error||'请求未完成，请稍后重试',response.status,normalized);
  }catch(error){
   if(error instanceof ApiClientError)throw error;
   if(requestInit.signal?.aborted)throw error;
   if(canRetry&&attempt<2){await waitForRetry(retryDelay(attempt),deadline,requestInit.signal||undefined);continue}
   throw error;
  }finally{timeout.cleanup()}
 }
}
