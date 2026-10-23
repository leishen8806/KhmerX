import {readState} from '@/lib/store';
import {context,findCase,payload,json,failed,KycError} from '@/lib/kyc/server';
import {loanTerms} from '@/lib/agreements/loan-terms';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const c=await context(request),row=await findCase(c.owner,c.customerId);if(!row)throw new KycError('未找到合同',404);const d=await payload(row),id=new URL(request.url).searchParams.get('loan'),{state}=await readState(c.owner),loan=state.loans.find(l=>l.customerId===c.customerId&&(!id||l.id===id)),contract=loan?.contract?JSON.parse(loan.contract):!id?d.signedLoan:null;if(!contract)throw new KycError('请先保存本笔申请的手写签名',404);return json({contract,blocks:contract.termsSnapshot||loanTerms.blocks})}catch(e){return failed(e)}}
