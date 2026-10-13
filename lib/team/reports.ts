import {AuthError} from '@/lib/h5-auth-core';
import {audit,staff} from './server';
import {scopedState} from './workflow';
import {csvCell} from './csv';

const reportRoles=['admin','audit','ops','dept_admin','finance','finance_checker','collection_admin','collector'];
const maskedId=(value:string)=>value.length>10?`${value.slice(0,6)}…${value.slice(-4)}`:value;

export async function exportCustomerSummary(input:any){
 const s=await staff();
 if(!s||!reportRoles.includes(s.member.role))throw new AuthError('当前岗位没有报表导出权限',403);
 const report=String(input?.report||'');if(!['customer_summary','kyc_funnel','loan_cashflow','collections'].includes(report))throw new AuthError('报表类型无效');
 const requestId=typeof input?.requestId==='string'?input.requestId.trim():'';
 if(!/^[A-Za-z0-9_-]{8,100}$/.test(requestId))throw new AuthError('请求编号无效');
 const data=await scopedState(),exportedAt=new Date().toISOString();
 const header=report==='customer_summary'?['customer_id_masked','phone_masked','registered_at','kyc_status','kyc_revision','loan_count','loan_statuses','disbursed_usd','repaid_usd']:report==='kyc_funnel'?['kyc_status','customer_count']:report==='loan_cashflow'?['loan_id_masked','customer_id_masked','status','principal_usd','fee_usd','paid_usd','due_at']:['loan_id_masked','customer_id_masked','status','overdue_days','outstanding_usd'];
 const overdueDays=(loan:any)=>{const due=Date.parse(loan.dueAt||'');return Number.isFinite(due)&&due<Date.now()?Math.max(1,Math.floor((Date.now()-due)/86400000)):Number(loan.demoDays||0)>0?Number(loan.demoDays):0};
 const rows=report==='customer_summary'?data.customers.map((customer:any)=>{
  const loans=(customer.loans||[]) as any[],ids=new Set(loans.map(loan=>loan.id));
  const entries=(data.state.entries||[]).filter((entry:any)=>ids.has(entry.loanId));
  const dollars=(kind:string)=>entries.filter((entry:any)=>entry.kind===kind).reduce((sum:number,entry:any)=>sum+(Number(entry.cents)||0),0)/100;
  return [maskedId(String(customer.customerId)),customer.phoneMasked||'',customer.registeredAt||'',customer.kyc?.status||'not_created',customer.kyc?.revision??'',loans.length,loans.map(loan=>loan.status).join('|'),dollars('测试放款').toFixed(2),dollars('测试还款').toFixed(2)];
 }):report==='kyc_funnel'?Object.entries(data.customers.reduce((out:any,c:any)=>{const k=c.kyc?.status||'not_created';out[k]=(out[k]||0)+1;return out},{})).map(([status,count])=>[status,count]):report==='loan_cashflow'?data.state.loans.map((loan:any)=>{const entries=(data.state.entries||[]).filter((e:any)=>e.loanId===loan.id);const total=(kind:string)=>entries.filter((e:any)=>e.kind===kind).reduce((n:number,e:any)=>n+(Number(e.cents)||0),0)/100;return [maskedId(loan.id),maskedId(String(loan.customerId||'unlinked')),loan.status,(Number(loan.amount||0)/100).toFixed(2),(Number(loan.fee||0)/100).toFixed(2),total('测试还款').toFixed(2),loan.dueAt||''] }):data.state.loans.filter((loan:any)=>overdueDays(loan)>0&&loan.status!=='closed').map((loan:any)=>[maskedId(loan.id),maskedId(String(loan.customerId||'unlinked')),loan.status,overdueDays(loan),((Number(loan.amount||0)+Number(loan.fee||0)-Number(loan.paid||0))/100).toFixed(2)]);
 const csv=[header,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
 await audit(s.tenant.id,s.user.userId,'report_export',{report,format:'csv',rows:rows.length,requestId,redacted:true,exportedAt}).run();
 return {csv,count:rows.length,exportedAt,filename:`payease-${report}.csv`};
}
