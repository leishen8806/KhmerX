import {AuthError} from '@/lib/h5-auth-core';
import {audit,staff} from './server';
import {scopedState} from './workflow';

const reportRoles=['admin','audit','ops','dept_admin','finance','finance_checker','collection_admin','collector'];
const csvCell=(value:unknown)=>{
 const text=String(value??'').replace(/\r?\n/g,' ');
 const safe=/^[=+\-@]/.test(text)?`'${text}`:text;
 return /[",]/.test(safe)?`"${safe.replace(/"/g,'""')}"`:safe;
};
const maskedId=(value:string)=>value.length>10?`${value.slice(0,6)}…${value.slice(-4)}`:value;

export async function exportCustomerSummary(input:any){
 const s=await staff();
 if(!s||!reportRoles.includes(s.member.role))throw new AuthError('当前岗位没有报表导出权限',403);
 if(input?.report!=='customer_summary')throw new AuthError('报表类型无效');
 const requestId=typeof input?.requestId==='string'?input.requestId.trim():'';
 if(!/^[A-Za-z0-9_-]{8,100}$/.test(requestId))throw new AuthError('请求编号无效');
 const data=await scopedState(),exportedAt=new Date().toISOString();
 const header=['customer_id_masked','phone_masked','registered_at','kyc_status','kyc_revision','loan_count','loan_statuses','disbursed_usd','repaid_usd'];
 const rows=data.customers.map((customer:any)=>{
  const loans=(customer.loans||[]) as any[],ids=new Set(loans.map(loan=>loan.id));
  const entries=(data.state.entries||[]).filter((entry:any)=>ids.has(entry.loanId));
  const dollars=(kind:string)=>entries.filter((entry:any)=>entry.kind===kind).reduce((sum:number,entry:any)=>sum+(Number(entry.cents)||0),0)/100;
  return [maskedId(String(customer.customerId)),customer.phoneMasked||'',customer.registeredAt||'',customer.kyc?.status||'not_created',customer.kyc?.revision??'',loans.length,loans.map(loan=>loan.status).join('|'),dollars('测试放款').toFixed(2),dollars('测试还款').toFixed(2)];
 });
 const csv=[header,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
 await audit(s.tenant.id,s.user.userId,'report_export',{report:'customer_summary',format:'csv',rows:rows.length,requestId,redacted:true,exportedAt}).run();
 return {csv,count:rows.length,exportedAt};
}
