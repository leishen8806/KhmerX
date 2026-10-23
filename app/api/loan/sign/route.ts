import {context,findCase,boundedBody,origin,json,failed,KycError} from '@/lib/kyc/server';
import {readState} from '@/lib/store';
import {saveLoanSignature} from '@/lib/loan-signing';
import {LOAN_TERMS_VERSION,loanTerms} from '@/lib/agreements/loan-terms';
import {KYC_FILE_MAX_BYTES} from '@/lib/kyc/limits';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const c=await context(request),{state}=await readState(c.owner),id=new URL(request.url).searchParams.get('loan'),loan=state.loans.find(l=>l.id===id&&l.customerId===c.customerId),kyc=await findCase(c.owner,c.customerId);if(!loan)throw new KycError('申请不存在',404);if(kyc?.status!=='approved')throw new KycError('请先通过 KYC 审核',409);return json({loan,blocks:loanTerms.blocks,termsVersion:LOAN_TERMS_VERSION})}catch(e){return failed(e)}}
export async function POST(request:Request){try{origin(request);const c=await context(request);if(request.headers.get('x-loan-consent')!=='true'||request.headers.get('x-loan-terms')!==LOAN_TERMS_VERSION)throw new KycError('请阅读并同意当前借款协议');const bytes=await boundedBody(request,KYC_FILE_MAX_BYTES);if(bytes.length<16)throw new KycError('签名文件无效');return json(await saveLoanSignature(c.owner,c.customerId,request.headers.get('x-loan-id')||'',bytes))}catch(e){return failed(e)}}
