import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const check=(ok,message)=>{if(!ok)throw Error(message)};
export function csvRows(text){
 const records=[];let row=[],value='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(value);value=''}else if(c==='\n'&&!quoted){row.push(value.replace(/\r$/,''));records.push(row);row=[];value=''}else value+=c}
 check(!quoted,'Unclosed CSV quote');if(value||row.length){row.push(value);records.push(row)}const header=records.shift()||[];return records.filter(r=>r.length===header.length).map(r=>Object.fromEntries(header.map((k,i)=>[k,r[i]])));
}
export function concurrency(intervals){
 const events=intervals.flatMap(([start,end])=>[[start,1],[end,-1]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let active=0,max=0;for(const [,n]of events){active+=n;max=Math.max(max,active)}return max;
}
const quantile=(values,p)=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(p*sorted.length)-1)]};
export function analyze(text,summary){
 const samples=csvRows(text),tagsOf=r=>Object.fromEntries((r.extra_tags||'').split('&').filter(Boolean).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),decodeURIComponent(x.slice(i+1))]}));
 const rows=samples.filter(r=>r.metric_name==='rows_request_ms').map(r=>{
  const tags=tagsOf(r);return {...r,...tags,start:Number(r.start_ms||tags.start_ms),ms:Number(r.metric_value)};
 });
 check(rows.length,'Missing request samples');check(rows.every(r=>Number.isFinite(r.start)&&Number.isFinite(r.ms)&&r.ms>=0),'Invalid request interval');
 const writes=rows.filter(r=>['create','confirm_bill'].includes(r.endpoint)),first=writes.filter(r=>r.attempt==='0');
 check(writes.length,'No writes observed; aborted run cannot provide write metrics');
 const start=Math.min(...writes.map(r=>r.start)),end=Math.max(...writes.map(r=>r.start+r.ms)),max=concurrency(writes.map(r=>[r.start,r.start+r.ms]));
 const totalMs=Math.max(...rows.map(r=>r.start+r.ms))-Math.min(...rows.map(r=>r.start)),counts=field=>Object.fromEntries([...new Set(rows.map(r=>r[field]))].map(k=>[k,rows.filter(r=>r[field]===k).length]));
 const rate=rows.filter(r=>r.status==='429').length/rows.length,conflicts=first.filter(r=>r.status==='409'&&r.kind==='conflict').length;
 const latency=Object.fromEntries(['create','confirm_bill','state_get'].map(endpoint=>{const v=rows.filter(r=>r.endpoint===endpoint).map(r=>r.ms);return [endpoint,{p50:quantile(v,.5),p95:quantile(v,.95),p99:quantile(v,.99)}]}));
 const phases={writes:rows.filter(r=>r.start>=start&&r.start<=end),readback:rows.filter(r=>r.endpoint==='state_get'&&r.start>end)};
 const windows=Object.fromEntries(Object.entries(phases).map(([phase,items])=>{const windowMs=items.length?Math.max(...items.map(r=>r.start+r.ms))-Math.min(...items.map(r=>r.start)):0;return [phase,{requests:items.length,windowMs,rps:windowMs?items.length*1000/windowMs:0}]}));
 const bins={};for(const r of rows){const second=String(Math.floor((r.start-Math.min(...rows.map(x=>x.start)))/1000));bins[second]=(bins[second]||0)+1}
 const retriesByReason={conflict:0,network:0,service:0};for(const sample of samples.filter(r=>r.metric_name==='rows_retries')){const reason=tagsOf(sample).reason;if(Object.hasOwn(retriesByReason,reason))retriesByReason[reason]+=Number(sample.metric_value)}
 return {...summary,conflictHeuristic:'OPEN-1: optimistic conflicts identified by message text',retriesByReason,failedAfterRetry:samples.filter(r=>r.metric_name==='rows_outcome'&&['create_failed','confirm_failed'].includes(tagsOf(r).category)&&writes.some(w=>w.index===tagsOf(r).index&&w.attempt!=='0')).length,payloadLimitRequests:rows.filter(r=>r.code==='WORKSPACE_PAYLOAD_LIMIT').length,totalRequests:rows.length,totalDurationMs:totalMs,requestsPerSecond:totalMs?rows.length*1000/totalMs:0,perSecond:bins,latency,windows,maxInFlightWrites:max,writeWindow:{start,end},barrierOffsetMs:writes.filter(r=>r.endpoint==='create'&&r.attempt==='0').map(r=>({index:Number(r.index),ms:r.start-summary.startAt})),firstWrites:first.length,firstOptimistic409:conflicts,optimisticConflictRate:first.length?conflicts/first.length:null,retry409:writes.filter(r=>r.attempt!=='0'&&r.status==='409').length,statusCounts:counts('status'),codeCounts:counts('code'),invalid:rate>.005?'INVALID: rate limited':null,concurrencyWarning:max<summary.vus*.8?'Observed concurrency insufficient; not Gate E evidence':null};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const [csv,summary,output]=process.argv.slice(2);writeFileSync(output,JSON.stringify(analyze(readFileSync(csv,'utf8'),JSON.parse(readFileSync(summary,'utf8'))),null,2))}catch{console.error('Rows analysis rejected invalid or incomplete inputs');process.exitCode=1}}
