import {validLoanContract} from '@/lib/loan-signing';
import {calculateBill} from './pricing';
import {ensureAssignment,assignment,pricingFor} from '@/lib/team/server';
import {env} from 'cloudflare:workers';
import {initialState,applyAction,type State} from './domain';
import {customerAction} from './domain';
import {findCase,payload,reviewer,KycError} from './kyc/server';
function db(){if(!env.DB)throw Error('测试数据库暂不可用');return env.DB}
export async function readState(owner:string):Promise<{state:State;revision:number}>{
 const row=await db().prepare('SELECT revision,payload FROM demo_workspaces WHERE owner=?').bind(owner).first<{revision:number;payload:string}>();
 const result=row?{state:JSON.parse(row.payload) as State,revision:row.revision}:{state:initialState(),revision:0};
 const credentials=(await db().prepare('SELECT bot_id,telegram_id,label,username FROM telegram_bot_credentials WHERE owner=?').bind(owner).all<{bot_id:string;telegram_id:string;label:string;username:string}>()).results;
 for(const bot of result.state.bots){const saved=credentials.find(c=>c.bot_id===bot.id);bot.tokenConfigured=!!saved;if(saved){bot.label=saved.label;bot.username=saved.username;bot.telegramId=saved.telegram_id}}
 return result;
}
export async function mutate(owner:string,p:any,customer?:{id:string;phoneMasked:string}){
 await db().prepare('INSERT OR IGNORE INTO demo_workspaces (owner,revision,payload) VALUES (?,0,?)').bind(owner,JSON.stringify(initialState())).run();
 for(let i=0;i<4;i++){
  const {state,revision}=await readState(owner);
  const loan=state.loans.find(l=>l.id===p.loanId);if(customer&&p.action==='create'&&state.loans.some(l=>l.customerId===customer.id&&!['closed','rejected'].includes(l.status)))throw new KycError('请先完成当前申请，再发起新的申请',409);
  // Customer ownership must be checked before consulting another customer's case.
  if(customer&&p.action!=='create'&&loan?.customerId!==customer.id)throw new KycError('申请不存在或不属于当前客户',404);
  let approvedCase;const creationCase=customer&&p.action==='create'?await findCase(owner,customer.id):null;if(customer&&p.action==='create'&&creationCase?.status!=='approved')throw new KycError('请先完成 KYC 资料审核，通过后才能申请贷款金额',409);
  if(loan?.customerId){
   if(!customer&&['confirm_bill','confirm_kyc','submit_kyc','resubmit','apply','sign','withdraw','repay'].includes(p.action))throw new KycError('请由客户在 H5 会话操作',403);
   if(['review','supplement'].includes(p.action))throw new KycError('请在 KYC 人工审核页面逐项核对资料',409);
   if(['approve','reject','disburse'].includes(p.action))await reviewer();
   if(['confirm_kyc','submit_kyc','resubmit','apply','approve','sign','disburse'].includes(p.action)){
    approvedCase=await findCase(owner,loan.customerId);
    if(approvedCase?.status!=='approved')throw new KycError('请先完成身份资料提交及人工审核，再返回我的贷款确认审核结果',409);
    if(loan.kycCaseId&&(loan.kycCaseId!==approvedCase.id||loan.kycRevision!==approvedCase.revision))throw new KycError('审核资料版本已变化，请联系审核人员',409);
   }
  }
  let confirmedContract;
  if(customer&&p.action==='apply'){
   if(!loan||!approvedCase)throw new KycError('请先完成资料审核',409);confirmedContract=await validLoanContract(owner,loan,approvedCase);
  }
  const next=customer?customerAction(state,p,customer):applyAction(state,p);
  if(creationCase){const target=next.loans[0];target.status='kyc_approved';target.kycCaseId=creationCase.id;target.kycRevision=creationCase.revision;target.note='贷款申请已创建，请核对测算费用后确认签约';}
  if(confirmedContract){const target=next.loans.find(l=>l.id===p.loanId)!;target.signedAt=confirmedContract.signedAt;target.signature='已保存的手写签名';target.contract=JSON.stringify({...confirmedContract,notice:'仅测试资金，待机构审批，不产生真实债务'});target.note='费用已确认、合同已签署，等待贷款审批';}

  if(next===state)return {state,revision};if(p.action==='create'&&owner.startsWith('t_')){const termDays=p.termDays??14;if(![14,28].includes(termDays))throw new KycError('请选择 14 天或 28 天贷款期限');const bill=calculateBill(next.loans[0].amount,{...await pricingFor(owner),termDays},crypto.randomUUID());next.loans[0].billing=bill;next.loans[0].fee=bill.total-bill.principal;}if(customer)await ensureAssignment(owner,customer.id);
  if(approvedCase){
   const updated=next.loans.find(l=>l.id===p.loanId)!;
   if(p.action==='approve'){const contract=await validLoanContract(owner,updated,approvedCase);updated.status='signed';updated.signedAt=contract.signedAt;updated.signature='已保存的手写签名';updated.contract=JSON.stringify(contract);updated.note='审批通过，按已签合同等待放款'}
   updated.kycCaseId=approvedCase.id;updated.kycRevision=approvedCase.revision;
   if(['confirm_kyc','submit_kyc','resubmit'].includes(p.action)){
    updated.status='kyc_approved';updated.note='人工资料审核通过，可以申请测试贷款（资料版本 '+approvedCase.revision+'）';
    next.events[0].note=updated.note;next.notifications[0].text=updated.note;
   }
  }
  const result=await db().prepare("UPDATE demo_workspaces SET payload=?,revision=revision+1 WHERE owner=? AND revision=? AND (? IS NULL OR EXISTS(SELECT 1 FROM kyc_cases WHERE id=? AND owner=? AND revision=? AND status='approved'))").bind(JSON.stringify(next),owner,revision,creationCase?.id||null,creationCase?.id||null,owner,creationCase?.revision??0).run();
  if(result.meta.changes===1)return {state:next,revision:revision+1};
 }
 throw Error('其他操作刚刚更新了记录，请重试');
}
