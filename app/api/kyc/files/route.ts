import {guardKyc} from '@/lib/team/server';
import {context,reviewer,origin,initialize,boundedBody,recordFile,fileRow,metadata,decryptFileObject,bucket,json,failed,KycError} from '@/lib/kyc/server';
import {slots,fileType,type Slot} from '@/lib/kyc/core';
import {kycFileMaxBytes} from '@/lib/kyc/limits';
import {attachRequestId,requestIdOf,resolveRequestId} from '@/lib/http/request-id';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const started=Date.now(),requestId=requestIdOf(request)??resolveRequestId(request);attachRequestId(request,requestId);
 try{
  origin(request);const c=await context(request),row=await initialize(c.owner,c.customerId,c.verified);
  if(!['draft','needs_info'].includes(row.status))throw new KycError('资料已锁定，无法上传',409);
  const slot=request.headers.get('x-kyc-slot') as Slot;
  if(slot==='signature')throw new KycError('手写签名请在贷款申请后的签约页面完成');
  if(!slots.some(s=>s.id===slot))throw new KycError('材料类型无效');
  const bytes=await boundedBody(request,kycFileMaxBytes(request.headers.get('content-type')||''));
  if(bytes.length<16)throw new KycError('文件为空或损坏');
  return json(await recordFile(c.owner,c.customerId,slot,bytes,fileType(bytes,slot),requestId),200,{},request);
 }catch(e){return failed(e,request)}finally{console.info('[kyc-upload-request]',{requestId,durationMs:Date.now()-started})}
}
export async function GET(request:Request){try{const url=new URL(request.url),id=url.searchParams.get('id')||'',review=url.searchParams.get('review')==='1';let owner:string,customerId:string|undefined,reviewerSession:any=null;if(review){reviewerSession=await reviewer();owner=reviewerSession.userId;if(reviewerSession.team?.member.role==='audit')throw new KycError('审计岗位仅可查看审核状态，不可下载 KYC 材料',403)}else{const c=await context(request);owner=c.owner;customerId=c.customerId}const row=await fileRow(owner,id,customerId);if(review&&owner.startsWith('t_'))await guardKyc(owner,row.customer_id);const ref=await metadata(row),object=await bucket().get('kyc/'+id);if(!object)throw new KycError('材料暂不可用',404);const bytes=await decryptFileObject(new Uint8Array(await object.arrayBuffer()),row);return new Response(bytes,{headers:{'Content-Type':ref.type,'Content-Disposition':`${ref.type==='application/pdf'?'attachment':'inline'}; filename="${ref.name}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Referrer-Policy':'no-referrer'}})}catch(e){return failed(e,request)}}
