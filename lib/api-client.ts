/** Browser-safe API boundary. Keep server-only modules out of this file. */
export type ApiFailure={error?:string;code?:string;requestId?:string;retryAfter?:number};
export class ApiClientError extends Error{
 readonly code:string;
 readonly status:number;
 readonly requestId?:string;
 constructor(message:string,status:number,body:ApiFailure={}){super(message);this.name='ApiClientError';this.code=body.code||'REQUEST_FAILED';this.status=status;this.requestId=body.requestId}
}

function baseUrl(){
 if(typeof window==='undefined')return '';
 const configured=(window as Window & {__PAYEASE_API_BASE__?:string}).__PAYEASE_API_BASE__;
 return configured?.replace(/\/$/,'')||'';
}

export function apiUrl(path:string){return `${baseUrl()}${path.startsWith('/')?path:`/${path}`}`}

export async function apiFetch<T=unknown>(path:string,init:RequestInit={}){
 const headers=new Headers(init.headers);
 if(init.body&&!headers.has('content-type')&&typeof init.body==='string')headers.set('content-type','application/json');
 if(!headers.has('x-request-id'))headers.set('x-request-id',crypto.randomUUID());
 const response=await fetch(apiUrl(path),{...init,headers,credentials:init.credentials||'include'});
 const requestId=response.headers.get('x-request-id')||undefined;
 const type=response.headers.get('content-type')||'';
 const body=type.includes('application/json')?await response.json().catch(()=>({})):await response.blob();
 if(!response.ok){
  const failure=(body&&typeof body==='object'&&!('size' in body)?body:{}) as ApiFailure;
  throw new ApiClientError(failure.error||'请求未完成，请稍后重试',response.status,{...failure,requestId:failure.requestId||requestId});
 }
 return {data:body as T,response,requestId};
}
