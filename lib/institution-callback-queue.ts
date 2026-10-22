export const callbackRetryPolicy={maxAttempts:5,backoffSeconds:[60,300,900,3600] as const};

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

// Manual dead-letter recovery starts a new retry epoch. Automatic retries stay
// bounded by maxAttempts; an explicit admin action gets one fresh pending row
// instead of being rejected because the previous epoch already exhausted it.
export function manualCallbackRetry(attempt:number,now=Math.floor(Date.now()/1000)){
 const base=Math.max(callbackRetryPolicy.maxAttempts,Math.floor(attempt));
 return {attempt:base+1,status:'pending' as const,nextAt:now+callbackRetryPolicy.backoffSeconds[0]};
}
