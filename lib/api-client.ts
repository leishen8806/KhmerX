/** Browser-safe API boundary. Keep server-only modules out of this file. */
import {clientRequestId} from './client-id';

export type ApiFailure={error?:string;code?:string;requestId?:string;params?:Record<string,unknown>;retryAfter?:number};
export type ApiFetchInit=RequestInit & {timeoutMs?:number;idempotencyKey?:string};
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

const retryDelay=(attempt:number)=>250*(2**attempt);

export async function apiFetch<T=unknown>(path:string,init:ApiFetchInit={}){
 const {timeoutMs=15000,idempotencyKey,...requestInit}=init;
 const method=(requestInit.method||'GET').toUpperCase();
 const canRetry=method==='GET'||Boolean(idempotencyKey);
 const headers=new Headers(requestInit.headers);
 if(requestInit.body&&!headers.has('content-type')&&typeof requestInit.body==='string')headers.set('content-type','application/json');
 if(!headers.has('x-request-id'))headers.set('x-request-id',clientRequestId());
 if(idempotencyKey)headers.set('x-idempotency-key',idempotencyKey);
 for(let attempt=0;;attempt++){
  const timeout=timeoutSignal(timeoutMs,requestInit.signal||undefined);
  try{
   const response=await fetch(apiUrl(path),{...requestInit,headers,signal:timeout.signal,credentials:requestInit.credentials||'include'});
   const requestId=response.headers.get('x-request-id')||undefined;
   const type=response.headers.get('content-type')||'';
   const body=type.includes('application/json')?await response.json().catch(()=>({})):await response.blob();
   if(response.ok)return {data:body as T,response,requestId};
   const failure=(body&&typeof body==='object'&&!('size' in body)?body:{}) as ApiFailure;
   const normalized={...failure,requestId:failure.requestId||requestId};
   if(canRetry&&attempt<2&&[502,503,504].includes(response.status)){await new Promise(resolve=>setTimeout(resolve,retryDelay(attempt)));continue}
   notifyAuthRequired(normalized);
   throw new ApiClientError(failure.error||'请求未完成，请稍后重试',response.status,normalized);
  }catch(error){
   if(error instanceof ApiClientError)throw error;
   if(requestInit.signal?.aborted)throw error;
   if(canRetry&&attempt<2){await new Promise(resolve=>setTimeout(resolve,retryDelay(attempt)));continue}
   throw error;
  }finally{timeout.cleanup()}
 }
}
