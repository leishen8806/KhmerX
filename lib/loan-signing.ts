import {db,bucket,findCase,payload,fileRow,metadata,digest,profileDigestMatches,recordFile,signedContract,storedContract,contractHashValid,KycError,type CaseRow,type CasePayload} from '@/lib/kyc/server';
import {LOAN_TERMS_VERSION,loanTerms} from '@/lib/agreements/loan-terms';
import {fileType} from '@/lib/kyc/core';
import type {Loan,State} from '@/lib/domain';
import type {FileRef} from '@/lib/kyc/core';
import {serializeWorkspacePayload} from '@/lib/workspace-payload';
export async function validLoanContract(owner:string,loan:Loan,row:CaseRow){
 const data=await payload(row);let contract:CasePayload['signedLoan'];
 try{contract=loan.contract?JSON.parse(loan.contract):data.signedLoan}catch{throw new KycError('合同记录无效',409)}
 const immutable=contract?.signatureId?await storedContract(owner,row.customer_id,contract.signatureId):null;
 const contractFields=['billing','borrowerName','profileHash','loanId','signatureId','signatureHash','termsVersion','principal','fee','currency','termDays','signedAt'] as const;
 const termsHash=await digest(JSON.stringify(loanTerms.blocks));
 const matchesImmutable=!!immutable&&await contractHashValid(immutable)&&immutable.termsHash===termsHash&&JSON.stringify(immutable.termsSnapshot)===JSON.stringify(loanTerms.blocks)&&!!contract&&contractFields.every(field=>JSON.stringify(contract?.[field])===JSON.stringify(immutable[field]));
 if(row.status!=='approved'||loan.kycCaseId!==row.id||loan.kycRevision!==row.revision||!loan.billConfirmedAt||!contract||!matchesImmutable||contract.loanId!==loan.id||contract.principal!==loan.amount||contract.fee!==loan.fee||!(await profileDigestMatches(data.profile.values,contract.profileHash))||contract.borrowerName!==[data.profile.values.surname,data.profile.values.givenName].filter(Boolean).join(' ')||(loan.billing&&contract.billing?.quoteId!==loan.billing.quoteId))throw new KycError('请完成当前申请的费用确认与手写签约，资料须保持审核通过',409);
 const file=await fileRow(owner,contract.signatureId,loan.customerId),ref=await metadata(file);
 if(file.slot!=='signature'||ref.sha256!==contract.signatureHash)throw new KycError('合同签名无效',409);
 return contract;
}
export async function saveLoanSignature(owner:string,customerId:string,loanId:string,bytes:Uint8Array){
 const workspace=await db().prepare('SELECT payload,revision FROM demo_workspaces WHERE owner=?').bind(owner).first<{payload:string;revision:number}>();
 if(!workspace)throw new KycError('请先创建贷款申请',404);const state=JSON.parse(workspace.payload) as State,loan=state.loans.find(l=>l.id===loanId&&l.customerId===customerId),row=await findCase(owner,customerId);
 if(!loan||loan.status!=='kyc_approved'||!loan.billConfirmedAt||!row||row.status!=='approved'||loan.kycCaseId!==row.id||loan.kycRevision!==row.revision)throw new KycError('请先通过 KYC、创建申请并确认费用，再签约',409);
 if(loan.contract)throw new KycError('本申请已保存签名合同，请返回提交审批',409);
 let ref:FileRef|undefined;
 try{
  const data=await payload(row);ref=await recordFile(owner,customerId,'signature',bytes,fileType(bytes,'signature'));
  const profile={...data.profile,consent:true,declarationVersion:LOAN_TERMS_VERSION,files:{...data.profile.files,signature:ref}};
  const contract=await signedContract(row,profile,{...data,signedLoan:undefined});if(!contract||contract.loanId!==loan.id)throw new KycError('申请已变化，请刷新',409);
  loan.contract=JSON.stringify({...contract,notice:'仅测试资金，不产生真实债务'});loan.signedAt=contract.signedAt;loan.signature='已保存的手写签名';loan.note='费用已确认、合同已签署，可以提交贷款审批';
  state.events.unshift({id:crypto.randomUUID(),loanId:loan.id,role:'mini',action:'customer_sign',note:loan.note,at:new Date().toISOString()});
  const saved=await db().prepare("UPDATE demo_workspaces SET payload=?,revision=revision+1 WHERE owner=? AND revision=? AND EXISTS(SELECT 1 FROM kyc_cases WHERE id=? AND owner=? AND revision=? AND status='approved')").bind(serializeWorkspacePayload(state),owner,workspace.revision,row.id,owner,row.revision).run();
  if(!saved.meta.changes)throw new KycError('申请或审核资料已变化，请刷新后重新签约',409);
  return {ok:true,contract};
 }catch(error){
  // Signature rows are created before the optimistic loan update. If that
  // update loses a race, remove both the DB row and the encrypted object so a
  // failed attempt cannot consume the customer's material quota.
  if(ref){await db().prepare('DELETE FROM kyc_contracts WHERE signature_id=? AND owner=? AND customer_id=?').bind(ref.id,owner,customerId).run();await db().prepare('DELETE FROM kyc_files WHERE id=? AND owner=? AND customer_id=? AND ready=1').bind(ref.id,owner,customerId).run();await bucket().delete('kyc/'+ref.id).catch(()=>{});}
  throw error;
 }
}
