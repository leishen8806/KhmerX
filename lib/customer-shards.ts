import {env} from 'cloudflare:workers';
import type {Loan,State} from './domain';
import {initialState} from './domain';
import type {Member} from './team/policy';
import {ApiError} from './http/api-error';

export type CustomerRowsMode='off'|'shadow'|'on';
export type CustomerShard=Pick<State,'loans'|'events'|'entries'|'notifications'|'requests'|'requestDigests'>;
type DB=Pick<D1Database,'prepare'|'batch'>;

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
 const statements=[db.prepare('DELETE FROM loan_index WHERE owner=? AND customer_id=? AND EXISTS (SELECT 1 FROM customer_workspaces WHERE owner=? AND customer_id=? AND revision=?)').bind(owner,customerId,...guard)];
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
 shard.requests=Array.isArray(requests.requests)?requests.requests.slice():[];
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

export type StaffPage={page?:number;pageSize?:number;status?:string};
const pageNumber=(value:number|undefined,fallback:number)=>Number.isFinite(value)&&Number(value)>0?Math.min(Number.MAX_SAFE_INTEGER,Math.max(1,Math.floor(Number(value)))):fallback;
export async function tenantConfig(db:DB,owner:string){
 const row=await db.prepare("SELECT revision,json_remove(payload,'$.loans','$.entries','$.events','$.notifications','$.requests','$.requestDigests') AS payload FROM demo_workspaces WHERE owner=?").bind(owner).first<{revision:number;payload:string}>();
 const state={...initialState(),...(row?JSON.parse(row.payload):{}),loans:[],entries:[],events:[],notifications:[],requests:[],requestDigests:{}} as State;
 const credentials=(await db.prepare('SELECT bot_id,telegram_id,label,username FROM telegram_bot_credentials WHERE owner=?').bind(owner).all<{bot_id:string;telegram_id:string;label:string;username:string}>()).results;
 for(const bot of state.bots){const saved=credentials.find(c=>c.bot_id===bot.id);bot.tokenConfigured=!!saved;if(saved){bot.label=saved.label;bot.username=saved.username;bot.telegramId=saved.telegram_id}}
 return {state,revision:row?.revision||0};
}
export async function staffLoanState(db:DB,owner:string,loanId:string){
 const tenant=await tenantConfig(db,owner);
 const row=await db.prepare('SELECT c.customer_id,c.revision,c.payload FROM loan_index i JOIN customer_workspaces c ON c.owner=i.owner AND c.customer_id=i.customer_id WHERE i.owner=? AND i.loan_id=?').bind(owner,loanId).first<{customer_id:string;revision:number;payload:string}>();
 if(!row)throw new ApiError(404,'NOT_FOUND','Loan unavailable');
 return {state:{...tenant.state,...JSON.parse(row.payload)} as State,revision:row.revision,customerId:row.customer_id,tenantRevision:tenant.revision};
}
export async function tenantFundingEntries(db:DB,owner:string,now=new Date().toISOString()){
 // Aggregate authoritative shard entries; legacy JSON is frozen after cutover.
 const rows=(await db.prepare("SELECT date(json_extract(e.value,'$.at'),'+7 hours') AS day,SUM(json_extract(e.value,'$.cents')) AS cents FROM customer_workspaces c,json_each(c.payload,'$.entries') e WHERE c.owner=? AND json_extract(e.value,'$.kind')=? AND strftime('%Y-%m',json_extract(e.value,'$.at'),'+7 hours')=strftime('%Y-%m',?,'+7 hours') GROUP BY day").bind(owner,'\u6d4b\u8bd5\u653e\u6b3e',now).all<{day:string;cents:number}>()).results;
 return rows.map(r=>({id:r.day,loanId:'',kind:'\u6d4b\u8bd5\u653e\u6b3e',cents:r.cents,debit:'',credit:'',at:r.day+'T12:00:00+07:00'}));
}
export function loanIndexUpdate(db:DB,owner:string,customerId:string,loan:Loan,revision:number,payload:string){
 return db.prepare('UPDATE loan_index SET status=?,updated_at=? WHERE owner=? AND loan_id=? AND customer_id=? AND EXISTS (SELECT 1 FROM customer_workspaces WHERE owner=? AND customer_id=? AND revision=? AND payload=?)').bind(loan.status,new Date().toISOString(),owner,loan.id,customerId,owner,customerId,revision,payload);
}
export function staffPayload(state:State,customerId?:string){return JSON.stringify(customerId?{...shardForCustomer(state,customerId),requests:state.requests,requestDigests:state.requestDigests||{}}:state)}
export function staffStateWrite(db:DB,owner:string,revision:number,state:State,customerId:string|undefined,guard:string,values:unknown[]){
 return db.prepare(`UPDATE ${customerId?'customer_workspaces':'demo_workspaces'} SET payload=?,revision=revision+1 ${customerId?',updated_at=?':''} WHERE owner=? AND revision=? ${customerId?'AND customer_id=?':''} AND ${guard}`).bind(staffPayload(state,customerId),...(customerId?[new Date().toISOString()]:[]),owner,revision,...(customerId?[customerId]:[]),...values);
}
export async function readStaffPage(db:DB,member:Member,input:StaffPage={}){
 const owner=member.tenant_id,page=pageNumber(input.page,1),pageSize=Math.min(200,pageNumber(input.pageSize,50)),offset=Math.min(Number.MAX_SAFE_INTEGER,(page-1)*pageSize);
 const role=member.role,unit=member.unit_id;
 const visibility=!member.active?'0':['admin','audit'].includes(role)?'1':['dept_admin','ops'].includes(role)?'a.department_id=?':role==='kyc'?'a.department_id=? AND a.reviewer_id=?':['lender','checker'].includes(role)?'a.institution_id=?':['finance','finance_checker'].includes(role)?"COALESCE(NULLIF(a.funding_institution_id,''),a.institution_id)=?":'0';
 const scopeArgs=visibility.includes('?')?(role==='kyc'?[unit,member.id]:[unit]):[];
 const scope=`a.tenant_id=? AND (${visibility})`;
 const from=`FROM loan_index i JOIN team_assignments a ON a.tenant_id=i.owner AND a.customer_id=i.customer_id WHERE ${scope}${input.status?' AND i.status=?':''}`;
 const values=[owner,...scopeArgs,...(input.status?[input.status]:[])];
 const total=(await db.prepare(`SELECT COUNT(*) AS n ${from}`).bind(...values).first<{n:number}>())?.n||0;
 const indexes=(await db.prepare(`SELECT i.loan_id,i.customer_id ${from} ORDER BY i.updated_at DESC,i.loan_id DESC LIMIT ? OFFSET ?`).bind(...values,pageSize,offset).all<{loan_id:string;customer_id:string}>()).results;
 const customerFrom=`FROM h5_accounts h JOIN team_assignments a ON a.tenant_id=h.owner AND a.customer_id=h.customer_id WHERE ${scope}`;
 const customerTotal=(await db.prepare(`SELECT COUNT(*) AS n ${customerFrom}`).bind(owner,...scopeArgs).first<{n:number}>())?.n||0;
 const customerIds=(await db.prepare(`SELECT h.customer_id ${customerFrom} ORDER BY h.created_at DESC,h.customer_id DESC LIMIT ? OFFSET ?`).bind(owner,...scopeArgs,pageSize,offset).all<{customer_id:string}>()).results.map(x=>x.customer_id);
 const ids=[...new Set([...indexes.map(x=>x.customer_id),...customerIds])],loans=new Set(indexes.map(x=>x.loan_id)),customerLoans:Loan[]=[];
 const rows=ids.length?(await db.prepare('SELECT payload FROM customer_workspaces WHERE owner=? AND customer_id IN (SELECT value FROM json_each(?))').bind(owner,JSON.stringify(ids)).all<{payload:string}>()).results:[];
 const data=await tenantConfig(db,owner),state=data.state;
 for(const row of rows){const shard=JSON.parse(row.payload) as CustomerShard;customerLoans.push(...shard.loans.filter(x=>customerIds.includes(x.customerId||'')));state.loans.push(...shard.loans.filter(x=>loans.has(x.id)));state.entries.push(...shard.entries.filter(x=>loans.has(x.loanId)));state.events.push(...shard.events.filter(x=>loans.has(x.loanId)));state.notifications.push(...shard.notifications.filter(x=>loans.has(x.loanId)))}
 const order=new Map(indexes.map((x,i)=>[x.loan_id,i]));state.loans.sort((a,b)=>order.get(a.id)!-order.get(b.id)!);
 state.events.sort((a,b)=>b.at.localeCompare(a.at));state.events=state.events.slice(0,200);state.notifications.sort((a,b)=>b.at.localeCompare(a.at));state.notifications=state.notifications.slice(0,200);
 const metadata=(total:number)=>({page,pageSize,total,pages:Math.max(1,Math.ceil(total/pageSize))});
 return {...data,pagination:metadata(total),customerPagination:metadata(customerTotal),customerIds,scopeIds:ids,customerLoans};
}
