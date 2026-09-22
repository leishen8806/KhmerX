import {context,findCase,payload,json,failed,KycError} from '@/lib/kyc/server';
import {loanTerms} from '@/lib/agreements/loan-terms';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const c=await context(request),row=await findCase(c.owner,c.customerId);if(!row)throw new KycError('未找到合同',404);const d=await payload(row);if(!d.signedLoan)throw new KycError('请先保存本笔申请的手写签名',404);return json({contract:d.signedLoan,blocks:loanTerms.blocks})}catch(e){return failed(e)}}
