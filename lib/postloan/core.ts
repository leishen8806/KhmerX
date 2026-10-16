import type {State,Loan} from '../domain';
import type {Member} from '../team/policy';
export const outcomes={contacted:'已联系',no_answer:'未接通',promise:'承诺还款',dispute:'客户异议',follow_up:'继续跟进'} as const;
export type PostRecord={id:string;at:string;actor:string;action:string;note:string;nextContactAt?:string;promiseDate?:string};
export type PostTask={id:string;loanId:string;departmentId:string;assigneeId:string|null;stage:'due'|'overdue';status:'open'|'following'|'promised'|'dispute'|'closed';dueDate:string;overdueDays:number;balance:number;createdAt:string;updatedAt:string;nextContactAt?:string;promiseDate?:string;records:PostRecord[]};
export type Postloan={tasks:PostTask[];lastCheckedAt?:string;lastJobAt?:string};
// Cambodian calendar days, independent of server timezone. Due day is not overdue.
export function localDay(iso:string){const n=Date.parse(iso);if(!Number.isFinite(n))throw Error('日期无效');return new Date(n+7*3600000).toISOString().slice(0,10)}
export function dayGap(a:string,b:string){return Math.round((Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/86400000)}
export function outstanding(l:Loan){return Math.max(0,l.amount+l.fee-l.paid)}
export function mayViewTask(m:Member,t:PostTask){return !!m.active&&(['admin','audit'].includes(m.role)||(m.role==='collection_admin'&&m.unit_id===t.departmentId)||(m.role==='collector'&&m.unit_id===t.departmentId&&m.id===t.assigneeId))}
function record(t:PostTask,at:string,action:string,note:string){t.records.push({id:crypto.randomUUID(),at,actor:'系统',action,note});t.updatedAt=at}
/** Immediately return a staff member's open post-loan work to the queue.
 * This is used during an account disable/scope change so access revocation is
 * visible in the same write, rather than waiting for the next scheduler run.
 */
export function unassignMemberTasks(input:State,memberId:string,now:string):State{
 const s:State=structuredClone(input);for(const task of s.postloan?.tasks||[]){
  if(task.assigneeId!==memberId||task.status==='closed')continue;
  task.assigneeId=null;record(task,now,'auto_unassign','员工停用或调岗，已转待分配队列');
 }
 return s;
}
export function syncSettlements(state:State,now:string){for(const t of state.postloan?.tasks||[]){const l=state.loans.find(l=>l.id===t.loanId);if(!l)continue;t.balance=outstanding(l);if((l.status==='closed'||t.balance===0)&&t.status!=='closed'){t.status='closed';delete t.nextContactAt;record(t,now,'settled','账本已确认全部结清，自动关闭贷后任务')}}}
export function runPostloan(input:State,members:Member[],departmentIds:string[],now:string,routing?:{enabled:boolean;departments:Record<string,string>}):State{
 const s:State=structuredClone(input),today=localDay(now);s.postloan??={tasks:[]};syncSettlements(s,now);
 const eligible=members.filter(m=>m.active&&m.role==='collector'&&departmentIds.includes(m.unit_id||''));
 const assign=(t:PostTask)=>{const candidates=eligible.filter(m=>m.unit_id===t.departmentId).sort((a,b)=>s.postloan!.tasks.filter(x=>x.status!=='closed'&&x.assigneeId===a.id).length-s.postloan!.tasks.filter(x=>x.status!=='closed'&&x.assigneeId===b.id).length||a.id.localeCompare(b.id));const next=candidates[0]?.id||null;if(next!==t.assigneeId){t.assigneeId=next;record(t,now,'auto_assign',next?'系统按客服待办量自动分配':'原客服停用或调岗，已转待分配队列')}};
 for(const l of s.loans){if(l.status!=='active'||!l.dueAt||!l.customerId||outstanding(l)<=0)continue;const due=localDay(l.dueAt),days=dayGap(due,today);
  // Catch up a missed T-3 run once, while still before due date. No stale reminders after settlement.
  const reminderId='postloan-reminder:'+l.id+':'+due;
  if(days>0&&days<=3&&!s.notifications.some(n=>n.id===reminderId))s.notifications.unshift({id:reminderId,loanId:l.id,botId:l.botId,text:`还款提醒：您的贷款将于 ${due} 到期，当前待还 $${(outstanding(l)/100).toFixed(2)}，请及时查看账单并还款。`,at:now,status:'站内提醒已生成 · Telegram 按客户订阅单独投递'});
  if(days>0)continue;
  let t=s.postloan.tasks.find(t=>t.loanId===l.id);
  if(!t){const assigned=routing?.departments[l.customerId];const dept=(assigned&&departmentIds.includes(assigned)?assigned:undefined)||[...departmentIds].sort((a,b)=>s.postloan!.tasks.filter(t=>t.departmentId===a&&t.status!=='closed').length-s.postloan!.tasks.filter(t=>t.departmentId===b&&t.status!=='closed').length||a.localeCompare(b))[0];if(!dept)continue;t={id:l.id,loanId:l.id,departmentId:dept,assigneeId:null,stage:days<0?'overdue':'due',status:'open',dueDate:due,overdueDays:Math.max(0,-days),balance:outstanding(l),createdAt:now,updatedAt:now,records:[]};s.postloan.tasks.push(t);record(t,now,'created',days<0?'补建逾期跟进任务':'到期日生成还款跟进任务')}
  if(t.status==='closed')continue;t.balance=outstanding(l);t.overdueDays=Math.max(0,-days);
  if(days<0&&t.stage!=='overdue'){t.stage='overdue';record(t,now,'overdue','到期未结清，自动转入逾期跟进')}
  if(t.promiseDate&&today>t.promiseDate&&t.status==='promised'){t.status='following';record(t,now,'promise_missed','承诺还款日期已过且未结清，请继续跟进')}
  if(routing?.enabled!==false&&!eligible.some(m=>m.id===t!.assigneeId&&m.unit_id===t!.departmentId))assign(t);
 }
 s.postloan.lastCheckedAt=now;return s;
}
