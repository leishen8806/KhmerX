import {existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

export function maintenanceResponse(request,flag='/data/gray-closed',retry=300){
 if(request.method==='GET'&&['/healthz','/readyz','/version'].includes(request.url))return null;
 if(!existsSync(flag))return null;
 const retryAfter=Number.isFinite(Number(retry))&&Number(retry)>0?Math.min(3600,Math.max(1,Math.floor(Number(retry)))):300;
 const requestId=randomUUID(),headers={'Cache-Control':'no-store','Retry-After':String(retryAfter),'X-Request-Id':requestId,'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'};
 const api=request.url?.startsWith('/api/');
 headers['Content-Type']=api?'application/json; charset=utf-8':'text/html; charset=utf-8';
 headers['Content-Security-Policy']="default-src 'none'; frame-ancestors 'none'; base-uri 'none'";
 const body=api?JSON.stringify({code:'SERVICE_UNAVAILABLE',error:'Service temporarily unavailable',requestId,params:{retryAfterSeconds:retryAfter}}):'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KhmerX maintenance</title><body><main><h1>KhmerX</h1><p lang="km">សេវាកម្មកំពុងផ្អាកបណ្ដោះអាសន្ន។ សូមព្យាយាមម្តងទៀតនៅពេលក្រោយ។</p><p lang="en">Service is temporarily paused. Please try again later.</p><p lang="zh">服务暂时维护，请稍后再试。</p></main></body></html>';
 return {status:503,headers,body};
}
