import {db,audit} from './server';

type BackfillSummary={linked:number;quarantined:number;unscoped:number;conflicts:number};

/** Bind legacy JSON loans only to a provable, approved KYC revision. */
export async function backfillLegacyLoanBindings(tenantId?:string):Promise<BackfillSummary>{
 const summary:BackfillSummary={linked:0,quarantined:0,unscoped:0,conflicts:0};
 const rows=await db().prepare(`SELECT owner,revision,payload FROM demo_workspaces ${tenantId?'WHERE owner=?':''}`).bind(...(tenantId?[tenantId]:[])).all<any>();
 for(const row of rows.results||[]){
  let state:any;try{state=JSON.parse(String(row.payload))}catch{continue}
  const linkedRows:any[]=[];let changed=false;
  for(const loan of Array.isArray(state.loans)?state.loans:[]){
   if(loan.kycCaseId&&loan.kycRevision!=null)continue;
   const processed=await db().prepare('SELECT outcome FROM legacy_loan_backfill WHERE tenant_id=? AND loan_id=?').bind(row.owner,loan.id).first<any>();
   if(processed?.outcome==='linked'&&!loan.kycCaseId)continue;
   if(!loan.customerId){const result=await db().prepare('INSERT OR IGNORE INTO legacy_loan_backfill(tenant_id,loan_id,outcome,detail,processed_at) VALUES (?,?,?,?,?)').bind(row.owner,loan.id,'unscoped','历史贷款缺少客户绑定，需人工核对',new Date().toISOString()).run();if(Number(result.meta?.changes||0)===1)summary.unscoped++;continue}
   const kyc=await db().prepare("SELECT id,revision FROM kyc_cases WHERE owner=? AND customer_id=? AND status='approved' ORDER BY updated_at DESC LIMIT 1").bind(row.owner,loan.customerId).first<any>();
   if(kyc){loan.kycCaseId=String(kyc.id);loan.kycRevision=Number(kyc.revision);changed=true;linkedRows.push({loanId:String(loan.id),kycCaseId:String(kyc.id),kycRevision:Number(kyc.revision)})}
   else{const result=await db().prepare('INSERT OR IGNORE INTO legacy_loan_backfill(tenant_id,loan_id,outcome,detail,processed_at) VALUES (?,?,?,?,?)').bind(row.owner,loan.id,'quarantined','历史贷款未找到可核验的已通过 KYC，禁止新增放款',new Date().toISOString()).run();if(Number(result.meta?.changes||0)===1)summary.quarantined++}
  }
  if(!changed)continue;
  const updated=await db().prepare('UPDATE demo_workspaces SET payload=?,revision=revision+1 WHERE owner=? AND revision=?').bind(JSON.stringify(state),row.owner,row.revision).run();
  if(Number(updated.meta?.changes||0)!==1){summary.conflicts++;continue}
  const processedAt=new Date().toISOString();
  for(const item of linkedRows){await db().prepare('INSERT OR REPLACE INTO legacy_loan_backfill(tenant_id,loan_id,outcome,kyc_case_id,detail,processed_at) VALUES (?,?,?,?,?,?)').bind(row.owner,item.loanId,'linked',item.kycCaseId,'已绑定最近一次人工审核通过的 KYC 版本',processedAt).run();summary.linked++}
  await audit(row.owner,'system','legacy_loan_backfill',{linked:linkedRows.map(x=>({loanId:x.loanId,kycCaseId:x.kycCaseId,kycRevision:x.kycRevision})),reason:'历史贷款自动绑定已通过 KYC 版本'}).run();
 }
 return summary;
}
