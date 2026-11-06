export const callbackRetryPolicy={maxAttempts:5,backoffSeconds:[60,300,900,3600] as const};
export const revisionConflictRetryDelaySeconds=30;
export const revisionConflictInlineAttempts=3;

export function nextCallbackRetry(attempt:number,now=Math.floor(Date.now()/1000)){
 const n=Math.max(1,Math.floor(attempt));
 if(n>=callbackRetryPolicy.maxAttempts)return {status:'dead_letter' as const,nextAt:null};
 const delay=callbackRetryPolicy.backoffSeconds[Math.min(n-1,callbackRetryPolicy.backoffSeconds.length-1)];
 return {status:'pending' as const,nextAt:now+delay};
}

export function callbackAttemptStatus(attempts:number,lastError?:string){
 const next=nextCallbackRetry(attempts);
 return {attempts, status:next.status, nextAt:next.nextAt, lastError:lastError?.slice(0,500)||null};
}

export function callbackConsumerRetry(reason:string|undefined,now=Math.floor(Date.now()/1000)){
 if(reason!=='REVISION_CONFLICT')return null;
 return {eventStatus:'received' as const,attemptStatus:'pending' as const,nextAt:now+revisionConflictRetryDelaySeconds,lastError:reason};
}

export async function retryRevisionConflict<T extends {reason?:string}>(consume:()=>Promise<T>){
 let result:T;
 for(let attempt=1;attempt<=revisionConflictInlineAttempts;attempt++){
  result=await consume();
  if(result.reason!=='REVISION_CONFLICT')return {result,attempts:attempt,exhausted:false};
 }
 return {result:result!,attempts:revisionConflictInlineAttempts,exhausted:true};
}
