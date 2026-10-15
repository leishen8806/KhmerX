import {env} from 'cloudflare:workers';
import type {Loan,State} from './domain';

export type CustomerRowsMode='off'|'shadow'|'on';
export type CustomerShard=Pick<State,'loans'|'events'|'entries'|'notifications'|'requests'|'requestDigests'>;
type DB={prepare(sql:string):{bind(...args:unknown[]):{first<T=Record<string,unknown>>():Promise<T|null>;all<T=Record<string,unknown>>():Promise<{results:T[]}>;run():Promise<{meta:{changes:number}}>}};batch(statements:unknown[]):Promise<Array<{meta:{changes:number}}>>};

const bindings=()=>env as unknown as Record<string,unknown>;
export function customerRowsMode():CustomerRowsMode{
 const value=String(bindings().CUSTOMER_ROWS||'off').toLowerCase();
 return value==='shadow'||value==='on'?value:'off';
}

export function shardForCustomer(state:State,customerId:string):CustomerShard{
 const loans=state.loans.filter(loan=>loan.customerId===customerId);
 const ids=new Set(loans.map(loan=>loan.id));
 return {
  loans,
  events:state.events.filter(event=>ids.has(event.loanId)),
  entries:state.entries.filter(entry=>ids.has(entry.loanId)),
  notifications:state.notifications.filter(notification=>ids.has(notification.loanId)),
  requests:[],
  requestDigests:{},
 };
}

function indexStatements(db:DB,owner:string,customerId:string,loans:Loan[],revision:number){
 const guard=[owner,customerId,revision];
 const now=new Date().toISOString();
 const statements:unknown[]=[db.prepare('DELETE FROM loan_index WHERE owner=? AND customer_id=? AND EXISTS (SELECT 1 FROM customer_workspaces WHERE owner=? AND customer_id=? AND revision=?)').bind(owner,customerId,...guard)];
 for(const loan of loans){
  statements.push(db.prepare(`INSERT INTO loan_index(owner,loan_id,customer_id,status,created_at,updated_at)
    SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM customer_workspaces WHERE owner=? AND customer_id=? AND revision=? )
    ON CONFLICT(owner,loan_id) DO UPDATE SET customer_id=excluded.customer_id,status=excluded.status,created_at=excluded.created_at,updated_at=excluded.updated_at`)
   .bind(owner,loan.id,customerId,loan.status,loan.createdAt,now,...guard));
 }
 return statements;
}

export async function readCustomerShard(db:DB,owner:string,customerId:string){
 return db.prepare('SELECT revision,payload FROM customer_workspaces WHERE owner=? AND customer_id=?')
  .bind(owner,customerId).first<{revision:number;payload:string}>();
}

export async function writeCustomerShard(db:DB,owner:string,customerId:string,state:State,revision:number,requestId?:string,strictRevision=true){
 const existing=await readCustomerShard(db,owner,customerId);
 const shard=shardForCustomer(state,customerId);
 const requests=existing?(JSON.parse(existing.payload) as CustomerShard):{requests:[] as string[],requestDigests:{} as Record<string,string>};
 shard.requests=Array.isArray(requests.requests)?requests.requests.slice(-499):[];
 shard.requestDigests={...(requests.requestDigests||{})};
 if(requestId&&state.requestDigests?.[requestId]!==undefined){
  shard.requests.push(requestId);
  shard.requestDigests[requestId]=state.requestDigests[requestId];
 }
 if(shard.requests.length>500){const removed=shard.requests.splice(0,shard.requests.length-500);for(const id of removed)delete shard.requestDigests[id];}
 await db.prepare('INSERT OR IGNORE INTO customer_workspaces(owner,customer_id,revision,payload,updated_at) VALUES(?,?,?,?,?)')
  .bind(owner,customerId,0,JSON.stringify(shard),new Date().toISOString()).run();
 const expected=strictRevision?revision:(existing?.revision??0);
 const next=expected+1;
 const result=await db.batch([
  db.prepare('UPDATE customer_workspaces SET revision=?,payload=?,updated_at=? WHERE owner=? AND customer_id=? AND revision=?')
   .bind(next,JSON.stringify(shard),new Date().toISOString(),owner,customerId,expected),
  ...indexStatements(db,owner,customerId,shard.loans,next),
 ]);
 return result[0]?.meta.changes===1;
}

export async function flushCustomerShardWrites(){
 // Kept as a stable async boundary for tests and future queueing.
 await Promise.resolve();
}
