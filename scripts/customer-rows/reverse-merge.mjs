import { args, db, ensureReport } from './common.mjs';

export const MAX_WORKSPACE_PAYLOAD_BYTES=1_500_000;

export function mergeCustomerShards(state,shards,owner='unknown'){
  const ids=new Set(shards.map(x=>x.customer_id));
  const oldCustomerLoanIds=new Set((state.loans||[]).filter(x=>ids.has(x.customerId)).map(x=>x.id));
  const loans=(state.loans||[]).filter(x=>!ids.has(x.customerId));
  for(const item of shards){const s=JSON.parse(item.payload);loans.push(...(s.loans||[]))}
  const keepRelated=x=>!oldCustomerLoanIds.has(x.loanId);
  const events=(state.events||[]).filter(keepRelated),entries=(state.entries||[]).filter(keepRelated),notifications=(state.notifications||[]).filter(keepRelated);
  for(const item of shards){const s=JSON.parse(item.payload);events.push(...(s.events||[]));entries.push(...(s.entries||[]));notifications.push(...(s.notifications||[]))}
  const next={...state,loans,events,entries,notifications,requests:[],requestDigests:{}};
  for(const item of shards){const s=JSON.parse(item.payload);for(const id of s.requests||[]){if(!next.requests.includes(id)){next.requests.push(id);next.requestDigests[id]=s.requestDigests?.[id]}}}
  const payload=JSON.stringify(next),bytes=new TextEncoder().encode(payload).byteLength;
  if(bytes>MAX_WORKSPACE_PAYLOAD_BYTES)throw new Error(`reverse merge exceeds workspace payload limit for ${owner}: ${bytes} bytes`);
  return {next,payload,bytes};
}

export function reverseMerge(database,{tenant,apply=false}={}){
  const rows=tenant?database.prepare('SELECT owner,revision,payload FROM demo_workspaces WHERE owner=?').all(tenant):database.prepare('SELECT owner,revision,payload FROM demo_workspaces').all(),report={owners:0,customers:0,apply,conflicts:0};
  for(const row of rows){const shards=database.prepare('SELECT customer_id,payload FROM customer_workspaces WHERE owner=?').all(row.owner);report.owners++;if(!shards.length)continue;const merged=mergeCustomerShards(JSON.parse(row.payload),shards,row.owner);report.customers+=shards.length;if(apply){const result=database.prepare('UPDATE demo_workspaces SET payload=?,revision=revision+1 WHERE owner=? AND revision=?').run(merged.payload,row.owner,row.revision);if(result.changes!==1){report.conflicts++;throw new Error(`reverse merge revision conflict for ${row.owner}`)}}}
  return report;
}
if(import.meta.url===`file:///${process.argv[1]?.replace(/\\/g,'/')}`){const a=args();const report=reverseMerge(db(),{tenant:a.tenant,apply:a.apply===true});ensureReport(a.report||'scripts/customer-rows/reverse-merge-report.json',report);console.log(report)}
