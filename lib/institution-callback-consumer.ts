import {validLoanContract} from '@/lib/loan-signing';
import {findCase} from '@/lib/kyc/server';
import {auditInsertSql} from '@/lib/team/audit-writer';
import {customerRowsMode,staffPayload,loanIndexUpdate} from '@/lib/customer-shards';
import type {State} from '@/lib/domain';
import {serializeWorkspacePayload} from '@/lib/workspace-payload';
import {applyInstitutionDecision,type InstitutionDecision} from '@/lib/institution-callback-decision';

type Database=Pick<D1Database,'prepare'|'batch'>;
type Source={customer_id?:string;revision:number;payload:string};

export type InstitutionDecisionResult={status:'applied'|'rejected'|'dead_letter'|'received';reason?:string;loanId?:string};

function parsePayload(raw:string){try{return JSON.parse(raw) as Record<string,unknown>}catch{throw new Error('机构回调载荷无效')}}
const text=(value:unknown,max=300)=>typeof value==='string'?value.trim().slice(0,max):'';

export async function consumeInstitutionCallbackEvent(input:{database:Database;tenantId:string;institutionId:string;eventId:string;eventType:string;payload:string}):Promise<InstitutionDecisionResult>{
 const {database,tenantId,institutionId,eventId,eventType,payload}=input;
 if(eventType!=='loan.approved'&&eventType!=='loan.rejected')return {status:'received',reason:'report_only'};
 const body=parsePayload(payload),data=body.data&&typeof body.data==='object'&&!Array.isArray(body.data)?body.data as Record<string,unknown>:{};
 const loanId=text(body.loanId||data.loanId,120),reason=text(body.reason||data.reason,300);
 if(!loanId)return {status:'dead_letter',reason:'LOAN_ID_MISSING'};
 const rows=customerRowsMode()==='on';
 const source:Source|undefined=(rows?await database.prepare('SELECT customer_id,revision,payload FROM customer_workspaces c WHERE c.owner=? AND EXISTS (SELECT 1 FROM loan_index i WHERE i.owner=c.owner AND i.customer_id=c.customer_id AND i.loan_id=?)').bind(tenantId,loanId).first<Source>():await database.prepare('SELECT revision,payload FROM demo_workspaces WHERE owner=?').bind(tenantId).first<Source>())||undefined;
 if(!source)return {status:'dead_letter',reason:'LOAN_NOT_FOUND',loanId};
 const state=JSON.parse(source.payload) as State,loan=state.loans.find(item=>item.id===loanId);
 if(!loan)return {status:'dead_letter',reason:'LOAN_NOT_FOUND',loanId};
 const assignment=loan.customerId?await database.prepare('SELECT institution_id FROM team_assignments WHERE tenant_id=? AND customer_id=?').bind(tenantId,loan.customerId).first<{institution_id:string|null}>():null;
 if(!assignment||assignment.institution_id!==institutionId)return {status:'dead_letter',reason:'INSTITUTION_MISMATCH',loanId};
 if(loan.status!=='decision_pending'||loan.approvalActor)return {status:'dead_letter',reason:'STATUS_MISMATCH',loanId};
 let contract:string|undefined;
 if(eventType==='loan.approved'){
  const row=loan.customerId?await findCase(tenantId,loan.customerId):null;
  if(!row)return {status:'dead_letter',reason:'KYC_CASE_MISSING',loanId};
  try{const valid=await validLoanContract(tenantId,loan,row);contract=JSON.stringify({...valid,notice:'仅测试资金，不产生真实债务'});}catch{return {status:'dead_letter',reason:'CONTRACT_INVALID',loanId};}
 }
 let next:State;try{next=applyInstitutionDecision(state,loanId,eventType as InstitutionDecision,`institution:${institutionId}`,reason,contract)}catch(error){return {status:'dead_letter',reason:error instanceof Error?error.message:'DECISION_INVALID',loanId};}
 const now=new Date().toISOString(),detail={eventId,loanId,eventType,institutionId};
 const write=rows
  ?database.prepare('UPDATE customer_workspaces SET payload=?,revision=revision+1,updated_at=? WHERE owner=? AND customer_id=? AND revision=?').bind(staffPayload(next,source.customer_id),now,tenantId,source.customer_id,source.revision)
  :database.prepare('UPDATE demo_workspaces SET payload=?,revision=revision+1 WHERE owner=? AND revision=?').bind(serializeWorkspacePayload(next),tenantId,source.revision);
 const statements=[write,auditInsertSql(database,tenantId,`institution:${institutionId}`,'institution_approval_callback',detail,crypto.randomUUID(),'changed')];
 if(rows)statements.push(loanIndexUpdate(database,tenantId,source.customer_id!,next.loans.find(item=>item.id===loanId)!,source.revision+1,staffPayload(next,source.customer_id!)) as never);
 const result=await database.batch(statements);
 if(result[0]?.meta.changes!==1)return {status:'received',reason:'REVISION_CONFLICT',loanId};
 return {status:eventType==='loan.rejected'?'rejected':'applied',loanId};
}
