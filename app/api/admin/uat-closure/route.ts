import {env} from 'cloudflare:workers';
import {input,json,failure,sameOrigin} from '@/lib/h5-auth';
import {AuthError} from '@/lib/h5-auth-core';
import {platformAdmin,db,audit,ensureAssignment} from '@/lib/team/server';
import {initialState,customerAction,applyAction} from '@/lib/domain';
import {calculateBill,defaultPricing} from '@/lib/pricing';
import {serializeWorkspacePayload} from '@/lib/workspace-payload';
import {emptyProfile,RULE_VERSION} from '@/lib/kyc/core';
import {initialize,transition} from '@/lib/kyc/server';

export const dynamic='force-dynamic';

function config(){return env as unknown as Record<string,string|undefined>}
function text(value:unknown,max=80){return typeof value==='string'?value.trim().slice(0,max):''}
function assertEnabled(request:Request){
 const values=config();
 if(values.UAT_CLOSURE_ENABLED!=='true')throw new AuthError('UAT 闭环入口未启用',404,'UAT_CLOSURE_DISABLED');
 const expected=values.UAT_CLOSURE_TOKEN?.trim();
 const supplied=request.headers.get('x-uat-closure-token')?.trim();
 if(!expected||!supplied||supplied!==expected)throw new AuthError('UAT 闭环入口令牌无效',403,'UAT_CLOSURE_FORBIDDEN');
}
async function tenantFor(slug:string){
 if(!/^uat-[a-z0-9-]{3,55}$/.test(slug))throw new AuthError('仅允许专用 UAT 租户',403,'UAT_TENANT_REQUIRED');
 const tenant=await db().prepare('SELECT id,name,slug,active,default_department FROM team_companies WHERE slug=?').bind(slug).first<any>();
 if(!tenant||tenant.active!==1)throw new AuthError('UAT 租户不存在或已停用',404,'UAT_TENANT_NOT_FOUND');
 return tenant;
}
function ids(batch:string){return {customerId:`uat-customer-${batch}`,caseId:`uat-kyc-${batch}`}}

async function assertEmptyUatTenant(tenant:any){
 const workspace=await db().prepare('SELECT payload FROM demo_workspaces WHERE owner=?').bind(tenant.id).first<any>();
 if(workspace){
  let state:any;
  try{state=JSON.parse(workspace.payload)}catch{throw new AuthError('专用 UAT 租户工作区数据无效，禁止覆盖',409,'UAT_TENANT_NOT_EMPTY')}
  const collections=['customers','loans','entries','events','notifications'];
  if(collections.some(key=>Array.isArray(state?.[key])&&state[key].length>0))throw new AuthError('专用 UAT 租户已有业务数据，请先清理对应批次',409,'UAT_TENANT_NOT_EMPTY');
 }
 const existing=await db().batch([
  db().prepare('SELECT COUNT(*) AS n FROM h5_accounts WHERE owner=?').bind(tenant.id),
  db().prepare('SELECT COUNT(*) AS n FROM kyc_cases WHERE owner=?').bind(tenant.id),
  db().prepare('SELECT COUNT(*) AS n FROM team_assignments WHERE tenant_id=?').bind(tenant.id)
 ]);
 if(existing.some(row=>Number((row.results?.[0] as any)?.n||0)>0))throw new AuthError('专用 UAT 租户已有业务数据，请先清理对应批次',409,'UAT_TENANT_NOT_EMPTY');
}

async function seed(request:Request,p:any,operator:any){
 const batchId=text(p.batchId,64).toLowerCase(),slug=text(p.company,64).toLowerCase();
 if(!/^[a-z0-9][a-z0-9-]{2,63}$/.test(batchId))throw new AuthError('batchId 格式无效');
 const tenant=await tenantFor(slug),existing=await db().prepare('SELECT * FROM team_uat_closure_batches WHERE tenant_id=? AND batch_id=?').bind(tenant.id,batchId).first<any>();
 if(existing)return {ok:true,replayed:true,batch:existing};
 await assertEmptyUatTenant(tenant);
 const {customerId}=ids(batchId),now=new Date().toISOString(),customer={id:customerId,phoneMasked:'+855 12 •••• 0001',channel:'SY' as const};
 let caseId='';
 await db().prepare('INSERT OR IGNORE INTO h5_accounts (customer_id,owner,phone_mask,mode,created_at,verification_completed) VALUES (?,?,?,?,?,?)').bind(customerId,tenant.id,customer.phoneMasked,'demo',Date.now(),1).run();
 try{
  await ensureAssignment(tenant.id,customerId);
  const row=await initialize(tenant.id,customerId,true);caseId=row.id;
  const profile=emptyProfile();profile.consent=true;profile.values.surname='UAT';profile.values.givenName='ACCEPTANCE';
  const approved=await transition(row,'approved',{profile,phoneVerified:true,ruleVersion:RULE_VERSION,submittedAt:now,review:{decision:'approved',reason:'受控 UAT 合成资料',checklist:{identity:true,contacts:true,employment:true,income:true,assets:true,bank:true,consent:true},actor:operator.email,at:now,revision:row.revision}},'uat:approved',operator.email);
  let state=initialState();
  state=customerAction(state,{action:'create',name:'UAT ACCEPTANCE',amount:5000,consent:true,requestId:`${batchId}:create`},customer);
  const loan=state.loans[0],actualLoanId=loan.id;loan.kycCaseId=caseId;loan.kycRevision=approved.revision;loan.status='signed';loan.billConfirmedAt=now;loan.signedAt=now;loan.signature='UAT ACCEPTANCE';loan.contract=JSON.stringify({version:'uat-closure-v1',notice:'仅 UAT 合成数据'});loan.billing=calculateBill(loan.amount,{...defaultPricing,termDays:14},`${batchId}:quote`);loan.fee=loan.billing.total-loan.billing.principal;
  state=applyAction(state,{action:'disburse',role:'lender',loanId:actualLoanId,requestId:`${batchId}:disburse`},now);
  state=applyAction(state,{action:'repay',role:'mini',loanId:actualLoanId,cents:loan.billing.total,requestId:`${batchId}:repay`},now);
  await db().batch([
   db().prepare('INSERT INTO demo_workspaces (owner,revision,payload) VALUES (?,0,?)').bind(tenant.id,serializeWorkspacePayload(state)),
   db().prepare('INSERT INTO team_uat_closure_batches (batch_id,tenant_id,customer_id,loan_id,kyc_case_id,status,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(batchId,tenant.id,customerId,actualLoanId,caseId,'seeded',operator.email,now),
   audit(tenant.id,operator.email,'uat_closure_seed',{batchId,customerId,loanId:actualLoanId,kycCaseId:caseId,status:'closed',synthetic:true})
  ]);
  return {ok:true,replayed:false,batch:{batchId,tenantId:tenant.id,tenant:tenant.name,customerId,loanId:actualLoanId,kycCaseId:caseId,status:'seeded',loanStatus:'closed',createdAt:now}};
 }catch(error){
  await db().batch([
   db().prepare("UPDATE kyc_cases SET status='draft' WHERE owner=? AND id=?").bind(tenant.id,caseId),
   db().prepare('DELETE FROM kyc_history WHERE owner=? AND case_id=?').bind(tenant.id,caseId),
   db().prepare('DELETE FROM kyc_cases WHERE owner=? AND id=?').bind(tenant.id,caseId),
   db().prepare('DELETE FROM team_assignments WHERE tenant_id=? AND customer_id=?').bind(tenant.id,customerId),
   db().prepare('DELETE FROM h5_accounts WHERE owner=? AND customer_id=?').bind(tenant.id,customerId)
  ]);
  throw error;
 }
}

async function clear(request:Request,p:any,operator:any){
 const batchId=text(p.batchId,64).toLowerCase(),slug=text(p.company,64).toLowerCase();
 const tenant=await tenantFor(slug),row=await db().prepare('SELECT * FROM team_uat_closure_batches WHERE tenant_id=? AND batch_id=?').bind(tenant.id,batchId).first<any>();
 if(!row)return {ok:true,replayed:true,cleared:false,batchId};
 const workspace=await db().prepare('SELECT revision,payload FROM demo_workspaces WHERE owner=?').bind(tenant.id).first<any>();
 const expectedRevision=typeof p.workspaceRevision==='number'&&Number.isInteger(p.workspaceRevision)?p.workspaceRevision:null;
 if(workspace&&expectedRevision!==null&&workspace.revision!==expectedRevision)throw new AuthError('工作区版本已变化，请刷新后重试',409,'UAT_WORKSPACE_CONFLICT');
 let next:any=null;
 if(workspace){try{next=JSON.parse(workspace.payload)}catch{throw new AuthError('专用 UAT 租户工作区数据无效，禁止覆盖',409,'UAT_TENANT_NOT_EMPTY')}}
 if(next){next.loans=next.loans.filter((loan:any)=>loan.id!==row.loan_id);next.events=next.events.filter((event:any)=>event.loanId!==row.loan_id);next.entries=next.entries.filter((entry:any)=>entry.loanId!==row.loan_id);next.notifications=next.notifications.filter((item:any)=>item.loanId!==row.loan_id)}
 const now=new Date().toISOString();
 const nextPayload=workspace&&next?serializeWorkspacePayload(next):null;
 const guard=workspace?' AND EXISTS (SELECT 1 FROM demo_workspaces WHERE owner=? AND revision=? AND payload=?)':'';
 const guardArgs=workspace?[tenant.id,workspace.revision+1,nextPayload]:[];
 const guarded=(sql:string,...args:unknown[])=>db().prepare(sql+guard).bind(...args,...guardArgs);
 const detail=JSON.stringify({batchId,customerId:row.customer_id,loanId:row.loan_id,kycCaseId:row.kyc_case_id,status:'cleared'});
 const auditStatement=workspace
  ? db().prepare('INSERT INTO team_audit (id,tenant_id,actor,action,detail,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM demo_workspaces WHERE owner=? AND revision=? AND payload=?)').bind(crypto.randomUUID(),tenant.id,operator.email,'uat_closure_clear',detail,now,tenant.id,workspace.revision+1,nextPayload)
  : audit(tenant.id,operator.email,'uat_closure_clear',JSON.parse(detail));
 const statements=[
  ...(workspace&&next?[db().prepare('UPDATE demo_workspaces SET payload=?,revision=revision+1 WHERE owner=? AND revision=?').bind(nextPayload,tenant.id,workspace.revision)]:[]),
  guarded("UPDATE kyc_cases SET status='draft' WHERE owner=? AND id=?",tenant.id,row.kyc_case_id),
  guarded('DELETE FROM kyc_history WHERE owner=? AND case_id=?',tenant.id,row.kyc_case_id),
  guarded('DELETE FROM kyc_files WHERE owner=? AND customer_id=?',tenant.id,row.customer_id),
  guarded('DELETE FROM kyc_cases WHERE owner=? AND id=?',tenant.id,row.kyc_case_id),
  guarded('DELETE FROM team_assignments WHERE tenant_id=? AND customer_id=?',tenant.id,row.customer_id),
  guarded('DELETE FROM h5_accounts WHERE owner=? AND customer_id=?',tenant.id,row.customer_id),
  guarded('UPDATE team_uat_closure_batches SET status=\'cleared\',cleaned_at=? WHERE tenant_id=? AND batch_id=? AND status=\'seeded\'',now,tenant.id,batchId),
  auditStatement
 ];
 const results=await db().batch(statements);
 if(workspace&&next&&results[0].meta.changes!==1)throw new AuthError('工作区版本已变化，请刷新后重试',409,'UAT_WORKSPACE_CONFLICT');
 return {ok:true,replayed:false,cleared:true,batchId,tenantId:tenant.id,remainingLoan:false,cleanedAt:now};
}

export async function POST(request:Request){try{sameOrigin(request);assertEnabled(request);const operator=await platformAdmin(),p=await input(request);if(p.action==='seed')return json(await seed(request,p,operator));if(p.action==='clear')return json(await clear(request,p,operator));throw new AuthError('UAT 闭环操作无效',400,'UAT_ACTION_INVALID')}catch(e){return failure(e,request)}}
